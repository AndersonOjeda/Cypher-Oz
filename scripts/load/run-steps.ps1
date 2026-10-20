param(
    [int[]]$Steps = @(10, 25, 50, 100),
    [ValidatePattern('^[a-z0-9-]+$')][string]$Label = 'after'
)

$ErrorActionPreference = 'Stop'
$loadRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$artifactDir = Join-Path $loadRoot '.runtime/loadtest'
New-Item -ItemType Directory -Force $artifactDir | Out-Null
foreach ($users in $Steps) {
    if ($users -notin @(10, 25, 50, 100, 250, 500, 1000)) {
        throw "Unsupported step: $users"
    }
    $runName = "tti-step-$Label-$users"
    $summaryPath = Join-Path $artifactDir "$Label-$users.json"
    # Preserve previous evidence; use a new label to repeat a measurement.
    if (Test-Path -LiteralPath $summaryPath) { throw "Report exists: $summaryPath" }
    docker run -d --name $runName --mount "type=bind,source=$loadRoot,target=/work" `
        -e "STEP_VUS=$users" grafana/k6:2.3.0 run --quiet `
        "--log-output=file=/work/.runtime/loadtest/$Label-$users-k6.log" `
        "--summary-export=/work/.runtime/loadtest/$Label-$users.json" `
        /work/scripts/load/catalog.k6.js
    if ($LASTEXITCODE -ne 0) { throw "Could not start $runName" }
    $deadline = (Get-Date).AddSeconds(120)
    do {
        Start-Sleep -Seconds 3
        $state = docker inspect $runName --format '{{json .State}}' | ConvertFrom-Json
        if ($LASTEXITCODE -ne 0) { throw "Could not inspect $runName" }
        if ((Get-Date) -gt $deadline -and $state.Running) {
            docker kill --signal=SIGINT $runName
            throw "Step $users exceeded 120 s; interrupted. Review logs before repeating."
        }
    } while ($state.Running)
    if (-not (Test-Path -LiteralPath $summaryPath)) { throw "Missing summary for $runName" }
    $metrics = (Get-Content -LiteralPath $summaryPath -Raw | ConvertFrom-Json).metrics
    $p95 = $metrics.http_req_duration.'p(95)'
    $errors = $metrics.http_req_failed.value
    Write-Output ([pscustomobject]@{
        Users = $users; Requests = $metrics.http_reqs.count
        P95ms = [math]::Round($p95, 2); ErrorPercent = [math]::Round($errors * 100, 2)
        ExitCode = $state.ExitCode
    })
    if ($state.ExitCode -ne 0) {
        Write-Warning "Step $users failed. Higher steps will not run."
        exit 1
    }
}
