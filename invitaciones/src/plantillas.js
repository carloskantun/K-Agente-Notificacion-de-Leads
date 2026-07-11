/**
 * =============================================================================
 * PLANTILLAS — Invitaciones Digitales
 * =============================================================================
 * Tres temas visuales (boda, XV años, aniversario) sobre un mismo esqueleto
 * de página: hero, countdown, detalles del evento, galería, mensaje y
 * RSVP (modo lista) o compuerta de contraseña (modo password).
 *
 * Todo el contenido dinámico se escapa con escapeHtml antes de insertarse.
 */

import { escapeHtml } from "./utilidades.js";

const TEMAS = {
  boda: {
    etiqueta: "¡Nos casamos!",
    icono: "💍",
    separador: "❧",
    fuenteTitulo: "'Playfair Display', Georgia, 'Times New Roman', serif",
    fuenteTexto: "Georgia, 'Times New Roman', serif",
    colorPrimario: "#8a6d3b",
    colorSecundario: "#f4ede1",
    colorAcento: "#c9a15a",
    colorTexto: "#3a2f22",
    gradiente: "linear-gradient(160deg, #faf6ef 0%, #f0e6d2 55%, #e8d9b8 100%)",
    tarjetaFondo: "rgba(255,255,255,0.72)",
    etiquetaPrincipal: "Ceremonia",
    etiquetaSecundaria: "Recepción",
  },
  xv: {
    etiqueta: "Mis XV Años",
    icono: "👑",
    separador: "✦",
    fuenteTitulo: "'Great Vibes', 'Brush Script MT', cursive",
    fuenteTexto: "'Poppins', Verdana, sans-serif",
    colorPrimario: "#b0246c",
    colorSecundario: "#fdf0f6",
    colorAcento: "#e191b8",
    colorTexto: "#4a1230",
    gradiente: "linear-gradient(160deg, #fff5fa 0%, #fbe1ee 50%, #f6c9de 100%)",
    tarjetaFondo: "rgba(255,255,255,0.75)",
    etiquetaPrincipal: "Misa",
    etiquetaSecundaria: "Fiesta",
  },
  aniversario: {
    etiqueta: "Celebrando nuestro amor",
    icono: "🥂",
    separador: "♥",
    fuenteTitulo: "'Cormorant Garamond', Georgia, serif",
    fuenteTexto: "Verdana, Geneva, sans-serif",
    colorPrimario: "#7a1f2b",
    colorSecundario: "#fbeeea",
    colorAcento: "#c65b45",
    colorTexto: "#3a1210",
    gradiente: "linear-gradient(160deg, #fff8f5 0%, #fbe3da 50%, #f3c9b8 100%)",
    tarjetaFondo: "rgba(255,255,255,0.72)",
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

  const mostrarContenido = evento.modo === "lista" ? true : !!desbloqueado;

  let cuerpo;
  if (evento.modo === "password" && !desbloqueado) {
    cuerpo = renderCompuertaPassword(evento, tema, errorClave);
  } else if (evento.modo === "lista" && codigoInvalido) {
    cuerpo = renderInvitacionNoEncontrada(evento, tema);
  } else {
    cuerpo = renderContenidoEvento(evento, tema, invitado);
  }

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${titulo}</title>
<meta name="robots" content="noindex, nofollow">
${estilos(tema)}
</head>
<body>
${cuerpo}
${mostrarContenido && evento.mostrarCountdown !== false && evento.fechaEvento ? scriptCountdown(evento.fechaEvento) : ""}
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// ESTILOS
// ---------------------------------------------------------------------------

function estilos(tema) {
  return `<style>
  :root {
    --primario: ${tema.colorPrimario};
    --secundario: ${tema.colorSecundario};
    --acento: ${tema.colorAcento};
    --texto: ${tema.colorTexto};
    --tarjeta: ${tema.tarjetaFondo};
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    min-height: 100vh;
    background: ${tema.gradiente};
    font-family: ${tema.fuenteTexto};
    color: var(--texto);
    display: flex;
    justify-content: center;
    padding: 0 0 48px;
  }
  .contenedor { width: 100%; max-width: 640px; padding: 0 20px; }
  .hero {
    text-align: center;
    padding: 64px 16px 32px;
  }
  .hero .icono { font-size: 2.6rem; }
  .hero h1 {
    font-family: ${tema.fuenteTitulo};
    font-size: clamp(2.2rem, 7vw, 3.4rem);
    color: var(--primario);
    margin: 8px 0 4px;
  }
  .hero .etiqueta {
    letter-spacing: 0.14em;
    text-transform: uppercase;
    font-size: 0.8rem;
    color: var(--acento);
    margin-bottom: 6px;
  }
  .hero .subtitulo { font-size: 1.05rem; opacity: 0.85; }
  .separador {
    text-align: center;
    color: var(--acento);
    font-size: 1.2rem;
    margin: 8px 0 28px;
    letter-spacing: 0.5em;
  }
  .tarjeta {
    background: var(--tarjeta);
    border: 1px solid rgba(0,0,0,0.06);
    border-radius: 18px;
    padding: 28px 24px;
    margin-bottom: 24px;
    backdrop-filter: blur(4px);
    box-shadow: 0 10px 30px rgba(0,0,0,0.06);
  }
  .tarjeta h2 {
    font-family: ${tema.fuenteTitulo};
    color: var(--primario);
    margin-top: 0;
    font-size: 1.5rem;
  }
  .countdown {
    display: flex;
    justify-content: center;
    gap: 14px;
    margin: 24px 0;
    flex-wrap: wrap;
  }
  .countdown .bloque {
    background: var(--primario);
    color: #fff;
    border-radius: 12px;
    padding: 12px 16px;
    min-width: 70px;
    text-align: center;
  }
  .countdown .bloque .numero { font-size: 1.6rem; font-weight: 700; display: block; }
  .countdown .bloque .etiqueta { font-size: 0.7rem; text-transform: uppercase; opacity: 0.85; }
  .detalle-fila { display: flex; gap: 12px; margin-bottom: 14px; align-items: flex-start; }
  .detalle-fila .icono-detalle { font-size: 1.3rem; }
  .detalle-fila .titulo-detalle { font-weight: 600; color: var(--primario); }
  .detalle-fila .texto-detalle { opacity: 0.9; line-height: 1.4; }
  .galeria {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 10px;
    margin-bottom: 24px;
  }
  .galeria img {
    width: 100%;
    height: 160px;
    object-fit: cover;
    border-radius: 12px;
  }
  .mensaje { text-align: center; font-style: italic; line-height: 1.6; }
  form.rsvp, form.clave { display: flex; flex-direction: column; gap: 14px; }
  label { font-weight: 600; font-size: 0.9rem; }
  input[type="text"], input[type="password"], input[type="number"], select {
    padding: 10px 12px;
    border-radius: 10px;
    border: 1px solid rgba(0,0,0,0.15);
    font-size: 1rem;
    font-family: inherit;
  }
  .opciones-asistencia { display: flex; gap: 12px; }
  .opciones-asistencia label {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 6px;
    background: rgba(0,0,0,0.03);
    padding: 10px 12px;
    border-radius: 10px;
    cursor: pointer;
    font-weight: 500;
  }
  button {
    background: var(--primario);
    color: #fff;
    border: none;
    padding: 13px;
    border-radius: 12px;
    font-size: 1rem;
    cursor: pointer;
    font-weight: 600;
  }
  button:hover { filter: brightness(1.08); }
  .estado {
    text-align: center;
    padding: 10px;
    border-radius: 10px;
    font-weight: 600;
    margin-bottom: 14px;
  }
  .estado.si { background: #e3f6e3; color: #226622; }
  .estado.no { background: #f8e3e3; color: #7a2222; }
  .error { color: #a02020; font-size: 0.9rem; text-align: center; }
  .footer { text-align: center; opacity: 0.6; font-size: 0.8rem; margin-top: 32px; }
  .no-encontrada { text-align: center; padding: 80px 16px; }
</style>`;
}

// ---------------------------------------------------------------------------
// SECCIONES
// ---------------------------------------------------------------------------

function renderCompuertaPassword(evento, tema, errorClave) {
  const titulo = escapeHtml(evento.titulo || "Invitación");
  return `<div class="contenedor">
  <div class="hero">
    <div class="icono">${tema.icono}</div>
    <div class="etiqueta">${escapeHtml(tema.etiqueta)}</div>
    <h1>${titulo}</h1>
    <p class="subtitulo">Esta invitación es privada. Ingresa la contraseña para verla.</p>
  </div>
  <div class="tarjeta">
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

function renderContenidoEvento(evento, tema, invitado) {
  return `<div class="contenedor">
  ${seccionHero(evento, tema)}
  ${seccionCountdown(evento)}
  ${seccionDetalles(evento, tema)}
  ${seccionGaleria(evento)}
  ${seccionMensaje(evento)}
  ${evento.modo === "lista" ? seccionRSVP(evento, invitado) : ""}
  ${seccionMusica(evento)}
  <div class="footer">Hecho con ${tema.icono} para ${escapeHtml(evento.titulo || "este evento")}</div>
</div>`;
}

function seccionHero(evento, tema) {
  return `<div class="hero">
    <div class="icono">${tema.icono}</div>
    <div class="etiqueta">${escapeHtml(tema.etiqueta)}</div>
    <h1>${escapeHtml(evento.titulo || "")}</h1>
    ${evento.subtitulo ? `<p class="subtitulo">${escapeHtml(evento.subtitulo)}</p>` : ""}
  </div>
  <div class="separador">${tema.separador} ${tema.separador} ${tema.separador}</div>`;
}

function seccionCountdown(evento) {
  if (evento.mostrarCountdown === false || !evento.fechaEvento) return "";
  return `<div class="countdown" id="countdown">
    <div class="bloque"><span class="numero" id="cd-dias">--</span><span class="etiqueta">Días</span></div>
    <div class="bloque"><span class="numero" id="cd-horas">--</span><span class="etiqueta">Horas</span></div>
    <div class="bloque"><span class="numero" id="cd-min">--</span><span class="etiqueta">Min</span></div>
    <div class="bloque"><span class="numero" id="cd-seg">--</span><span class="etiqueta">Seg</span></div>
  </div>`;
}

function seccionDetalles(evento, tema) {
  const filas = [];

  if (evento.lugarCeremonia || evento.horaCeremonia) {
    filas.push(filaDetalle("📍", tema.etiquetaPrincipal, [
      evento.lugarCeremonia,
      evento.direccionCeremonia,
      evento.horaCeremonia ? `Hora: ${evento.horaCeremonia}` : null,
    ]));
  }

  if (evento.lugarRecepcion || evento.horaRecepcion) {
    filas.push(filaDetalle("🥂", tema.etiquetaSecundaria, [
      evento.lugarRecepcion,
      evento.direccionRecepcion,
      evento.horaRecepcion ? `Hora: ${evento.horaRecepcion}` : null,
    ]));
  }

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

function seccionGaleria(evento) {
  const fotos = Array.isArray(evento.fotos) ? evento.fotos.slice(0, 8) : [];
  if (fotos.length === 0) return "";
  const imgs = fotos
    .map((url) => `<img src="${escapeHtml(url)}" alt="Foto del evento" loading="lazy">`)
    .join("");
  return `<div class="galeria">${imgs}</div>`;
}

function seccionMensaje(evento) {
  if (!evento.mensaje) return "";
  return `<div class="tarjeta"><p class="mensaje">${escapeHtml(evento.mensaje)}</p></div>`;
}

function seccionMusica(evento) {
  if (!evento.musicaUrl) return "";
  return `<audio id="musica-evento" src="${escapeHtml(evento.musicaUrl)}" loop></audio>
  <button type="button" id="btn-musica" style="position:fixed;bottom:20px;right:20px;border-radius:50%;width:52px;height:52px;padding:0;z-index:10;">🎵</button>
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
    <h2>Confirma tu asistencia</h2>
    <p>Hola <strong>${escapeHtml(invitado.nombre)}</strong>, tienes <strong>${invitado.pases}</strong> ${invitado.pases === 1 ? "pase" : "pases"} asignado${invitado.pases === 1 ? "" : "s"}.</p>
    ${estadoHtml}
    <form class="rsvp" id="form-rsvp">
      <div class="opciones-asistencia">
        <label><input type="radio" name="asistencia" value="si" ${invitado.confirmado === true ? "checked" : ""} required> Sí asistiré</label>
        <label><input type="radio" name="asistencia" value="no" ${invitado.confirmado === false ? "checked" : ""}> No podré ir</label>
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
    form.querySelectorAll('input[name="asistencia"]').forEach(function(input) {
      input.addEventListener('change', function() {
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
