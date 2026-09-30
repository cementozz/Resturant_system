const fs=require('fs');
const path=require('path');
const os=require('os');
const crypto=require('crypto');
const {execFileSync}=require('child_process');

const PRODUCT='trackbite-commercial-v1';
const PUBLIC_KEY=`-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEA5d4o334OkHOBKSw0Sx2e9ND93z+i+25FNRNbHp9dwYQ=\n-----END PUBLIC KEY-----\n`;

function b64urlToBuffer(v){return Buffer.from(String(v).replace(/-/g,'+').replace(/_/g,'/'),'base64')}
function rootDir(){return path.resolve(__dirname,'..')}
function licensePath(){return path.join(rootDir(),'license','trackbite.license')}
function requestPath(){return path.join(rootDir(),'ACTIVATION_REQUEST.txt')}
function statePath(){return path.join(rootDir(),'.runtime','commercial-license-state.json')}

function hardwareText(){
  if(process.platform!=='win32') return `nonwindows|${os.hostname()}|${os.arch()}`;
  const script=[
    "$ErrorActionPreference='SilentlyContinue'",
    "$mg=(Get-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Cryptography').MachineGuid",
    "$uuid=(Get-CimInstance Win32_ComputerSystemProduct).UUID",
    "$bios=(Get-CimInstance Win32_BIOS).SerialNumber",
    "$board=(Get-CimInstance Win32_BaseBoard).SerialNumber",
    "Write-Output (($mg,$uuid,$bios,$board -join '|'))"
  ].join(';');
  try{return execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{encoding:'utf8',windowsHide:true,timeout:12000}).trim()}
  catch{return `${os.hostname()}|${process.env.SystemDrive||'C:'}|${os.arch()}`}
}
function fingerprint(){return crypto.createHash('sha256').update(hardwareText().toLowerCase().replace(/\s+/g,'')).digest('hex')}
function safeRead(file){try{return JSON.parse(fs.readFileSync(file,'utf8'))}catch{return null}}
function writeRequest(fp,reason){
  const request={product:PRODUCT,fingerprint:fp,machineName:os.hostname(),createdAt:new Date().toISOString()};
  const requestCode=Buffer.from(JSON.stringify(request)).toString('base64url');
  const text=[
    'TRACK BITE ACTIVATION REQUEST',
    '================================',
    '',
    `Machine: ${request.machineName}`,
    `Fingerprint: ${fp}`,
    '',
    'Activation code:',
    requestCode,
    '',
    `Status: ${reason||'License required'}`,
    '',
    'Send this file or the activation code to the software seller.',
    'The seller will return a file named trackbite.license.',
    'Place it inside the license folder next to TrackBite.exe, then open TrackBite.exe again.',
    '',
    'Do not edit the activation code.'
  ].join('\r\n');
  fs.writeFileSync(requestPath(),text,'utf8');
  return requestPath();
}
function verifyLicense(){
  const fp=fingerprint();
  const file=licensePath();
  const lic=safeRead(file);
  if(!lic?.payload||!lic?.signature)return {ok:false,reason:'No valid license file was found.',request:writeRequest(fp,'License missing')};
  let payloadBytes,payload;
  try{payloadBytes=b64urlToBuffer(lic.payload);payload=JSON.parse(payloadBytes.toString('utf8'))}catch{return {ok:false,reason:'The license file is damaged.',request:writeRequest(fp,'Invalid license format')}}
  let verified=false;
  try{verified=crypto.verify(null,payloadBytes,PUBLIC_KEY,b64urlToBuffer(lic.signature))}catch{}
  if(!verified)return {ok:false,reason:'The license signature is invalid.',request:writeRequest(fp,'Invalid signature')};
  if(payload.product!==PRODUCT)return {ok:false,reason:'This license is for a different product.',request:writeRequest(fp,'Wrong product')};
  if(payload.fingerprint!==fp)return {ok:false,reason:'This license belongs to another computer.',request:writeRequest(fp,'Computer does not match license')};
  const now=Date.now();
  if(payload.notBefore&&now<Date.parse(payload.notBefore))return {ok:false,reason:'This license is not active yet.',request:writeRequest(fp,'License not active yet')};
  if(payload.expiresAt&&now>Date.parse(payload.expiresAt))return {ok:false,reason:'This license has expired.',request:writeRequest(fp,'License expired')};
  fs.mkdirSync(path.dirname(statePath()),{recursive:true});
  const previous=safeRead(statePath());
  if(previous?.lastSeen&&now+24*3600*1000<Date.parse(previous.lastSeen))return {ok:false,reason:'The computer clock moved backwards significantly. Correct the clock and try again.',request:writeRequest(fp,'Clock validation failed')};
  fs.writeFileSync(statePath(),JSON.stringify({licenseId:payload.licenseId,lastSeen:new Date().toISOString(),customer:payload.customer},null,2));
  return {ok:true,payload};
}

if(require.main===module){
  const result=verifyLicense();
  if(result.ok){console.log(`LICENSE_OK ${result.payload.licenseId} ${result.payload.customer||''}`);process.exit(0)}
  console.error(`LICENSE_REQUIRED: ${result.reason}`);
  console.error(`Activation request: ${result.request}`);
  process.exit(17);
}
module.exports={verifyLicense,fingerprint,PRODUCT};
