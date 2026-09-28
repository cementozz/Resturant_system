const waiting=['pending','awaiting_restaurant_confirmation','needs_review'];
export const onlineSchema=[`CREATE TABLE IF NOT EXISTS site_order_decisions(order_id TEXT PRIMARY KEY REFERENCES site_orders(id),reason TEXT,actor TEXT,decided_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,"UPDATE site_orders SET status=CASE WHEN error IS NULL THEN 'awaiting_restaurant_confirmation' ELSE 'needs_review' END WHERE status='pending'","UPDATE site_orders SET status='confirmed' WHERE status='accepted'","UPDATE site_orders SET status='completed' WHERE status='fulfilled'","UPDATE site_orders SET status='refunded' WHERE status='cancelled' AND payment_status='refunded'"];
export async function onlineApi({db,request,url,body,json,fail}){
 const path=url.pathname,verb=request.method;
 if(path==='/api/sync/orders/pending'&&verb==='GET'){
  const after=Math.max(0,Number(url.searchParams.get('after'))||0);const rows=await db.all("SELECT * FROM site_orders WHERE status IN ('pending','awaiting_restaurant_confirmation','needs_review') AND seq>? ORDER BY seq LIMIT 100",after);
  return json({orders:rows.map(row=>({id:row.id,sequential_no:row.seq+5000,created_at:row.created_at,error:row.error,status:row.status,total:row.total,payload:JSON.parse(row.payload)})),next:rows.length===100?rows.at(-1).seq:null});
 }
 if(path==='/api/sync/diagnostics'&&verb==='GET'){const setting=async key=>(await db.one('SELECT value FROM site_state WHERE key=?',key))?.value;return json({installationId:request.headers.get('x-installation-id'),heartbeat:await setting('heartbeat'),catalogRevision:await setting('catalog_revision'),incoming:(await db.one("SELECT COUNT(*) n FROM site_orders WHERE status IN ('pending','awaiting_restaurant_confirmation')")).n,review:(await db.one("SELECT COUNT(*) n FROM site_orders WHERE status='needs_review'")).n})}
 const match=path.match(/^\/api\/sync\/orders\/([\w-]+)(?:\/(ack|review|reject|error))?$/);if(!match)return null;
 const old=await db.one('SELECT * FROM site_orders WHERE id=?',match[1]);if(!old)fail(404,'Order not found');const p=JSON.parse(old.payload);
 if(!match[2]&&verb==='GET'){let rewardValid=true;if(p.reward){const spend=await db.one("SELECT delta,customer_id FROM site_loyalty WHERE idempotency_key=?",p.reward.redemption_key);rewardValid=!!spend&&spend.customer_id===p.customerId&&spend.delta===-p.reward.points_cost}return json({order:{id:old.id,status:old.status,localOrderId:old.local_order_id,rewardValid}})}
 if(verb!=='POST')return null;const b=await body(request);
 if(match[2]==='ack'){
  if(!b.localOrderId||!['due','paid','refunded','cancelled'].includes(b.paymentStatus||'due'))fail(400,'Invalid acknowledgement');
  if(old.local_order_id&&old.local_order_id!==b.localOrderId)fail(409,'Order already belongs to a different POS order');if(!old.local_order_id&&!waiting.includes(old.status))fail(409,'Order is no longer awaiting confirmation');
  await db.run("UPDATE site_orders SET local_order_id=?,status=CASE WHEN status IN ('pending','awaiting_restaurant_confirmation','needs_review') THEN 'confirmed' ELSE status END,payment_status=CASE WHEN status IN ('pending','awaiting_restaurant_confirmation','needs_review') THEN ? ELSE payment_status END,error=NULL,imported_at=COALESCE(imported_at,CURRENT_TIMESTAMP) WHERE id=? AND (local_order_id=? OR (local_order_id IS NULL AND status IN ('pending','awaiting_restaurant_confirmation','needs_review')))",String(b.localOrderId),b.paymentStatus||'due',old.id,String(b.localOrderId));
  const saved=await db.one('SELECT local_order_id FROM site_orders WHERE id=?',old.id);if(saved.local_order_id!==b.localOrderId)fail(409,'Order acknowledgement conflict');return json({ok:true});
 }
 if(match[2]==='reject'){
  const reason=String(b.reason||'').trim();if(!reason||reason.length>500)fail(400,'Rejection reason required');if(old.status==='rejected')return json({ok:true});if(!waiting.includes(old.status)||old.local_order_id)fail(409,'Accepted order cannot be rejected');
  const writes=[["UPDATE site_orders SET status='rejected',error=NULL WHERE id=? AND local_order_id IS NULL AND status IN ('pending','awaiting_restaurant_confirmation','needs_review')",old.id],['INSERT OR IGNORE INTO site_order_decisions(order_id,reason,actor) SELECT id,?,? FROM site_orders WHERE id=? AND status=\'rejected\'',reason,String(b.actor||'restaurant'),old.id]];
  if(p.reward)writes.push(["INSERT OR IGNORE INTO site_loyalty(id,customer_id,order_id,type,delta,idempotency_key,reason,actor) SELECT ?,?,id,'redemption_reversal',?,?,?,'restaurant' FROM site_orders WHERE id=? AND status='rejected'",crypto.randomUUID(),p.customerId,p.reward.points_cost,'reject-redeem:'+old.id,'Rejected order reservation released',old.id]);
  await db.batch(writes);if((await db.one('SELECT status FROM site_orders WHERE id=?',old.id)).status!=='rejected')fail(409,'Order decision conflict');return json({ok:true});
 }
 if(match[2]==='review'||match[2]==='error'){
  const status=b.status==='awaiting_restaurant_confirmation'?'awaiting_restaurant_confirmation':'needs_review';const codes=['stock','price','recipe','modifier','product','customer','loyalty','delivery','connection','database'];const code=codes.includes(b.code)?b.code:'review';
  await db.run("UPDATE site_orders SET status=?,error=? WHERE id=? AND local_order_id IS NULL AND status IN ('pending','awaiting_restaurant_confirmation','needs_review')",status,status==='needs_review'?code:null,old.id);return json({ok:true});
 }
 return null;
}
