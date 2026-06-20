/**
 * =============================================================================
 * AGENTE DE NOTIFICACIÓN IA — CLOUDFLARE WORKER
 * =============================================================================
 *
 * Arquitectura: ES Module, fetch puro (sin SDKs de terceros), V8 isolate.
 *
 * Flujo de una request:
 *  1. Preflight OPTIONS  →  Responde headers CORS y sale.
 *  2. POST /lead         →  Valida JSON, llama a IA, despacha notificación.
 *  3. GET /health        →  Endpoint de monitoreo (retorna 200 OK).
 *
 * PAQUETES:
 *   PACKAGE              "simple" | "ia" | "premium"
 *
 *   — Simple: alerta Telegram + link wa.me. Sin IA, sin costo de APIs externas.
 *   — Con IA: Simple + análisis automático del lead con OpenAI o Gemini.
 *   — Premium: Con IA + email automático al negocio + SMS + respuesta al cliente.
 *
 * Variables de entorno (wrangler.toml → [vars]):
 *   PACKAGE              "simple" | "ia" | "premium"
 *   AI_ENABLED           "true" | "false"   (true en paquetes ia y premium)
 *   AI_PROVIDER          "openai" | "gemini"
 *   AI_MODEL             e.g. "gpt-4o-mini" | "gemini-1.5-flash"
 *   AI_TEMPERATURE       e.g. "0.3"
 *   AI_MAX_TOKENS        e.g. "512"
 *   AI_SYSTEM_PROMPT     Prompt completo del sistema (string)
 *   DISPATCH_TYPE        "telegram" | "email" | "whatsapp"
 *   ALLOWED_ORIGINS      JSON array: '["https://ejemplo.com"]'
 *   REQUIRED_FIELDS      JSON array: '["nombre","telefono","problema"]'
 *   MAX_PROBLEMA_LENGTH  e.g. "1000"
 *   CLIENTE_NOMBRE       Nombre del negocio
 *   RESPUESTA_CLIENTE    Mensaje de confirmación al usuario del formulario
 *   INCLUDE_COTIZACION   "true" | "false"
 *   WHATSAPP_NUMERO      Número internacional e.g. "521XXXXXXXXXX" (todos los paquetes)
 *
 *   — Telegram —
 *   TELEGRAM_CHAT_ID     ID del chat/grupo destino
 *
 *   — Email (Resend) — solo Premium
 *   EMAIL_DESTINATARIOS  JSON array: '["a@x.com","b@x.com"]'
 *   EMAIL_ASUNTO_PREFIJO e.g. "[Lead] "
 *
 *   — SMS (Twilio) — solo Premium
 *   TWILIO_FROM_NUMBER   Número Twilio remitente e.g. "+15005550006"
 *   TWILIO_TO_NUMBER     Número destino de alertas e.g. "+521XXXXXXXXXX"
 *
 * Secrets (nunca en wrangler.toml, cargar con `wrangler secret put`):
 *   OPENAI_API_KEY       Paquetes ia y premium, si AI_PROVIDER = "openai"
 *   GEMINI_API_KEY       Paquetes ia y premium, si AI_PROVIDER = "gemini"
 *   TELEGRAM_BOT_TOKEN   Todos los paquetes
 *   RESEND_API_KEY       Solo Premium
 *   TWILIO_ACCOUNT_SID   Solo Premium
 *   TWILIO_AUTH_TOKEN    Solo Premium
 *
 * =============================================================================
 */

// ---------------------------------------------------------------------------
// CONSTANTES
// ---------------------------------------------------------------------------

/** Cabeceras de seguridad que se añaden a todas las respuestas */
const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

// ---------------------------------------------------------------------------
// UTILIDADES CORS
// ---------------------------------------------------------------------------

/**
 * Comprueba si el origen de la request está en la lista blanca.
 * @param {string|null} origin - Valor del header Origin
 * @param {string[]} allowedOrigins - Array de orígenes permitidos
 * @returns {string|null} - El origen permitido, o null si está bloqueado
 */
function resolveAllowedOrigin(origin, allowedOrigins) {
  if (!origin) return null;
  // Comparación case-insensitive y sin trailing slash
  const normalized = origin.replace(/\/$/, "").toLowerCase();
  const match = allowedOrigins.find(
    (o) => o.replace(/\/$/, "").toLowerCase() === normalized
  );
  return match || null;
}

/**
 * Construye los headers CORS para una respuesta.
 * @param {string} allowedOrigin - Origen validado
 * @returns {Object}
 */
function buildCorsHeaders(allowedOrigin) {
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

// ---------------------------------------------------------------------------
// VALIDACIÓN DE PAYLOAD
// ---------------------------------------------------------------------------

/**
 * Valida que el JSON recibido contenga los campos requeridos y no exceda límites.
 * @param {Object} data - Datos parseados del body
 * @param {string[]} requiredFields - Lista de campos obligatorios
 * @param {number} maxProblemaLength - Longitud máxima del campo "problema"
 * @returns {{ valid: boolean, error: string|null }}
 */
function validatePayload(data, requiredFields, maxProblemaLength) {
  for (const field of requiredFields) {
    if (!data[field] || String(data[field]).trim() === "") {
      return { valid: false, error: `El campo '${field}' es requerido.` };
    }
  }

  // Prevención básica de payloads masivos (DoS)
  const problemaField = data.problema || data.descripcion || data.message || "";
  if (String(problemaField).length > maxProblemaLength) {
    return {
      valid: false,
      error: `El campo de descripción no puede superar ${maxProblemaLength} caracteres.`,
    };
  }

  return { valid: true, error: null };
}

// ---------------------------------------------------------------------------
// CAPA DE IA
// ---------------------------------------------------------------------------

/**
 * Llama a la API de OpenAI usando fetch puro.
 * @param {Object} env - Variables de entorno del Worker
 * @param {string} userMessage - Texto a analizar
 * @returns {Promise<string>} - Respuesta de texto del modelo
 */
async function callOpenAI(env, userMessage) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: env.AI_MODEL || "gpt-4o-mini",
      temperature: parseFloat(env.AI_TEMPERATURE || "0.4"),
      max_tokens: parseInt(env.AI_MAX_TOKENS || "512", 10),
      messages: [
        { role: "system", content: env.AI_SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${errText}`);
  }

  const json = await response.json();
  return json.choices?.[0]?.message?.content?.trim() ?? "";
}

/**
 * Llama a la API de Gemini usando fetch puro.
 * @param {Object} env - Variables de entorno del Worker
 * @param {string} userMessage - Texto a analizar
 * @returns {Promise<string>} - Respuesta de texto del modelo
 */
async function callGemini(env, userMessage) {
  const model = env.AI_MODEL || "gemini-1.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: env.AI_SYSTEM_PROMPT }] },
      contents: [{ role: "user", parts: [{ text: userMessage }] }],
      generationConfig: {
        temperature: parseFloat(env.AI_TEMPERATURE || "0.4"),
        maxOutputTokens: parseInt(env.AI_MAX_TOKENS || "512", 10),
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errText}`);
  }

  const json = await response.json();
  return (
    json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ??
    ""
  );
}

/**
 * Router de IA: elige el proveedor según AI_PROVIDER y retorna el análisis.
 * @param {Object} env
 * @param {Object} formData - Datos del formulario ya validados
 * @returns {Promise<string>}
 */
async function analyzeWithAI(env, formData) {
  // Construye el mensaje de usuario con todos los campos del formulario
  const userMessage = Object.entries(formData)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");

  const provider = (env.AI_PROVIDER || "openai").toLowerCase();

  if (provider === "gemini") {
    return callGemini(env, userMessage);
  }
  // Default: OpenAI
  return callOpenAI(env, userMessage);
}

// ---------------------------------------------------------------------------
// CAPA DE DESPACHO
// ---------------------------------------------------------------------------

/**
 * Formatea el payload recibido en un bloque de texto legible para notificaciones.
 * @param {Object} formData
 * @param {string} clienteNombre
 * @returns {string}
 */
function formatLeadBlock(formData, clienteNombre) {
  const lineas = Object.entries(formData)
    .map(([k, v]) => `• ${k}: ${v}`)
    .join("\n");
  return `🔔 *Nuevo Lead — ${clienteNombre}*\n\n${lineas}`;
}

/**
 * Envía notificación al Bot de Telegram.
 * Usa el método sendMessage de la Bot API.
 * @param {Object} env
 * @param {string} leadBlock - Texto del lead formateado
 * @param {string} aiAnalysis - Respuesta del modelo IA
 */
async function dispatchTelegram(env, leadBlock, aiAnalysis) {
  const botToken = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    throw new Error(
      "Falta TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID en el entorno."
    );
  }

  const text = `${leadBlock}\n\n---\n🤖 *Análisis IA:*\n${aiAnalysis}`;

  const res = await fetch(
    `https://api.telegram.org/bot${botToken}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: "Markdown",
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Telegram dispatch error ${res.status}: ${err}`);
  }
}

/**
 * Envía correo electrónico vía Resend.
 * Documentación: https://resend.com/docs/api-reference/emails/send-email
 * @param {Object} env
 * @param {string} leadBlock
 * @param {string} aiAnalysis
 * @param {string} asuntoPrefijo
 * @param {string[]} destinatarios
 */
async function dispatchEmail(env, leadBlock, aiAnalysis, asuntoPrefijo, destinatarios) {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) throw new Error("Falta RESEND_API_KEY en el entorno.");

  const clienteNombre = env.CLIENTE_NOMBRE || "Cliente";
  const asunto = `${asuntoPrefijo}${clienteNombre} — ${new Date().toLocaleString("es-MX", { timeZone: env.TIMEZONE || "America/Mexico_City" })}`;

  // HTML seguro: escapamos el contenido dinámico para prevenir XSS en el correo
  const htmlBody = `
    <h2>🔔 Nuevo Lead — ${escapeHtml(clienteNombre)}</h2>
    <pre style="background:#f4f4f4;padding:12px;border-radius:6px;">${escapeHtml(leadBlock.replace(/\*/g, ""))}</pre>
    <h3>🤖 Análisis IA</h3>
    <div style="background:#eef6ff;padding:12px;border-radius:6px;">
      ${escapeHtml(aiAnalysis).replace(/\n/g, "<br>")}
    </div>
  `;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: `Agente IA <agente@${env.EMAIL_FROM_DOMAIN || "notificaciones.com"}>`,
      to: destinatarios,
      subject: asunto,
      html: htmlBody,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend dispatch error ${res.status}: ${err}`);
  }
}

/**
 * Genera un link de WhatsApp pre-redactado (wa.me).
 * Disponible en TODOS los paquetes — no requiere API de pago.
 * @param {Object} env
 * @param {string} leadBlock
 * @param {string|null} aiAnalysis - null en paquete Simple
 * @returns {string} - URL completa de wa.me
 */
function buildWhatsAppLink(env, leadBlock, aiAnalysis) {
  const numero = env.WHATSAPP_NUMERO;
  if (!numero) throw new Error("Falta WHATSAPP_NUMERO en el entorno.");

  const base = leadBlock.replace(/\*/g, "");
  const texto = aiAnalysis
    ? `${base}\n\n---\nAnálisis: ${aiAnalysis}`
    : base;
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}

/**
 * Envía SMS vía Twilio REST API.
 * Solo disponible en paquete Premium.
 * @param {Object} env
 * @param {string} leadBlock
 * @param {string|null} aiAnalysis
 */
async function dispatchSMS(env, leadBlock, aiAnalysis) {
  const sid   = env.TWILIO_ACCOUNT_SID;
  const token = env.TWILIO_AUTH_TOKEN;
  const from  = env.TWILIO_FROM_NUMBER;
  const to    = env.TWILIO_TO_NUMBER;

  if (!sid || !token || !from || !to) {
    throw new Error(
      "Faltan credenciales de Twilio: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER o TWILIO_TO_NUMBER."
    );
  }

  // SMS tiene límite de 160 chars — enviamos un resumen corto
  const resumen = leadBlock.replace(/\*/g, "").slice(0, 120);
  const body    = aiAnalysis
    ? `${resumen}... | IA: ${aiAnalysis.slice(0, 80)}`
    : resumen;

  const params = new URLSearchParams({ From: from, To: to, Body: body });

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method:  "POST",
      headers: {
        "Content-Type":  "application/x-www-form-urlencoded",
        "Authorization": "Basic " + btoa(`${sid}:${token}`),
      },
      body: params.toString(),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Twilio SMS error ${res.status}: ${err}`);
  }
}

/**
 * Escapa caracteres HTML especiales para prevenir XSS en contenido de correo.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ---------------------------------------------------------------------------
// HANDLER PRINCIPAL
// ---------------------------------------------------------------------------

/**
 * Maneja la ruta POST /lead: punto de entrada principal del agente.
 */
async function handleLead(request, env, corsHeaders) {
  // 1. Parsear y validar Content-Type
  const contentType = request.headers.get("Content-Type") || "";
  if (!contentType.includes("application/json")) {
    return jsonResponse(
      { success: false, error: "Content-Type debe ser application/json." },
      415,
      corsHeaders
    );
  }

  // 2. Parsear body
  let formData;
  try {
    formData = await request.json();
  } catch {
    return jsonResponse(
      { success: false, error: "JSON inválido en el cuerpo de la request." },
      400,
      corsHeaders
    );
  }

  // 3. Validar campos requeridos
  const requiredFields = safeJsonParse(env.REQUIRED_FIELDS, ["nombre", "telefono", "problema"]);
  const maxLength = parseInt(env.MAX_PROBLEMA_LENGTH || "1000", 10);
  const { valid, error } = validatePayload(formData, requiredFields, maxLength);

  if (!valid) {
    return jsonResponse({ success: false, error }, 422, corsHeaders);
  }

  // 4. Determinar paquete activo
  const pkg = (env.PACKAGE || "simple").toLowerCase();
  const aiEnabled = env.AI_ENABLED === "true" || pkg === "ia" || pkg === "premium";

  // 5. Analizar con IA (solo si el paquete lo requiere)
  let aiAnalysis = null;
  if (aiEnabled) {
    try {
      aiAnalysis = await analyzeWithAI(env, formData);
    } catch (err) {
      console.error("[IA Error]", err.message);
      // Fallback: no bloqueamos la notificación si la IA falla
      aiAnalysis = "⚠️ Análisis automático no disponible. Revisar manualmente.";
    }
  }

  // 6. Formatear bloque del lead
  const clienteNombre = env.CLIENTE_NOMBRE || "Cliente";
  const leadBlock = formatLeadBlock(formData, clienteNombre);

  // 7. Despachar canales según paquete
  // Siempre: Telegram (canal principal de alerta) + wa.me link
  // Premium:  + Email automático al negocio + SMS
  let whatsappLink = null;
  const errors     = [];

  // ── Telegram (todos los paquetes) ────────────────────────────────────────
  try {
    await dispatchTelegram(env, leadBlock, aiAnalysis);
  } catch (err) {
    console.error("[Dispatch/Telegram]", err.message);
    errors.push("telegram");
  }

  // ── WhatsApp link (todos los paquetes, sin costo) ────────────────────────
  if (env.WHATSAPP_NUMERO) {
    try {
      whatsappLink = buildWhatsAppLink(env, leadBlock, aiAnalysis);
    } catch (err) {
      console.error("[Dispatch/WhatsApp]", err.message);
    }
  }

  // ── Email al negocio (solo Premium) ──────────────────────────────────────
  if (pkg === "premium" && env.EMAIL_DESTINATARIOS) {
    try {
      const destinatarios = safeJsonParse(env.EMAIL_DESTINATARIOS, []);
      const asuntoPrefijo = env.EMAIL_ASUNTO_PREFIJO || "[Lead] ";
      await dispatchEmail(env, leadBlock, aiAnalysis, asuntoPrefijo, destinatarios);
    } catch (err) {
      console.error("[Dispatch/Email]", err.message);
      errors.push("email");
    }
  }

  // ── SMS al negocio (solo Premium) ────────────────────────────────────────
  if (pkg === "premium" && env.TWILIO_ACCOUNT_SID) {
    try {
      await dispatchSMS(env, leadBlock, aiAnalysis);
    } catch (err) {
      console.error("[Dispatch/SMS]", err.message);
      errors.push("sms");
    }
  }

  // Si Telegram falló Y no hay otro canal activo, es un error crítico
  if (errors.includes("telegram") && pkg === "simple") {
    return jsonResponse(
      { success: false, error: "Error al enviar la notificación. Intenta de nuevo más tarde." },
      502,
      corsHeaders
    );
  }

  // 8. Construir respuesta para el frontend
  const incluirCotizacion = aiEnabled && env.INCLUDE_COTIZACION !== "false";
  const respuesta = {
    success: true,
    paquete: pkg,
    mensaje: env.RESPUESTA_CLIENTE || "¡Gracias! Nos pondremos en contacto pronto.",
  };

  if (incluirCotizacion && aiAnalysis) {
    respuesta.analisis = aiAnalysis;
  }

  if (whatsappLink) {
    respuesta.whatsappLink = whatsappLink;
  }

  return jsonResponse(respuesta, 200, corsHeaders);
}

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

/**
 * Crea una respuesta JSON estandarizada con los headers correctos.
 */
function jsonResponse(body, status, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...SECURITY_HEADERS,
      ...extraHeaders,
    },
  });
}

/**
 * Parsea JSON de forma segura; retorna fallback si falla.
 */
function safeJsonParse(str, fallback) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// ENTRY POINT — export default (ES Module)
// ---------------------------------------------------------------------------

export default {
  /**
   * Punto de entrada de Cloudflare Workers.
   * @param {Request} request
   * @param {Object} env - Variables de entorno + secrets del Worker
   * @param {ExecutionContext} ctx
   */
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();
    const origin = request.headers.get("Origin");

    // ── Validar origen CORS ──────────────────────────────────────────────────
    const allowedOrigins = safeJsonParse(env.ALLOWED_ORIGINS, []);
    const allowedOrigin = resolveAllowedOrigin(origin, allowedOrigins);

    // Si el origen no está permitido y NO es una request sin origen
    // (e.g., Wrangler local, curl directo para tests):
    if (origin && !allowedOrigin) {
      return new Response("Origen no permitido.", {
        status: 403,
        headers: SECURITY_HEADERS,
      });
    }

    const corsHeaders = allowedOrigin ? buildCorsHeaders(allowedOrigin) : {};

    // ── Preflight OPTIONS ────────────────────────────────────────────────────
    if (method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: { ...corsHeaders, ...SECURITY_HEADERS },
      });
    }

    // ── GET /health — monitoreo ──────────────────────────────────────────────
    if (method === "GET" && url.pathname === "/health") {
      return jsonResponse(
        {
          status: "ok",
          worker: env.CLIENTE_NOMBRE || "agente",
          timestamp: new Date().toISOString(),
        },
        200,
        corsHeaders
      );
    }

    // ── POST /lead — flujo principal ─────────────────────────────────────────
    if (method === "POST" && url.pathname === "/lead") {
      return handleLead(request, env, corsHeaders);
    }

    // ── 404 para todo lo demás ───────────────────────────────────────────────
    return jsonResponse(
      { success: false, error: "Ruta no encontrada." },
      404,
      corsHeaders
    );
  },
};
