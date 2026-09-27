$ErrorActionPreference='Stop'
$workspace=Split-Path -Parent $PSScriptRoot
$node=Get-ChildItem (Join-Path $workspace '.runtime') -Filter node.exe -Recurse | Select-Object -First 1 -ExpandProperty FullName
if(-not $node){$node=(Get-Command node -ErrorAction Stop).Source}
Push-Location (Join-Path $workspace 'trackbite-system')
try{foreach($test in @('smoke','sync-smoke','platform','resilience','storefront')){& $node "tests/$test.js";if($LASTEXITCODE -ne 0){throw "$test failed"}}}finally{Pop-Location}
