/**
 * =============================================================================
 * ALMACENAMIENTO — Cloudflare KV
 * =============================================================================
 * Un solo Worker multi-evento: cada evento y sus invitados viven en el mismo
 * namespace KV, separados por prefijo de clave.
 *
 *   evento:{slug}                 → config del evento (JSON)
 *   invitado:{slug}:{codigo}      → datos + estado RSVP de un invitado (JSON)
 */

const PREFIJO_EVENTO = "evento:";
const PREFIJO_INVITADO = "invitado:";

export function claveEvento(slug) {
  return `${PREFIJO_EVENTO}${slug}`;
}

export function claveInvitado(slug, codigo) {
  return `${PREFIJO_INVITADO}${slug}:${codigo}`;
}

export async function obtenerEvento(kv, slug) {
  return kv.get(claveEvento(slug), "json");
}

export async function guardarEvento(kv, slug, evento) {
  await kv.put(claveEvento(slug), JSON.stringify(evento));
}

export async function eliminarEvento(kv, slug) {
  await kv.delete(claveEvento(slug));
  const invitados = await listarInvitados(kv, slug);
  await Promise.all(
    invitados.map((inv) => kv.delete(claveInvitado(slug, inv.codigo)))
  );
}

export async function obtenerInvitado(kv, slug, codigo) {
  return kv.get(claveInvitado(slug, codigo), "json");
}

export async function guardarInvitado(kv, slug, invitado) {
  await kv.put(claveInvitado(slug, invitado.codigo), JSON.stringify(invitado));
}

/** Lista todos los invitados de un evento (usa list() con prefijo, pagina automáticamente). */
export async function listarInvitados(kv, slug) {
  const prefijo = `${PREFIJO_INVITADO}${slug}:`;
  const invitados = [];
  let cursor;
  do {
    const resultado = await kv.list({ prefix: prefijo, cursor });
    const valores = await Promise.all(
      resultado.keys.map((k) => kv.get(k.name, "json"))
    );
    invitados.push(...valores.filter(Boolean));
    cursor = resultado.list_complete ? undefined : resultado.cursor;
  } while (cursor);
  return invitados;
}
