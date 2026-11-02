param([int]$Port = 5174)
$ErrorActionPreference = 'Stop'
$webDirectory = Join-Path $PSScriptRoot 'web'
if (-not (Test-Path -LiteralPath (Join-Path $webDirectory 'node_modules/vite/bin/vite.js'))) {
    throw 'Install the web dependencies first: cd web; npm install'
}
Write-Host "Open the Charter workbench at http://127.0.0.1:$Port/charter.html"
Push-Location $webDirectory
try {
    & node node_modules/vite/bin/vite.js --host 127.0.0.1 --port $Port --strictPort
} finally {
    Pop-Location
}
