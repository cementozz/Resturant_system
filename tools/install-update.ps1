param([Parameter(Mandatory=$true)][string]$Version)
$ErrorActionPreference='Stop'
$workspace=[IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
if($Version -notmatch '^\d+\.\d+\.\d+$'){throw 'Use an approved semantic version, for example 0.6.0.'}
$runtime=Join-Path $workspace '.runtime'
$stage=Join-Path $runtime ('release-install-'+[guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $stage | Out-Null
$base="https://github.com/cementozz/Resturant_system/releases/download/v$Version"
$manifest=Invoke-RestMethod "$base/trackbite-approved.json"
if($manifest.approved -ne $true -or $manifest.version -ne $Version -or $manifest.asset -ne "trackbite-$Version.zip" -or $manifest.sha256 -notmatch '^[a-fA-F0-9]{64}$'){throw 'Invalid approval or integrity metadata'}
$archive=Join-Path $stage $manifest.asset
Invoke-WebRequest "$base/$($manifest.asset)" -OutFile $archive -UseBasicParsing
if((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash -ne $manifest.sha256){throw 'Release checksum mismatch'}
Add-Type -AssemblyName System.IO.Compression.FileSystem
$unpack=Join-Path $stage 'unpacked'
New-Item -ItemType Directory -Path $unpack | Out-Null
$zip=[IO.Compression.ZipFile]::OpenRead($archive)
try{foreach($entry in $zip.Entries){$name=$entry.FullName.Replace('\','/');$target=[IO.Path]::GetFullPath((Join-Path $unpack $name));if(-not $target.StartsWith($unpack+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase) -or $name -match '(^|/)(data|backups|node_modules|\.runtime|\.git|\.env)(/|$)' -or $name -match '\.(db|sqlite|key|pem)$'){throw "Unsafe archive entry: $name"}}}finally{$zip.Dispose()}
[IO.Compression.ZipFile]::ExtractToDirectory($archive,$unpack)
$project=Join-Path $workspace 'trackbite-system'
$replacement=Join-Path $unpack 'trackbite-system'
$current=(Get-Content -Raw (Join-Path $project 'package.json') | ConvertFrom-Json).version
if([version]$Version -le [version]$current){throw 'Release must be newer than the installed version'}
if(-not ($manifest.databaseCompatibleFrom -contains $current)){throw 'This release has no approved database compatibility/rollback strategy for the installed version'}
if((Get-Content -Raw (Join-Path $replacement 'package.json') | ConvertFrom-Json).version -ne $Version){throw 'Package version mismatch'}
$node=Get-ChildItem $runtime -Filter node.exe -Recurse | Select-Object -First 1 -ExpandProperty FullName
if(-not $node){$node=(Get-Command node -ErrorAction Stop).Source}
# Test the downloaded application with temporary databases before stopping the restaurant.
$env:DEMO_MODE='true'
Push-Location $replacement
try{& $node tests/smoke.js;if($LASTEXITCODE -ne 0){throw 'Downloaded release smoke test failed'}}finally{Pop-Location;Remove-Item Env:DEMO_MODE -ErrorAction SilentlyContinue}
$backup=Join-Path $stage 'verified-database.db'
$env:TB_UPDATE_DATABASE=Join-Path $project 'data/trackbite.db';$env:TB_UPDATE_BACKUP=$backup
@'
const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(process.env.TB_UPDATE_DATABASE);db.prepare('VACUUM INTO ?').run(process.env.TB_UPDATE_BACKUP);db.close();const copy=new DatabaseSync(process.env.TB_UPDATE_BACKUP,{readOnly:true});try{if(copy.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw Error('Backup failed verification')}finally{copy.close()}
'@ | & $node -
if($LASTEXITCODE -ne 0){throw 'Database backup failed'}
& (Join-Path $PSScriptRoot 'stop.ps1')
$previous=Join-Path $stage 'previous-application'
# All recursive moves stay inside the checked workspace. Keep the same live database.
foreach($candidate in @($project,$replacement,$previous)){if(-not ([IO.Path]::GetFullPath($candidate)).StartsWith($workspace+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Update path is outside the workspace'}}
Move-Item -LiteralPath $project -Destination $previous
try{
 Move-Item -LiteralPath $replacement -Destination $project
 if(Test-Path (Join-Path $project 'data')){Remove-Item -LiteralPath (Join-Path $project 'data')}
 Move-Item -LiteralPath (Join-Path $previous 'data') -Destination (Join-Path $project 'data')
 & (Join-Path $PSScriptRoot 'start.ps1') -Open none
 $health=Invoke-RestMethod 'http://127.0.0.1:4173/api/status'
 if(-not $health.ok){throw 'Updated application health check failed'}
 Write-Host "Installed $Version. Verified backup: $backup"
}catch{
 $failure=$_
 & (Join-Path $PSScriptRoot 'stop.ps1')
 $failed=Join-Path $stage 'failed-application'
 if(Test-Path $project){Move-Item -LiteralPath $project -Destination $failed}
 Move-Item -LiteralPath $previous -Destination $project
 if(Test-Path (Join-Path $failed 'data')){Move-Item -LiteralPath (Join-Path $failed 'data') -Destination (Join-Path $project 'data')}
 # Compatibility was required above. Never restore the database blindly.
 & (Join-Path $PSScriptRoot 'start.ps1') -Open none
 throw "Update rolled back to the previous application using the current database: $failure"
}
