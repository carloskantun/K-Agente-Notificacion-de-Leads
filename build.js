#!/usr/bin/env node
/**
 * =============================================================================
 * BUILD.JS — AUTOMATIZADOR DE DESPLIEGUE POR CLIENTE
 * =============================================================================
 *
 * PROPÓSITO:
 *   Toma un archivo de configuración de cliente (config/<slug>.json),
 *   genera el wrangler.toml final con todos los valores inyectados,
 *   copia el worker.js al directorio dist/ con el nombre del cliente,
 *   y opcionalmente lanza wrangler deploy o wrangler dev.
 *
 * PREREQUISITOS:
 *   - Node.js >= 18 (usa fetch nativo y fs/promises)
 *   - Wrangler CLI instalado globalmente: npm install -g wrangler
 *   - Autenticado en Cloudflare: wrangler login
 *
 * USO:
 *   node build.js <slug-del-cliente> [--env staging|production] [--dev] [--deploy]
 *
 * EJEMPLOS:
 *   node build.js reparacionesadomicilio
 *   node build.js reparacionesadomicilio --dev
 *   node build.js reparacionesadomicilio --env production --deploy
 *
 * =============================================================================
 */

import fs from "node:fs/promises";
import path from "node:path";
import { execSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// PATHS BASE
// ---------------------------------------------------------------------------
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PATHS = {
  config:        path.join(__dirname, "config"),
  src:           path.join(__dirname, "src", "worker.js"),
  dist:          path.join(__dirname, "dist"),
  tomlTemplate:  path.join(__dirname, "wrangler.toml.template"),
  wranglerToml:  path.join(__dirname, "wrangler.toml"),
};

// ---------------------------------------------------------------------------
// PARSEAR ARGUMENTOS DE LÍNEA DE COMANDOS
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const args = argv.slice(2);
  const slug = args[0];

  if (!slug || slug.startsWith("--")) {
    console.error(
      "\n❌ Error: debes proporcionar el slug del cliente.\n" +
      "   Uso: node build.js <slug> [--env staging|production] [--dev] [--deploy]\n" +
      "   Ejemplo: node build.js reparacionesadomicilio --dev\n"
    );
    process.exit(1);
  }

  return {
    slug,
    env: args.includes("--env") ? args[args.indexOf("--env") + 1] : null,
    dev: args.includes("--dev"),
    deploy: args.includes("--deploy"),
  };
}

// ---------------------------------------------------------------------------
// LEER CONFIGURACIÓN DEL CLIENTE
// ---------------------------------------------------------------------------
async function loadClientConfig(slug) {
  const configPath = path.join(PATHS.config, `${slug}.json`);

  let raw;
  try {
    raw = await fs.readFile(configPath, "utf-8");
  } catch {
    console.error(
      `\n❌ No se encontró config/${slug}.json\n` +
      `   Asegúrate de crear el archivo primero (copia config/template.json).\n`
    );
    process.exit(1);
  }

  // Filtramos los campos _comment antes de parsear
  const cleaned = raw.replace(/^\s*"_comment[^"]*"\s*:\s*"[^"]*",?\s*$/gm, "");
  let config;
  try {
    config = JSON.parse(cleaned);
  } catch (err) {
    console.error(`\n❌ Error al parsear config/${slug}.json:\n   ${err.message}\n`);
    process.exit(1);
  }

  return config;
}

// ---------------------------------------------------------------------------
// CONSTRUIR MAPA DE SUSTITUCIONES
// ---------------------------------------------------------------------------
/**
 * Convierte la configuración del cliente en un mapa plano de
 * {{PLACEHOLDER}} → valor para inyectar en el template TOML.
 */
function buildReplacementMap(config) {
  const c = config.cliente;
  const ia = config.ia;
  const d = config.despacho;
  const f = config.formulario;
  const cors = config.cors;
  const r = config.respuestaAlCliente;

  // El prompt del sistema puede ser un array de strings → unir con \n
  const systemPrompt = Array.isArray(ia.promptSistema)
    ? ia.promptSistema.join("\\n")
    : String(ia.promptSistema);

  // Para TOML, los strings con comillas dobles necesitan escape
  const escapeTOML = (str) => String(str).replace(/\\/g, "\\\\").replace(/"/g, '\\"');

  return {
    CLIENTE_SLUG:          c.slug,
    CLIENTE_NOMBRE:        escapeTOML(c.nombre),
    AI_PROVIDER:           ia.proveedor || "openai",
    AI_MODEL:              ia.modelo || "gpt-4o-mini",
    AI_TEMPERATURE:        String(ia.temperatura ?? "0.4"),
    AI_MAX_TOKENS:         String(ia.maxTokens ?? "512"),
    AI_SYSTEM_PROMPT:      escapeTOML(systemPrompt),
    DISPATCH_TYPE:         d.tipo,
    TELEGRAM_CHAT_ID:      d.telegram?.chatId || "",
    TELEGRAM_CHAT_ID_STAGING: d.telegram?.chatId || "",  // staging usa el mismo por default
    EMAIL_DESTINATARIOS:   JSON.stringify(d.email?.destinatarios || []),
    EMAIL_ASUNTO_PREFIJO:  escapeTOML(d.email?.asuntoPrefijo || "[Lead] "),
    EMAIL_FROM_DOMAIN:     c.sitioWeb?.replace(/https?:\/\//, "").replace(/^www\./, "") || "",
    WHATSAPP_NUMERO:       d.whatsapp?.numeroDestino || "",
    ALLOWED_ORIGINS:       JSON.stringify(cors?.origenesPermitidos || []),
    REQUIRED_FIELDS:       JSON.stringify(f?.camposRequeridos || ["nombre", "telefono", "problema"]),
    MAX_PROBLEMA_LENGTH:   String(f?.longitudMaximaProblema ?? "1000"),
    RESPUESTA_CLIENTE:     escapeTOML(r?.mensaje || "¡Gracias! Nos pondremos en contacto pronto."),
    INCLUDE_COTIZACION:    String(r?.incluirCotizacion ?? "true"),
    TIMEZONE:              c.zonaHoraria || "America/Mexico_City",
  };
}

// ---------------------------------------------------------------------------
// INYECTAR PLACEHOLDERS EN TEMPLATE
// ---------------------------------------------------------------------------
/**
 * Reemplaza todos los {{PLACEHOLDER}} en el template con los valores del mapa.
 * Los placeholders que no tengan valor quedan como string vacío (no rompen el TOML).
 */
function injectTemplate(template, map) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (!(key in map)) {
      console.warn(`  ⚠️  Placeholder no mapeado: {{${key}}} — se dejará vacío.`);
      return "";
    }
    return map[key];
  });
}

// ---------------------------------------------------------------------------
// LIMPIAR / CREAR DIRECTORIO DIST
// ---------------------------------------------------------------------------
async function prepareDist() {
  try {
    await fs.mkdir(PATHS.dist, { recursive: true });
  } catch {
    // Ya existe, ok
  }
}

// ---------------------------------------------------------------------------
// VERIFICAR DEPENDENCIAS
// ---------------------------------------------------------------------------
function checkDependencies() {
  console.log("\n🔍 Verificando dependencias...");
  try {
    execSync("wrangler --version", { stdio: "pipe" });
    const version = execSync("wrangler --version", { encoding: "utf-8" }).trim();
    console.log(`   ✅ Wrangler: ${version}`);
  } catch {
    console.error(
      "\n❌ Wrangler no está instalado o no está en el PATH.\n" +
      "   Instalar: npm install -g wrangler\n" +
      "   Luego autenticarse: wrangler login\n"
    );
    process.exit(1);
  }

  try {
    const nodeVersion = process.version;
    const major = parseInt(nodeVersion.slice(1).split(".")[0], 10);
    if (major < 18) {
      console.error(`\n❌ Node.js >= 18 requerido. Tienes: ${nodeVersion}\n`);
      process.exit(1);
    }
    console.log(`   ✅ Node.js: ${nodeVersion}`);
  } catch {
    // Ignore
  }
}

// ---------------------------------------------------------------------------
// EJECUTAR COMANDO WRANGLER
// ---------------------------------------------------------------------------
/**
 * Lanza un comando wrangler como proceso hijo, heredando stdin/stdout/stderr.
 * @param {string[]} args - Argumentos para wrangler
 * @param {string} cwd - Directorio de trabajo
 * @returns {Promise<number>} - Código de salida
 */
function runWrangler(args, cwd) {
  return new Promise((resolve, reject) => {
    const proc = spawn("wrangler", args, {
      cwd,
      stdio: "inherit",
      shell: process.platform === "win32",  // Necesario en Windows
    });
    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`wrangler ${args[0]} salió con código ${code}`));
      } else {
        resolve(code);
      }
    });
    proc.on("error", reject);
  });
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------
async function main() {
  const args = parseArgs(process.argv);
  const { slug, env, dev, deploy } = args;

  console.log(`\n🚀 Build para cliente: ${slug}`);
  if (env) console.log(`   Entorno: ${env}`);

  // 1. Verificar dependencias
  checkDependencies();

  // 2. Leer config del cliente
  console.log(`\n📋 Leyendo config/${slug}.json...`);
  const config = await loadClientConfig(slug);
  console.log(`   ✅ Cliente: ${config.cliente.nombre}`);

  // 3. Construir mapa de sustituciones
  const replacements = buildReplacementMap(config);

  // 4. Generar wrangler.toml
  console.log("\n⚙️  Generando wrangler.toml...");
  const tomlTemplate = await fs.readFile(PATHS.tomlTemplate, "utf-8");
  const finalToml = injectTemplate(tomlTemplate, replacements);
  await fs.writeFile(PATHS.wranglerToml, finalToml, "utf-8");
  console.log(`   ✅ wrangler.toml generado (worker: agente-${slug})`);

  // 5. Preparar dist/ y copiar worker
  console.log(`\n📦 Preparando dist/...`);
  await prepareDist();
  const destWorker = path.join(PATHS.dist, `worker.${slug}.js`);
  await fs.copyFile(PATHS.src, destWorker);
  console.log(`   ✅ dist/worker.${slug}.js copiado`);

  // 6. Mostrar reminder de secrets
  console.log(`
📌 RECORDATORIO DE SECRETS:
   Los siguientes secrets debes configurarlos UNA VEZ por cliente:

   wrangler secret put OPENAI_API_KEY      --name agente-${slug}
   wrangler secret put TELEGRAM_BOT_TOKEN  --name agente-${slug}
   wrangler secret put RESEND_API_KEY      --name agente-${slug}

   (Solo configura los que apliquen según DISPATCH_TYPE y AI_PROVIDER)
`);

  // 7. Ejecutar wrangler según flags
  if (dev) {
    console.log("🔧 Iniciando wrangler dev (modo local)...\n");
    const devArgs = ["dev", destWorker, "--local"];
    if (env) devArgs.push("--env", env);
    try {
      await runWrangler(devArgs, __dirname);
    } catch (err) {
      console.error(`\n❌ Error en wrangler dev: ${err.message}\n`);
      process.exit(1);
    }

  } else if (deploy) {
    console.log("🚢 Desplegando a Cloudflare Workers...\n");
    const deployArgs = ["deploy", destWorker];
    if (env) deployArgs.push("--env", env);
    try {
      await runWrangler(deployArgs, __dirname);
      console.log(`\n✅ ¡Despliegue exitoso! Worker: agente-${slug}`);
      console.log(
        `   URL: https://agente-${slug}.${obtenerSubdomain()}.workers.dev\n`
      );
    } catch (err) {
      console.error(`\n❌ Error en wrangler deploy: ${err.message}\n`);
      process.exit(1);
    }

  } else {
    console.log("✅ Build completado. Próximos pasos:");
    console.log(`   • Probar local:  node build.js ${slug} --dev`);
    console.log(`   • Deploy:        node build.js ${slug} --env production --deploy\n`);
  }
}

/**
 * Intenta obtener el subdominio de Cloudflare del usuario desde wrangler whoami.
 * Si falla, retorna "<tu-subdominio>".
 */
function obtenerSubdomain() {
  try {
    const output = execSync("wrangler whoami", { encoding: "utf-8", stdio: "pipe" });
    const match = output.match(/workers\.dev subdomain.*?:\s*(\S+)/i);
    return match?.[1] || "<tu-subdominio>";
  } catch {
    return "<tu-subdominio>";
  }
}

// ---------------------------------------------------------------------------
// EJECUCIÓN
// ---------------------------------------------------------------------------
main().catch((err) => {
  console.error(`\n❌ Error inesperado: ${err.message}\n`);
  process.exit(1);
});
