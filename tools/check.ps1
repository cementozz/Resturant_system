$ErrorActionPreference='Stop'
$workspace=Split-Path -Parent $PSScriptRoot
$runtime=Join-Path $workspace '.runtime'
$node=Get-ChildItem $runtime -Filter node.exe -Recurse | Select-Object -First 1 -ExpandProperty FullName
if(-not $node){$node=(Get-Command node -ErrorAction SilentlyContinue).Source}
if($node){Write-Host ('Node: '+(& $node --version)) -ForegroundColor Green}else{Write-Host 'MISSING: Node.js 22.5 or later' -ForegroundColor Red}
$connectionFile=Join-Path $runtime 'public-cloud.json'
$cloudBase='http://127.0.0.1:5174'
if(Test-Path -LiteralPath $connectionFile){$connection=Get-Content -Raw -LiteralPath $connectionFile | ConvertFrom-Json;$cloudBase=$connection.cloudUrl.TrimEnd('/')}
foreach($service in @(@{Name='Restaurant / POS';Url='http://127.0.0.1:4173'},@{Name='Customer website';Url=$cloudBase})){
  try{$status=Invoke-RestMethod ($service.Url+'/api/status') -TimeoutSec 15;if(-not $status.ok){throw 'Not ready'};Write-Host "$($service.Name): RUNNING" -ForegroundColor Green;if($status.sync){Write-Host "POS synchronization online: $($status.sync.online)";if($status.sync.lastError){Write-Host $status.sync.lastError -ForegroundColor Yellow}}}catch{Write-Host "$($service.Name): UNREACHABLE - check internet or start 02_START_POS.bat" -ForegroundColor Yellow}
}
try{$menu=Invoke-RestMethod ($cloudBase+'/api/public/menu') -TimeoutSec 15;Write-Host "Online menu: $($menu.products.Count) items; restaurant connected: $($menu.online)"}catch{}
Write-Host ''
Write-Host ('Website: '+$cloudBase+'/customer/')
Write-Host 'POS:     http://127.0.0.1:4173/pos/'
Write-Host 'The POS runs on this computer. Keep it running and connected to the internet to receive website orders.'
Write-Host 'See START_HERE.md and trackbite-system/docs/STOREFRONT.md.'
