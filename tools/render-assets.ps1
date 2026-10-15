# Gera as imagens do tutorial (assets/*.png) a partir de tools/tutorial/index.html usando o Edge headless.
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$edge = @(
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $edge) { throw 'Microsoft Edge não encontrado.' }

$html = (Resolve-Path "$root\tools\tutorial\index.html").Path -replace '\\', '/'
$nomes = '01-comando', '02-formulario', '03-post', '04-validacao', '05-status'
New-Item -ItemType Directory -Force "$root\assets" | Out-Null
$perfil = Join-Path $env:TEMP 'edge-render-assets'

$ErrorActionPreference = 'Continue'  # o Edge escreve o progresso no stderr
for ($i = 0; $i -lt $nomes.Count; $i++) {
  $out = "$root\assets\$($nomes[$i]).png"
  & $edge --headless=new --disable-gpu --hide-scrollbars --user-data-dir="$perfil" `
    --force-device-scale-factor=2 --window-size=900,520 `
    --screenshot="$out" "file:///$html#$($i + 1)" 2>$null | Out-Null
  Write-Host "ok $out"
}
