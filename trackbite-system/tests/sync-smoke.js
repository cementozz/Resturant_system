const {spawn}=require('child_process');const fs=require('fs');const path=require('path');
const root=path.join(__dirname,'..'),localDb=path.join(__dirname,'sync-local.db'),cloudDb=path.join(__dirname,'sync-cloud.db');
for(const f of [localDb,cloudDb])for(const s of ['','-wal','-shm'])try{fs.unlinkSync(f+s)}catch{}
const secret='smoke-secret';
const cloud=spawn(process.execPath,['cloud/server.js'],{cwd:root,env:{...process.env,CLOUD_PORT:'5193',CLOUD_DB:cloudDb,SYNC_SECRET:secret},stdio:['ignore','pipe','pipe']});
const local=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,PORT:'4193',TRACKBITE_DB:localDb,CLOUD_API_URL:'http://127.0.0.1:5193',SYNC_SECRET:secret,SYNC_INTERVAL_MS:'200'},stdio:['ignore','pipe','pipe']});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function j(base,url,opt={}){const r=await fetch(base+url,opt);const d=await r.json();if(!r.ok)throw new Error(`${url} ${r.status}: ${JSON.stringify(d)}`);return d}
(async()=>{try{
 for(let i=0;i<40;i++){try{await j('http://127.0.0.1:4193','/api/status');await j('http://127.0.0.1:5193','/api/status');break}catch{}await sleep(100)}
 await sleep(900);
 const cloudStatus=await j('http://127.0.0.1:5193','/api/status');if(!cloudStatus.restaurantOnline)throw new Error('Cloud did not receive restaurant heartbeat');
 const menu=await j('http://127.0.0.1:5193','/api/public/menu');if(!menu.products?.length)throw new Error('Catalog not synchronized');
 const web=await j('http://127.0.0.1:5193','/api/orders',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({items:[{productId:1,qty:1}],customerName:'Cloud Customer'})});
 await sleep(900);
 const login=await j('http://127.0.0.1:4193','/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:'owner',password:'1234'})});
 const list=await j('http://127.0.0.1:4193','/api/orders',{headers:{authorization:'Bearer '+login.token}});const imported=list.orders.find(x=>x.source==='web');if(!imported)throw new Error('Cloud web order not imported to restaurant');
 await sleep(600);const events=await j('http://127.0.0.1:5193','/api/sync/events',{headers:{'x-sync-secret':secret}});if(!events.rows.length)throw new Error('Local sync event was not pushed to cloud');
 console.log(JSON.stringify({ok:true,cloudOrder:web.order.sequential_no,localOrder:imported.sequential_no,catalogProducts:menu.products.length,events:events.rows.length},null,2));
 }finally{cloud.kill();local.kill();await sleep(100);for(const f of [localDb,cloudDb])for(const s of ['','-wal','-shm'])try{fs.unlinkSync(f+s)}catch{}}
})().catch(e=>{console.error(e);cloud.kill();local.kill();process.exit(1)});
