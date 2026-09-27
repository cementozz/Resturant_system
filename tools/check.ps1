$ErrorActionPreference='Stop'
$workspace=Split-Path -Parent $PSScriptRoot
$runtime=Join-Path $workspace '.runtime'
$node=Get-ChildItem $runtime -Filter node.exe -Recurse | Select-Object -First 1 -ExpandProperty FullName
if(-not $node){$node=(Get-Command node -ErrorAction SilentlyContinue).Source}
if($node){Write-Host ('Node: '+(& $node --version)) -ForegroundColor Green}else{Write-Host 'MISSING: Node.js 22.5 or later' -ForegroundColor Red}
foreach($service in @(@{Name='Restaurant / POS';Port=4173},@{Name='Customer cloud';Port=5174})){
  try{$status=Invoke-RestMethod "http://127.0.0.1:$($service.Port)/api/status" -TimeoutSec 3;if(-not $status.ok){throw 'Not ready'};Write-Host "$($service.Name): RUNNING" -ForegroundColor Green}catch{Write-Host "$($service.Name): STOPPED - double-click 01_START_WEBSITE.bat" -ForegroundColor Yellow}
}
try{$menu=Invoke-RestMethod 'http://127.0.0.1:5174/api/public/menu' -TimeoutSec 3;Write-Host "Online menu: $($menu.products.Count) items; restaurant connected: $($menu.online)"}catch{}
Write-Host ''
Write-Host 'Website: http://127.0.0.1:5174/customer/'
Write-Host 'POS:     http://127.0.0.1:4173/pos/'
Write-Host 'These addresses work on this computer. Public hosting is not configured.'
Write-Host 'See START_HERE.md and trackbite-system/docs/STOREFRONT.md.'
