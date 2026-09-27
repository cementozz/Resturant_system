$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$suite=Join-Path $root ('.runtime/updater-test-'+[guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $suite | Out-Null
$node=Get-ChildItem (Join-Path $root '.runtime') -Filter node.exe -Recurse | Select-Object -First 1 -ExpandProperty FullName
if (-not $node) { $node=(Get-Command node -ErrorAction Stop).Source }
$env:PATH=(Split-Path -Parent $node)+';'+$env:PATH
Add-Type -AssemblyName System.IO.Compression.FileSystem
function Invoke-WebRequest {param($Uri,$OutFile,[switch]$UseBasicParsing) Copy-Item -LiteralPath $global:TBUpdaterTest_packageZip -Destination $OutFile}
function Invoke-RestMethod {param($Uri)
 if($Uri -like '*trackbite-approved.json'){return $global:TBUpdaterTest_approvalManifest}
 if($Uri -eq 'http://127.0.0.1:4173/api/status'){$v=(Get-Content -Raw (Join-Path $global:TBUpdaterTest_testWorkspace 'trackbite-system/package.json')|ConvertFrom-Json).version;return @{ok=(-not $global:TBUpdaterTest_failHealth -or $v -eq '0.6.0')}}
 throw 'Unexpected network call in isolated updater test'
}
try{
 foreach($scenario in @('success','failed-health','bad-checksum')){
  $global:TBUpdaterTest_testWorkspace=Join-Path $suite $scenario
  $project=Join-Path $global:TBUpdaterTest_testWorkspace 'trackbite-system'
  $testTools=Join-Path $global:TBUpdaterTest_testWorkspace 'tools'
  New-Item -ItemType Directory -Force -Path (Join-Path $project 'data'),$testTools,(Join-Path $global:TBUpdaterTest_testWorkspace '.runtime') | Out-Null
  [IO.File]::WriteAllText((Join-Path $project 'package.json'),'{"version":"0.6.0"}')
  [IO.File]::WriteAllText((Join-Path $global:TBUpdaterTest_testWorkspace '.runtime/public-cloud.json'),'{"testSecret":"preserve-only"}')
  $env:TB_TEST_DATABASE=Join-Path $project 'data/trackbite.db'
  $env:TB_TEST_EXPECT_MIGRATION=if($scenario -eq 'bad-checksum'){'false'}else{'true'}
  @'
const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(process.env.TB_TEST_DATABASE);db.exec("CREATE TABLE orders(id TEXT PRIMARY KEY);INSERT INTO orders VALUES('preserve-order');");db.close();
'@ | & $node -
  if($LASTEXITCODE -ne 0){throw 'Fixture database failed'}
  Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'install-update.ps1') -Destination $testTools
  [IO.File]::WriteAllText((Join-Path $testTools 'stop.ps1'),"Write-Host 'Isolated service stopped'")
  [IO.File]::WriteAllText((Join-Path $testTools 'start.ps1'),@'
param($Open)
$env:TB_TEST_DATABASE=Join-Path (Split-Path -Parent $PSScriptRoot) 'trackbite-system/data/trackbite.db'
@"
const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(process.env.TB_TEST_DATABASE);db.exec('CREATE TABLE IF NOT EXISTS committed_migration(id INTEGER)');db.close();
"@ | node -
if($LASTEXITCODE -ne 0){throw 'Isolated start failed'}
'@)
  $packageRoot=Join-Path $global:TBUpdaterTest_testWorkspace 'package'
  New-Item -ItemType Directory -Force -Path (Join-Path $packageRoot 'trackbite-system/tests') | Out-Null
  [IO.File]::WriteAllText((Join-Path $packageRoot 'trackbite-system/package.json'),'{"version":"0.6.1"}')
  [IO.File]::WriteAllText((Join-Path $packageRoot 'trackbite-system/tests/smoke.js'),"require('fs').mkdirSync('data',{recursive:true});")
  $global:TBUpdaterTest_packageZip=Join-Path $global:TBUpdaterTest_testWorkspace 'package.zip'
  [IO.Compression.ZipFile]::CreateFromDirectory($packageRoot,$global:TBUpdaterTest_packageZip)
  $global:TBUpdaterTest_approvalManifest=@{version='0.6.1';asset='trackbite-0.6.1.zip';approved=$true;sha256=(Get-FileHash $global:TBUpdaterTest_packageZip -Algorithm SHA256).Hash;databaseCompatibleFrom=@('0.6.0')}
  if($scenario -eq 'bad-checksum'){$global:TBUpdaterTest_approvalManifest.sha256='0'*64}
  $global:TBUpdaterTest_failHealth=$scenario -eq 'failed-health'
  $failed=$false
  try{& (Join-Path $testTools 'install-update.ps1') -Version '0.6.1'}catch{$failed=$true;if($scenario -eq 'success'){throw}}
  if(($scenario -eq 'success') -eq $failed){throw "Unexpected outcome: $scenario"}
  $installed=(Get-Content -Raw (Join-Path $project 'package.json')|ConvertFrom-Json).version
  $expected=if($scenario -eq 'success'){'0.6.1'}else{'0.6.0'}
  if($installed -ne $expected){throw 'Application rollback/install mismatch'}
  $env:TB_TEST_DATABASE=Join-Path $project 'data/trackbite.db'
  @'
const assert=require('assert'),{DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(process.env.TB_TEST_DATABASE,{readOnly:true});assert.equal(db.prepare('SELECT id FROM orders').get().id,'preserve-order');assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');if(process.env.TB_TEST_EXPECT_MIGRATION==='true')assert(db.prepare("SELECT name FROM sqlite_master WHERE name='committed_migration'").get());db.close();
'@ | & $node -
  if($LASTEXITCODE -ne 0){throw 'Preserved database validation failed'}
  if(-not (Test-Path (Join-Path $global:TBUpdaterTest_testWorkspace '.runtime/public-cloud.json'))){throw 'Private runtime configuration was lost'}
  Write-Host "PASS: $scenario; data and secrets preserved"
 }
}finally{
 $resolved=[IO.Path]::GetFullPath($suite)
 if($resolved.StartsWith((Join-Path $root '.runtime')+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){Remove-Item -LiteralPath $resolved -Recurse -Force}
}
