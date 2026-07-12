/**
 * =============================================================================
 * PLANTILLAS — Invitaciones Digitales
 * =============================================================================
 * Tres temas visuales (boda, XV años, aniversario) sobre un mismo esqueleto
 * tipo "tarjeta digital": hero de foto completa, countdown flotante estilo
 * glass, itinerario en línea de tiempo, mapa embebido, galería de foto/video
 * con lightbox, mensaje y RSVP (modo lista) o compuerta de contraseña (modo
 * password).
 *
 * Todo el contenido dinámico se escapa con escapeHtml antes de insertarse.
 */

import { escapeHtml } from "./utilidades.js";

// Paletas basadas en la categoría "Wedding/Event Planning" y "Brewery/Winery"
// (romántico + dorado elegante, y borgoña profundo + dorado), verificadas WCAG.
const TEMAS = {
  boda: {
    etiqueta: "¡Nos casamos!",
    icono: "💍",
    separador: "❧",
    fuenteTitulo: "'Playfair Display', Georgia, 'Times New Roman', serif",
    fuenteTexto: "Georgia, 'Times New Roman', serif",
    colorPrimario: "#292018",
    colorSecundario: "#f4ede1",
    colorAcento: "#a16207",
    colorTexto: "#292018",
    gradiente: "linear-gradient(160deg, #fdfaf5 0%, #f3e9d4 55%, #e9d9b8 100%)",
    tarjetaFondo: "rgba(255,255,255,0.78)",
    etiquetaPrincipal: "Ceremonia",
    etiquetaSecundaria: "Recepción",
  },
  xv: {
    etiqueta: "Mis XV Años",
    icono: "👑",
    separador: "✦",
    fuenteTitulo: "'Great Vibes', 'Brush Script MT', cursive",
    fuenteTexto: "'Poppins', Verdana, sans-serif",
    colorPrimario: "#db2777",
    colorSecundario: "#fdf2f8",
    colorAcento: "#a16207",
    colorTexto: "#831843",
    gradiente: "linear-gradient(160deg, #fffafc 0%, #fce3f0 50%, #fbcfe8 100%)",
    tarjetaFondo: "rgba(255,255,255,0.8)",
    etiquetaPrincipal: "Misa",
    etiquetaSecundaria: "Fiesta",
  },
  aniversario: {
    etiqueta: "Celebrando nuestro amor",
    icono: "🥂",
    separador: "♥",
    fuenteTitulo: "'Cormorant Garamond', Georgia, serif",
    fuenteTexto: "Verdana, Geneva, sans-serif",
    colorPrimario: "#7c2d12",
    colorSecundario: "#fef2f2",
    colorAcento: "#a16207",
    colorTexto: "#450a0a",
    gradiente: "linear-gradient(160deg, #fff9f6 0%, #fce4de 50%, #fecaca 100%)",
    tarjetaFondo: "rgba(255,255,255,0.78)",
    etiquetaPrincipal: "Celebración",
    etiquetaSecundaria: "Recepción",
  },
};

export function temaDe(tipo) {
  return TEMAS[tipo] || TEMAS.boda;
}

// ---------------------------------------------------------------------------
// ESQUELETO PRINCIPAL
// ---------------------------------------------------------------------------

/**
 * Renderiza la página completa de la invitación.
 * @param {Object} opts
 * @param {Object} opts.evento - Config del evento (ya sin passwordHash).
 * @param {Object|null} opts.invitado - Datos del invitado (modo lista) o null.
 * @param {boolean} opts.codigoInvalido - true si se pasó un código que no existe (modo lista).
 * @param {boolean} opts.desbloqueado - true si ya pasó la compuerta de contraseña (modo password).
 * @param {string|null} opts.errorClave - Mensaje de error al intentar la contraseña.
 */
export function renderPagina({ evento, invitado, codigoInvalido, desbloqueado, errorClave }) {
  const tema = temaDe(evento.tipo);
  const titulo = escapeHtml(evento.titulo || "Invitación");
  const fotoFondo = evento.fotoPortada || primeraFotoGaleria(evento);

  const mostrarContenido = evento.modo === "lista" ? true : !!desbloqueado;

  let cuerpo;
  if (evento.modo === "password" && !desbloqueado) {
    cuerpo = renderCompuertaPassword(evento, tema, errorClave, fotoFondo);
  } else if (evento.modo === "lista" && codigoInvalido) {
    cuerpo = renderInvitacionNoEncontrada(evento, tema);
  } else {
    cuerpo = renderContenidoEvento(evento, tema, invitado, fotoFondo);
  }

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${titulo}</title>
<meta name="robots" content="noindex, nofollow">
${estilos(tema, evento)}
</head>
<body>
${cuerpo}
${mostrarContenido && evento.mostrarCountdown !== false && evento.fechaEvento ? scriptCountdown(evento.fechaEvento) : ""}
${mostrarContenido ? scriptLightbox() : ""}
</body>
</html>`;
}

function primeraFotoGaleria(evento) {
  const galeria = Array.isArray(evento.galeria) ? evento.galeria : [];
  const foto = galeria.find((item) => item.tipo !== "video");
  return foto ? foto.url : null;
}

// ---------------------------------------------------------------------------
// ESTILOS
// ---------------------------------------------------------------------------

function estilos(tema, evento) {
  const fondoTextura = evento?.decoracion?.fondoTextura;
  const fondoBody = fondoTextura
    ? `url('${fondoTextura.replace(/'/g, "%27")}') center/cover fixed, ${tema.gradiente}`
    : tema.gradiente;

  return `<style>
  :root {
    --primario: ${tema.colorPrimario};
    --secundario: ${tema.colorSecundario};
    --acento: ${tema.colorAcento};
    --texto: ${tema.colorTexto};
    --tarjeta: ${tema.tarjetaFondo};
    --fuente-titulo: ${tema.fuenteTitulo};
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    min-height: 100vh;
    background: ${fondoBody};
    font-family: ${tema.fuenteTexto};
    color: var(--texto);
  }
  .contenedor { width: 100%; max-width: 640px; margin: 0 auto; padding: 0 20px 48px; }

  /* ── Hero ─────────────────────────────────────────────────────────── */
  .hero-foto {
    position: relative;
    min-height: 62vh;
    background-size: cover;
    background-position: center;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding: 80px 20px 40px;
    overflow: hidden;
  }
  .hero-foto::before {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.35) 55%, rgba(0,0,0,0.75) 100%);
  }
  .hero-foto .hero-contenido { position: relative; z-index: 3; text-align: center; color: #fff; }
  .hero-foto .hero-contenido h1 { color: #fff; text-shadow: 0 2px 18px rgba(0,0,0,0.35); }
  .hero-foto .hero-etiqueta { color: #f4e9c8; }

  .hero-plana { position: relative; text-align: center; padding: 64px 16px 32px; overflow: hidden; }
  .hero-plana h1 { color: var(--primario); }
  .hero-plana .hero-contenido { position: relative; z-index: 3; }

  /* ── Decoración (esquinas/ilustración subidas por el admin) ─────────── */
  .hero-decoracion {
    position: absolute;
    width: 32%;
    max-width: 200px;
    z-index: 2;
    pointer-events: none;
    user-select: none;
  }
  .hero-decoracion.superior-izq { top: 0; left: 0; }
  .hero-decoracion.superior-der { top: 0; right: 0; }
  .hero-decoracion.inferior-izq { bottom: 0; left: 0; }
  .hero-decoracion.inferior-der { bottom: 0; right: 0; }
  .hero-ilustracion {
    position: absolute;
    bottom: 0;
    right: 0;
    width: 46%;
    max-width: 260px;
    z-index: 1;
    pointer-events: none;
    user-select: none;
  }
  .divisor-ornamental { display: block; margin: 12px auto 0; color: var(--acento); }

  .hero-contenido .icono { font-size: 2.6rem; }
  .hero-contenido h1 {
    font-family: var(--fuente-titulo);
    font-size: clamp(2.2rem, 7vw, 3.6rem);
    margin: 8px 0 4px;
  }
  .hero-etiqueta {
    letter-spacing: 0.16em;
    text-transform: uppercase;
    font-size: 0.78rem;
    color: var(--acento);
    margin-bottom: 6px;
    font-weight: 600;
  }
  .hero-subtitulo { font-size: 1.05rem; opacity: 0.9; margin: 4px 0 0; }

  /* ── Countdown flotante (glass) ──────────────────────────────────────── */
  .countdown-flotante {
    position: relative;
    z-index: 5;
    max-width: 480px;
    margin: -56px auto 8px;
    background: rgba(255,255,255,0.62);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(255,255,255,0.65);
    border-radius: 22px;
    padding: 22px 10px;
    display: flex;
    justify-content: space-around;
    box-shadow: 0 20px 50px rgba(0,0,0,0.16);
  }
  .countdown-flotante .cd-item { text-align: center; min-width: 56px; }
  .countdown-flotante .cd-num {
    font-family: var(--fuente-titulo);
    font-size: 1.7rem;
    font-weight: 700;
    color: var(--primario);
    display: block;
    line-height: 1;
  }
  .countdown-flotante .cd-label {
    font-size: 0.62rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--texto);
    opacity: 0.72;
  }

  .separador {
    text-align: center;
    color: var(--acento);
    font-size: 1.2rem;
    margin: 20px 0 24px;
    letter-spacing: 0.5em;
  }

  /* ── Tarjetas ─────────────────────────────────────────────────────────── */
  .tarjeta {
    background: var(--tarjeta);
    border: 1px solid rgba(0,0,0,0.06);
    border-radius: 20px;
    padding: 28px 24px;
    margin-bottom: 22px;
    backdrop-filter: blur(6px);
    box-shadow: 0 16px 40px rgba(0,0,0,0.07);
  }
  .eyebrow {
    text-align: center;
    text-transform: uppercase;
    letter-spacing: 0.16em;
    font-size: 0.7rem;
    font-weight: 700;
    color: var(--acento);
    margin-bottom: 6px;
  }
  .tarjeta h2 {
    font-family: var(--fuente-titulo);
    color: var(--primario);
    margin-top: 0;
    margin-bottom: 18px;
    font-size: 1.5rem;
    text-align: center;
  }

  /* ── Itinerario (timeline) ───────────────────────────────────────────── */
  .timeline { position: relative; }
  .timeline-item { display: flex; gap: 16px; position: relative; padding-bottom: 26px; }
  .timeline-item:last-child { padding-bottom: 0; }
  .timeline-item:not(:last-child)::after {
    content: "";
    position: absolute;
    left: 19px;
    top: 40px;
    bottom: -26px;
    width: 2px;
    background: var(--acento);
    opacity: 0.3;
  }
  .timeline-marcador {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--primario);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.05rem;
    flex-shrink: 0;
    z-index: 2;
  }
  .timeline-contenido { padding-top: 4px; }
  .timeline-hora {
    font-weight: 700;
    color: var(--acento);
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .timeline-titulo { font-family: var(--fuente-titulo); font-size: 1.15rem; color: var(--primario); margin-top: 2px; }
  .timeline-desc { opacity: 0.82; font-size: 0.92rem; margin-top: 4px; line-height: 1.5; }

  .detalle-fila { display: flex; gap: 12px; margin-bottom: 14px; align-items: flex-start; }
  .detalle-fila:last-child { margin-bottom: 0; }
  .detalle-fila .icono-detalle { font-size: 1.3rem; }
  .detalle-fila .titulo-detalle { font-weight: 600; color: var(--primario); }
  .detalle-fila .texto-detalle { opacity: 0.9; line-height: 1.4; }

  /* ── Mapa ─────────────────────────────────────────────────────────────── */
  .mapa-item { margin-bottom: 18px; }
  .mapa-item:last-child { margin-bottom: 0; }
  .mapa-titulo { font-weight: 700; color: var(--primario); margin-bottom: 8px; }
  .mapa-embed {
    border-radius: 16px;
    overflow: hidden;
    aspect-ratio: 16 / 9;
    border: 1px solid rgba(0,0,0,0.08);
  }
  .mapa-embed iframe { width: 100%; height: 100%; border: 0; display: block; }
  .mapa-boton {
    display: inline-block;
    margin-top: 8px;
    color: var(--primario);
    font-weight: 700;
    text-decoration: none;
    font-size: 0.88rem;
  }

  /* ── Galería + lightbox ──────────────────────────────────────────────── */
  .galeria-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
    gap: 10px;
  }
  .galeria-item {
    position: relative;
    aspect-ratio: 1 / 1;
    border-radius: 14px;
    overflow: hidden;
    border: 0;
    padding: 0;
    cursor: pointer;
    background: rgba(0,0,0,0.05);
  }
  .galeria-item img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 0.3s ease; }
  .galeria-item:hover img { transform: scale(1.06); }
  .galeria-item .play-badge {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.4rem;
    color: #fff;
    background: rgba(0,0,0,0.28);
  }
  .lightbox {
    position: fixed;
    inset: 0;
    background: rgba(10,10,10,0.92);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 24px;
  }
  .lightbox[hidden] { display: none; }
  .lightbox-contenido img, .lightbox-contenido video {
    max-width: 90vw;
    max-height: 85vh;
    border-radius: 10px;
    display: block;
  }
  .lightbox-cerrar {
    position: absolute;
    top: 18px;
    right: 22px;
    background: rgba(255,255,255,0.15);
    color: #fff;
    border: none;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    font-size: 1.1rem;
    cursor: pointer;
  }

  .mensaje { text-align: center; font-style: italic; line-height: 1.6; }

  /* ── Dedicatoria (padres/padrinos) ───────────────────────────────────── */
  .dedicatoria-grid {
    display: flex;
    justify-content: center;
    align-items: flex-start;
    gap: 22px;
    flex-wrap: wrap;
    text-align: center;
    margin-top: 16px;
  }
  .dedicatoria-columna { flex: 1; min-width: 130px; }
  .dedicatoria-etiqueta {
    font-family: var(--fuente-titulo);
    font-style: italic;
    color: var(--primario);
    font-size: 1.15rem;
    margin-bottom: 8px;
  }
  .dedicatoria-nombre { font-size: 0.92rem; margin-bottom: 4px; line-height: 1.4; }
  .dedicatoria-separador {
    font-family: var(--fuente-titulo);
    font-size: 1.3rem;
    color: var(--acento);
    padding-top: 6px;
  }

  /* ── Formularios ──────────────────────────────────────────────────────── */
  form.rsvp, form.clave { display: flex; flex-direction: column; gap: 14px; }
  label { font-weight: 600; font-size: 0.9rem; }
  input[type="text"], input[type="password"], input[type="number"], select {
    padding: 11px 12px;
    border-radius: 12px;
    border: 1px solid rgba(0,0,0,0.15);
    font-size: 1rem;
    font-family: inherit;
  }
  .opciones-asistencia {
    display: flex;
    gap: 6px;
    background: rgba(0,0,0,0.045);
    padding: 5px;
    border-radius: 16px;
  }
  .opciones-asistencia label {
    position: relative;
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 12px;
    border-radius: 12px;
    cursor: pointer;
    font-weight: 600;
    transition: background 0.15s, color 0.15s;
  }
  .opciones-asistencia input { position: absolute; opacity: 0; pointer-events: none; }
  .opciones-asistencia label.seleccionado { background: var(--primario); color: #fff; }
  button {
    background: var(--primario);
    color: #fff;
    border: none;
    padding: 14px;
    border-radius: 14px;
    font-size: 1rem;
    cursor: pointer;
    font-weight: 700;
  }
  button:hover { filter: brightness(1.08); }
  .estado {
    text-align: center;
    padding: 10px;
    border-radius: 12px;
    font-weight: 600;
    margin-bottom: 14px;
  }
  .estado.si { background: #e3f6e3; color: #226622; }
  .estado.no { background: #f8e3e3; color: #7a2222; }
  .error { color: #a02020; font-size: 0.9rem; text-align: center; }
  .footer { text-align: center; opacity: 0.6; font-size: 0.8rem; margin-top: 32px; }
  .no-encontrada { text-align: center; padding: 80px 16px; }

  .boton-musica {
    position: fixed;
    bottom: 20px;
    right: 20px;
    border-radius: 50%;
    width: 52px;
    height: 52px;
    padding: 0;
    z-index: 10;
    box-shadow: 0 8px 24px rgba(0,0,0,0.25);
  }
</style>`;
}

// ---------------------------------------------------------------------------
// SECCIONES
// ---------------------------------------------------------------------------

/**
 * Construye las imágenes de decoración (esquinas + ilustración) para un hero.
 * Sube UN solo archivo de esquina y se refleja automáticamente al otro lado,
 * a menos que definas el lado derecho de forma explícita.
 */
function decoracionEsquinas(decoracion) {
  if (!decoracion) return "";
  const partes = [];

  const superiorIzq = decoracion.esquinaSuperior || null;
  const superiorDer = decoracion.esquinaSuperiorDer || decoracion.esquinaSuperior || null;
  const espejarSuperiorDer = !decoracion.esquinaSuperiorDer && !!decoracion.esquinaSuperior;
  const inferiorIzq = decoracion.esquinaInferior || null;
  const inferiorDer = decoracion.esquinaInferiorDer || decoracion.esquinaInferior || null;
  const espejarInferiorDer = !decoracion.esquinaInferiorDer && !!decoracion.esquinaInferior;

  if (superiorIzq) {
    partes.push(`<img class="hero-decoracion superior-izq" src="${escapeHtml(superiorIzq)}" alt="">`);
  }
  if (superiorDer) {
    const espejo = espejarSuperiorDer ? ' style="transform:scaleX(-1);"' : "";
    partes.push(`<img class="hero-decoracion superior-der" src="${escapeHtml(superiorDer)}" alt=""${espejo}>`);
  }
  if (inferiorIzq) {
    partes.push(`<img class="hero-decoracion inferior-izq" src="${escapeHtml(inferiorIzq)}" alt="">`);
  }
  if (inferiorDer) {
    const espejo = espejarInferiorDer ? ' style="transform:scaleX(-1);"' : "";
    partes.push(`<img class="hero-decoracion inferior-der" src="${escapeHtml(inferiorDer)}" alt=""${espejo}>`);
  }
  if (decoracion.ilustracion) {
    partes.push(`<img class="hero-ilustracion" src="${escapeHtml(decoracion.ilustracion)}" alt="">`);
  }

  return partes.join("");
}

/** Pequeño divisor ornamental dibujado en SVG (línea + rombo), sin depender de artes externas. */
function divisorOrnamental() {
  return `<svg class="divisor-ornamental" width="150" height="18" viewBox="0 0 150 18" fill="none" xmlns="http://www.w3.org/2000/svg">
    <line x1="0" y1="9" x2="58" y2="9" stroke="currentColor" stroke-width="1"/>
    <path d="M75 1 L83 9 L75 17 L67 9 Z" fill="currentColor"/>
    <line x1="92" y1="9" x2="150" y2="9" stroke="currentColor" stroke-width="1"/>
  </svg>`;
}

function renderCompuertaPassword(evento, tema, errorClave, fotoFondo) {
  const titulo = escapeHtml(evento.titulo || "Invitación");
  const decoracion = decoracionEsquinas(evento.decoracion);
  const heroInterno = `
    <div class="icono">${tema.icono}</div>
    <div class="hero-etiqueta">${escapeHtml(tema.etiqueta)}</div>
    <h1>${titulo}</h1>
    <p class="hero-subtitulo">Esta invitación es privada. Ingresa la contraseña para verla.</p>`;

  const hero = fotoFondo
    ? `<div class="hero-foto" style="background-image:url('${escapeHtml(fotoFondo)}')">${decoracion}<div class="hero-contenido">${heroInterno}</div></div>`
    : `<div class="hero-plana">${decoracion}<div class="hero-contenido">${heroInterno}</div></div>`;

  return `${hero}
<div class="contenedor">
  <div class="tarjeta" style="margin-top:${fotoFondo ? "-40px" : "0"};position:relative;z-index:5;">
    <form class="clave" id="form-clave">
      <label for="clave">Contraseña</label>
      <input type="password" id="clave" name="clave" required autofocus>
      ${errorClave ? `<div class="error">${escapeHtml(errorClave)}</div>` : ""}
      <button type="submit">Ver invitación</button>
    </form>
  </div>
  <div class="footer">Si no tienes la contraseña, contacta a quien te compartió este link.</div>
</div>
<script>
document.getElementById('form-clave').addEventListener('submit', async function(e) {
  e.preventDefault();
  const clave = document.getElementById('clave').value;
  const res = await fetch(window.location.pathname + '/clave', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clave })
  });
  if (res.ok) {
    window.location.reload();
  } else {
    const data = await res.json().catch(() => ({}));
    alert(data.error || 'Contraseña incorrecta.');
  }
});
</script>`;
}

function renderInvitacionNoEncontrada(evento, tema) {
  return `<div class="contenedor no-encontrada">
  <div class="icono">${tema.icono}</div>
  <h1 style="font-family:${tema.fuenteTitulo};color:var(--primario);">Invitación no encontrada</h1>
  <p>El link que usaste no es válido o ya expiró. Verifica con el anfitrión que copiaste el link completo.</p>
</div>`;
}

function renderContenidoEvento(evento, tema, invitado, fotoFondo) {
  const decoracion = decoracionEsquinas(evento.decoracion);
  const heroInterno = `
    <div class="icono">${tema.icono}</div>
    <div class="hero-etiqueta">${escapeHtml(tema.etiqueta)}</div>
    <h1>${escapeHtml(evento.titulo || "")}</h1>
    ${evento.subtitulo ? `<p class="hero-subtitulo">${escapeHtml(evento.subtitulo)}</p>` : ""}
    ${divisorOrnamental()}`;

  const hero = fotoFondo
    ? `<div class="hero-foto" style="background-image:url('${escapeHtml(fotoFondo)}')">${decoracion}<div class="hero-contenido">${heroInterno}</div></div>`
    : `<div class="hero-plana">${decoracion}<div class="hero-contenido">${heroInterno}</div></div>`;

  const countdown = seccionCountdown(evento);

  return `${hero}
${countdown}
<div class="contenedor">
  ${countdown ? "" : `<div class="separador">${tema.separador} ${tema.separador} ${tema.separador}</div>`}
  ${seccionDedicatoria(evento)}
  ${seccionItinerario(evento, tema)}
  ${seccionDetalles(evento, tema)}
  ${seccionMapa(evento, tema)}
  ${seccionGaleria(evento)}
  ${seccionMensaje(evento)}
  ${evento.modo === "lista" ? seccionRSVP(evento, invitado) : ""}
  ${seccionMusica(evento)}
  <div class="footer">Hecho con ${tema.icono} para ${escapeHtml(evento.titulo || "este evento")}</div>
</div>`;
}

function seccionDedicatoria(evento) {
  const dedicatoria = evento.dedicatoria;
  const columnas = dedicatoria?.columnas;
  if (!Array.isArray(columnas) || columnas.length === 0) return "";

  const cols = columnas
    .map(
      (col) => `<div class="dedicatoria-columna">
        <div class="dedicatoria-etiqueta">${escapeHtml(col.etiqueta || "")}</div>
        ${(col.personas || []).map((p) => `<div class="dedicatoria-nombre">${escapeHtml(p)}</div>`).join("")}
      </div>`
    )
    .join(columnas.length > 1 ? `<div class="dedicatoria-separador">&amp;</div>` : "");

  return `<div class="tarjeta">
    ${dedicatoria.mensaje ? `<p class="mensaje">${escapeHtml(dedicatoria.mensaje)}</p><div class="dedicatoria-grid" style="margin-top:20px;">${cols}</div>` : `<div class="dedicatoria-grid">${cols}</div>`}
  </div>`;
}

function seccionCountdown(evento) {
  if (evento.mostrarCountdown === false || !evento.fechaEvento) return "";
  return `<div class="countdown-flotante" id="countdown">
    <div class="cd-item"><span class="cd-num" id="cd-dias">--</span><span class="cd-label">Días</span></div>
    <div class="cd-item"><span class="cd-num" id="cd-horas">--</span><span class="cd-label">Horas</span></div>
    <div class="cd-item"><span class="cd-num" id="cd-min">--</span><span class="cd-label">Min</span></div>
    <div class="cd-item"><span class="cd-num" id="cd-seg">--</span><span class="cd-label">Seg</span></div>
  </div>`;
}

/**
 * Construye el itinerario a mostrar: usa evento.itinerario si existe, o lo
 * arma automáticamente a partir de los campos de ceremonia/recepción para
 * eventos configurados antes de que existiera el campo itinerario.
 */
function itinerarioEfectivo(evento, tema) {
  if (Array.isArray(evento.itinerario) && evento.itinerario.length > 0) {
    return evento.itinerario;
  }
  const items = [];
  if (evento.lugarCeremonia || evento.horaCeremonia) {
    items.push({
      hora: evento.horaCeremonia || "",
      titulo: tema.etiquetaPrincipal,
      descripcion: [evento.lugarCeremonia, evento.direccionCeremonia].filter(Boolean).join(" — "),
      icono: "📍",
    });
  }
  if (evento.lugarRecepcion || evento.horaRecepcion) {
    items.push({
      hora: evento.horaRecepcion || "",
      titulo: tema.etiquetaSecundaria,
      descripcion: [evento.lugarRecepcion, evento.direccionRecepcion].filter(Boolean).join(" — "),
      icono: "🥂",
    });
  }
  return items;
}

function seccionItinerario(evento, tema) {
  const items = itinerarioEfectivo(evento, tema);
  if (items.length === 0) return "";

  const filas = items
    .map(
      (item) => `<div class="timeline-item">
        <div class="timeline-marcador">${escapeHtml(item.icono || "•")}</div>
        <div class="timeline-contenido">
          ${item.hora ? `<div class="timeline-hora">${escapeHtml(item.hora)}</div>` : ""}
          <div class="timeline-titulo">${escapeHtml(item.titulo || "")}</div>
          ${item.descripcion ? `<div class="timeline-desc">${escapeHtml(item.descripcion)}</div>` : ""}
        </div>
      </div>`
    )
    .join("");

  return `<div class="tarjeta">
    <div class="eyebrow">${tema.separador} Programa ${tema.separador}</div>
    <h2>Itinerario</h2>
    <div class="timeline">${filas}</div>
  </div>`;
}

function seccionDetalles(evento, tema) {
  const filas = [];

  if (evento.codigoVestimenta) {
    filas.push(filaDetalle("👗", "Código de vestimenta", [evento.codigoVestimenta]));
  }
  if (evento.mesaDeRegalos) {
    filas.push(filaDetalle("🎁", "Mesa de regalos", [evento.mesaDeRegalos]));
  }

  if (filas.length === 0) return "";

  return `<div class="tarjeta"><h2>Detalles</h2>${filas.join("")}</div>`;
}

function filaDetalle(icono, titulo, lineas) {
  const texto = lineas
    .filter(Boolean)
    .map((l) => escapeHtml(l))
    .join("<br>");
  if (!texto) return "";
  return `<div class="detalle-fila">
    <div class="icono-detalle">${icono}</div>
    <div>
      <div class="titulo-detalle">${escapeHtml(titulo)}</div>
      <div class="texto-detalle">${texto}</div>
    </div>
  </div>`;
}

function seccionMapa(evento, tema) {
  const items = [];
  if (evento.mapaCeremonia) items.push({ etiqueta: tema.etiquetaPrincipal, direccion: evento.mapaCeremonia });
  if (evento.mapaRecepcion) items.push({ etiqueta: tema.etiquetaSecundaria, direccion: evento.mapaRecepcion });
  if (items.length === 0) return "";

  const mapas = items.map((item) => mapaEmbed(item.etiqueta, item.direccion)).join("");

  return `<div class="tarjeta">
    <div class="eyebrow">${tema.separador} Ubicación ${tema.separador}</div>
    <h2>Cómo llegar</h2>
    ${mapas}
  </div>`;
}

function esUrl(valor) {
  return /^https?:\/\//i.test(String(valor || "").trim());
}

/**
 * Renderiza el mapa de una ubicación. Acepta dos formatos en `direccion`:
 *  - Texto libre ("Parroquia San José, Cancún") → se embebe un iframe interactivo
 *    de Google Maps (sin API key) más un botón "Cómo llegar".
 *  - Un link completo de Google Maps (https://maps.app.goo.gl/... o
 *    https://www.google.com/maps/place/...) → esos links de redirección no se
 *    pueden embeber en un iframe, así que solo se muestra el botón que abre
 *    el link tal cual.
 */
function mapaEmbed(etiqueta, direccion) {
  if (esUrl(direccion)) {
    return `<div class="mapa-item">
      <div class="mapa-titulo">📍 ${escapeHtml(etiqueta)}</div>
      <a class="mapa-boton" href="${escapeHtml(direccion)}" target="_blank" rel="noopener">Ver ubicación en Google Maps →</a>
    </div>`;
  }

  const query = encodeURIComponent(direccion);
  return `<div class="mapa-item">
    <div class="mapa-titulo">📍 ${escapeHtml(etiqueta)}</div>
    <div class="mapa-embed">
      <iframe src="https://maps.google.com/maps?q=${query}&output=embed" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe>
    </div>
    <a class="mapa-boton" href="https://www.google.com/maps/dir/?api=1&destination=${query}" target="_blank" rel="noopener">Cómo llegar →</a>
  </div>`;
}

function seccionGaleria(evento) {
  const items = Array.isArray(evento.galeria) ? evento.galeria.slice(0, 24) : [];
  if (items.length === 0) return "";

  const botones = items
    .map((item) => {
      const url = escapeHtml(item.url);
      if (item.tipo === "video") {
        const poster = escapeHtml(item.poster || item.url);
        return `<button type="button" class="galeria-item" data-tipo="video" data-src="${url}">
          <img src="${poster}" alt="" loading="lazy">
          <span class="play-badge">▶</span>
        </button>`;
      }
      return `<button type="button" class="galeria-item" data-tipo="foto" data-src="${url}">
        <img src="${url}" alt="" loading="lazy">
      </button>`;
    })
    .join("");

  return `<div class="tarjeta">
    <div class="eyebrow">Galería</div>
    <h2>Momentos</h2>
    <div class="galeria-grid">${botones}</div>
  </div>
  <div class="lightbox" id="lightbox" hidden>
    <button type="button" class="lightbox-cerrar" id="lightbox-cerrar">✕</button>
    <div class="lightbox-contenido" id="lightbox-contenido"></div>
  </div>`;
}

function seccionMensaje(evento) {
  if (!evento.mensaje) return "";
  return `<div class="tarjeta"><p class="mensaje">${escapeHtml(evento.mensaje)}</p></div>`;
}

function seccionMusica(evento) {
  if (!evento.musicaUrl) return "";
  return `<audio id="musica-evento" src="${escapeHtml(evento.musicaUrl)}" loop></audio>
  <button type="button" id="btn-musica" class="boton-musica">🎵</button>
  <script>
  (function() {
    var audio = document.getElementById('musica-evento');
    var btn = document.getElementById('btn-musica');
    var sonando = false;
    btn.addEventListener('click', function() {
      if (sonando) { audio.pause(); btn.textContent = '🎵'; }
      else { audio.play().catch(function(){}); btn.textContent = '⏸'; }
      sonando = !sonando;
    });
  })();
  </script>`;
}

function seccionRSVP(evento, invitado) {
  if (!invitado) return "";

  const yaConfirmado = invitado.confirmado !== null && invitado.confirmado !== undefined;
  const estadoHtml = yaConfirmado
    ? `<div class="estado ${invitado.confirmado ? "si" : "no"}">
        ${invitado.confirmado
          ? `Confirmaste asistencia (${invitado.pasesConfirmados} ${invitado.pasesConfirmados === 1 ? "pase" : "pases"}). Puedes actualizar tu respuesta si algo cambia.`
          : "Indicaste que no podrás asistir. Puedes actualizar tu respuesta si algo cambia."}
      </div>`
    : "";

  const opcionesPases = Array.from({ length: invitado.pases }, (_, i) => i + 1)
    .map((n) => `<option value="${n}" ${invitado.pasesConfirmados === n ? "selected" : ""}>${n}</option>`)
    .join("");

  return `<div class="tarjeta">
    <div class="eyebrow">RSVP</div>
    <h2>Confirma tu asistencia</h2>
    <p>Hola <strong>${escapeHtml(invitado.nombre)}</strong>, tienes <strong>${invitado.pases}</strong> ${invitado.pases === 1 ? "pase" : "pases"} asignado${invitado.pases === 1 ? "" : "s"}.</p>
    ${estadoHtml}
    <form class="rsvp" id="form-rsvp">
      <div class="opciones-asistencia" id="opciones-asistencia">
        <label class="${invitado.confirmado === true ? "seleccionado" : ""}"><input type="radio" name="asistencia" value="si" ${invitado.confirmado === true ? "checked" : ""} required> Sí asistiré</label>
        <label class="${invitado.confirmado === false ? "seleccionado" : ""}"><input type="radio" name="asistencia" value="no" ${invitado.confirmado === false ? "checked" : ""}> No podré ir</label>
      </div>
      <div id="grupo-pases" style="${invitado.confirmado === false ? "display:none;" : ""}">
        <label for="pases">¿Cuántos de tus pases confirmas?</label>
        <select id="pases" name="pases">${opcionesPases}</select>
      </div>
      <button type="submit">Enviar confirmación</button>
    </form>
  </div>
  <script>
  (function() {
    var form = document.getElementById('form-rsvp');
    var grupoPases = document.getElementById('grupo-pases');
    var opciones = document.getElementById('opciones-asistencia');
    form.querySelectorAll('input[name="asistencia"]').forEach(function(input) {
      input.addEventListener('change', function() {
        opciones.querySelectorAll('label').forEach(function(label) {
          label.classList.toggle('seleccionado', label.querySelector('input').checked);
        });
        grupoPases.style.display = form.querySelector('input[name="asistencia"]:checked').value === 'si' ? 'block' : 'none';
      });
    });
    form.addEventListener('submit', async function(e) {
      e.preventDefault();
      var asistencia = form.querySelector('input[name="asistencia"]:checked').value;
      var pases = document.getElementById('pases').value;
      var res = await fetch(window.location.pathname + '/rsvp' + window.location.search, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo: '${escapeHtml(invitado.codigo)}', asistencia: asistencia, pases: pases })
      });
      if (res.ok) {
        window.location.reload();
      } else {
        var data = await res.json().catch(function(){ return {}; });
        alert(data.error || 'No se pudo enviar tu confirmación.');
      }
    });
  })();
  </script>`;
}

function scriptCountdown(fechaISO) {
  return `<script>
(function() {
  var fecha = new Date(${JSON.stringify(fechaISO)}).getTime();
  var elDias = document.getElementById('cd-dias');
  var elHoras = document.getElementById('cd-horas');
  var elMin = document.getElementById('cd-min');
  var elSeg = document.getElementById('cd-seg');
  if (!elDias) return;
  function actualizar() {
    var restante = fecha - Date.now();
    if (restante <= 0) {
      elDias.textContent = elHoras.textContent = elMin.textContent = elSeg.textContent = '0';
      clearInterval(intervalo);
      return;
    }
    elDias.textContent = Math.floor(restante / 86400000);
    elHoras.textContent = Math.floor((restante % 86400000) / 3600000);
    elMin.textContent = Math.floor((restante % 3600000) / 60000);
    elSeg.textContent = Math.floor((restante % 60000) / 1000);
  }
  actualizar();
  var intervalo = setInterval(actualizar, 1000);
})();
</script>`;
}

function scriptLightbox() {
  return `<script>
(function() {
  var lightbox = document.getElementById('lightbox');
  if (!lightbox) return;
  var contenido = document.getElementById('lightbox-contenido');
  var cerrar = document.getElementById('lightbox-cerrar');

  document.querySelectorAll('.galeria-item').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var tipo = btn.getAttribute('data-tipo');
      var src = btn.getAttribute('data-src');
      contenido.innerHTML = tipo === 'video'
        ? '<video src="' + src + '" controls autoplay playsinline></video>'
        : '<img src="' + src + '" alt="">';
      lightbox.hidden = false;
    });
  });

  function cerrarLightbox() {
    lightbox.hidden = true;
    contenido.innerHTML = '';
  }
  cerrar.addEventListener('click', cerrarLightbox);
  lightbox.addEventListener('click', function(e) {
    if (e.target === lightbox) cerrarLightbox();
  });
})();
</script>`;
}
