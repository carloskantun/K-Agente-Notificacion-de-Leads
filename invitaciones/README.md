# Invitaciones Digitales — Cloudflare Workers

Landing page de invitación digital para bodas, XV años y aniversarios. Un solo Worker
multi-evento (a diferencia del agente de notificación de leads, que despliega un
Worker por cliente) — cada evento vive como un registro en Cloudflare KV bajo su
propio `slug`.

## Dos modos de invitación

| Modo | Cómo funciona |
|---|---|
| **`lista`** | Subes un CSV (`nombre,pases,correo`). Cada invitado recibe un código único (`?c=CODIGO`) para ver su invitación personalizada y confirmar asistencia (RSVP) indicando cuántos de sus pases usará. |
| **`password`** | Invitación genérica de solo lectura. Un único link + una contraseña compartida. Sin lista de invitados ni RSVP — solo controla quién puede *ver* el contenido. |

## Tres temas visuales

`tipo`: `"boda"` · `"xv"` · `"aniversario"` — cada uno con su propia paleta de colores,
tipografía y textos por defecto (ver `src/plantillas.js`). La paleta de colores de
cualquier tema se puede sobrescribir por evento con el campo `colores` (ver tabla
de campos abajo) para que combine con el arte real del cliente.

## Interactividad

- **Galería en carrusel**: fotos y video se muestran en un carrusel horizontal
  (swipe en móvil, flechas + puntos indicadores), tocar una tarjeta abre el
  lightbox a pantalla completa.
- **Código QR**: cada invitación muestra un QR de su propio link (útil para
  compartir o imprimir).
- **Saludo personalizado**: en modo `lista`, se muestra el nombre del invitado
  en el hero, no solo en el formulario de RSVP.
- **Botones con más presencia**: RSVP, "Cómo llegar" y el botón de música usan
  degradado con los dos colores del tema en vez de un color plano.

---

## Despliegue inicial

```bash
cd invitaciones
npm install

# 1. Crea el namespace de KV
npx wrangler kv namespace create INVITACIONES_KV
npx wrangler kv namespace create INVITACIONES_KV --preview

# 2. Crea el bucket R2 para fotos/video (portada + galería)
npx wrangler r2 bucket create invitaciones-media

# 3. Copia la plantilla y pega los IDs que te dio el comando de KV
cp wrangler.toml.template wrangler.toml
# Edita wrangler.toml: {{KV_NAMESPACE_ID}}, {{KV_NAMESPACE_PREVIEW_ID}}, {{EMAIL_FROM_DOMAIN}}

# 4. Carga los secrets
npx wrangler secret put ADMIN_TOKEN        # protege todas las rutas /admin/*
npx wrangler secret put SESSION_SECRET     # pepper de contraseñas + firma de cookies
npx wrangler secret put RESEND_API_KEY     # opcional, solo si algún evento usa email automático

# 5. Despliega
npx wrangler deploy
```

Para desarrollo local: `cp .dev.vars.example .dev.vars` (edita los valores) y
`npx wrangler dev`.

---

## Crear un evento

```bash
curl -X POST https://TU-WORKER.workers.dev/admin/eventos \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "juan-y-maria",
    "tipo": "boda",
    "modo": "lista",
    "titulo": "Juan & María",
    "subtitulo": "¡Nos casamos!",
    "fechaEvento": "2026-12-12T17:00:00-05:00",
    "lugarCeremonia": "Parroquia San José",
    "horaCeremonia": "17:00",
    "lugarRecepcion": "Salón Jardines del Mar",
    "horaRecepcion": "19:00",
    "codigoVestimenta": "Formal",
    "mensaje": "Con la bendición de Dios y nuestros padres, los invitamos a celebrar con nosotros.",
    "fotoPortada": "https://TU-WORKER.workers.dev/media/juan-y-maria/abc123-portada.jpg",
    "galeria": [
      { "tipo": "foto", "url": "https://TU-WORKER.workers.dev/media/juan-y-maria/abc123-portada.jpg" },
      { "tipo": "video", "url": "https://TU-WORKER.workers.dev/media/juan-y-maria/def456-video.mp4", "poster": "https://TU-WORKER.workers.dev/media/juan-y-maria/abc123-portada.jpg" }
    ],
    "itinerario": [
      { "hora": "17:00", "titulo": "Ceremonia", "descripcion": "Parroquia San José", "icono": "⛪" },
      { "hora": "19:00", "titulo": "Recepción", "descripcion": "Salón Jardines del Mar", "icono": "🥂" }
    ],
    "mapaCeremonia": "Parroquia San José, Cancún, Quintana Roo",
    "mapaRecepcion": "Salón Jardines del Mar, Cancún, Quintana Roo",
    "emailAutomatico": false
  }'
```

Volver a llamar `POST /admin/eventos` con el mismo `slug` actualiza el evento
(merge parcial — solo se sobrescriben los campos enviados).

### Campos del evento

| Campo | Requerido | Descripción |
|---|---|---|
| `slug` | sí | minúsculas, números, guiones. Es la URL del evento. |
| `tipo` | no (default `boda`) | `boda` \| `xv` \| `aniversario` — tema visual |
| `modo` | sí (al crear) | `lista` \| `password` |
| `titulo` | sí (al crear) | Título principal de la invitación |
| `clave` | solo si `modo=password` | Contraseña en texto plano — se hashea (PBKDF2) y nunca se devuelve |
| `fechaEvento` | no | ISO 8601 con zona horaria. Activa el countdown. |
| `mostrarCountdown` | no (default `true`) | |
| `fotoPortada` | no | URL de imagen de fondo del hero (ideal: subida vía `/admin/eventos/:slug/media`, ver abajo) |
| `fotoFestejada` | no | URL de foto circular (retrato) mostrada entre el nombre y el subtítulo del hero |
| `galeria` | no | Array `[{ tipo: "foto"\|"video", url, poster? }]` — se muestra en un carrusel (swipe/flechas) con lightbox. `poster` es la miniatura del video (si no se da: para YouTube se usa la miniatura oficial automática, para video normal se usa `url`). Un `video` cuyo `url` sea un link de YouTube (`youtube.com/watch?v=...`, `youtu.be/...`) se embebe automáticamente como iframe de YouTube en el lightbox. |
| `itinerario` | no | Array `[{ hora, titulo, descripcion?, icono? }]` — se muestra como línea de tiempo. Si se omite, se arma automáticamente con `lugarCeremonia`/`lugarRecepcion` (compatibilidad con eventos creados antes de este campo). |
| `mapaCeremonia` / `mapaRecepcion` | no | Dirección de texto (ej. `"Parroquia San José, Cancún"`) **o** un link completo de Google Maps (ej. `https://maps.app.goo.gl/...`). Con dirección de texto se embebe un mapa interactivo + botón "Cómo llegar"; con un link completo (no se puede embeber) solo se muestra el botón que abre ese link. No requiere API key de Google. |
| `lugarCeremonia`/`direccionCeremonia`/`horaCeremonia` | no | Usado para el itinerario automático si no defines `itinerario` |
| `lugarRecepcion`/`direccionRecepcion`/`horaRecepcion` | no | Ídem, segundo punto del itinerario automático |
| `codigoVestimenta` | no | |
| `mesaDeRegalos` | no | Texto libre (link o instrucciones) |
| `mensaje` | no | Mensaje/dedicatoria de los anfitriones (arriba del itinerario) |
| `dedicatoria` | no | `{ mensaje?, columnas: [{ etiqueta, personas: [] }] }` — sección tipo "Padres & Padrinos". Cada columna es una lista de nombres bajo una etiqueta itálica; si hay 2+ columnas se separan con "&". |
| `decoracion` | no | Imágenes PNG (idealmente transparentes) para decorar el hero: `marco` (una sola imagen que cubre todo el hero — ideal para un diseño de fondo completo generado en Canva/etc.), `esquinaSuperior`/`esquinaInferior` (se reflejan automáticamente al lado opuesto salvo que definas `esquinaSuperiorDer`/`esquinaInferiorDer`), `ilustracion` (se ancla abajo-derecha), `fondoTextura` (imagen de fondo de toda la página en vez del degradado del tema). Súbelas primero con `/admin/eventos/:slug/media`. |
| `colores` | no | `{ primario?, secundario?, acento?, texto?, gradiente?, tarjetaFondo? }` — sobrescribe la paleta del `tipo` campo por campo (ej. para que combine con el color real de las decoraciones). Cualquier campo omitido usa el valor por defecto del tema. |
| `musicaUrl` | no | URL de audio de fondo (botón play/pause, no autoplay) |
| `emailAutomatico` | no (default `false`), solo `modo=lista` | Si `true` y hay `RESEND_API_KEY`, envía el link por correo al importar el CSV |
| `emailAsunto` / `emailFromNombre` / `emailFromDomain` | no | Personalización del correo de invitación |

> **Sobre las decoraciones florales/ilustradas** (como en invitaciones tipo Canva con
> flores, vestido, tiara, mariposas): el sistema soporta capas de imagen (`decoracion`)
> para lograr ese efecto, pero esas ilustraciones en sí (acuarelas, flores, vestidos)
> son arte con licencia — no vienen incluidas. Consíguelas como PNG transparente (Etsy,
> Creative Fabrica, Canva "elementos" exportados como PNG, o encárgalas a un diseñador),
> súbelas con el endpoint de media de abajo, y colócalas en `decoracion`. Mientras tanto,
> cada tema (`boda`/`xv`/`aniversario`) trae un diseño elegante por defecto sin necesitar
> ninguna imagen extra.

---

## Subir fotos y video (portada + galería)

Las fotos y videos se suben directo al Worker, que los guarda en un bucket R2
propio y los sirve desde `/media/:slug/:archivo`. No necesitas ningún hosting
externo.

```bash
curl -X POST https://TU-WORKER.workers.dev/admin/eventos/juan-y-maria/media \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: image/jpeg" \
  -H "X-Filename: portada.jpg" \
  --data-binary @portada.jpg
```

Respuesta:

```json
{ "success": true, "tipo": "foto", "url": "https://TU-WORKER.workers.dev/media/juan-y-maria/a1b2c3d4-portada.jpg", "archivo": "a1b2c3d4-portada.jpg" }
```

Usa esa `url` en `fotoPortada` o dentro de `galeria` al crear/actualizar el evento.
Mismo endpoint sirve para video, solo cambia `Content-Type` (`video/mp4`, `video/webm`
o `video/quicktime`) — el Worker detecta el tipo automáticamente.

- **Tipos permitidos:** `image/jpeg`, `image/png`, `image/webp`, `image/gif`, `video/mp4`, `video/webm`, `video/quicktime`.
- **Límites de tamaño:** 15MB por foto, 100MB por video.
- **Borrar un archivo:** `DELETE /admin/eventos/:slug/media/:archivo` (mismo Authorization).

### Importar un archivo desde una URL (ej. un link de exportación de Canva)

Si la imagen ya vive en algún lugar público (Canva, Google Drive con link
público, etc.), el Worker la puede descargar y guardar en R2 él mismo, sin
que tengas que bajarla y volver a subirla:

```bash
curl -X POST https://TU-WORKER.workers.dev/admin/eventos/juan-y-maria/media/importar-url \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "url": "https://ejemplo.com/mi-diseno.png", "filename": "marco.png" }'
```

Misma respuesta y mismos límites que la subida directa. Nota: esto requiere
que el Worker (no tu computadora) pueda alcanzar esa URL — en producción
funciona con cualquier URL pública normal.

---

## Modo `lista` — importar invitados por CSV

```bash
curl -X POST https://TU-WORKER.workers.dev/admin/eventos/juan-y-maria/csv \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: text/csv" \
  --data-binary $'nombre,pases,correo\nCarlos Ramírez,2,carlos@example.com\nLucía Torres,1,'
```

Formato del CSV: **`nombre,pases,correo`** (con o sin fila de encabezado; `correo`
es opcional). El endpoint responde con el código único y el link generado para
cada invitado:

```json
{
  "success": true,
  "total": 2,
  "emailAutomatico": false,
  "importados": [
    { "nombre": "Carlos Ramírez", "correo": "carlos@example.com", "pases": 2,
      "codigo": "A1B2C3D4", "link": "https://TU-WORKER.workers.dev/evento/juan-y-maria?c=A1B2C3D4",
      "emailEnviado": false }
  ]
}
```

- **Si `emailAutomatico` es `false`** (o no hay `RESEND_API_KEY`): copia y envía los
  `link` manualmente (WhatsApp, correo personal, etc.) — esto siempre funciona,
  sin costo.
- **Si `emailAutomatico` es `true`**: además del link generado, el Worker envía
  automáticamente un correo con ese link a cada invitado que tenga `correo`.

> Ambas opciones conviven en el mismo evento — `emailAutomatico` es simplemente
> el flag que activa el envío automático (pensado para gatearse según lo que
> el cliente haya contratado).

Cada invitado ve su invitación en `/evento/juan-y-maria?c=A1B2C3D4`, con su
nombre, sus pases asignados y un formulario para confirmar sí/no y cuántos
pases usará.

### Consultar y exportar RSVPs

```bash
# JSON con resumen (confirmados/declinados/pendientes) + detalle por invitado
curl https://TU-WORKER.workers.dev/admin/eventos/juan-y-maria/invitados \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# CSV descargable con el mismo detalle
curl https://TU-WORKER.workers.dev/admin/eventos/juan-y-maria/invitados.csv \
  -H "Authorization: Bearer $ADMIN_TOKEN" -o invitados.csv
```

---

## Modo `password` — invitación genérica protegida

```bash
curl -X POST https://TU-WORKER.workers.dev/admin/eventos \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "bodas-de-plata",
    "tipo": "aniversario",
    "modo": "password",
    "titulo": "25 Años Juntos",
    "clave": "familia2026"
  }'
```

Comparte `https://TU-WORKER.workers.dev/evento/bodas-de-plata` — cualquiera con
el link ve una compuerta de contraseña; sin la contraseña correcta no se
muestra ningún dato del evento. Al acertar, se guarda una cookie de sesión
firmada (HMAC, 12 horas) para no pedirla en cada visita.

---

## Endpoints

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/health` | — | Monitoreo |
| GET | `/evento/:slug` | — | Página de la invitación |
| POST | `/evento/:slug/clave` | — | `{ clave }` — desbloquea modo password |
| POST | `/evento/:slug/rsvp` | — | `{ codigo, asistencia: "si"|"no", pases }` — modo lista |
| POST | `/admin/eventos` | Bearer | Crea/actualiza evento |
| GET | `/admin/eventos/:slug` | Bearer | Config del evento |
| DELETE | `/admin/eventos/:slug` | Bearer | Elimina evento + invitados |
| POST | `/admin/eventos/:slug/csv` | Bearer | Importa invitados (CSV en el body) |
| GET | `/admin/eventos/:slug/invitados` | Bearer | Lista + resumen de RSVPs (JSON) |
| GET | `/admin/eventos/:slug/invitados.csv` | Bearer | Exporta RSVPs (CSV) |
| POST | `/admin/eventos/:slug/media` | Bearer | Sube una foto/video (body binario, ver arriba) |
| DELETE | `/admin/eventos/:slug/media/:archivo` | Bearer | Elimina un archivo de R2 |
| GET | `/media/:slug/:archivo` | — | Sirve el archivo subido |

Prueba rápida end-to-end: `BASE_URL=http://localhost:8787 ADMIN_TOKEN=dev-token bash test/test-invitacion.sh`
(con `npx wrangler dev` corriendo en otra terminal).

---

## Seguridad

- Las contraseñas de invitación se guardan como hash PBKDF2 (100k iteraciones,
  salt aleatorio) — nunca en texto plano.
- Las sesiones del modo `password` son cookies `HttpOnly` firmadas con HMAC-SHA256
  (`SESSION_SECRET`), no reutilizables entre eventos.
- Todas las rutas `/admin/*` requieren `Authorization: Bearer $ADMIN_TOKEN`.
- Todo el contenido dinámico (nombres, mensajes, direcciones) se escapa antes de
  insertarse en el HTML.
- Ningún secret vive en `wrangler.toml` — todos se cargan con `wrangler secret put`.
