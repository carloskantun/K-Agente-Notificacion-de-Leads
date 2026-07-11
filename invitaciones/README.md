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
tipografía y textos por defecto (ver `src/plantillas.js`).

---

## Despliegue inicial

```bash
cd invitaciones
npm install

# 1. Crea el namespace de KV
npx wrangler kv namespace create INVITACIONES_KV
npx wrangler kv namespace create INVITACIONES_KV --preview

# 2. Copia la plantilla y pega los IDs que te dio el comando anterior
cp wrangler.toml.template wrangler.toml
# Edita wrangler.toml: {{KV_NAMESPACE_ID}}, {{KV_NAMESPACE_PREVIEW_ID}}, {{EMAIL_FROM_DOMAIN}}

# 3. Carga los secrets
npx wrangler secret put ADMIN_TOKEN        # protege todas las rutas /admin/*
npx wrangler secret put SESSION_SECRET     # pepper de contraseñas + firma de cookies
npx wrangler secret put RESEND_API_KEY     # opcional, solo si algún evento usa email automático

# 4. Despliega
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
    "fotos": ["https://ejemplo.com/foto1.jpg"],
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
| `lugarCeremonia`/`direccionCeremonia`/`horaCeremonia` | no | Evento principal |
| `lugarRecepcion`/`direccionRecepcion`/`horaRecepcion` | no | Segundo evento (recepción/fiesta) |
| `codigoVestimenta` | no | |
| `mesaDeRegalos` | no | Texto libre (link o instrucciones) |
| `mensaje` | no | Mensaje/dedicatoria de los anfitriones |
| `fotos` | no | Array de URLs de imágenes (galería, máx. 8) |
| `musicaUrl` | no | URL de audio de fondo (botón play/pause, no autoplay) |
| `emailAutomatico` | no (default `false`), solo `modo=lista` | Si `true` y hay `RESEND_API_KEY`, envía el link por correo al importar el CSV |
| `emailAsunto` / `emailFromNombre` / `emailFromDomain` | no | Personalización del correo de invitación |

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
