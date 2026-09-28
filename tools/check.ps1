$ErrorActionPreference='Stop'
$workspace=Split-Path -Parent $PSScriptRoot
$runtime=Join-Path $workspace '.runtime'
$node=Get-ChildItem $runtime -Filter node.exe -Recurse | Select-Object -First 1 -ExpandProperty FullName
if(-not $node){$node=(Get-Command node -ErrorAction SilentlyContinue).Source}
if($node){Write-Host ('Node: '+(& $node --version)) -ForegroundColor Green}else{Write-Host 'MISSING: Node.js 22.5 or later' -ForegroundColor Red}
$connectionFile=Join-Path $runtime 'public-cloud.json'
$cloudBase='http://127.0.0.1:5174'
if(Test-Path -LiteralPath $connectionFile){$connection=Get-Content -Raw -LiteralPath $connectionFile | ConvertFrom-Json;$cloudBase=$connection.cloudUrl.TrimEnd('/')}
if($node){& $node (Join-Path $workspace 'tools/health.cjs')}
Write-Host ''
Write-Host ('Website: '+$cloudBase+'/customer/')
Write-Host 'POS:     http://127.0.0.1:4173/pos/'
Write-Host 'The POS runs on this computer. Keep it running and connected to the internet to receive website orders.'
Write-Host 'See START_HERE.md and trackbite-system/docs/STOREFRONT.md.'
