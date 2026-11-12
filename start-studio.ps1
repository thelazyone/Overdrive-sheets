param([int]$Port = 5176)
$ErrorActionPreference = 'Stop'
$webDirectory = Join-Path $PSScriptRoot 'web'
if (-not (Test-Path -LiteralPath (Join-Path $webDirectory 'node_modules/vite/bin/vite.js'))) {
    throw 'Install the web dependencies first: cd web; npm install'
}
Write-Host "Open Layout Studio at http://127.0.0.1:$Port/studio/"
Push-Location $webDirectory
try {
    & node node_modules/vite/bin/vite.js --host 127.0.0.1 --port $Port --strictPort
} finally {
    Pop-Location
}
