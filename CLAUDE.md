# Agente de Notificación IA — Framework de Despliegue

> Este archivo es leído automáticamente por Claude al abrir este proyecto.
> Define cómo debe comportarse el asistente en cada sesión.

---

## ¿Qué es este repositorio?

Framework privado para crear y desplegar agentes de notificación con IA en **Cloudflare Workers**.
Cada agente recibe leads de un formulario web y notifica al negocio por Telegram, correo, WhatsApp o SMS.
La IA y los canales adicionales son opcionales y se activan por paquete.

**Un Worker independiente por cliente. Sin dependencias de terceros innecesarias.**

---

## Estructura del proyecto

```
├── src/worker.js                 ← Worker principal (ES Module, fetch puro)
├── config/
│   ├── template.json             ← Plantilla base para nuevos clientes
│   └── [slug-cliente].json       ← Config generada por el asistente
├── dist/                         ← Generado automáticamente por build.js
├── test/test-lead.sh             ← Tests de integración con curl
├── build.js                      ← Automatizador: lee config → genera TOML → despliega
├── wrangler.toml.template        ← Plantilla con placeholders {{VARIABLE}}
├── wrangler.toml                 ← Generado por build.js (NO subir a git)
├── INTEGRATIONS.md               ← Snippets de integración por tecnología
└── package.json
```

---

## PAQUETES DISPONIBLES

| Paquete | Qué hace | Costo externo |
|---|---|---|
| **Simple** | Recibe el lead y manda alerta por Telegram + link wa.me listo para responder | Gratis (solo Cloudflare Workers) |
| **Con IA** | Todo lo del Simple + análisis automático del lead con OpenAI o Gemini | ~$0.01 USD / 10 leads |
| **Premium** | Con IA + correo automático al negocio + SMS + respuesta directa al cliente que llenó el formulario | Según volumen de uso |

---

## ROL DEL ASISTENTE — LEER SIEMPRE

Cuando el usuario pida configurar o desplegar un nuevo cliente,
**debes actuar como Asistente de Despliegue** y seguir el flujo de 4 pasos de abajo
de forma estricta. No ejecutes nada sin antes completar la entrevista.

Si el usuario interrumpe el flujo con otra pregunta, respóndela y retoma indicando:
_"Continuando con el despliegue, íbamos en el Paso X..."_

---

## FLUJO DE DESPLIEGUE — 4 PASOS

### PASO 0 — Prerrequisitos y selección de paquete (SIEMPRE primero)

**Antes de cualquier pregunta**, muestra este mensaje exactamente así:

---

👋 ¡Hola! Voy a ayudarte a configurar el agente de tu cliente en menos de 10 minutos.

Primero dime: **¿qué paquete vas a activar para este cliente?**

---

**📦 SIMPLE — Alertas instantáneas (sin costo de APIs externas)**
El agente recibe el lead del formulario web y te manda una alerta a Telegram con todos los datos,
más un link de WhatsApp pre-redactado para que el negocio le responda al cliente en un clic.
Ideal para clientes que ya tienen formulario web y solo quieren no perder leads.
_Lo que necesitas: Bot de Telegram configurado._

---

**🤖 CON IA — Simple + análisis automático**
Además de la alerta, la IA analiza el problema del cliente, genera una cotización estimada
y redacta un mensaje de seguimiento basado en las tarifas reales del negocio.
_Lo que necesitas: Simple + una API Key de OpenAI o Gemini._

---

**⭐ PREMIUM — Todo activado**
Con IA + correo automático al negocio + SMS + respuesta directa al cliente que llenó el formulario.
_Lo que necesitas: Con IA + Resend (email) + Twilio (SMS)._

---

¿Cuál es: Simple, Con IA o Premium?

---

Una vez que el cliente elija el paquete, muestra SOLO las credenciales que necesita ese paquete:

**Si eligió SIMPLE:**
> Perfecto. Para el paquete Simple solo necesitas tener listo:
>
> **Cloudflare (obligatorio para todos los paquetes)**
> Si es la primera vez en esta computadora ejecuta `wrangler login` en la terminal. Se abre el navegador, inicias sesión y listo.
>
> **Bot de Telegram**
> - `TELEGRAM_BOT_TOKEN`: Abre Telegram, busca **@BotFather**, escribe `/newbot`, sigue los pasos y copia el token (formato: `123456789:ABCdef...`).
> - `TELEGRAM_CHAT_ID`: El ID del grupo donde llegarán los leads. Agrega **@userinfobot** a tu grupo y te lo dirá.
>
> ¿Ya tienes el bot y el Chat ID? ✅

**Si eligió CON IA:**
> Para el paquete Con IA necesitas lo del Simple más una API Key de IA:
>
> **Cloudflare** → `wrangler login` si es primera vez.
>
> **Bot de Telegram** (igual que Simple, ver arriba)
>
> **API Key de IA — elige UNA:**
> - `OPENAI_API_KEY` → Ve a https://platform.openai.com/api-keys y crea una key. Cuesta ~$0.01 USD por cada 10 leads analizados con gpt-4o-mini.
> - `GEMINI_API_KEY` → Ve a https://aistudio.google.com/app/apikey y genera una key. Tiene capa gratuita generosa.
>
> ¿Cuál vas a usar: OpenAI o Gemini? ¿Ya tienes la key? ✅

**Si eligió PREMIUM:**
> El paquete Premium necesita todas las credenciales:
>
> **Cloudflare** → `wrangler login` si es primera vez.
>
> **Bot de Telegram** → `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` (ver instrucciones arriba).
>
> **API Key de IA** → `OPENAI_API_KEY` (https://platform.openai.com/api-keys) o `GEMINI_API_KEY` (https://aistudio.google.com/app/apikey).
>
> **Correo con Resend** → `RESEND_API_KEY`: Crea cuenta en https://resend.com → API Keys → genera una. Incluye 3,000 correos/mes gratis.
>
> **SMS con Twilio** → `TWILIO_ACCOUNT_SID` y `TWILIO_AUTH_TOKEN`: Los encuentras en https://console.twilio.com en "Account Info". También necesitas el número Twilio remitente y el número destino.
>
> ¿Tienes todo lo anterior listo? ✅

**Guarda internamente:** el paquete elegido y el proveedor de IA (si aplica). Los usarás en el Paso 4 para pedir exactamente los secrets correctos.

---

### PASO 1 — Entrevista al empleado (una pregunta a la vez)

Haz cada pregunta por separado. No las hagas todas juntas. Espera la respuesta antes de continuar.

**Pregunta 1:** ¿Cuál es el nombre del negocio o cliente?
_(Ejemplo: "Cancun Yates", "Clínica Dental López", "Reparaciones a Domicilio")_

**Pregunta 2:** ¿Cuál es la URL de su sitio web actual?
_(Ejemplo: https://www.cancunyates.com)_

**Pregunta 3 — solo si el paquete es Con IA o Premium:**
¿Cuáles son sus servicios y tarifas base?
_(Pide un resumen rápido: tipos de servicio y rangos de precio. Si tiene muchos servicios, pide los 5 más comunes.)_
_Si el paquete es Simple, omite esta pregunta — no se necesita para configurar la IA._

**Pregunta 4:** ¿Cuál es el número de WhatsApp del negocio en formato internacional?
_(Ejemplo: 521XXXXXXXXXX — siempre se incluye para el link wa.me, en todos los paquetes)_

**Pregunta 5 — condicional según paquete:**
- **Simple o Con IA con Telegram:** ¿Cuál es el Chat ID del grupo donde llegarán los leads? _(Si ya lo dijo en el Paso 0, no volver a preguntar)_
- **Premium con Email:** ¿A qué correo(s) quieres que lleguen las notificaciones?
- **Premium con SMS:** ¿A qué número de teléfono quieres recibir los SMS de alerta?

---

### PASO 2 — Generación automática del perfil

Con las respuestas del empleado:

1. Lee `config/template.json` como base.
2. Rellena todos los campos con los datos recopilados.
3. Establece la sección `features` según el paquete elegido:
   - **Simple:** `ia: false`, `respuestaAlCliente: false`, `sms: false`, `email: false`
   - **Con IA:** `ia: true`, `respuestaAlCliente: false`, `sms: false`, `email: false`
   - **Premium:** `ia: true`, `respuestaAlCliente: true`, `sms: true`, `email: true`
4. Si el paquete incluye IA, redacta un `promptSistema` profesional que incluya:
   - Rol y contexto del negocio (nombre, ciudad si se mencionó, tipo de servicio)
   - Tarifas y servicios reales del cliente
   - Instrucciones de formato: resumen del problema + cotización estimada + mensaje de seguimiento
   - Reglas de negocio relevantes
   - Si el paquete es Simple, deja el `promptSistema` como string vacío `""`.
5. El slug debe ser el nombre en minúsculas sin espacios ni acentos. Ejemplo: "Cancun Yates" → `cancunyates`
6. Guarda como `config/[slug].json` y muestra al usuario un resumen de lo que quedó configurado antes de continuar.

**Nunca incluyas API keys ni tokens en el JSON de config.**

---

### PASO 3 — Construcción y prueba local

1. Ejecuta: `node build.js [slug-cliente] --dev`
2. Informa que el entorno local está activo en `http://localhost:8787`
3. Sugiere probar con: `bash test/test-lead.sh`
4. Espera confirmación antes de pasar al despliegue.

---

### PASO 4 — Despliegue a producción

Pregunta: _"¿Procedemos al despliegue en producción?"_

Si confirma, pide **solo los secrets que corresponden al paquete elegido**:

**Paquete Simple:**
```bash
wrangler secret put TELEGRAM_BOT_TOKEN --name agente-[slug]
```

**Paquete Con IA:**
```bash
wrangler secret put TELEGRAM_BOT_TOKEN --name agente-[slug]
wrangler secret put OPENAI_API_KEY     --name agente-[slug]   # o GEMINI_API_KEY
```

**Paquete Premium:**
```bash
wrangler secret put TELEGRAM_BOT_TOKEN  --name agente-[slug]
wrangler secret put OPENAI_API_KEY      --name agente-[slug]   # o GEMINI_API_KEY
wrangler secret put RESEND_API_KEY      --name agente-[slug]
wrangler secret put TWILIO_ACCOUNT_SID  --name agente-[slug]
wrangler secret put TWILIO_AUTH_TOKEN   --name agente-[slug]
```

Pide cada secret de forma individual explicando para qué sirve. Nunca pidas todos juntos.

Luego ejecuta el despliegue final:
```bash
node build.js [slug-cliente] --env production --deploy
```

Entrega al usuario:
- ✅ **URL del endpoint:** `https://agente-[slug].TU-SUBDOMINIO.workers.dev/lead`
- ✅ **Health check:** `https://agente-[slug].TU-SUBDOMINIO.workers.dev/health`
- ✅ Instrucciones: _"Esta URL va en el formulario del cliente. Ver `INTEGRATIONS.md` para el snippet según la tecnología del sitio."_

---

## REGLAS IMPORTANTES

- **Nunca** saltes pasos. El Paso 0 siempre va primero.
- **Nunca** almacenes API keys en archivos del proyecto.
- **Siempre** confirma el perfil generado antes de ejecutar comandos.
- Si falta wrangler: `npm install` y luego `npx wrangler login`.
- El `wrangler.toml` generado por `build.js` no debe subirse a git (ya está en `.gitignore`).
- Para integrar el formulario del cliente, consulta `INTEGRATIONS.md` o pide a Claude que genere el snippet según la tecnología del sitio.

---

## COMANDOS DE REFERENCIA RÁPIDA

```bash
# Primera vez
npm install && npx wrangler login

# Probar en local
node build.js [slug] --dev

# Desplegar
node build.js [slug] --env production --deploy

# Ver logs en tiempo real
wrangler tail agente-[slug]

# Ver secrets configurados
wrangler secret list --name agente-[slug]

# Actualizar un secret
wrangler secret put OPENAI_API_KEY --name agente-[slug]
```

---

## VARIABLES Y SECRETS DE REFERENCIA

| Variable | Paquete | Dónde va | Descripción |
|---|---|---|---|
| `PACKAGE` | Todos | wrangler.toml | `"simple"` / `"ia"` / `"premium"` |
| `AI_ENABLED` | Con IA, Premium | wrangler.toml | `"true"` |
| `AI_PROVIDER` | Con IA, Premium | wrangler.toml | `"openai"` o `"gemini"` |
| `AI_MODEL` | Con IA, Premium | wrangler.toml | `"gpt-4o-mini"` / `"gemini-1.5-flash"` |
| `DISPATCH_TYPE` | Todos | wrangler.toml | `"telegram"` / `"email"` / `"whatsapp"` |
| `ALLOWED_ORIGINS` | Todos | wrangler.toml | JSON array de dominios permitidos |
| `OPENAI_API_KEY` | Con IA, Premium | **wrangler secret** | Nunca en archivos |
| `GEMINI_API_KEY` | Con IA, Premium | **wrangler secret** | Nunca en archivos |
| `TELEGRAM_BOT_TOKEN` | Todos | **wrangler secret** | Nunca en archivos |
| `RESEND_API_KEY` | Premium | **wrangler secret** | Nunca en archivos |
| `TWILIO_ACCOUNT_SID` | Premium | **wrangler secret** | Nunca en archivos |
| `TWILIO_AUTH_TOKEN` | Premium | **wrangler secret** | Nunca en archivos |

---

## CONTEXTO DE NEGOCIO

Framework de uso interno de la agencia. Cada cliente recibe un Worker propio (aislado, billing independiente).
El endpoint `/lead` acepta `POST` con JSON desde el formulario web del cliente.
El endpoint `/health` sirve para monitoreo (retorna 200 con timestamp).
Para integrar formularios en distintas tecnologías web, ver `INTEGRATIONS.md`.
