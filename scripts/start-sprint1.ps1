$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$runtimeDir = Join-Path $repoRoot '.runtime'
New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null
foreach ($port in @(3002, 8002)) {
    if (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) {
        throw "El puerto $port esta ocupado. Deten la demo anterior antes de iniciar otra."
    }
}
Push-Location $repoRoot
try {
    docker compose up -d --wait postgres
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo iniciar PostgreSQL.' }
    $backendDir = Join-Path $repoRoot 'backend'
    $backendProcess = Start-Process -FilePath (Join-Path $backendDir '.venv/Scripts/python.exe') -ArgumentList 'scripts/demo_sprint1.py' -WorkingDirectory $backendDir -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtimeDir 'sprint1-backend.log') -RedirectStandardError (Join-Path $runtimeDir 'sprint1-backend-error.log')
    $previousUrl = $env:DJANGO_URL
    $previousDemo = $env:TTI_DEMO
    try {
        $env:DJANGO_URL = 'http://127.0.0.1:8002'
        $env:TTI_DEMO = '1'
        $frontendProcess = Start-Process -FilePath (Get-Command node.exe).Source -ArgumentList 'node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3002' -WorkingDirectory (Join-Path $repoRoot 'frontend') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtimeDir 'sprint1-frontend.log') -RedirectStandardError (Join-Path $runtimeDir 'sprint1-frontend-error.log')
    } finally {
        $env:DJANGO_URL = $previousUrl
        $env:TTI_DEMO = $previousDemo
    }
    @($backendProcess, $frontendProcess) | ForEach-Object {
        [ordered]@{ pid = $_.Id; started_at = $_.StartTime.ToUniversalTime().ToString('o') }
    } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $runtimeDir 'sprint1-processes.json') -Encoding UTF8
    $ready = $false
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        try {
            $health = Invoke-RestMethod -Uri 'http://127.0.0.1:3002/health/' -TimeoutSec 3
            if ($health.status -eq 'ok') { $ready = $true; break }
        } catch { Start-Sleep -Seconds 1 }
        if ($backendProcess.HasExited -or $frontendProcess.HasExited) { break }
    }
    if (-not $ready) { throw 'La demo no respondio. Revisa .runtime/ y detenla con scripts/stop-sprint1.ps1.' }
    Write-Output "Demo verificada: http://localhost:3002"
    Write-Output "Procesos: backend $($backendProcess.Id), frontend $($frontendProcess.Id)"
    Write-Output 'Credenciales y recorrido: docs/sprint-1-current.md. Logs: .runtime/'
} finally { Pop-Location }
