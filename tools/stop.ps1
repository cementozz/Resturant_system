$ErrorActionPreference='Stop'
$workspace=Split-Path -Parent $PSScriptRoot
$runtime=Join-Path $workspace '.runtime'
foreach($service in @('restaurant','cloud')){
  $recordPath=Join-Path $runtime "$service.process.json"
  if(-not(Test-Path -LiteralPath $recordPath)){Write-Host "$service has no launcher process record.";continue}
  $record=Get-Content -Raw -LiteralPath $recordPath | ConvertFrom-Json
  $process=Get-Process -Id $record.Id -ErrorAction SilentlyContinue
  if($process){
    $sameTime=$process.StartTime.ToUniversalTime().ToString('o') -eq $record.Started
    $sameFile=$process.Path -eq $record.Executable
    if(-not($sameTime -and $sameFile)){Write-Warning "Skipped $service because its process identity changed.";continue}
    Stop-Process -Id $process.Id
    Write-Host "$service stopped. Your data is saved."
  }else{Write-Host "$service is already stopped."}
  Remove-Item -LiteralPath $recordPath
}
