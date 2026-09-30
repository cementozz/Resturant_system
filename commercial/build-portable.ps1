param([string]$OutputDir = "$PSScriptRoot\..\dist-commercial")
$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$out=[IO.Path]::GetFullPath($OutputDir)
if(Test-Path $out){Remove-Item -Recurse -Force $out}
New-Item -ItemType Directory -Force $out | Out-Null
foreach($d in @('runtime','license','data','.runtime')){New-Item -ItemType Directory -Force (Join-Path $out $d)|Out-Null}
Copy-Item -Recurse -Force (Join-Path $root 'trackbite-system') (Join-Path $out 'trackbite-system')
Copy-Item -Recurse -Force (Join-Path $root 'commercial') (Join-Path $out 'commercial')
# Development/test files are not required by a restaurant installation.
foreach($p in @('tests','tools','cloud')){ $x=Join-Path $out ('trackbite-system\'+$p); if(Test-Path $x){Remove-Item -Recurse -Force $x} }
foreach($p in @('node_modules','data')){ $x=Join-Path $out ('trackbite-system\'+$p); if(Test-Path $x){Remove-Item -Recurse -Force $x} }

$nodeUrl='https://nodejs.org/dist/v22.16.0/win-x64/node.exe'
$nodeFile=Join-Path $out 'runtime\node.exe'
Invoke-WebRequest $nodeUrl -OutFile $nodeFile -UseBasicParsing
$expected='c5ff4c736112dd483c750fd4149d30c8a116db1a49b8b3ec88be4b65e6c86c19'
$actual=(Get-FileHash $nodeFile -Algorithm SHA256).Hash.ToLowerInvariant()
if($actual -ne $expected){throw "Node runtime checksum mismatch: $actual"}

$source=@'
using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;
class TrackBiteLauncher {
  [STAThread]
  static void Main() {
    string root=AppDomain.CurrentDomain.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar);
    string node=Path.Combine(root,"runtime","node.exe");
    string start=Path.Combine(root,"commercial","start.js");
    if(!File.Exists(node)||!File.Exists(start)) { MessageBox.Show("Track Bite files are incomplete.","Track Bite",MessageBoxButtons.OK,MessageBoxIcon.Error); return; }
    Directory.CreateDirectory(Path.Combine(root,".runtime"));
    var psi=new ProcessStartInfo(node,"\""+start+"\"");
    psi.WorkingDirectory=root; psi.UseShellExecute=false; psi.CreateNoWindow=true;
    var p=Process.Start(psi);
    if(p==null){MessageBox.Show("Track Bite could not start.","Track Bite");return;}
    if(p.WaitForExit(4500)) {
      if(p.ExitCode==17) {
        string req=Path.Combine(root,"ACTIVATION_REQUEST.txt");
        MessageBox.Show("This computer is not activated yet.\n\nAn ACTIVATION_REQUEST.txt file was created. Send it to the software seller, place the returned trackbite.license file in the license folder, then open Track Bite again.","Track Bite Activation",MessageBoxButtons.OK,MessageBoxIcon.Information);
        if(File.Exists(req)) Process.Start(new ProcessStartInfo("notepad.exe","\""+req+"\""){UseShellExecute=true});
      } else if(p.ExitCode!=0) MessageBox.Show("Track Bite stopped during startup. Check the .runtime folder for diagnostics.","Track Bite",MessageBoxButtons.OK,MessageBoxIcon.Error);
    }
  }
}
'@
Add-Type -TypeDefinition $source -ReferencedAssemblies System.Windows.Forms -OutputAssembly (Join-Path $out 'TrackBite.exe') -OutputType WindowsApplication

@'
@echo off
powershell -NoProfile -ExecutionPolicy Bypass -Command "$c=Get-NetTCPConnection -LocalPort 4173 -State Listen -ErrorAction SilentlyContinue; if($c){$c|%%{Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue}}"
'@ | Set-Content -Encoding ASCII (Join-Path $out 'Stop Track Bite.bat')

@'
TRACK BITE - PORTABLE COMMERCIAL EDITION
========================================

CUSTOMER / RESTAURANT INSTALLATION
1. Copy this whole folder from the USB drive to a local folder on the restaurant PC.
   Recommended: C:\TrackBite
2. Double-click TrackBite.exe.
3. On a new computer, ACTIVATION_REQUEST.txt will be created.
4. Send that activation request to the software seller.
5. Put the returned trackbite.license file inside the license folder.
6. Open TrackBite.exe again.

Nothing needs to be installed: the required Node.js Windows runtime is inside runtime\node.exe.
The POS and local database continue to work offline after activation.
The public customer website and synchronization naturally require internet connectivity.

IMPORTANT SECURITY NOTES
- The license is digitally signed and locked to one computer fingerprint.
- Copying the folder to another computer will create a different activation request and will not reuse the old license.
- Keep the entire data folder backed up. It contains the restaurant operational database.
- Do not put the seller's private signing key inside this customer folder.
- No desktop licensing system is impossible to reverse engineer for a determined local administrator. For stronger commercial control, combine this machine-bound license with periodic server revalidation and code signing.

WEBSITE / CLOUD PAIRING
A restaurant-specific public website is paired separately. Do not copy another restaurant's private cloud synchronization key into this package.
'@ | Set-Content -Encoding UTF8 (Join-Path $out 'README - START HERE.txt')

@'
Place the seller-issued trackbite.license file in this folder.
Do not store the seller private signing key here.
'@ | Set-Content -Encoding UTF8 (Join-Path $out 'license\README.txt')

$zip=Join-Path (Split-Path $out -Parent) 'TrackBite-Portable-Commercial.zip'
if(Test-Path $zip){Remove-Item $zip -Force}
Compress-Archive -Path (Join-Path $out '*') -DestinationPath $zip -CompressionLevel Optimal
Write-Host "Portable package: $zip"
