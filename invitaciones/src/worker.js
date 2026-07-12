/**
 * =============================================================================
 * INVITACIONES DIGITALES — CLOUDFLARE WORKER (multi-evento)
 * =============================================================================
 *
 * Un solo Worker sirve todas las invitaciones bajo /evento/{slug}.
 * Cada evento vive en Cloudflare KV (binding INVITACIONES_KV).
 *
 * MODOS DE INVITACIÓN (evento.modo):
 *   "lista"    → Lista de invitados subida por CSV. Cada quien tiene un
 *                código único (?c=CODIGO) para ver su invitación personalizada
 *                y confirmar asistencia (RSVP) con sus pases.
 *   "password" → Invitación genérica de solo lectura, protegida con una
 *                contraseña compartida. Sin lista de invitados ni RSVP.
 *
 * RUTAS PÚBLICAS:
 *   GET  /health
 *   GET  /evento/:slug                  → página de la invitación
 *   POST /evento/:slug/clave            → { clave } valida contraseña (modo password)
 *   POST /evento/:slug/rsvp             → { codigo, asistencia, pases } (modo lista)
 *
 * RUTAS ADMIN (Authorization: Bearer ADMIN_TOKEN):
 *   POST   /admin/eventos                    → crea/actualiza un evento
 *   GET    /admin/eventos/:slug              → obtiene config del evento
 *   DELETE /admin/eventos/:slug              → elimina evento + invitados
 *   POST   /admin/eventos/:slug/csv          → importa invitados desde CSV
 *   GET    /admin/eventos/:slug/invitados    → lista invitados + estado RSVP (JSON)
 *   GET    /admin/eventos/:slug/invitados.csv→ exporta invitados + estado RSVP (CSV)
 *   POST   /admin/eventos/:slug/media        → sube una foto/video a R2 (body binario)
 *   POST   /admin/eventos/:slug/media/importar-url → { url, filename? } descarga y guarda en R2
 *   DELETE /admin/eventos/:slug/media/:file  → elimina un archivo de R2
 *
 * RUTA PÚBLICA DE MEDIOS:
 *   GET /media/:slug/:file                   → sirve el archivo subido a R2
 *
 * Secrets (wrangler secret put):
 *   ADMIN_TOKEN       Token para todas las rutas /admin/*
 *   SESSION_SECRET    Pepper de contraseñas + firma de cookies de sesión
 *   RESEND_API_KEY    Opcional. Solo si algún evento tiene emailAutomatico: true
 * =============================================================================
 */

import {
  jsonResponse,
  htmlResponse,
  escapeHtml,
  generarCodigo,
  compararSeguro,
  parsearCSV,
  hashPassword,
  verificarPassword,
  crearTokenSesion,
  verificarTokenSesion,
  leerCookie,
  SECURITY_HEADERS,
} from "./utilidades.js";

import {
  obtenerEvento,
  guardarEvento,
  eliminarEvento,
  obtenerInvitado,
  guardarInvitado,
  listarInvitados,
} from "./almacenamiento.js";

import { renderPagina } from "./plantillas.js";

const SLUG_REGEX = /^[a-z0-9-]{2,64}$/;
const TIPOS_VALIDOS = ["boda", "xv", "aniversario"];

// ---------------------------------------------------------------------------
// AUTENTICACIÓN ADMIN
// ---------------------------------------------------------------------------

function autorizadoAdmin(request, env) {
  if (!env.ADMIN_TOKEN) return false;
  const auth = request.headers.get("Authorization") || "";
  const match = auth.match(/^Bearer\s+(.+)$/);
  if (!match) return false;
  return compararSeguro(match[1], env.ADMIN_TOKEN);
}

// ---------------------------------------------------------------------------
// PÁGINA PÚBLICA DE INVITACIÓN
// ---------------------------------------------------------------------------

async function manejarVerInvitacion(request, env, slug) {
  const evento = await obtenerEvento(env.INVITACIONES_KV, slug);
  if (!evento) {
    return htmlResponse(
      `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Invitación no encontrada</title></head>
      <body style="font-family:sans-serif;text-align:center;padding:80px 20px;">
      <h1>Invitación no encontrada</h1><p>Verifica el link con quien te lo compartió.</p></body></html>`,
      404
    );
  }

  const url = new URL(request.url);
  const eventoPublico = { ...evento };
  delete eventoPublico.passwordHash;

  if (evento.modo === "lista") {
    const codigo = (url.searchParams.get("c") || "").trim().toUpperCase();
    if (!codigo) {
      return htmlResponse(renderPagina({ evento: eventoPublico, invitado: null, codigoInvalido: true }));
    }
    const invitado = await obtenerInvitado(env.INVITACIONES_KV, slug, codigo);
    if (!invitado) {
      return htmlResponse(renderPagina({ evento: eventoPublico, invitado: null, codigoInvalido: true }));
    }
    return htmlResponse(renderPagina({ evento: eventoPublico, invitado, codigoInvalido: false }));
  }

  // modo === "password"
  const token = leerCookie(request, `inv_${slug}`);
  const desbloqueado = await verificarTokenSesion(token, slug, env.SESSION_SECRET || "");
  return htmlResponse(renderPagina({ evento: eventoPublico, invitado: null, desbloqueado }));
}

async function manejarVerificarClave(request, env, slug) {
  const evento = await obtenerEvento(env.INVITACIONES_KV, slug);
  if (!evento || evento.modo !== "password") {
    return jsonResponse({ error: "Evento no encontrado." }, 404);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "JSON inválido." }, 400);
  }

  const ok = await verificarPassword(body.clave || "", env.SESSION_SECRET || "", evento.passwordHash);
  if (!ok) {
    return jsonResponse({ error: "Contraseña incorrecta." }, 401);
  }

  const token = await crearTokenSesion(slug, env.SESSION_SECRET || "");
  const url = new URL(request.url);
  const secureFlag = url.protocol === "https:" ? " Secure;" : "";
  const cookie = `inv_${slug}=${token}; Path=/evento/${slug}; HttpOnly;${secureFlag} SameSite=Lax; Max-Age=43200`;

  return jsonResponse({ success: true }, 200, { "Set-Cookie": cookie });
}

async function manejarRSVP(request, env, slug) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "JSON inválido." }, 400);
  }

  const codigo = String(body.codigo || "").trim().toUpperCase();
  const asistencia = body.asistencia;

  if (!codigo || (asistencia !== "si" && asistencia !== "no")) {
    return jsonResponse({ error: "Datos de confirmación inválidos." }, 422);
  }

  const invitado = await obtenerInvitado(env.INVITACIONES_KV, slug, codigo);
  if (!invitado) {
    return jsonResponse({ error: "Invitado no encontrado." }, 404);
  }

  if (asistencia === "si") {
    const pases = parseInt(body.pases, 10);
    if (!Number.isFinite(pases) || pases < 1 || pases > invitado.pases) {
      return jsonResponse(
        { error: `El número de pases debe estar entre 1 y ${invitado.pases}.` },
        422
      );
    }
    invitado.confirmado = true;
    invitado.pasesConfirmados = pases;
  } else {
    invitado.confirmado = false;
    invitado.pasesConfirmados = 0;
  }
  invitado.fechaConfirmacion = new Date().toISOString();

  await guardarInvitado(env.INVITACIONES_KV, slug, invitado);

  return jsonResponse({
    success: true,
    confirmado: invitado.confirmado,
    pasesConfirmados: invitado.pasesConfirmados,
  });
}

// ---------------------------------------------------------------------------
// ADMIN — EVENTOS
// ---------------------------------------------------------------------------

async function manejarCrearEvento(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "JSON inválido." }, 400);
  }

  const slug = String(body.slug || "").trim().toLowerCase();
  if (!SLUG_REGEX.test(slug)) {
    return jsonResponse(
      { error: "slug inválido. Usa minúsculas, números y guiones (2-64 caracteres)." },
      422
    );
  }

  const existente = await obtenerEvento(env.INVITACIONES_KV, slug);
  const modo = body.modo || existente?.modo;
  const tipo = body.tipo || existente?.tipo || "boda";

  if (!existente) {
    if (!body.titulo) return jsonResponse({ error: "Falta 'titulo'." }, 422);
    if (modo !== "lista" && modo !== "password") {
      return jsonResponse({ error: "'modo' debe ser 'lista' o 'password'." }, 422);
    }
    if (modo === "password" && !body.clave) {
      return jsonResponse({ error: "Falta 'clave' para el modo password." }, 422);
    }
  }

  if (!TIPOS_VALIDOS.includes(tipo)) {
    return jsonResponse({ error: `'tipo' debe ser uno de: ${TIPOS_VALIDOS.join(", ")}.` }, 422);
  }

  const evento = {
    ...existente,
    slug,
    tipo,
    modo,
    titulo: body.titulo ?? existente?.titulo,
    subtitulo: body.subtitulo ?? existente?.subtitulo ?? "",
    fechaEvento: body.fechaEvento ?? existente?.fechaEvento ?? null,
    mostrarCountdown: body.mostrarCountdown ?? existente?.mostrarCountdown ?? true,
    lugarCeremonia: body.lugarCeremonia ?? existente?.lugarCeremonia ?? "",
    direccionCeremonia: body.direccionCeremonia ?? existente?.direccionCeremonia ?? "",
    horaCeremonia: body.horaCeremonia ?? existente?.horaCeremonia ?? "",
    lugarRecepcion: body.lugarRecepcion ?? existente?.lugarRecepcion ?? "",
    direccionRecepcion: body.direccionRecepcion ?? existente?.direccionRecepcion ?? "",
    horaRecepcion: body.horaRecepcion ?? existente?.horaRecepcion ?? "",
    codigoVestimenta: body.codigoVestimenta ?? existente?.codigoVestimenta ?? "",
    mesaDeRegalos: body.mesaDeRegalos ?? existente?.mesaDeRegalos ?? "",
    mensaje: body.mensaje ?? existente?.mensaje ?? "",
    fotoPortada: body.fotoPortada ?? existente?.fotoPortada ?? "",
    // fotoFestejada: retrato circular mostrado entre el nombre y el subtítulo del hero
    fotoFestejada: body.fotoFestejada ?? existente?.fotoFestejada ?? "",
    // galeria: [{ tipo: "foto"|"video", url, poster? }]
    galeria: body.galeria ?? existente?.galeria ?? [],
    // itinerario: [{ hora, titulo, descripcion?, icono? }]
    itinerario: body.itinerario ?? existente?.itinerario ?? [],
    // Dirección de texto O link completo de Google Maps (maps.app.goo.gl / google.com/maps/...)
    mapaCeremonia: body.mapaCeremonia ?? existente?.mapaCeremonia ?? "",
    mapaRecepcion: body.mapaRecepcion ?? existente?.mapaRecepcion ?? "",
    // dedicatoria: { mensaje?, columnas: [{ etiqueta, personas: [] }] } — ej. "Padres & Padrinos"
    dedicatoria: body.dedicatoria ?? existente?.dedicatoria ?? null,
    // decoracion: URLs de imágenes PNG transparentes que subiste vía /admin/eventos/:slug/media.
    // esquinaSuperior/esquinaInferior se reflejan automáticamente al otro lado a menos que
    // definas esquinaSuperiorDer/esquinaInferiorDer explícitos. ilustracion se ancla abajo-derecha.
    decoracion: body.decoracion ?? existente?.decoracion ?? null,
    // colores: { primario?, secundario?, acento?, texto?, gradiente?, tarjetaFondo? } —
    // sobrescribe la paleta del tema (boda/xv/aniversario) campo por campo para
    // que combine con el arte real del cliente.
    colores: body.colores ?? existente?.colores ?? null,
    musicaUrl: body.musicaUrl ?? existente?.musicaUrl ?? null,
    emailAutomatico: body.emailAutomatico ?? existente?.emailAutomatico ?? false,
    emailAsunto: body.emailAsunto ?? existente?.emailAsunto ?? "Estás invitado — {{titulo}}",
    emailFromNombre: body.emailFromNombre ?? existente?.emailFromNombre ?? "Invitaciones",
    emailFromDomain: body.emailFromDomain ?? existente?.emailFromDomain ?? "",
    actualizado: new Date().toISOString(),
    creado: existente?.creado ?? new Date().toISOString(),
  };

  if (modo === "password" && body.clave) {
    evento.passwordHash = await hashPassword(body.clave, env.SESSION_SECRET || "");
  } else if (modo === "password" && !evento.passwordHash) {
    return jsonResponse({ error: "El evento no tiene contraseña configurada." }, 422);
  }

  await guardarEvento(env.INVITACIONES_KV, slug, evento);

  const publico = { ...evento };
  delete publico.passwordHash;
  return jsonResponse({ success: true, evento: publico }, existente ? 200 : 201);
}

async function manejarObtenerEvento(env, slug) {
  const evento = await obtenerEvento(env.INVITACIONES_KV, slug);
  if (!evento) return jsonResponse({ error: "Evento no encontrado." }, 404);
  const publico = { ...evento };
  delete publico.passwordHash;
  return jsonResponse({ evento: publico });
}

async function manejarEliminarEvento(env, slug) {
  const evento = await obtenerEvento(env.INVITACIONES_KV, slug);
  if (!evento) return jsonResponse({ error: "Evento no encontrado." }, 404);
  await eliminarEvento(env.INVITACIONES_KV, slug);
  return jsonResponse({ success: true });
}

// ---------------------------------------------------------------------------
// ADMIN — IMPORTAR CSV / LISTAR / EXPORTAR INVITADOS
// ---------------------------------------------------------------------------

async function manejarImportarCSV(request, env, slug, origin) {
  const evento = await obtenerEvento(env.INVITACIONES_KV, slug);
  if (!evento) return jsonResponse({ error: "Evento no encontrado." }, 404);
  if (evento.modo !== "lista") {
    return jsonResponse({ error: "Este evento no usa modo 'lista'." }, 422);
  }

  const texto = await request.text();
  const registros = parsearCSV(texto);
  if (registros.length === 0) {
    return jsonResponse({ error: "El CSV está vacío o no tiene el formato nombre,pases,correo." }, 422);
  }

  const puedeEnviarEmail = evento.emailAutomatico && !!env.RESEND_API_KEY;
  const importados = [];

  for (const registro of registros) {
    let codigo = generarCodigo();
    // Evita colisiones improbables con invitados ya existentes
    while (await obtenerInvitado(env.INVITACIONES_KV, slug, codigo)) {
      codigo = generarCodigo();
    }

    const invitado = {
      codigo,
      nombre: registro.nombre,
      pases: registro.pases,
      correo: registro.correo || "",
      confirmado: null,
      pasesConfirmados: null,
      fechaConfirmacion: null,
    };

    await guardarInvitado(env.INVITACIONES_KV, slug, invitado);

    const link = `${origin}/evento/${slug}?c=${codigo}`;
    let emailEnviado = false;
    let emailError = null;

    if (puedeEnviarEmail && registro.correo) {
      try {
        await enviarEmailInvitacion(env, evento, invitado, link);
        emailEnviado = true;
      } catch (err) {
        emailError = err.message;
        console.error("[Email/Invitacion]", slug, codigo, err.message);
      }
    }

    importados.push({ nombre: invitado.nombre, correo: invitado.correo, pases: invitado.pases, codigo, link, emailEnviado, emailError });
  }

  return jsonResponse({ success: true, total: importados.length, emailAutomatico: puedeEnviarEmail, importados });
}

async function manejarListarInvitados(env, slug) {
  const evento = await obtenerEvento(env.INVITACIONES_KV, slug);
  if (!evento) return jsonResponse({ error: "Evento no encontrado." }, 404);

  const invitados = await listarInvitados(env.INVITACIONES_KV, slug);
  const resumen = {
    total: invitados.length,
    confirmados: invitados.filter((i) => i.confirmado === true).length,
    declinados: invitados.filter((i) => i.confirmado === false).length,
    pendientes: invitados.filter((i) => i.confirmado === null || i.confirmado === undefined).length,
    pasesConfirmados: invitados.reduce((acc, i) => acc + (i.confirmado === true ? i.pasesConfirmados || 0 : 0), 0),
  };

  return jsonResponse({ resumen, invitados });
}

async function manejarExportarInvitadosCSV(env, slug) {
  const evento = await obtenerEvento(env.INVITACIONES_KV, slug);
  if (!evento) return jsonResponse({ error: "Evento no encontrado." }, 404);

  const invitados = await listarInvitados(env.INVITACIONES_KV, slug);
  const encabezado = "nombre,pases,correo,codigo,confirmado,pases_confirmados,fecha_confirmacion";
  const filas = invitados.map((i) =>
    [
      csvEscape(i.nombre),
      i.pases,
      csvEscape(i.correo),
      i.codigo,
      i.confirmado === null || i.confirmado === undefined ? "pendiente" : i.confirmado ? "si" : "no",
      i.pasesConfirmados ?? "",
      i.fechaConfirmacion ?? "",
    ].join(",")
  );

  const csv = [encabezado, ...filas].join("\n");
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="invitados-${slug}.csv"`,
      ...SECURITY_HEADERS,
    },
  });
}

function csvEscape(valor) {
  const str = String(valor ?? "");
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

// ---------------------------------------------------------------------------
// MEDIOS — subida y servido vía R2 (fotos/video de la galería y portada)
// ---------------------------------------------------------------------------

const TIPOS_MIME_PERMITIDOS = {
  "image/jpeg": "foto",
  "image/png": "foto",
  "image/webp": "foto",
  "image/gif": "foto",
  "video/mp4": "video",
  "video/webm": "video",
  "video/quicktime": "video",
};

const MAX_TAMANO_FOTO = 15 * 1024 * 1024; // 15MB
const MAX_TAMANO_VIDEO = 100 * 1024 * 1024; // 100MB

function sanitizarNombreArchivo(nombre) {
  return String(nombre || "archivo")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9.\-_]/g, "-")
    .slice(0, 80);
}

async function manejarSubirMedia(request, env, slug) {
  if (!env.INVITACIONES_MEDIA) {
    return jsonResponse({ error: "Almacenamiento de medios no configurado (falta el binding R2)." }, 500);
  }

  const evento = await obtenerEvento(env.INVITACIONES_KV, slug);
  if (!evento) return jsonResponse({ error: "Evento no encontrado." }, 404);

  const contentType = (request.headers.get("Content-Type") || "").split(";")[0].trim().toLowerCase();
  const tipo = TIPOS_MIME_PERMITIDOS[contentType];
  if (!tipo) {
    return jsonResponse(
      { error: `Tipo de archivo no permitido: ${contentType || "desconocido"}. Usa JPEG, PNG, WEBP, GIF, MP4, WEBM o MOV.` },
      415
    );
  }

  const contentLength = parseInt(request.headers.get("Content-Length") || "0", 10);
  const limite = tipo === "video" ? MAX_TAMANO_VIDEO : MAX_TAMANO_FOTO;
  if (contentLength && contentLength > limite) {
    return jsonResponse({ error: `El archivo excede el límite de ${Math.round(limite / 1024 / 1024)}MB.` }, 413);
  }

  const nombreOriginal = sanitizarNombreArchivo(request.headers.get("X-Filename") || `${tipo}-${Date.now()}`);
  const nombreArchivo = `${crypto.randomUUID().slice(0, 8)}-${nombreOriginal}`;
  const key = `${slug}/${nombreArchivo}`;

  await env.INVITACIONES_MEDIA.put(key, request.body, {
    httpMetadata: { contentType },
  });

  const url = `${new URL(request.url).origin}/media/${slug}/${nombreArchivo}`;
  return jsonResponse({ success: true, tipo, url, archivo: nombreArchivo }, 201);
}

/**
 * Descarga un archivo desde una URL externa (ej. un link de exportación de
 * Canva) y lo guarda en R2, igual que si se hubiera subido directo. Útil
 * cuando el archivo ya vive en algún lugar público mientras se decide si
 * vale la pena tenerlo permanente en R2.
 */
async function manejarImportarMediaDesdeURL(request, env, slug) {
  if (!env.INVITACIONES_MEDIA) {
    return jsonResponse({ error: "Almacenamiento de medios no configurado (falta el binding R2)." }, 500);
  }

  const evento = await obtenerEvento(env.INVITACIONES_KV, slug);
  if (!evento) return jsonResponse({ error: "Evento no encontrado." }, 404);

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "JSON inválido." }, 400);
  }

  const urlOrigen = body.url;
  if (!urlOrigen || !/^https?:\/\//i.test(urlOrigen)) {
    return jsonResponse({ error: "Falta 'url' (debe ser http/https)." }, 422);
  }

  let respuesta;
  try {
    respuesta = await fetch(urlOrigen);
  } catch (err) {
    return jsonResponse({ error: `No se pudo descargar la URL: ${err.message}` }, 502);
  }
  if (!respuesta.ok) {
    return jsonResponse({ error: `La URL respondió ${respuesta.status}.` }, 502);
  }

  const contentType = (respuesta.headers.get("Content-Type") || "").split(";")[0].trim().toLowerCase();
  const tipo = TIPOS_MIME_PERMITIDOS[contentType];
  if (!tipo) {
    return jsonResponse(
      { error: `Tipo de archivo no permitido: ${contentType || "desconocido"}. Usa JPEG, PNG, WEBP, GIF, MP4, WEBM o MOV.` },
      415
    );
  }

  const nombreOriginal = sanitizarNombreArchivo(body.filename || `${tipo}-${Date.now()}`);
  const nombreArchivo = `${crypto.randomUUID().slice(0, 8)}-${nombreOriginal}`;
  const key = `${slug}/${nombreArchivo}`;

  await env.INVITACIONES_MEDIA.put(key, respuesta.body, {
    httpMetadata: { contentType },
  });

  const url = `${new URL(request.url).origin}/media/${slug}/${nombreArchivo}`;
  return jsonResponse({ success: true, tipo, url, archivo: nombreArchivo }, 201);
}

async function manejarServirMedia(env, slug, archivo) {
  if (!env.INVITACIONES_MEDIA) return jsonResponse({ error: "No encontrado." }, 404);

  const objeto = await env.INVITACIONES_MEDIA.get(`${slug}/${archivo}`);
  if (!objeto) return jsonResponse({ error: "Archivo no encontrado." }, 404);

  return new Response(objeto.body, {
    status: 200,
    headers: {
      "Content-Type": objeto.httpMetadata?.contentType || "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
      ...SECURITY_HEADERS,
    },
  });
}

async function manejarEliminarMedia(env, slug, archivo) {
  if (!env.INVITACIONES_MEDIA) {
    return jsonResponse({ error: "Almacenamiento de medios no configurado (falta el binding R2)." }, 500);
  }
  await env.INVITACIONES_MEDIA.delete(`${slug}/${archivo}`);
  return jsonResponse({ success: true });
}

// ---------------------------------------------------------------------------
// EMAIL — Resend (opcional, evento.emailAutomatico)
// ---------------------------------------------------------------------------

async function enviarEmailInvitacion(env, evento, invitado, link) {
  const asunto = (evento.emailAsunto || "Estás invitado — {{titulo}}").replace(
    "{{titulo}}",
    evento.titulo || ""
  );
  const fromDomain = evento.emailFromDomain || env.EMAIL_FROM_DOMAIN || "notificaciones.com";
  const fromNombre = evento.emailFromNombre || "Invitaciones";

  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:auto;">
      <h2>${escapeHtml(evento.titulo || "")}</h2>
      <p>Hola ${escapeHtml(invitado.nombre)}, ¡estás invitado! Tienes ${invitado.pases} ${invitado.pases === 1 ? "pase" : "pases"} asignado${invitado.pases === 1 ? "" : "s"}.</p>
      <p><a href="${link}" style="background:#333;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block;">Ver invitación y confirmar</a></p>
      <p style="color:#888;font-size:0.85rem;">Si el botón no funciona, copia este link: ${link}</p>
    </div>
  `;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: `${fromNombre} <invitacion@${fromDomain}>`,
      to: [invitado.correo],
      subject: asunto,
      html,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend error ${res.status}: ${err}`);
  }
}

// ---------------------------------------------------------------------------
// ENTRY POINT
// ---------------------------------------------------------------------------

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method.toUpperCase();

    if (method === "OPTIONS") {
      return new Response(null, { status: 204, headers: SECURITY_HEADERS });
    }

    if (method === "GET" && pathname === "/health") {
      return jsonResponse({ status: "ok", timestamp: new Date().toISOString() });
    }

    // ── Rutas públicas /evento/:slug[...] ──────────────────────────────────
    let m;

    if ((m = pathname.match(/^\/evento\/([a-z0-9-]+)$/)) && method === "GET") {
      return manejarVerInvitacion(request, env, m[1]);
    }
    if ((m = pathname.match(/^\/evento\/([a-z0-9-]+)\/clave$/)) && method === "POST") {
      return manejarVerificarClave(request, env, m[1]);
    }
    if ((m = pathname.match(/^\/evento\/([a-z0-9-]+)\/rsvp$/)) && method === "POST") {
      return manejarRSVP(request, env, m[1]);
    }
    if ((m = pathname.match(/^\/media\/([a-z0-9-]+)\/([a-zA-Z0-9.\-_]+)$/)) && method === "GET") {
      return manejarServirMedia(env, m[1], m[2]);
    }

    // ── Rutas admin ─────────────────────────────────────────────────────────
    if (pathname === "/admin/eventos" || pathname.startsWith("/admin/eventos/")) {
      if (!autorizadoAdmin(request, env)) {
        return jsonResponse({ error: "No autorizado." }, 401);
      }

      if (pathname === "/admin/eventos" && method === "POST") {
        return manejarCrearEvento(request, env);
      }
      if ((m = pathname.match(/^\/admin\/eventos\/([a-z0-9-]+)$/))) {
        if (method === "GET") return manejarObtenerEvento(env, m[1]);
        if (method === "DELETE") return manejarEliminarEvento(env, m[1]);
      }
      if ((m = pathname.match(/^\/admin\/eventos\/([a-z0-9-]+)\/csv$/)) && method === "POST") {
        return manejarImportarCSV(request, env, m[1], url.origin);
      }
      if ((m = pathname.match(/^\/admin\/eventos\/([a-z0-9-]+)\/invitados$/)) && method === "GET") {
        return manejarListarInvitados(env, m[1]);
      }
      if ((m = pathname.match(/^\/admin\/eventos\/([a-z0-9-]+)\/invitados\.csv$/)) && method === "GET") {
        return manejarExportarInvitadosCSV(env, m[1]);
      }
      if ((m = pathname.match(/^\/admin\/eventos\/([a-z0-9-]+)\/media$/)) && method === "POST") {
        return manejarSubirMedia(request, env, m[1]);
      }
      if ((m = pathname.match(/^\/admin\/eventos\/([a-z0-9-]+)\/media\/importar-url$/)) && method === "POST") {
        return manejarImportarMediaDesdeURL(request, env, m[1]);
      }
      if ((m = pathname.match(/^\/admin\/eventos\/([a-z0-9-]+)\/media\/([a-zA-Z0-9.\-_]+)$/)) && method === "DELETE") {
        return manejarEliminarMedia(env, m[1], m[2]);
      }
    }

    return jsonResponse({ error: "Ruta no encontrada." }, 404);
  },
};
