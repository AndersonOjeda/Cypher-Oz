$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$statePath = Join-Path $repoRoot '.runtime/sprint1-processes.json'
if (-not (Test-Path -LiteralPath $statePath)) { throw 'No hay procesos registrados para esta demo.' }
$records = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
foreach ($record in $records) {
    $demoProcess = Get-Process -Id $record.pid -ErrorAction SilentlyContinue
    if ($demoProcess -and $demoProcess.StartTime.ToUniversalTime().ToString('o') -eq $record.started_at) {
        taskkill.exe /PID $demoProcess.Id /T /F | Out-Null
        if ($LASTEXITCODE -ne 0) {
            throw "No se pudo detener el proceso de demo $($demoProcess.Id)."
        }
    }
}
Write-Output 'Demo detenida. Los datos de PostgreSQL se conservan.'
