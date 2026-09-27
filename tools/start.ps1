param([ValidateSet('website','pos','all','none')][string]$Open='website')
$ErrorActionPreference='Stop'
$workspace=Split-Path -Parent $PSScriptRoot
$project=Join-Path $workspace 'trackbite-system'
$runtime=Join-Path $workspace '.runtime'
New-Item -ItemType Directory -Force $runtime | Out-Null
$node=Get-ChildItem $runtime -Filter node.exe -Recurse | Select-Object -First 1 -ExpandProperty FullName
if(-not $node){$node=(Get-Command node -ErrorAction SilentlyContinue).Source}
if(-not $node){throw 'Node.js is missing. Install Node.js 22.5 or later, then run this launcher again.'}
$version=& $node -p 'process.versions.node'
if([version]$version -lt [version]'22.5.0'){throw 'Node.js 22.5 or later is required. Upgrade Node.js, then run this launcher again.'}
$connectionFile=Join-Path $runtime 'public-cloud.json'
$website='http://127.0.0.1:5174/customer/'
$services=@(@{Name='cloud';Script='cloud/server.js';Port=5174},@{Name='restaurant';Script='server.js';Port=4173})
if(Test-Path -LiteralPath $connectionFile){
  $connection=Get-Content -Raw -LiteralPath $connectionFile | ConvertFrom-Json
  $cloudUri=[uri]$connection.cloudUrl
  if($cloudUri.Scheme -ne 'https' -or $cloudUri.UserInfo -or -not $cloudUri.Host){throw 'The public website must have a valid HTTPS address.'}
  if(-not $connection.syncSecret -or $connection.syncSecret.Length -lt 32){throw 'The public website connection key is missing or invalid.'}
  $env:DEMO_MODE='false'
  $env:CLOUD_API_URL=$connection.cloudUrl.TrimEnd('/')
  $env:SYNC_SECRET=$connection.syncSecret
  $env:SYNC_TIMEOUT_MS='15000'
  $website=$env:CLOUD_API_URL+'/customer/'
  $services=@(@{Name='restaurant';Script='server.js';Port=4173})
}else{
  $env:DEMO_MODE='true'
  if(-not $env:SYNC_SECRET){$env:SYNC_SECRET='trackbite-dev-secret'}
  $env:CLOUD_API_URL='http://127.0.0.1:5174'
}
$env:HOST='127.0.0.1';$env:CLOUD_HOST='127.0.0.1';$env:PORT='4173';$env:CLOUD_PORT='5174'
foreach($service in $services){
  $url="http://127.0.0.1:$($service.Port)/api/status"
  $status=$null
  try{$status=Invoke-RestMethod $url -TimeoutSec 2}catch{}
  if($status){
    $expected=if($service.Name -eq 'cloud'){$status.service -eq 'Track Bite Cloud'}else{$status.service -eq 'Track Bite POS'}
    if(-not $expected){throw "Port $($service.Port) is occupied by another application."}
    Write-Host "$($service.Name) is already running."
    continue
  }
  $script=Join-Path $project $service.Script
  $process=Start-Process -FilePath $node -ArgumentList ('"'+$script+'"') -WorkingDirectory $project -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtime "$($service.Name).log") -RedirectStandardError (Join-Path $runtime "$($service.Name).error.log")
  @{Id=$process.Id;Started=$process.StartTime.ToUniversalTime().ToString('o');Executable=$node;Script=$script}|ConvertTo-Json|Set-Content -Encoding UTF8 (Join-Path $runtime "$($service.Name).process.json")
  $ready=$false
  for($i=0;$i -lt 30;$i++){
    Start-Sleep -Milliseconds 500
    if($process.HasExited){throw "$($service.Name) exited. Read .runtime/$($service.Name).error.log."}
    try{$ready=(Invoke-RestMethod $url -TimeoutSec 2).ok}catch{}
    if($ready){break}
  }
  if(-not $ready){throw "$($service.Name) did not start. Read .runtime/$($service.Name).error.log."}
}
Write-Host ''
Write-Host "CUSTOMER WEBSITE: $website" -ForegroundColor Green
Write-Host 'STAFF / POS:      http://127.0.0.1:4173/pos/' -ForegroundColor Green
Write-Host 'LOCAL WEBSITE:    http://127.0.0.1:4173/customer/'
if($env:DEMO_MODE -eq 'true'){Write-Host 'Demo staff login: owner / 1234'}else{Write-Host 'Production: use your configured staff username and strong password.'}
foreach($url in @($(if($Open -in @('website','all')){$website}),$(if($Open -in @('pos','all')){'http://127.0.0.1:4173/pos/'}))){
  if($url){try{Start-Process $url}catch{Write-Host "The browser could not open automatically. Open this link manually: $url" -ForegroundColor Yellow}}
}
