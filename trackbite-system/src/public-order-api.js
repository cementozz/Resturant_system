const {one}=require('./db');
async function handle(req,res,url,user,b,json){const path=url.pathname,done=data=>{json(res,200,data);return true};
 if(path==='/api/public/orders'&&req.method==='POST'){
  if(!require('./sync-policy').configuration().url){json(res,503,{error:'Online ordering requires the connected restaurant cloud'});return true}
  return done(await require('./sync-service').cloud('/api/orders',{method:'POST',body:JSON.stringify(b)}));
 }
 if(path.startsWith('/api/tracking/')){const token=path.split('/').pop(),row=one("SELECT o.sequential_no,CASE WHEN o.status='refunded' THEN 'refunded' ELSE o.fulfillment_status END status,o.total,o.payment_status FROM orders o JOIN local_order_tracking t ON t.order_id=o.id WHERE t.token=?",token);if(row)return done({order:row});
  if(require('./sync-policy').configuration().url)return done(await require('./sync-service').cloud('/api/tracking/'+encodeURIComponent(token)));
  json(res,404,{error:'Order not found'});return true;
 }
 return false;
}
module.exports={handle};
