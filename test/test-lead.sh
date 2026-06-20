#!/bin/bash
# =============================================================================
# TEST DE INTEGRACIÓN — Prueba el Worker localmente con curl
# =============================================================================
# Requisito: Worker corriendo con `node build.js reparacionesadomicilio --dev`
# Uso: bash test/test-lead.sh
# =============================================================================

BASE_URL="http://localhost:8787"
echo ""
echo "══════════════════════════════════════════"
echo "  TEST DE AGENTE IA — Reparaciones"
echo "══════════════════════════════════════════"

# ── 1. Health check ──────────────────────────────────────────────────────────
echo ""
echo "1️⃣  GET /health"
curl -s "$BASE_URL/health" | python3 -m json.tool 2>/dev/null || curl -s "$BASE_URL/health"

# ── 2. Lead válido ───────────────────────────────────────────────────────────
echo ""
echo "2️⃣  POST /lead (datos válidos)"
curl -s -X POST "$BASE_URL/lead" \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "María González",
    "telefono": "9981234567",
    "electrodomestico": "Lavadora",
    "problema": "Mi lavadora LG no centrifuga. Hace un ruido fuerte al intentar girar y se detiene sola.",
    "colonia": "Centro",
    "disponibilidad": "Tarde (4pm-7pm)"
  }' | python3 -m json.tool 2>/dev/null || \
curl -s -X POST "$BASE_URL/lead" \
  -H "Content-Type: application/json" \
  -d '{"nombre":"María González","telefono":"9981234567","electrodomestico":"Lavadora","problema":"Mi lavadora LG no centrifuga."}'

# ── 3. Campos faltantes ──────────────────────────────────────────────────────
echo ""
echo "3️⃣  POST /lead (falta campo 'telefono' — debe dar 422)"
curl -s -X POST "$BASE_URL/lead" \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Test","problema":"Prueba"}' | python3 -m json.tool 2>/dev/null || \
curl -s -X POST "$BASE_URL/lead" \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Test","problema":"Prueba"}'

# ── 4. Content-Type incorrecto ───────────────────────────────────────────────
echo ""
echo "4️⃣  POST /lead con Content-Type: text/plain (debe dar 415)"
curl -s -X POST "$BASE_URL/lead" \
  -H "Content-Type: text/plain" \
  -d 'datos' | python3 -m json.tool 2>/dev/null || \
curl -s -X POST "$BASE_URL/lead" \
  -H "Content-Type: text/plain" \
  -d 'datos'

# ── 5. Ruta inexistente ──────────────────────────────────────────────────────
echo ""
echo "5️⃣  GET /ruta-inexistente (debe dar 404)"
curl -s "$BASE_URL/ruta-inexistente" | python3 -m json.tool 2>/dev/null || \
curl -s "$BASE_URL/ruta-inexistente"

echo ""
echo "══════════════════════════════════════════"
echo "  Tests completados"
echo "══════════════════════════════════════════"
echo ""
