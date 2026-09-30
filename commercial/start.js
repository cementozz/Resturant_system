const fs=require('fs');
const path=require('path');
const {spawn}=require('child_process');
const {verifyLicense}=require('./license-runtime');

const root=path.resolve(__dirname,'..');
const result=verifyLicense();
if(!result.ok){
  console.error(result.reason);
  console.error('Activation request: '+result.request);
  process.exit(17);
}
const license=result.payload;
process.env.DEMO_MODE='false';
process.env.HOST='127.0.0.1';
process.env.PORT=process.env.PORT||'4173';
if(license.initialOwnerPassword)process.env.INITIAL_OWNER_PASSWORD=license.initialOwnerPassword;
if(license.cloudUrl&&license.syncSecret){
  process.env.CLOUD_API_URL=String(license.cloudUrl).replace(/\/$/,'');
  process.env.SYNC_SECRET=license.syncSecret;
  process.env.SYNC_TIMEOUT_MS='15000';
}
fs.mkdirSync(path.join(root,'.runtime'),{recursive:true});
const url='http://127.0.0.1:'+process.env.PORT+'/pos/';
setTimeout(()=>{
  try{spawn('cmd.exe',['/c','start','',url],{detached:true,stdio:'ignore',windowsHide:true}).unref()}catch{}
},1800).unref();
require('../trackbite-system/server.js');
