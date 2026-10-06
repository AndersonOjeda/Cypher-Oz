param([Parameter(Mandatory = $true)][ValidateRange(1, 7)][int]$Sprint)
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$outputDir = Join-Path $repoRoot '.runtime/entregas'
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.IO.Compression
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$destination = Join-Path $outputDir "sprint-$Sprint-$stamp.zip"
Push-Location $repoRoot
try {
    $files = @(git -c core.quotepath=false ls-files --cached --others --exclude-standard)
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo consultar el repositorio.' }
    $archive = [IO.Compression.ZipFile]::Open($destination, [IO.Compression.ZipArchiveMode]::Create)
    $manifest = @()
    try {
        foreach ($relative in ($files | Sort-Object -Unique)) {
            $leaf = Split-Path -Leaf $relative
            if ($leaf -like '.env*' -and $leaf -ne '.env.example') { continue }
            if ($relative -match '(^|/)(\.runtime|\.git|\.venv|node_modules|\.next[^/]*|test-results|playwright-report)/') { continue }
            $absolute = Join-Path $repoRoot $relative
            if (-not (Test-Path -LiteralPath $absolute -PathType Leaf)) { continue }
            [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $absolute, $relative.Replace('\', '/'), [IO.Compression.CompressionLevel]::Optimal) | Out-Null
            $manifest += [ordered]@{ file = $relative; sha256 = (Get-FileHash -LiteralPath $absolute -Algorithm SHA256).Hash }
        }
        $metadata = [ordered]@{
            sprint = $Sprint
            created_at = (Get-Date).ToUniversalTime().ToString('o')
            base_commit = (git rev-parse HEAD)
            working_tree_snapshot = $true
            note = 'Copia del codigo local, incluidos cambios sin commit. No acredita aprobacion ni cierre de Jira. Sin secretos ni bases de datos.'
            files = $manifest
        }
        $entry = $archive.CreateEntry('ENTREGA.json')
        $writer = [IO.StreamWriter]::new($entry.Open(), [Text.UTF8Encoding]::new($false))
        try { $writer.Write(($metadata | ConvertTo-Json -Depth 5)) } finally { $writer.Dispose() }
    } finally { $archive.Dispose() }
    Write-Output $destination
    Write-Output "SHA256: $((Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash)"
} finally { Pop-Location }
