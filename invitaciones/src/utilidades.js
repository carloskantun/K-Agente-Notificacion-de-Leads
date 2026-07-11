/**
 * =============================================================================
 * UTILIDADES — Invitaciones Digitales
 * =============================================================================
 * Helpers compartidos: JSON responses, escape HTML, CSV, códigos de invitado,
 * hashing de contraseña (PBKDF2) y firma de sesión (HMAC) — todo con
 * Web Crypto API nativa (sin dependencias externas).
 */

export const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

export function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...SECURITY_HEADERS,
      ...extraHeaders,
    },
  });
}

export function htmlResponse(html, status = 200, extraHeaders = {}) {
  return new Response(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      ...SECURITY_HEADERS,
      ...extraHeaders,
    },
  });
}

export function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Genera un código corto de invitado (8 caracteres, base36 mayúsculas). */
export function generarCodigo() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
}

/** Compara dos strings en tiempo constante (para tokens/admin auth). */
export function compararSeguro(a, b) {
  const bufA = new TextEncoder().encode(String(a || ""));
  const bufB = new TextEncoder().encode(String(b || ""));
  if (bufA.length !== bufB.length) return false;
  let diff = 0;
  for (let i = 0; i < bufA.length; i++) diff |= bufA[i] ^ bufB[i];
  return diff === 0;
}

// ---------------------------------------------------------------------------
// CSV — parseo mínimo con soporte de comillas
// ---------------------------------------------------------------------------

/**
 * Parsea texto CSV con columnas: nombre,pases,correo (correo opcional).
 * Ignora la fila de encabezado si detecta "nombre" en la primera columna.
 * @param {string} texto
 * @returns {{nombre:string, pases:number, correo:string}[]}
 */
export function parsearCSV(texto) {
  const filas = texto
    .split(/\r\n|\n|\r/)
    .map((f) => f.trim())
    .filter((f) => f.length > 0);

  if (filas.length === 0) return [];

  const registros = [];
  for (const fila of filas) {
    const campos = parsearLineaCSV(fila);
    if (campos.length === 0) continue;

    const [nombre, pasesRaw, correo] = campos;
    if (!nombre) continue;

    // Salta encabezado
    if (nombre.trim().toLowerCase() === "nombre") continue;

    const pases = parseInt(pasesRaw, 10);
    registros.push({
      nombre: nombre.trim(),
      pases: Number.isFinite(pases) && pases > 0 ? pases : 1,
      correo: (correo || "").trim(),
    });
  }
  return registros;
}

function parsearLineaCSV(linea) {
  const campos = [];
  let actual = "";
  let entreComillas = false;

  for (let i = 0; i < linea.length; i++) {
    const char = linea[i];
    if (entreComillas) {
      if (char === '"') {
        if (linea[i + 1] === '"') {
          actual += '"';
          i++;
        } else {
          entreComillas = false;
        }
      } else {
        actual += char;
      }
    } else if (char === '"') {
      entreComillas = true;
    } else if (char === ",") {
      campos.push(actual);
      actual = "";
    } else {
      actual += char;
    }
  }
  campos.push(actual);
  return campos;
}

// ---------------------------------------------------------------------------
// CONTRASEÑA — PBKDF2 (modo genérico protegido por contraseña)
// ---------------------------------------------------------------------------

const PBKDF2_ITERACIONES = 100000;

/**
 * Deriva un hash de contraseña con PBKDF2-SHA256. Retorna "salt:hash" en hex.
 * @param {string} password
 * @param {string} pepper - Secreto del Worker (SESSION_SECRET) para reforzar el hash.
 */
export async function hashPassword(password, pepper) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hashBytes = await derivarPBKDF2(password, pepper, salt);
  return `${bytesToHex(salt)}:${bytesToHex(hashBytes)}`;
}

/** Verifica una contraseña contra un hash "salt:hash" generado por hashPassword. */
export async function verificarPassword(password, pepper, hashGuardado) {
  if (!hashGuardado || !hashGuardado.includes(":")) return false;
  const [saltHex, hashHex] = hashGuardado.split(":");
  const salt = hexToBytes(saltHex);
  const hashBytes = await derivarPBKDF2(password, pepper, salt);
  return compararSeguro(bytesToHex(hashBytes), hashHex);
}

async function derivarPBKDF2(password, pepper, salt) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(`${password}::${pepper}`),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERACIONES, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return new Uint8Array(bits);
}

function bytesToHex(bytes) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

// ---------------------------------------------------------------------------
// SESIÓN FIRMADA — cookie HMAC para el modo contraseña
// ---------------------------------------------------------------------------

const SESION_DURACION_MS = 12 * 60 * 60 * 1000; // 12 horas

export async function crearTokenSesion(slug, secret) {
  const expira = Date.now() + SESION_DURACION_MS;
  const payload = `${slug}.${expira}`;
  const firma = await firmarHMAC(payload, secret);
  return `${payload}.${firma}`;
}

export async function verificarTokenSesion(token, slug, secret) {
  if (!token) return false;
  const partes = token.split(".");
  if (partes.length !== 3) return false;
  const [slugToken, expiraStr, firma] = partes;
  if (slugToken !== slug) return false;

  const payload = `${slugToken}.${expiraStr}`;
  const firmaEsperada = await firmarHMAC(payload, secret);
  if (!compararSeguro(firma, firmaEsperada)) return false;

  const expira = parseInt(expiraStr, 10);
  return Number.isFinite(expira) && Date.now() < expira;
}

async function firmarHMAC(mensaje, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const firma = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(mensaje));
  return bytesToHex(new Uint8Array(firma));
}

/** Extrae el valor de una cookie por nombre del header Cookie de la request. */
export function leerCookie(request, nombre) {
  const cabecera = request.headers.get("Cookie") || "";
  const match = cabecera.match(new RegExp(`(?:^|;\\s*)${nombre}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}
