# =============================================================================
# TEST DE INTEGRACIÓN PARA POWERSHELL
# Uso: .\test\test-lead.ps1
# Requisito: Worker corriendo con `node build.js [slug] --dev`
# =============================================================================

$BASE = "http://127.0.0.1:8787"

Write-Host ""
Write-Host "══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  TEST DE AGENTE IA — PowerShell" -ForegroundColor Cyan
Write-Host "══════════════════════════════════════════" -ForegroundColor Cyan

# ── 1. Health check ──────────────────────────────────────────────────────────
Write-Host "`n1️⃣  GET /health" -ForegroundColor Yellow
try {
    Invoke-RestMethod -Uri "$BASE/health" -Method GET | ConvertTo-Json
} catch { Write-Host $_.Exception.Message -ForegroundColor Red }

# ── 2. Lead válido ───────────────────────────────────────────────────────────
Write-Host "`n2️⃣  POST /lead (datos válidos)" -ForegroundColor Yellow
try {
    $body = @{
        nombre          = "María González"
        telefono        = "9981234567"
        electrodomestico = "Lavadora"
        problema        = "No centrifuga, hace ruido fuerte al girar"
        disponibilidad  = "Tardes"
    } | ConvertTo-Json
    Invoke-RestMethod -Uri "$BASE/lead" -Method POST -ContentType "application/json" -Body $body | ConvertTo-Json
} catch {
    # Invoke-RestMethod lanza excepción en respuestas no-2xx — mostramos el body
    $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
    Write-Host $reader.ReadToEnd() -ForegroundColor Red
}

# ── 3. Campos faltantes ──────────────────────────────────────────────────────
Write-Host "`n3️⃣  POST /lead sin 'telefono' (debe dar 422)" -ForegroundColor Yellow
try {
    $body = @{ nombre = "Test"; problema = "Prueba" } | ConvertTo-Json
    Invoke-RestMethod -Uri "$BASE/lead" -Method POST -ContentType "application/json" -Body $body | ConvertTo-Json
} catch {
    $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
    Write-Host $reader.ReadToEnd()
}

# ── 4. Ruta inexistente ──────────────────────────────────────────────────────
Write-Host "`n4️⃣  GET /ruta-inexistente (debe dar 404)" -ForegroundColor Yellow
try {
    Invoke-RestMethod -Uri "$BASE/ruta-inexistente" | ConvertTo-Json
} catch {
    $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
    Write-Host $reader.ReadToEnd()
}

Write-Host ""
Write-Host "══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Tests completados" -ForegroundColor Cyan
Write-Host "══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
