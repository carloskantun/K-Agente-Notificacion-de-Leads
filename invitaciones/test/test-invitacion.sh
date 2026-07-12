#!/usr/bin/env bash
# =============================================================================
# TEST DE INTEGRACIÓN — Invitaciones Digitales
# =============================================================================
# Uso:
#   BASE_URL=http://localhost:8787 ADMIN_TOKEN=dev-token bash test/test-invitacion.sh
#
# Requiere que el Worker esté corriendo en local (npx wrangler dev) con
# ADMIN_TOKEN y SESSION_SECRET configurados como variables de entorno de dev
# (ver .dev.vars.example).
# =============================================================================
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8787}"
ADMIN_TOKEN="${ADMIN_TOKEN:-dev-token}"

echo "── Health check ──"
curl -sS "$BASE_URL/health"; echo

echo -e "\n── Crear evento modo 'lista' (boda) ──"
curl -sS -X POST "$BASE_URL/admin/eventos" \
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
    "mensaje": "Con la bendición de Dios y nuestros padres, los invitamos a celebrar con nosotros."
  }'; echo

echo -e "\n── Importar CSV de invitados ──"
curl -sS -X POST "$BASE_URL/admin/eventos/juan-y-maria/csv" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: text/csv" \
  --data-binary $'nombre,pases,correo\nCarlos Ramírez,2,carlos@example.com\nLucía Torres,1,'
echo

echo -e "\n── Actualizar evento con itinerario y mapa ──"
curl -sS -X POST "$BASE_URL/admin/eventos" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "juan-y-maria",
    "itinerario": [
      { "hora": "17:00", "titulo": "Ceremonia", "descripcion": "Parroquia San José", "icono": "⛪" },
      { "hora": "19:00", "titulo": "Recepción", "descripcion": "Salón Jardines del Mar", "icono": "🥂" }
    ],
    "mapaCeremonia": "Parroquia San José, Cancún, Quintana Roo"
  }'; echo

echo -e "\n── (copia un 'codigo' de la respuesta anterior y pruébalo aquí) ──"
echo "curl \"$BASE_URL/evento/juan-y-maria?c=CODIGO\""

echo -e "\n── Crear evento modo 'password' (aniversario) ──"
curl -sS -X POST "$BASE_URL/admin/eventos" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "bodas-de-plata",
    "tipo": "aniversario",
    "modo": "password",
    "titulo": "25 Años Juntos",
    "clave": "familia2026",
    "fechaEvento": "2026-09-20T18:00:00-05:00",
    "lugarCeremonia": "Casa de los Torres",
    "horaCeremonia": "18:00"
  }'; echo

echo -e "\n── Ver invitación password-protegida sin desbloquear (debe pedir contraseña) ──"
curl -sS "$BASE_URL/evento/bodas-de-plata" | grep -o "<h1>.*</h1>" | head -1

echo -e "\n── Verificar contraseña correcta ──"
curl -sS -i -X POST "$BASE_URL/evento/bodas-de-plata/clave" \
  -H "Content-Type: application/json" \
  -d '{"clave":"familia2026"}' | head -20

echo -e "\n── Listar invitados de 'juan-y-maria' ──"
curl -sS "$BASE_URL/admin/eventos/juan-y-maria/invitados" \
  -H "Authorization: Bearer $ADMIN_TOKEN"; echo
