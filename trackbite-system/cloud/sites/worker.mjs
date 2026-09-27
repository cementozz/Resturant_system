import pricing from '../../public/shared/pricing.js';

const schema=[
  'CREATE TABLE IF NOT EXISTS site_state(key TEXT PRIMARY KEY,value TEXT NOT NULL)',
  `CREATE TABLE IF NOT EXISTS site_orders(seq INTEGER PRIMARY KEY AUTOINCREMENT,id TEXT NOT NULL UNIQUE,request_key TEXT NOT NULL UNIQUE,request_hash TEXT NOT NULL,tracking_token TEXT NOT NULL UNIQUE,status TEXT NOT NULL DEFAULT 'pending',payment_status TEXT NOT NULL DEFAULT 'due',payload TEXT NOT NULL,total REAL NOT NULL,local_order_id TEXT UNIQUE,error TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,imported_at TEXT)`,
  'CREATE TABLE IF NOT EXISTS site_sync_receipts(event_key TEXT PRIMARY KEY,received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)',
  'CREATE TABLE IF NOT EXISTS site_rate_limits(bucket TEXT PRIMARY KEY,count INTEGER NOT NULL,expires_at INTEGER NOT NULL)',
  'CREATE INDEX IF NOT EXISTS site_order_pending ON site_orders(status,seq)'
];
const initialized=new WeakMap();
class HttpError extends Error{constructor(status,message){super(message);this.status=status}}
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'}})}
const fail=(status,message)=>{throw new HttpError(status,message)};
const text=(v,max=200)=>String(v??'').trim().slice(0,max);
const digest=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),x=>x.toString(16).padStart(2,'0')).join('');
async function secureEqual(a,b){if(!a||!b)return false;const [x,y]=await Promise.all([digest(a),digest(b)]);let result=0;for(let i=0;i<x.length;i++)result|=x.charCodeAt(i)^y.charCodeAt(i);return result===0}
async function body(request,max=32768){
  if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))fail(415,'JSON content type required');
  if(Number(request.headers.get('content-length')||0)>max)fail(413,'Request too large');
  const reader=request.body?.getReader();if(!reader)return {};const chunks=[];let size=0;
  for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>max){await reader.cancel();fail(413,'Request too large')}chunks.push(value)}
  const data=new Uint8Array(size);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length}
  try{const value=JSON.parse(new TextDecoder().decode(data));if(!value||typeof value!=='object'||Array.isArray(value))fail(400,'Invalid JSON object');return value}catch(e){if(e instanceof HttpError)throw e;fail(400,'Invalid JSON')}
}
async function store(binding){
  let ready=initialized.get(binding);if(!ready){ready=binding.batch(schema.map(sql=>binding.prepare(sql))).catch(e=>{initialized.delete(binding);throw e});initialized.set(binding,ready)}await ready;
  // All requests start at the primary, so status reads observe completed POS writes.
  const db=binding.withSession?binding.withSession('first-primary'):binding;
  return {one:(sql,...values)=>db.prepare(sql).bind(...values).first(),all:async(sql,...values)=>(await db.prepare(sql).bind(...values).all()).results,run:(sql,...values)=>db.prepare(sql).bind(...values).run(),batch:statements=>db.batch(statements.map(([sql,...values])=>db.prepare(sql).bind(...values)))};
}
const state=async(db,key)=>(await db.one('SELECT value FROM site_state WHERE key=?',key))?.value;
const put=(key,value)=>['INSERT INTO site_state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',key,value];
const online=heartbeat=>!!heartbeat&&Date.now()-Date.parse(heartbeat)<180000;
function publicOrder(row){return {id:row.id,sequential_no:row.seq+5000,total:row.total,status:row.status,trackingToken:row.tracking_token}}
function normalized(b){
  if(!Array.isArray(b.items)||!b.items.length||b.items.length>100)fail(400,'Order needs 1–100 items');
  const items=b.items.map(item=>{
    if(!item||!Number.isInteger(Number(item.productId)))fail(400,'Invalid product');
    const qty=Number(item.qty??1);if(!Number.isInteger(qty)||qty<1||qty>99)fail(400,'Quantity must be between 1 and 99');
    if(item.modifiers!==undefined&&!Array.isArray(item.modifiers))fail(400,'Invalid modifiers');
    const modifiers=[...new Set((item.modifiers||[]).map(Number))].sort((a,b)=>a-b);if(modifiers.length>30||modifiers.some(id=>!Number.isInteger(id)))fail(400,'Invalid modifiers');
    return {productId:Number(item.productId),qty,modifiers,notes:text(item.notes,500)};
  });
  const detailKeys=['area','street','fullAddress','building','floor','apartment','landmark','alternativePhone','deliveryNotes'];
  const details=Object.fromEntries(detailKeys.map(key=>[key,text(b.deliveryDetails?.[key],key==='fullAddress'||key==='deliveryNotes'?500:150)]));
  return {items,customerName:text(b.customerName,100)||null,customerPhone:text(b.customerPhone,25)||null,orderType:text(b.orderType||'pickup',50),deliveryAddress:text(b.deliveryAddress||details.fullAddress||details.street,500)||null,deliveryDetails:details,notes:text(b.notes,500)||null};
}
async function rateLimit(db,request){
  const ip=request.headers.get('cf-connecting-ip')||request.headers.get('x-real-ip')||'unknown';
  const minute=Math.floor(Date.now()/60000),bucket=await digest(ip+':'+minute);
  const row=await db.one('INSERT INTO site_rate_limits(bucket,count,expires_at) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET count=count+1 RETURNING count',bucket,(minute+2)*60000);
  if(row.count>20)fail(429,'Too many order attempts. Please wait a minute and try again.');
  await db.run('DELETE FROM site_rate_limits WHERE expires_at<?',Date.now());
}
async function api(request,env,url){
  if(!env.SYNC_SECRET||env.SYNC_SECRET.length<32||env.SYNC_SECRET==='trackbite-dev-secret')return json({error:'Restaurant connection is not configured'},503);
  if(!env.DB)return json({error:'Order storage is not configured'},503);
  const path=url.pathname,verb=request.method;
  if(path.startsWith('/api/sync/')&&!await secureEqual(request.headers.get('x-sync-secret'),env.SYNC_SECRET))return json({error:'Unauthorized'},401);
  const db=await store(env.DB);
  if(path==='/api/status'&&verb==='GET'){const heartbeat=await state(db,'heartbeat');return json({ok:true,service:'Track Bite Cloud',database:'managed-d1',heartbeat:heartbeat||null,restaurantOnline:online(heartbeat)})}
  if(path==='/api/public/menu'&&verb==='GET'){
    const c=JSON.parse(await state(db,'catalog')||'{"categories":[],"products":[],"modifiers":[],"orderTypes":[],"settings":{}}');
    return json({...c,online:online(await state(db,'heartbeat')),restaurant:{name_ar:c.settings?.restaurant_name_ar||'تراك بايت',name_en:c.settings?.restaurant_name_en||'Track Bite'}});
  }
  if(path==='/api/orders'&&verb==='POST'){
    if(request.headers.get('origin')&&request.headers.get('origin')!==url.origin)fail(403,'Cross-origin orders are not allowed');
    const b=await body(request),input=normalized(b),key=text(b.requestId,150);if(!/^[\w-]{16,150}$/.test(key))fail(400,'A valid request ID is required');
    const hash=await digest(JSON.stringify(input));
    const previous=await db.one('SELECT * FROM site_orders WHERE request_key=?',key);
    if(previous){if(previous.request_hash!==hash)fail(409,'Request ID already used for another order');return json({order:publicOrder(previous)},201)}
    if(!online(await state(db,'heartbeat')))fail(503,'Restaurant is offline; ordering is paused');
    const catalog=JSON.parse(await state(db,'catalog')||'{}');const type=(catalog.orderTypes||[]).find(x=>(x.code||x.id)===input.orderType);if(!type)fail(400,'Order type unavailable');
    if(!input.customerName||!/^\+?[0-9 ()-]{7,25}$/.test(input.customerPhone||''))fail(400,'Customer name and a valid mobile number are required');
    if(type.requires_delivery&&!input.deliveryAddress)fail(400,'Delivery address is required');
    const items=input.items.map(item=>{const p=(catalog.products||[]).find(x=>x.id===item.productId);if(!p)fail(400,'Product unavailable');let price=Number(p.price);for(const id of item.modifiers){const mod=(catalog.modifiers||[]).find(m=>m.id===id&&m.product_id===p.id);if(!mod)fail(400,'Modifier unavailable');price+=Number(mod.price)}if(!Number.isFinite(price)||price<0)fail(400,'Invalid product price');return {...item,price:pricing.round(price)}});
    const deliveryFee=type.requires_delivery?Number(catalog.settings?.delivery_fee||0):0;
    const priced=pricing.calculate({subtotal:pricing.round(items.reduce((sum,item)=>sum+pricing.round(item.price*item.qty),0)),deliveryFee,settings:catalog.settings});
    if(!Number.isFinite(Number(b.expectedTotal))||Math.abs(Number(b.expectedTotal)-priced.total)>0.001)fail(409,'Menu prices changed. Reopen checkout to review the latest total.');
    await rateLimit(db,request);
    const id=crypto.randomUUID(),trackingToken=crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','');
    const payload={...input,cloudOrderId:id,items,deliveryFee,pricing:priced,total:priced.total};
    // One atomic insert owns the request ID, amount, payload and private tracking token.
    await db.run('INSERT INTO site_orders(id,request_key,request_hash,tracking_token,payload,total) VALUES(?,?,?,?,?,?) ON CONFLICT(request_key) DO NOTHING',id,key,hash,trackingToken,JSON.stringify(payload),priced.total);
    const saved=await db.one('SELECT * FROM site_orders WHERE request_key=?',key);if(saved.request_hash!==hash)fail(409,'Request ID already used for another order');return json({order:publicOrder(saved)},201);
  }
  const tracking=path.match(/^\/api\/tracking\/([a-f0-9]{48,64})$/);
  if(tracking&&verb==='GET'){const row=await db.one('SELECT seq,status,total,payment_status,error FROM site_orders WHERE tracking_token=?',tracking[1]);return row?json({order:{sequential_no:row.seq+5000,status:row.status,total:row.total,payment_status:row.payment_status,error:row.error?'Restaurant review required':null}}):json({error:'Order not found'},404)}
  if(path==='/api/sync/heartbeat'&&verb==='POST'){
    const b=await body(request);if(env.INSTALLATION_ID&&b.installationId!==env.INSTALLATION_ID)fail(403,'Incorrect restaurant installation');
    await db.batch([put('heartbeat',new Date().toISOString())]);return json({ok:true});
  }
  if(path==='/api/sync/catalog'&&verb==='POST'){
    const b=await body(request,2e6);if(!Array.isArray(b.products)||!Array.isArray(b.categories)||!Array.isArray(b.orderTypes))fail(400,'Invalid catalog');
    await db.batch([put('catalog',JSON.stringify(b))]);return json({ok:true});
  }
  if(path==='/api/sync/orders/pending'&&verb==='GET')return json({orders:(await db.all("SELECT * FROM site_orders WHERE status='pending' ORDER BY seq LIMIT 100")).map(row=>({id:row.id,sequential_no:row.seq+5000,total:row.total,payload:{...JSON.parse(row.payload),sequential_no:row.seq+5000}}))});
  const ack=path.match(/^\/api\/sync\/orders\/([\w-]+)\/(ack|error)$/);
  if(ack&&verb==='POST'){
    const b=await body(request);const old=await db.one('SELECT local_order_id FROM site_orders WHERE id=?',ack[1]);if(!old)fail(404,'Order not found');
    if(ack[2]==='error')await db.run('UPDATE site_orders SET error=? WHERE id=?',text(b.error,500),ack[1]);
    else{if(!b.localOrderId||!['due','paid','refunded'].includes(b.paymentStatus||'due'))fail(400,'Invalid order acknowledgement');if(old.local_order_id&&old.local_order_id!==b.localOrderId)fail(409,'Order is already linked to a different POS order');
      await db.run("UPDATE site_orders SET local_order_id=?,status=CASE WHEN status='pending' THEN 'accepted' ELSE status END,payment_status=CASE WHEN status='pending' THEN ? ELSE payment_status END,error=NULL,imported_at=COALESCE(imported_at,?) WHERE id=?",text(b.localOrderId),b.paymentStatus||'due',new Date().toISOString(),ack[1]);}
    return json({ok:true});
  }
  if(path==='/api/sync/events'&&verb==='POST'){
    const b=await body(request,2e6),key=text(b.eventKey,200);if(!key)fail(400,'Event key required');if(env.INSTALLATION_ID&&b.installationId!==env.INSTALLATION_ID)fail(403,'Incorrect restaurant installation');
    const writes=[];
    if(b.entityType==='orders'&&b.payload?.id){const row=b.payload,status=row.status==='refunded'?'cancelled':row.fulfillment_status;if(!['pending','accepted','preparing','ready','fulfilled','cancelled'].includes(status))fail(400,'Invalid order status');
      writes.push(['UPDATE site_orders SET status=?,payment_status=? WHERE local_order_id=? AND NOT EXISTS(SELECT 1 FROM site_sync_receipts WHERE event_key=?)',status,text(row.payment_status,30),String(row.id),key]);}
    writes.push(['INSERT OR IGNORE INTO site_sync_receipts(event_key) VALUES(?)',key]);await db.batch(writes);return json({ok:true});
  }
  // There are no public staff, owner-report, database, or administrative routes.
  return json({error:'Not found'},404);
}
export default {
  async fetch(request,env){
    const url=new URL(request.url);
    try{
      if(url.pathname.startsWith('/api/'))return await api(request,env,url);
      if(!['GET','HEAD'].includes(request.method))return json({error:'Method not allowed'},405);
      if(url.pathname==='/')return Response.redirect(new URL('/customer/',url).href,302);
      if(!url.pathname.startsWith('/customer/')&&!url.pathname.startsWith('/shared/')&&url.pathname!=='/app/shared.js')return json({error:'Not found'},404);
      const asset=await env.ASSETS.fetch(request),response=new Response(asset.body,asset);
      response.headers.set('X-Content-Type-Options','nosniff');response.headers.set('Referrer-Policy','no-referrer');response.headers.set('X-Frame-Options','DENY');response.headers.set('Cache-Control','public, max-age=60');
      response.headers.set('Content-Security-Policy',"default-src 'self'; img-src 'self' https: data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'");return response;
    }catch(error){if(error instanceof HttpError)return json({error:error.message},error.status);console.error('Track Bite request failed:',error.name);return json({error:'Service temporarily unavailable. Please retry with the same order.'},503)}
  }
};
