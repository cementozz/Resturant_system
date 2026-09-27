process.env.DEMO_MODE='true';
// Real Workers/D1 runtime, bridged to an isolated local POS. Never uses live data.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const {spawn}=require('node:child_process');
const {Miniflare}=require('miniflare');
const root=path.resolve(__dirname,'../..');fs.mkdirSync(path.join(root,'.runtime'),{recursive:true});const temp=fs.mkdtempSync(path.join(root,'.runtime','hosted-test-'));
const secret=crypto.randomBytes(32).toString('hex'),localUrl='http://127.0.0.1:4194',cloudUrl='http://127.0.0.1:5194';
let mf,local,bridge,token,logs='';const pause=ms=>new Promise(r=>setTimeout(r,ms));
const options={modules:true,scriptPath:path.join(root,'dist/server/index.mjs'),compatibilityDate:'2026-05-22',compatibilityFlags:['nodejs_compat'],bindings:{SYNC_SECRET:secret},d1Databases:['DB'],d1Persist:path.join(temp,'d1'),serviceBindings:{ASSETS:()=>new Response('asset')}};
async function cloud(url,body,status=200,auth=false,ip='127.0.0.1'){
 const r=await mf.dispatchFetch('https://restaurant.test'+url,{method:body===undefined?'GET':'POST',headers:{'content-type':'application/json','cf-connecting-ip':ip,...(auth?{'x-sync-secret':secret}:{})},body:body===undefined?undefined:JSON.stringify(body)});
 const d=await r.json();assert.equal(r.status,status,url+': '+JSON.stringify(d));return d;
}
async function pos(url,body,status=200){const r=await fetch(localUrl+url,{method:body===undefined?'GET':'POST',headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body)});const d=await r.json();assert.equal(r.status,status,JSON.stringify(d));return d}
async function until(fn){for(let i=0;i<150;i++){try{const value=await fn();if(value)return value}catch{}await pause(100)}throw new Error('Timed out: '+logs)}
(async()=>{try{
 mf=new Miniflare(options);await mf.ready;
 assert.equal((await cloud('/api/status')).restaurantOnline,false);
 await cloud('/api/sync/orders/pending',undefined,401);await cloud('/api/owner/report',undefined,404);await cloud('/api/login',{username:'owner',password:'1234'},404);
 assert.equal((await mf.dispatchFetch('https://restaurant.test/pos/')).status,404);
 bridge=http.createServer(async(req,res)=>{try{const chunks=[];for await(const chunk of req)chunks.push(chunk);const data=Buffer.concat(chunks);const reply=await mf.dispatchFetch('https://restaurant.test'+req.url,{method:req.method,headers:req.headers,body:data.length?data:undefined});res.writeHead(reply.status,Object.fromEntries(reply.headers));res.end(Buffer.from(await reply.arrayBuffer()))}catch(e){res.writeHead(503);res.end(JSON.stringify({error:e.message}))}});await new Promise(r=>bridge.listen(5194,'127.0.0.1',r));
 local=spawn(process.execPath,['server.js'],{cwd:path.join(root,'trackbite-system'),env:{...process.env,PORT:'4194',TRACKBITE_DB:path.join(temp,'pos.db'),CLOUD_API_URL:cloudUrl,SYNC_SECRET:secret,SYNC_INTERVAL_MS:'200'},stdio:['ignore','pipe','pipe']});local.stderr.on('data',d=>logs+=d);
 await until(()=>pos('/api/status'));token=(await pos('/api/login',{username:'owner',password:'1234'})).token;
 await pos('/api/settings',{delivery_fee:'20',tax_enabled:'true',tax_type:'percentage',tax_value:'14'});
 await until(async()=>{const m=await cloud('/api/public/menu');return m.products.length===4&&m.settings.delivery_fee==='20'&&m.online});
 const payload={requestId:crypto.randomUUID(),items:[{productId:1,qty:1,modifiers:[1],notes:'No onions'}],customerName:'Worker test',customerPhone:'01012345678',orderType:'delivery',deliveryAddress:'Test address',deliveryDetails:{fullAddress:'Test address'},expectedTotal:208.1};
 await cloud('/api/orders',{...payload,expectedTotal:1},409);
 const placed=(await cloud('/api/orders',payload,201)).order;assert.equal(placed.total,208.1);
 const retries=await Promise.all(Array.from({length:6},()=>cloud('/api/orders',payload,201)));assert(retries.every(x=>x.order.id===placed.id));
 await cloud('/api/orders',{...payload,notes:'Changed order'},409);
 const imported=await until(async()=>{const rows=(await pos('/api/orders')).orders;return rows.find(x=>x.request_id===placed.id)});
 assert.equal(imported.total,208.1);assert.equal(imported.payment_status,'due');
 await until(async()=>(await cloud('/api/tracking/'+placed.trackingToken)).order.status==='accepted');
 await pos('/api/shifts/open',{openingCash:500},201);await pos('/api/orders/'+imported.id+'/collect',{payments:[{methodId:1,amount:208.1}]});
 for(const status of ['preparing','ready','fulfilled'])await pos('/api/orders/'+imported.id+'/fulfill',{status});
 await until(async()=>{const t=(await cloud('/api/tracking/'+placed.trackingToken)).order;return t.status==='fulfilled'&&t.payment_status==='paid'});
 await cloud('/api/sync/orders/'+placed.id+'/ack',{localOrderId:imported.id,paymentStatus:'due'},200,true);assert.equal((await cloud('/api/tracking/'+placed.trackingToken)).order.status,'fulfilled');
 const db=await mf.getD1Database('DB');assert.equal((await db.prepare('SELECT COUNT(*) count FROM site_orders').first()).count,1);
 const receipts=await db.prepare('SELECT COUNT(*) count FROM site_sync_receipts').first();assert(receipts.count>0);
 const replay={eventKey:crypto.randomUUID(),entityType:'orders',payload:{id:imported.id,fulfillment_status:'fulfilled',payment_status:'paid'}};
 await cloud('/api/sync/events',replay,200,true);await cloud('/api/sync/events',{...replay,payload:{...replay.payload,fulfillment_status:'preparing'}},200,true);assert.equal((await cloud('/api/tracking/'+placed.trackingToken)).order.status,'fulfilled');
 const minute=Math.floor(Date.now()/60000),bucket=crypto.createHash('sha256').update('rate-test:'+minute).digest('hex');await db.prepare('INSERT INTO site_rate_limits(bucket,count,expires_at) VALUES(?,20,?)').bind(bucket,Date.now()+120000).run();await cloud('/api/orders',{...payload,requestId:crypto.randomUUID()},429,false,'rate-test');
 await db.prepare("UPDATE site_state SET value='2000-01-01T00:00:00Z' WHERE key='heartbeat'").run();
 await new Promise(resolve=>{local.once('exit',resolve);local.kill()});local=null;
 await db.prepare("UPDATE site_state SET value='2000-01-01T00:00:00Z' WHERE key='heartbeat'").run();await cloud('/api/orders',{...payload,requestId:crypto.randomUUID()},503);
 // Retries of an accepted order remain recoverable even while the POS is offline.
 assert.equal((await cloud('/api/orders',payload,201)).order.id,placed.id);
 await mf.dispose();mf=new Miniflare(options);await mf.ready;assert.equal((await cloud('/api/tracking/'+placed.trackingToken)).order.status,'fulfilled');
 console.log(JSON.stringify({ok:true,checks:['public menu synchronized from POS','private sync authentication','staff routes inaccessible','D1 persistence across restart','shared checkout pricing','concurrent duplicate retries','website order imported once into POS','paid/fulfilled status synchronized back','acknowledgement and event replay preserve final status','order rate limit','offline pause with safe retry recovery']},null,2));
}finally{if(local)await new Promise(resolve=>{local.once('exit',resolve);local.kill()});if(bridge)await new Promise(r=>bridge.close(r));await mf?.dispose();const resolved=path.resolve(temp);if(resolved.startsWith(path.join(root,'.runtime')+path.sep)&&path.basename(resolved).startsWith('hosted-test-'))fs.rmSync(resolved,{recursive:true,force:true})}})().catch(e=>{console.error(e);process.exitCode=1});
