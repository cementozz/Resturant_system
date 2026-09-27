process.env.DEMO_MODE='true';
// Real local/cloud HTTP checks with isolated databases; never uses restaurant data.
const assert=require('node:assert/strict');
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {spawn,spawnSync}=require('child_process');
const root=path.resolve(__dirname,'..'),temp=fs.mkdtempSync(path.join(__dirname,'storefront-'));
const L='http://127.0.0.1:4196',C='http://127.0.0.1:5196';
let local,cloud,auth,logs='';const secret=crypto.randomUUID();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function start(file,env){const p=spawn(process.execPath,[file],{cwd:root,env:{...process.env,...env,SYNC_SECRET:secret},stdio:['ignore','pipe','pipe']});p.stderr.on('data',d=>logs+=d);return p}
async function request(base,url,b,status=200,token=null,method){const r=await fetch(base+url,{method:method||(b===undefined?'GET':'POST'),headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},body:b===undefined?undefined:JSON.stringify(b)});const d=await r.json();assert.equal(r.status,status,url+': '+JSON.stringify(d));return d}
async function until(fn){for(let i=0;i<100;i++){try{const value=await fn();if(value)return value}catch{}await sleep(100)}throw new Error('Timeout: '+logs)}
(async()=>{try{
  for(const file of ['storefront.js',...fs.readdirSync(path.join(root,'public/customer/modules')).filter(x=>x.endsWith('.js')).map(x=>'modules/'+x)]){const syntax=path.join(temp,'syntax.mjs');fs.copyFileSync(path.join(root,'public/customer',file),syntax);const checked=spawnSync(process.execPath,['--check',syntax],{encoding:'utf8'});assert.equal(checked.status,0,file+': '+checked.stderr)}
  cloud=start('cloud/server.js',{CLOUD_PORT:'5196',CLOUD_DB:path.join(temp,'cloud.db')});local=start('server.js',{PORT:'4196',TRACKBITE_DB:path.join(temp,'local.db'),CLOUD_API_URL:C,SYNC_INTERVAL_MS:'150'});
  await until(()=>request(L,'/api/status'));await until(()=>request(C,'/api/status'));
  auth=(await request(L,'/api/login',{username:'owner',password:'1234'})).token;
  await request(L,'/api/settings',{restaurant_address:'Test pickup address',restaurant_phone:'01012345678',restaurant_hours:'Daily 12:00–23:00',delivery_fee:'20',tax_enabled:'true',tax_type:'percentage',tax_value:'14'},200,auth);
  const menu=await until(async()=>{const m=await request(C,'/api/public/menu');return m.settings?.restaurant_hours&&m.products.length===4&&m});
  assert.equal(menu.settings.restaurant_address,'Test pickup address');assert.equal(menu.settings.restaurant_phone,'01012345678');assert.equal(menu.settings.installation_id,undefined);
  const initialOrders=(await request(L,'/api/orders',undefined,200,auth)).orders.length;
  const initialStock=(await request(L,'/api/inventory/summary',undefined,200,auth)).summary;
  const order={requestId:crypto.randomUUID(),items:[{productId:1,qty:1,modifiers:[1],notes:'Sauce aside'}],customerName:'Website test',customerPhone:'01012345678',orderType:'delivery',deliveryAddress:'Test 12',deliveryDetails:{fullAddress:'Test 12'},expectedTotal:1};
  await request(L,'/api/public/orders',order,400);assert.equal((await request(L,'/api/orders',undefined,200,auth)).orders.length,initialOrders);assert.deepEqual((await request(L,'/api/inventory/summary',undefined,200,auth)).summary,initialStock);
  await request(C,'/api/orders',order,400);
  order.expectedTotal=208.1;const placed=(await request(C,'/api/orders',order,201)).order;assert.equal(placed.total,208.1);assert.equal((await request(C,'/api/orders',order,201)).order.id,placed.id);
  const imported=await until(async()=>{const rows=(await request(L,'/api/orders',undefined,200,auth)).orders;return rows.find(x=>x.request_id===placed.id)});assert.equal(imported.total,208.1);
  const direct=(await request(L,'/api/public/orders',{...order,requestId:crypto.randomUUID()})).order;assert(direct.trackingToken);assert.equal((await request(L,'/api/tracking/'+direct.trackingToken)).order.status,'accepted');
  await request(L,'/api/shifts/open',{openingCash:500},201,auth);await request(L,'/api/orders/'+direct.id+'/collect',{payments:[{methodId:1,amount:208.1}]},200,auth);await request(L,'/api/orders/'+direct.id+'/refund',{reason:'Test cancelled order',restock:true},200,auth);assert.equal((await request(L,'/api/tracking/'+direct.trackingToken)).order.status,'cancelled');
  for(const base of [L,C]){for(const file of ['index.html','storefront.js','storefront.css','modules/core.js','modules/menu.js','modules/customer.js','modules/checkout.js'])assert.equal((await fetch(base+'/customer/'+file)).status,200);const img=await fetch(base+'/customer/assets/classic.png');assert.equal(img.headers.get('content-type'),'image/png');assert.equal(img.status,200)}
  console.log(JSON.stringify({ok:true,checks:['storefront module syntax','local and cloud assets','restaurant information sync','stale total rejected without stock or order side effects','cloud checkout and duplicate retry','local checkout','refund shown as cancelled to customer']},null,2));
}finally{const children=[local,cloud].filter(Boolean);await Promise.all(children.map(p=>new Promise(resolve=>{if(p.exitCode!==null)return resolve();p.once('exit',resolve);p.kill()})));const target=path.resolve(temp);if(target.startsWith(path.resolve(__dirname)+path.sep)&&path.basename(target).startsWith('storefront-'))fs.rmSync(target,{recursive:true,force:true})}})().catch(e=>{console.error(e);process.exitCode=1});
