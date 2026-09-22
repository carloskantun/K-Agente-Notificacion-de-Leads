# Agente de Notificación IA — Cloudflare Workers

Framework privado para desplegar agentes de notificación con IA por cliente, sobre Cloudflare Workers. Sin dependencias de terceros innecesarias. Un Worker independiente por negocio.

> **Otro producto en este repo:** [`invitaciones/`](invitaciones/README.md) — landing page de invitación digital (bodas, XV años, aniversarios) con modo lista CSV + RSVP o modo genérico protegido por contraseña. Es un Worker independiente, no forma parte del flujo de leads descrito abajo.

## ¿Qué hace?

Recibe leads de formularios web → los analiza con IA (OpenAI o Gemini) → despacha cotización por Telegram, correo (Resend) o link de WhatsApp.

---

## Prerequisitos

| Herramienta | Versión mínima | Cómo instalar |
|---|---|---|
| Node.js | 18+ | [nodejs.org](https://nodejs.org) |
| Wrangler CLI | 3+ | `npm install -g wrangler` |
| Cuenta Cloudflare | — | [cloudflare.com](https://cloudflare.com) (gratis) |

---

## Instalación

```bash
# 1. Clona el repositorio (privado)
git clone git@github.com:TU-ORG/agente-notificacion-ia.git
cd agente-notificacion-ia

# 2. Instala dependencias
npm install

# 3. Autentícate en Cloudflare
npx wrangler login
```

---

## Modo asistido (recomendado para empleados)

**Abre la carpeta del proyecto con Claude (Cowork o Claude Code).**

Claude leerá el archivo `CLAUDE.md` automáticamente y comenzará a hacerte las preguntas necesarias para configurar y desplegar el agente de tu cliente. No necesitas tocar ningún archivo manualmente.

---

## Modo manual (para desarrolladores)

### 1. Crear config del cliente

Copia la plantilla y rellena los campos:

```bash
cp config/template.json config/mi-cliente.json
# Editar config/mi-cliente.json con nombre, tarifas, canal de despacho, etc.
```

### 2. Probar en local

```bash
node build.js mi-cliente --dev
# Worker disponible en http://localhost:8787
```

### 3. Cargar secrets (una vez por cliente)

```bash
wrangler secret put OPENAI_API_KEY       --name agente-mi-cliente
wrangler secret put TELEGRAM_BOT_TOKEN   --name agente-mi-cliente
# Solo los que apliquen según tu config
```

### 4. Desplegar a producción

```bash
node build.js mi-cliente --env production --deploy
```

El Worker queda en: `https://agente-mi-cliente.TU-SUBDOMINIO.workers.dev`

---

## Endpoints del Worker

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/lead` | Recibe el JSON del formulario, procesa con IA y despacha |
| `GET` | `/health` | Monitoreo — retorna `200 OK` con timestamp |

### Ejemplo de payload para `/lead`

```json
{
  "nombre": "María González",
  "telefono": "9981234567",
  "problema": "Mi lavadora no centrifuga, hace ruido al girar.",
  "disponibilidad": "Tardes"
}
```

### Ejemplo de respuesta

```json
{
  "success": true,
  "mensaje": "¡Gracias! Nos pondremos en contacto en menos de 30 minutos.",
  "analisis": "Resumen: Lavadora con falla en motor de centrifugado...\nCotización estimada:\n• Diagnóstico: $350 MXN\n• Reparación estimada: $450–$800 MXN..."
}
```

---

## Estructura de archivos

```
├── src/
│   └── worker.js               ← Worker principal (ES Module, fetch puro)
├── config/
│   ├── template.json           ← Plantilla base (versionar)
│   └── [cliente].json          ← Config por cliente (NO versionar si tiene datos sensibles)
├── dist/                       ← Generado por build.js (NO versionar)
├── test/
│   └── test-lead.sh            ← Tests de integración
├── build.js                    ← Automatizador de despliegue
├── wrangler.toml.template      ← Plantilla TOML
├── wrangler.toml               ← Generado por build.js (NO versionar)
├── CLAUDE.md                   ← Instrucciones para el asistente IA
└── .gitignore
```

---

## Secrets requeridos por canal

| Canal | Secrets necesarios |
|---|---|
| Telegram | `OPENAI_API_KEY` + `TELEGRAM_BOT_TOKEN` |
| Email (Resend) | `OPENAI_API_KEY` + `RESEND_API_KEY` |
| WhatsApp | `OPENAI_API_KEY` (el link se genera sin API de pago) |
| Gemini en lugar de OpenAI | `GEMINI_API_KEY` (reemplaza `OPENAI_API_KEY`) |

---

## Comandos útiles

```bash
# Ver logs en tiempo real
wrangler tail agente-[cliente]

# Ver secrets configurados
wrangler secret list --name agente-[cliente]

# Listar todos los Workers de la cuenta
wrangler deployments list

# Eliminar un Worker
wrangler delete --name agente-[cliente]
```

---

## Seguridad

- Las API keys **nunca** van en archivos del repositorio. Solo via `wrangler secret put`.
- El Worker valida el origen de cada request contra la lista blanca del cliente (`ALLOWED_ORIGINS`).
- El `wrangler.toml` generado por `build.js` está en `.gitignore`.
- Los errores internos nunca se exponen al cliente (solo se loguean en Cloudflare).
