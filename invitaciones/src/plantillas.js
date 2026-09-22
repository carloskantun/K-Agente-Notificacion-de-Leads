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
    fuenteSecundaria: "'Playfair Display', Georgia, 'Times New Roman', serif",
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
    fuenteSecundaria: "'Playfair Display', Georgia, serif",
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
    fuenteSecundaria: "'Cormorant Garamond', Georgia, serif",
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
  cumpleanos: {
    etiqueta: "¡Fiesta de Cumpleaños!",
    icono: "🕺",
    separador: "✦",
    fuenteTitulo: "'Righteous', 'Arial Black', sans-serif",
    fuenteSecundaria: "'Poppins', Verdana, sans-serif",
    fuenteTexto: "'Poppins', Verdana, sans-serif",
    colorPrimario: "#d6006f",
    colorSecundario: "#fff0f7",
    colorAcento: "#00b8d9",
    colorTexto: "#2b1150",
    gradiente: "linear-gradient(180deg, #0a0812 0%, #150a1f 55%, #1c0d29 100%)",
    tarjetaFondo: "rgba(255,255,255,0.93)",
    paginaOscura: true,
    etiquetaPrincipal: "Fiesta",
    etiquetaSecundaria: "Fiesta",
  },
};

/**
 * Resuelve el tema visual de un evento: parte de la paleta base del `tipo`
 * y, si el evento define `colores`, la sobrescribe campo por campo. Así un
 * mismo tema (ej. "xv") puede adaptarse al arte real del cliente sin tocar
 * código (ej. azul hielo en vez del rosa por defecto).
 */
export function temaDe(tipo, evento) {
  const base = TEMAS[tipo] || TEMAS.boda;
  const colores = evento?.colores;
  if (!colores) return base;
  return {
    ...base,
    colorPrimario: colores.primario || base.colorPrimario,
    colorSecundario: colores.secundario || base.colorSecundario,
    colorAcento: colores.acento || base.colorAcento,
    colorTexto: colores.texto || base.colorTexto,
    gradiente: colores.gradiente || base.gradiente,
    tarjetaFondo: colores.tarjetaFondo || base.tarjetaFondo,
  };
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
  const tema = temaDe(evento.tipo, evento);
  const tituloTexto = evento.titulo || "Invitación";
  const titulo = escapeHtml(tituloTexto);
  const fotoFondo = evento.fotoPortada || null;

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
${metasSociales(evento, tituloTexto)}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Great+Vibes&family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Cormorant+Garamond:wght@400;600;700&family=Poppins:wght@400;500;600;700&family=Righteous&display=swap" rel="stylesheet">
${estilos(tema, evento)}
</head>
<body>
${evento.tipo === "cumpleanos" ? decoracionFondoPagina() : ""}
${cuerpo}
${mostrarContenido && evento.mostrarCountdown !== false && evento.fechaEvento ? scriptCountdown(evento.fechaEvento) : ""}
${mostrarContenido && Array.isArray(evento.galeria) && evento.galeria.length > 0 ? scriptCarrusel() : ""}
${mostrarContenido ? scriptLightbox() : ""}
</body>
</html>`;
}

/**
 * Meta tags Open Graph / Twitter Card para que el link se vea bien al
 * compartirse (WhatsApp, Facebook, etc.): título, descripción e imagen.
 */
function metasSociales(evento, tituloTexto) {
  const descripcion = evento.descripcionSocial || evento.mensaje || evento.subtitulo || "Te invitamos a celebrar este momento especial.";
  const imagen = evento.fotoSocial || evento.fotoPortada || evento.fotoFestejada || primeraImagenGaleria(evento);
  const url = evento.slug ? `https://invitaciones-digitales.carloskantun.workers.dev/evento/${encodeURIComponent(evento.slug)}` : "";
  const imagenMeta = esUrl(imagen)
    ? `<meta property="og:image" content="${escapeHtml(imagen)}">
<meta property="og:image:secure_url" content="${escapeHtml(imagen)}">
<meta name="twitter:image" content="${escapeHtml(imagen)}">`
    : "";

  return `<meta name="description" content="${escapeHtml(descripcion)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${escapeHtml(tituloTexto)}">
<meta property="og:description" content="${escapeHtml(descripcion)}">
${url ? `<meta property="og:url" content="${escapeHtml(url)}">` : ""}
${imagenMeta}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(tituloTexto)}">
<meta name="twitter:description" content="${escapeHtml(descripcion)}">`;
}

function primeraImagenGaleria(evento) {
  const item = Array.isArray(evento.galeria) ? evento.galeria.find((g) => g?.tipo === "foto" && g.url) : null;
  return item?.url || "";
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
    --texto-pagina: ${tema.paginaOscura ? "#f3ecff" : tema.colorTexto};
    --tarjeta: ${tema.tarjetaFondo};
    --fuente-titulo: ${tema.fuenteTitulo};
    --fuente-secundaria: ${tema.fuenteSecundaria || tema.fuenteTitulo};
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
  .hero-plana:not(.hero-plana--sintetico) .hero-subtitulo { color: var(--texto-pagina); }

  /* ── Hero "sintético" (synthwave, tema cumpleaños sin fotos) ─────────── */
  .hero-plana--sintetico {
    background: linear-gradient(180deg, #170a30 0%, #3c1259 40%, #7a1e6e 72%, #24123f 100%);
    padding-top: 76px;
    padding-bottom: 44px;
  }
  .hero-sintetico-fondo { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 0; }
  .hero-plana--sintetico .hero-contenido .icono { font-size: 2.2rem; filter: drop-shadow(0 0 10px rgba(255,255,255,0.5)); }
  .hero-plana--sintetico .hero-etiqueta { color: #6bf1ff; text-shadow: 0 0 12px rgba(107,241,255,0.7); }
  .hero-plana--sintetico h1 {
    color: #fffaf3;
    text-shadow:
      0 0 16px rgba(255,110,180,0.95),
      0 0 32px rgba(178,59,255,0.75),
      0 4px 16px rgba(0,0,0,0.65);
    letter-spacing: 0.02em;
  }
  .hero-plana--sintetico .hero-subtitulo { color: #f3e9ff; opacity: 0.95; text-shadow: 0 1px 8px rgba(0,0,0,0.4); }
  .hero-plana--sintetico .foto-festejada { box-shadow: 0 0 0 2px #6bf1ff, 0 10px 30px rgba(0,0,0,0.4); }
  .hero-plana--sintetico .saludo-invitado { background: rgba(255,255,255,0.12); border-color: rgba(255,255,255,0.25); color: #fff; }
  .hero-emoji-flotante {
    position: absolute;
    font-size: 1.8rem;
    z-index: 2;
    filter: drop-shadow(0 4px 10px rgba(0,0,0,0.35));
  }

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
  .hero-marco {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center;
    z-index: 2;
    pointer-events: none;
    user-select: none;
  }
  .divisor-ornamental { display: block; margin: 12px auto 0; color: var(--acento); }

  .foto-festejada {
    width: 108px;
    height: 108px;
    border-radius: 50%;
    overflow: hidden;
    margin: 10px auto;
    border: 4px solid rgba(255,255,255,0.92);
    box-shadow: 0 0 0 2px var(--acento), 0 10px 30px rgba(0,0,0,0.22);
    position: relative;
    z-index: 3;
  }
  .foto-festejada img { width: 100%; height: 100%; object-fit: cover; display: block; }

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
    position: relative;
    overflow: hidden;
    background: var(--tarjeta);
    border: 1px solid rgba(0,0,0,0.06);
    border-radius: 20px;
    padding: 28px 24px;
    margin-bottom: 22px;
    backdrop-filter: blur(6px);
    box-shadow: 0 16px 40px rgba(0,0,0,0.07);
  }
  ${
    tema.paginaOscura
      ? `.tarjeta::before {
    content: "";
    position: absolute;
    top: -10px;
    right: -10px;
    width: 34px;
    height: 34px;
    border-radius: 50%;
    background: var(--acento);
    opacity: 0.16;
    pointer-events: none;
  }
  .tarjeta::after {
    content: "";
    position: absolute;
    bottom: -6px;
    left: -6px;
    width: 0;
    height: 0;
    border-style: solid;
    border-width: 0 0 28px 28px;
    border-color: transparent transparent var(--primario) transparent;
    opacity: 0.14;
    pointer-events: none;
  }`
      : ""
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
    font-family: var(--fuente-secundaria);
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
  .timeline-titulo { font-family: var(--fuente-secundaria); font-size: 1.15rem; color: var(--primario); margin-top: 2px; }
  .timeline-desc { opacity: 0.82; font-size: 0.92rem; margin-top: 4px; line-height: 1.5; }
  .programa-fecha {
    text-align: center;
    margin: -6px 0 22px;
    color: var(--primario);
    font-family: var(--fuente-secundaria);
    font-size: 1.08rem;
  }

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
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin-top: 10px;
    padding: 12px 20px;
    border-radius: 14px;
    background: linear-gradient(135deg, var(--primario), var(--acento));
    color: #fff;
    font-weight: 700;
    text-decoration: none;
    font-size: 0.88rem;
    box-shadow: 0 10px 24px rgba(0,0,0,0.16);
    transition: transform 0.15s;
  }
  .mapa-boton:active { transform: scale(0.96); }

  /* ── Galería en carrusel + lightbox ──────────────────────────────────── */
  .carrusel-wrap { margin: 0 -24px; padding: 0 24px; }
  .carrusel {
    display: flex;
    gap: 12px;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    padding-bottom: 4px;
  }
  .carrusel::-webkit-scrollbar { display: none; }
  .carrusel-slide {
    flex: 0 0 74%;
    scroll-snap-align: center;
  }
  .carrusel-flechas { display: flex; justify-content: center; gap: 10px; margin-top: 12px; }
  .carrusel-flecha {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    border: none;
    background: rgba(0,0,0,0.06);
    color: var(--primario);
    font-size: 1rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .carrusel-flecha:active { transform: scale(0.92); }
  .carrusel-puntos { display: flex; justify-content: center; gap: 6px; margin-top: 10px; }
  .carrusel-punto {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: rgba(0,0,0,0.18);
    transition: width 0.2s, background 0.2s;
  }
  .carrusel-punto.activo { width: 20px; border-radius: 4px; background: var(--primario); }

  .galeria-item {
    position: relative;
    width: 100%;
    aspect-ratio: 1 / 1;
    border-radius: 16px;
    overflow: hidden;
    border: 0;
    padding: 0;
    cursor: pointer;
    background: rgba(0,0,0,0.05);
    box-shadow: 0 10px 26px rgba(0,0,0,0.1);
  }
  .galeria-item img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 0.3s ease; }
  .galeria-item:hover img { transform: scale(1.06); }
  .galeria-item .play-badge {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.6rem;
    color: #fff;
    background: rgba(0,0,0,0.28);
  }
  .galeria-item .play-badge span {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: rgba(255,255,255,0.28);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
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
    font-family: var(--fuente-secundaria);
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
  button { border: none; cursor: pointer; font-family: inherit; }
  button[type="submit"] {
    background: linear-gradient(135deg, var(--primario), var(--acento));
    color: #fff;
    padding: 15px;
    border-radius: 14px;
    font-size: 1rem;
    font-weight: 700;
    box-shadow: 0 12px 28px rgba(0,0,0,0.18);
    transition: transform 0.15s, filter 0.15s;
  }
  button[type="submit"]::before { content: "✨ "; }
  button[type="submit"]:hover { filter: brightness(1.08); }
  button[type="submit"]:active { transform: scale(0.97); }

  /* ── Sección QR ───────────────────────────────────────────────────────── */
  .qr-wrap { display: flex; justify-content: center; margin-top: 14px; }
  .qr-wrap img {
    width: 180px;
    height: 180px;
    border-radius: 18px;
    background: #fff;
    padding: 12px;
    box-shadow: 0 12px 30px rgba(0,0,0,0.14);
  }
  .qr-texto { text-align: center; opacity: 0.75; font-size: 0.88rem; margin-top: 4px; }

  /* ── Saludo personalizado ────────────────────────────────────────────── */
  .saludo-invitado {
    display: inline-block;
    margin-top: 14px;
    padding: 8px 18px;
    border-radius: 20px;
    background: rgba(255,255,255,0.25);
    border: 1px solid rgba(255,255,255,0.35);
    backdrop-filter: blur(6px);
    font-size: 0.82rem;
    font-weight: 600;
  }
  .hero-plana .saludo-invitado {
    background: rgba(0,0,0,0.05);
    border: 1px solid rgba(0,0,0,0.08);
    color: var(--primario);
  }
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
  .footer { text-align: center; opacity: 0.6; font-size: 0.8rem; margin-top: 32px; color: var(--texto-pagina); }
  .no-encontrada { text-align: center; padding: 80px 16px; }

  .boton-musica {
    position: fixed;
    bottom: calc(20px + env(safe-area-inset-bottom, 0px));
    right: 20px;
    border-radius: 50%;
    width: 56px;
    height: 56px;
    padding: 0;
    z-index: 1000;
    background: linear-gradient(135deg, var(--primario), var(--acento));
    color: #fff;
    font-size: 1.3rem;
    box-shadow: 0 8px 24px rgba(0,0,0,0.3);
    transition: transform 0.15s;
  }
  .boton-musica:active { transform: scale(0.92); }
  .boton-musica::after {
    content: "";
    position: absolute;
    inset: -6px;
    border-radius: 50%;
    border: 2px solid var(--acento);
    opacity: 0.7;
    animation: pulso-musica 1.8s ease-out infinite;
    pointer-events: none;
  }
  @keyframes pulso-musica {
    0% { transform: scale(1); opacity: 0.7; }
    100% { transform: scale(1.5); opacity: 0; }
  }
  .boton-musica.musica-activa::after { animation: none; opacity: 0; }
  .etiqueta-musica {
    position: fixed;
    bottom: calc(38px + env(safe-area-inset-bottom, 0px));
    right: 84px;
    background: rgba(20,10,30,0.85);
    color: #fff;
    padding: 7px 14px;
    border-radius: 20px;
    font-size: 0.8rem;
    font-weight: 600;
    white-space: nowrap;
    z-index: 999;
    box-shadow: 0 6px 16px rgba(0,0,0,0.25);
    animation: aparecer-etiqueta-musica 0.4s ease-out 0.8s both;
    pointer-events: none;
  }
  .etiqueta-musica::after {
    content: "";
    position: absolute;
    right: -5px;
    bottom: 14px;
    width: 10px;
    height: 10px;
    background: rgba(20,10,30,0.85);
    transform: rotate(45deg);
  }
  @keyframes aparecer-etiqueta-musica {
    from { opacity: 0; transform: translateX(8px); }
    to { opacity: 1; transform: translateX(0); }
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
function decoracionEsquinas(decoracion, tema, tipo) {
  const tieneImagenes =
    decoracion &&
    (decoracion.marco ||
      decoracion.esquinaSuperior ||
      decoracion.esquinaSuperiorDer ||
      decoracion.esquinaInferior ||
      decoracion.esquinaInferiorDer ||
      decoracion.ilustracion);

  if (!tieneImagenes) {
    // Sin imágenes subidas: para el tema de cumpleaños se dibuja un adorno
    // vectorial estilo Memphis (confeti geométrico) en vez de dejar el hero
    // vacío — no depende de ningún archivo externo.
    return tipo === "cumpleanos" && tema ? decoracionSintetico(tema) : "";
  }

  const partes = [];

  // marco: una sola imagen que cubre todo el hero (ej. un diseño de fondo
  // completo generado en Canva con flores arriba y vestido/ilustración abajo).
  if (decoracion.marco) {
    partes.push(`<img class="hero-marco" src="${escapeHtml(decoracion.marco)}" alt="">`);
  }

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

/**
 * Adorno vectorial estilo Memphis (confeti geométrico: círculo, triángulo,
 * garabato, rombo) en los colores del tema — para invitaciones sencillas
 * que no suben arte propio. 100% SVG inline, sin archivos externos.
 */
/**
 * Escena "synthwave" completa para el hero de cumpleaños sin arte propio:
 * fondo con sol + horizonte de rejilla en SVG (cubre todo el hero), más
 * cassette, confeti geométrico y globos/grabadora como acentos flotantes.
 * Todo vectorial e inline — no depende de ningún archivo externo.
 */
function decoracionSintetico(tema) {
  const p = escapeHtml(tema.colorPrimario);
  const a = escapeHtml(tema.colorAcento);

  const fondo = `<svg class="hero-sintetico-fondo" viewBox="0 0 400 320" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="sol" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#fff26b"/>
        <stop offset="45%" stop-color="#ff6fb0"/>
        <stop offset="100%" stop-color="#b23bff"/>
      </linearGradient>
      <linearGradient id="rejilla" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${a}"/>
        <stop offset="100%" stop-color="${p}"/>
      </linearGradient>
    </defs>
    <circle cx="200" cy="130" r="82" fill="url(#sol)"/>
    <rect x="118" y="158" width="164" height="7" fill="#170a30"/>
    <rect x="118" y="172" width="164" height="8" fill="#170a30"/>
    <rect x="118" y="187" width="164" height="9" fill="#170a30"/>
    <rect x="118" y="203" width="164" height="11" fill="#170a30"/>
    <g stroke="url(#rejilla)" stroke-width="1.5" opacity="0.8">
      <line x1="0" y1="224" x2="400" y2="224"/>
      <line x1="0" y1="248" x2="400" y2="248"/>
      <line x1="0" y1="278" x2="400" y2="278"/>
      <line x1="-60" y1="320" x2="200" y2="224"/>
      <line x1="460" y1="320" x2="200" y2="224"/>
      <line x1="10" y1="320" x2="200" y2="224"/>
      <line x1="390" y1="320" x2="200" y2="224"/>
      <line x1="80" y1="320" x2="200" y2="224"/>
      <line x1="320" y1="320" x2="200" y2="224"/>
      <line x1="150" y1="320" x2="200" y2="224"/>
      <line x1="250" y1="320" x2="200" y2="224"/>
    </g>
  </svg>`;

  const cassette = `<svg class="hero-decoracion" style="left:5%;bottom:78px;top:auto;width:24%;max-width:100px;" width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <rect x="6" y="20" width="88" height="60" rx="8" fill="#2b1150" stroke="${a}" stroke-width="2.5"/>
    <rect x="16" y="30" width="68" height="24" rx="4" fill="#170a30"/>
    <circle cx="34" cy="42" r="9" fill="none" stroke="${a}" stroke-width="2.5"/>
    <circle cx="66" cy="42" r="9" fill="none" stroke="${p}" stroke-width="2.5"/>
    <circle cx="34" cy="42" r="3" fill="${a}"/>
    <circle cx="66" cy="42" r="3" fill="${p}"/>
    <rect x="30" y="62" width="40" height="6" rx="3" fill="${a}" opacity="0.8"/>
    <rect x="16" y="72" width="68" height="4" rx="2" fill="${p}" opacity="0.6"/>
  </svg>`;

  const confetti = decoracionMemphis(tema);
  const globos = `<span class="hero-emoji-flotante" style="top:8%;right:10%;">🎈</span>
    <span class="hero-emoji-flotante" style="top:20%;right:22%;font-size:1.3rem;">🎈</span>
    <span class="hero-emoji-flotante" style="bottom:6%;right:8%;">📻</span>`;

  return fondo + confetti + cassette + globos;
}

/** Confeti geométrico estilo Memphis (círculo, triángulo, garabato, rombo), usado como acento. */
function decoracionMemphis(tema) {
  const p = escapeHtml(tema.colorPrimario);
  const a = escapeHtml(tema.colorAcento);
  const izq = `<svg class="hero-decoracion superior-izq" width="130" height="130" viewBox="0 0 140 140" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="30" cy="30" r="16" fill="${a}" opacity="0.85"/>
    <polygon points="90,10 112,52 68,52" fill="${p}" opacity="0.85"/>
    <path d="M10 92 Q25 76 40 92 T70 92" stroke="${a}" stroke-width="6" fill="none" stroke-linecap="round"/>
    <rect x="95" y="86" width="24" height="24" rx="4" fill="${p}" opacity="0.7" transform="rotate(20 107 98)"/>
  </svg>`;
  const der = `<svg class="hero-decoracion superior-der" width="130" height="130" viewBox="0 0 140 140" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="112" cy="34" r="14" fill="${p}" opacity="0.85"/>
    <polygon points="30,14 52,56 8,56" fill="${a}" opacity="0.85"/>
    <path d="M68 96 Q83 80 98 96 T128 96" stroke="${p}" stroke-width="6" fill="none" stroke-linecap="round"/>
    <rect x="14" y="90" width="22" height="22" rx="4" fill="${a}" opacity="0.7" transform="rotate(-15 25 101)"/>
  </svg>`;
  return izq + der;
}

/**
 * Fondo decorativo de página completa estilo "póster de fiesta 80's":
 * anillos de neón concéntricos en las esquinas + salpicaduras de pintura
 * dispersas, fijos detrás del contenido (position:fixed, z-index:-1) para
 * que se vean en todo el scroll, no solo en el hero. 100% SVG inline.
 */
function decoracionFondoPagina() {
  const colores = ["#ffde59", "#ff2e88", "#00e5ff", "#7ed957"];
  const anillos = (cx, cy) =>
    colores
      .map((c, i) => `<circle cx="${cx}" cy="${cy}" r="${34 + i * 22}" fill="none" stroke="${c}" stroke-width="3" opacity="${0.5 - i * 0.08}"/>`)
      .join("");

  const manchas = [
    { x: "8%", y: "14%", r: 5, c: "#ffde59" },
    { x: "88%", y: "22%", r: 7, c: "#ff2e88" },
    { x: "14%", y: "68%", r: 6, c: "#00e5ff" },
    { x: "82%", y: "78%", r: 5, c: "#7ed957" },
    { x: "50%", y: "40%", r: 4, c: "#ff2e88" },
    { x: "30%", y: "88%", r: 6, c: "#ffde59" },
  ]
    .map(
      (m) =>
        `<span style="position:absolute;left:${m.x};top:${m.y};width:${m.r * 2}px;height:${m.r * 2}px;border-radius:50%;background:${m.c};opacity:0.55;box-shadow:0 0 12px ${m.c};"></span>`
    )
    .join("");

  return `<div style="position:fixed;inset:0;z-index:-1;overflow:hidden;pointer-events:none;" aria-hidden="true">
    <svg style="position:absolute;top:-60px;left:-60px;" width="220" height="220" viewBox="0 0 220 220" xmlns="http://www.w3.org/2000/svg">${anillos(110, 110)}</svg>
    <svg style="position:absolute;bottom:-70px;right:-70px;" width="240" height="240" viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg">${anillos(120, 120)}</svg>
    ${manchas}
  </div>`;
}

/** Pequeño divisor ornamental dibujado en SVG (línea + rombo), sin depender de artes externas. */
function divisorOrnamental() {
  return `<svg class="divisor-ornamental" width="150" height="18" viewBox="0 0 150 18" fill="none" xmlns="http://www.w3.org/2000/svg">
    <line x1="0" y1="9" x2="58" y2="9" stroke="currentColor" stroke-width="1"/>
    <path d="M75 1 L83 9 L75 17 L67 9 Z" fill="currentColor"/>
    <line x1="92" y1="9" x2="150" y2="9" stroke="currentColor" stroke-width="1"/>
  </svg>`;
}

/** true si el hero debe usar el fondo oscuro "synthwave" (cumpleaños sin fotos propias). */
function usaHeroSintetico(evento, fotoFondo) {
  if (evento.tipo !== "cumpleanos" || fotoFondo) return false;
  const d = evento.decoracion;
  const tieneImagenes = d && (d.marco || d.esquinaSuperior || d.esquinaSuperiorDer || d.esquinaInferior || d.esquinaInferiorDer || d.ilustracion);
  return !tieneImagenes;
}

function renderCompuertaPassword(evento, tema, errorClave, fotoFondo) {
  const titulo = escapeHtml(evento.titulo || "Invitación");
  const decoracion = decoracionEsquinas(evento.decoracion, tema, evento.tipo);
  const heroInterno = `
    <div class="icono">${tema.icono}</div>
    <div class="hero-etiqueta">${escapeHtml(evento.etiquetaHero || tema.etiqueta)}</div>
    <h1>${titulo}</h1>
    <p class="hero-subtitulo">Esta invitación es privada. Ingresa la contraseña para verla.</p>`;

  const heroPlanaClase = usaHeroSintetico(evento, fotoFondo) ? "hero-plana hero-plana--sintetico" : "hero-plana";
  const hero = fotoFondo
    ? `<div class="hero-foto" style="background-image:url('${escapeHtml(fotoFondo)}')">${decoracion}<div class="hero-contenido">${heroInterno}</div></div>`
    : `<div class="${heroPlanaClase}">${decoracion}<div class="hero-contenido">${heroInterno}</div></div>`;

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
  const res = await fetch('/evento/${escapeHtml(evento.slug)}/clave', {
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
  const decoracion = decoracionEsquinas(evento.decoracion, tema, evento.tipo);
  const heroInterno = `
    <div class="icono">${tema.icono}</div>
    <div class="hero-etiqueta">${escapeHtml(evento.etiquetaHero || tema.etiqueta)}</div>
    <h1>${escapeHtml(evento.titulo || "")}</h1>
    ${evento.fotoFestejada ? `<div class="foto-festejada"><img src="${escapeHtml(evento.fotoFestejada)}" alt=""></div>` : ""}
    ${evento.subtitulo ? `<p class="hero-subtitulo">${escapeHtml(evento.subtitulo)}</p>` : ""}
    ${divisorOrnamental()}
    ${invitado ? `<div class="saludo-invitado">💌 Invitación especial para ${escapeHtml(invitado.nombre)}</div>` : ""}`;

  const heroPlanaClase = usaHeroSintetico(evento, fotoFondo) ? "hero-plana hero-plana--sintetico" : "hero-plana";
  const hero = fotoFondo
    ? `<div class="hero-foto" style="background-image:url('${escapeHtml(fotoFondo)}')">${decoracion}<div class="hero-contenido">${heroInterno}</div></div>`
    : `<div class="${heroPlanaClase}">${decoracion}<div class="hero-contenido">${heroInterno}</div></div>`;

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
  ${evento.modo === "lista" && evento.mostrarRSVP !== false ? seccionRSVP(evento, invitado) : ""}
  ${evento.mostrarQR !== false ? seccionQR() : ""}
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
  const fecha = formatearFechaEvento(evento.fechaEvento);

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
    <h2>Programa</h2>
    ${fecha ? `<div class="programa-fecha">${escapeHtml(fecha)}</div>` : ""}
    <div class="timeline">${filas}</div>
  </div>`;
}

/** Fecha del evento en español legible ("Sábado 10 de octubre de 2026"). */
function formatearFechaEvento(fechaISO) {
  if (!fechaISO) return "";
  const fecha = new Date(fechaISO);
  if (Number.isNaN(fecha.getTime())) return "";
  const texto = new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(fecha);
  return texto.charAt(0).toUpperCase() + texto.slice(1);
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

/** Extrae el ID de video de un link de YouTube (watch/shorts/youtu.be), o null si no aplica. */
function youtubeId(url) {
  const m = String(url || "").match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

function seccionGaleria(evento) {
  const items = Array.isArray(evento.galeria) ? evento.galeria.slice(0, 24) : [];
  if (items.length === 0) return "";

  const slides = items
    .map((item) => {
      const url = escapeHtml(item.url);
      if (item.tipo === "video") {
        const yt = youtubeId(item.url);
        if (yt) {
          const poster = escapeHtml(item.poster || `https://img.youtube.com/vi/${yt}/hqdefault.jpg`);
          return `<div class="carrusel-slide">
            <button type="button" class="galeria-item" data-tipo="youtube" data-id="${escapeHtml(yt)}">
              <img src="${poster}" alt="" loading="lazy">
              <span class="play-badge"><span>▶</span></span>
            </button>
          </div>`;
        }
        const poster = escapeHtml(item.poster || item.url);
        return `<div class="carrusel-slide">
          <button type="button" class="galeria-item" data-tipo="video" data-src="${url}">
            <img src="${poster}" alt="" loading="lazy">
            <span class="play-badge"><span>▶</span></span>
          </button>
        </div>`;
      }
      return `<div class="carrusel-slide">
        <button type="button" class="galeria-item" data-tipo="foto" data-src="${url}">
          <img src="${url}" alt="" loading="lazy">
        </button>
      </div>`;
    })
    .join("");

  const puntos = items.map((_, i) => `<span class="carrusel-punto${i === 0 ? " activo" : ""}"></span>`).join("");

  return `<div class="tarjeta">
    <div class="eyebrow">Galería</div>
    <h2>Momentos</h2>
    <div class="carrusel-wrap">
      <div class="carrusel" id="carrusel-galeria">${slides}</div>
    </div>
    ${items.length > 1
      ? `<div class="carrusel-flechas">
          <button type="button" class="carrusel-flecha" id="carrusel-prev" aria-label="Anterior">‹</button>
          <button type="button" class="carrusel-flecha" id="carrusel-next" aria-label="Siguiente">›</button>
        </div>
        <div class="carrusel-puntos" id="carrusel-puntos">${puntos}</div>`
      : ""}
  </div>
  <div class="lightbox" id="lightbox" hidden>
    <button type="button" class="lightbox-cerrar" id="lightbox-cerrar">✕</button>
    <div class="lightbox-contenido" id="lightbox-contenido"></div>
  </div>`;
}

/**
 * QR de la propia invitación (el link que el navegador ya tiene abierto),
 * para guardar o compartir. Se arma con JS del lado del cliente para no
 * necesitar el origin/URL absoluta desde el servidor.
 */
function seccionQR() {
  return `<div class="tarjeta">
    <div class="eyebrow">Comparte</div>
    <h2>Tu código QR</h2>
    <p class="qr-texto">Guárdalo o compártelo — abre directo esta invitación.</p>
    <div class="qr-wrap"><img id="qr-imagen" alt="Código QR de esta invitación"></div>
  </div>
  <script>
  (function() {
    var img = document.getElementById('qr-imagen');
    if (!img) return;
    img.src = 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=' + encodeURIComponent(window.location.href);
  })();
  </script>`;
}

function seccionMensaje(evento) {
  if (!evento.mensaje) return "";
  return `<div class="tarjeta"><p class="mensaje">${escapeHtml(evento.mensaje)}</p></div>`;
}

function seccionMusica(evento) {
  if (!evento.musicaUrl) return "";
  const etiqueta = `<span class="etiqueta-musica" id="etiqueta-musica">¡Dale play a la música! 🎶</span>`;

  const yt = youtubeId(evento.musicaUrl);
  if (yt) {
    const src = `https://www.youtube.com/embed/${escapeHtml(yt)}?enablejsapi=1&playsinline=1&controls=0&loop=1&playlist=${escapeHtml(yt)}`;
    return `<iframe id="yt-musica" src="${src}" allow="autoplay; encrypted-media" frameborder="0"
    style="position:fixed;bottom:0;right:0;width:2px;height:2px;opacity:0;pointer-events:none;" aria-hidden="true"></iframe>
  ${etiqueta}
  <button type="button" id="btn-musica" class="boton-musica">🎵</button>
  <script>
  (function() {
    var iframe = document.getElementById('yt-musica');
    var btn = document.getElementById('btn-musica');
    var etiquetaBtn = document.getElementById('etiqueta-musica');
    var sonando = false;
    function comando(func) {
      iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: func, args: [] }), '*');
    }
    btn.addEventListener('click', function() {
      if (sonando) { comando('pauseVideo'); btn.textContent = '🎵'; }
      else { comando('playVideo'); btn.textContent = '⏸'; }
      sonando = !sonando;
      btn.classList.toggle('musica-activa', sonando);
      if (etiquetaBtn) etiquetaBtn.remove();
    });
  })();
  </script>`;
  }

  return `<audio id="musica-evento" src="${escapeHtml(evento.musicaUrl)}" loop></audio>
  ${etiqueta}
  <button type="button" id="btn-musica" class="boton-musica">🎵</button>
  <script>
  (function() {
    var audio = document.getElementById('musica-evento');
    var btn = document.getElementById('btn-musica');
    var etiquetaBtn = document.getElementById('etiqueta-musica');
    var sonando = false;
    btn.addEventListener('click', function() {
      if (sonando) { audio.pause(); btn.textContent = '🎵'; }
      else { audio.play().catch(function(){}); btn.textContent = '⏸'; }
      sonando = !sonando;
      btn.classList.toggle('musica-activa', sonando);
      if (etiquetaBtn) etiquetaBtn.remove();
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
      var res = await fetch('/evento/${escapeHtml(evento.slug)}/rsvp', {
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

function scriptCarrusel() {
  return `<script>
(function() {
  var carrusel = document.getElementById('carrusel-galeria');
  if (!carrusel) return;
  var puntosWrap = document.getElementById('carrusel-puntos');
  var puntos = puntosWrap ? Array.prototype.slice.call(puntosWrap.children) : [];
  var prev = document.getElementById('carrusel-prev');
  var next = document.getElementById('carrusel-next');

  function anchoSlide() {
    var slide = carrusel.querySelector('.carrusel-slide');
    return slide ? slide.getBoundingClientRect().width + 12 : carrusel.clientWidth;
  }

  function actualizarPuntos() {
    if (!puntos.length) return;
    var indice = Math.round(carrusel.scrollLeft / anchoSlide());
    puntos.forEach(function(p, i) { p.classList.toggle('activo', i === indice); });
  }

  var raf = null;
  carrusel.addEventListener('scroll', function() {
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(actualizarPuntos);
  });

  if (prev) prev.addEventListener('click', function() {
    carrusel.scrollBy({ left: -anchoSlide(), behavior: 'smooth' });
  });
  if (next) next.addEventListener('click', function() {
    carrusel.scrollBy({ left: anchoSlide(), behavior: 'smooth' });
  });
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
      if (tipo === 'youtube') {
        var id = btn.getAttribute('data-id');
        contenido.innerHTML = '<div style="width:90vw;max-width:480px;aspect-ratio:16/9;">' +
          '<iframe width="100%" height="100%" style="border:0;border-radius:10px;" ' +
          'src="https://www.youtube.com/embed/' + id + '?autoplay=1" ' +
          'title="Video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" ' +
          'allowfullscreen></iframe></div>';
      } else {
        var src = btn.getAttribute('data-src');
        contenido.innerHTML = tipo === 'video'
          ? '<video src="' + src + '" controls autoplay playsinline></video>'
          : '<img src="' + src + '" alt="">';
      }
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
