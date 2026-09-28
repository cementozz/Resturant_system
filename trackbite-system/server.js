const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const { one, all, run, transaction, dbPath } = require('./src/db');
const auth = require('./src/auth');
const inventory = require('./src/inventory');
const orders = require('./src/orders');
const reports = require('./src/reports');
const admin = require('./src/admin');
const sync = require('./src/sync');
const crypto = require('crypto');
const permissions = require('./src/permissions');
const platform = require('./src/platform-api');
const requestContext=require('./src/request-context');

const PORT = process.env.PORT || 4173;
const HOST = process.env.HOST || '127.0.0.1';
const publicDir = path.join(__dirname, 'public');

function json(res, status, data) {
  const user=requestContext.getStore()?.user;
  if(user&&data?.order)data={...data,order:require('./src/response-views').order(user,data.order)};
  const body = JSON.stringify(data);
  res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
  res.end(body);
}
function text(res,status,body,type='text/plain; charset=utf-8'){res.writeHead(status,{'Content-Type':type});res.end(body)}
function bodyJson(req){return req.bodyPromise ||= new Promise((resolve,reject)=>{const limit=req.url.startsWith('/api/public/')?32768:2000000;let size=0,chunks=[],failed=false;req.on('data',c=>{size+=c.length;if(size>limit){failed=true;const e=Error('Body too large');e.status=413;reject(e)}else if(!failed)chunks.push(c)});req.on('end',()=>{if(failed)return;try{const b=JSON.parse(Buffer.concat(chunks).toString()||'{}');if(!b||typeof b!=='object'||Array.isArray(b))throw Error();resolve(b)}catch{reject(Error('Invalid JSON object'))}});req.on('error',reject)})}
function session(req){return auth.getSession(req)}
function requireUser(req,res){const u=session(req);if(!u){json(res,401,{error:'Unauthorized'});return null}return u}
function audit(userId,action,entityType,entityId,newValue=null,reason=null){const context=requestContext.getStore()||{};permissions.audit({id:userId},action,entityType,entityId,null,newValue,reason||context.reason||null,context.approvedBy||null)}
function api(req,res,url){return requestContext.run({},()=>apiRequest(req,res,url))}
async function apiRequest(req,res,url){
  try {
    if(!['GET','HEAD'].includes(req.method)&&req.headers.origin&&req.headers.origin!=='http://'+req.headers.host&&req.headers.origin!=='https://'+req.headers.host)return json(res,403,{error:'Cross-origin request denied'});
    const user=session(req), payload=['POST','PATCH','PUT'].includes(req.method)?await bodyJson(req):{};
    const route=require('./src/routes').resolve(req.method,url.pathname);if(!route)return json(res,404,{error:'API endpoint not found'});
    requestContext.getStore().user=user;
    const permission=route.permission;
    if(permission){if(!user)return json(res,401,{error:'Unauthorized'});if(permission!=='authenticated')requestContext.getStore().approvedBy=permissions.requirePermission(user,permission,payload.approval);requestContext.getStore().reason=payload.reason||payload.note||null}
    if(await platform.handle(req,res,url,user,payload,json))return;
    if(req.method==='GET' && url.pathname==='/api/status') return json(res,200,{ok:true,restaurant:one("SELECT value FROM settings WHERE key='restaurant_name_en'")?.value||'Track Bite',time:new Date().toISOString(),service:'Track Bite POS',sync:user&&permissions.can(user,'sync.manage')?sync.getSyncStatus():{environment:sync.getSyncStatus().environment,cloudOrigin:sync.getSyncStatus().cloudOrigin,installationSuffix:sync.getSyncStatus().installation?.slice(-4),pairingVerified:sync.getSyncStatus().pairingVerified,enabled:sync.getSyncStatus().enabled,online:sync.getSyncStatus().online,lastSuccess:sync.getSyncStatus().lastSuccess}});
    if(req.method==='POST' && url.pathname==='/api/login'){
      const b=await bodyJson(req);auth.limit(req,String(b.username||'')); const username=String(b.username||'').trim(); const password=String(b.password||''); const u=one('SELECT * FROM users WHERE username=? AND active=1',username);
      if(!u||!auth.verifyPassword(password,u.password_hash)) return json(res,401,{error:'Invalid username or password'});
      if(process.env.DEMO_MODE!=='true'&&auth.verifyPassword('1234',u.password_hash))return json(res,403,{error:'Demo credentials are disabled. Configure a strong staff password.'});const token=auth.createSession(u); return json(res,200,{token,user:{id:u.id,username:u.username,role:u.role,display_name_ar:u.display_name_ar,display_name_en:u.display_name_en}});
    }
    if(req.method==='POST' && url.pathname==='/api/logout'){auth.logout(req);return json(res,200,{ok:true})}
    if(req.method==='GET' && url.pathname==='/api/me'){const u=requireUser(req,res); if(!u)return; return json(res,200,{user:{...u,permissions:permissions.list(u)}})}

    if(req.method==='GET' && url.pathname==='/api/bootstrap'){
      const u=requireUser(req,res); if(!u)return;
      const data={
        permissions:permissions.list(u),
        orderTypes:all('SELECT code id,* FROM order_types WHERE active=1'),
        modifiers:all('SELECT id,product_id,name_ar,name_en,price FROM modifiers WHERE active=1'),
        wasteReasons:all('SELECT * FROM waste_reasons WHERE active=1'),
        settings:Object.fromEntries(all('SELECT key,value FROM settings').map(x=>[x.key,x.value])),
        categories:all('SELECT * FROM categories WHERE active=1 ORDER BY sort_order,id'),
        products:all('SELECT p.*,EXISTS(SELECT 1 FROM recipes r JOIN recipe_lines l ON l.recipe_id=r.id WHERE r.product_id=p.id) recipe_complete,c.name_ar category_ar,c.name_en category_en,s.code station_code FROM products p JOIN categories c ON c.id=p.category_id LEFT JOIN preparation_stations s ON s.id=p.station_id WHERE p.active=1 ORDER BY c.sort_order,p.id'),
        paymentMethods:all('SELECT * FROM payment_methods WHERE active=1 ORDER BY sort_order,id'),
        locations:all('SELECT * FROM stock_locations WHERE active=1 ORDER BY priority,id'),
        variants:all(`SELECT v.*,i.name_ar ingredient_ar,i.name_en ingredient_en,i.base_unit FROM ingredient_variants v JOIN ingredients i ON i.id=v.ingredient_id WHERE v.active=1 ORDER BY i.name_ar,v.preferred DESC,v.name_ar`),
        ingredients:all('SELECT * FROM ingredients WHERE active=1 ORDER BY name_ar'),
        stations:all('SELECT * FROM preparation_stations ORDER BY id')
      };
      return json(res,200,require('./src/response-views').bootstrap(u,data));
    }

    if(req.method==='GET' && url.pathname==='/api/inventory/summary'){const u=requireUser(req,res); if(!u)return; return json(res,200,{summary:inventory.stockSummary(),rows:inventory.stockRows()})}
    if(req.method==='POST' && url.pathname==='/api/inventory/receive'){
      const u=requireUser(req,res); if(!u)return; const b=await bodyJson(req);
      const qtyBase=inventory.receiveStock({variantId:Number(b.variantId),locationId:Number(b.locationId),quantityPurchase:Number(b.quantityPurchase),unitPricePurchase:b.unitPricePurchase,userId:u.id,note:b.note||null,batchNumber:b.batchNumber,expiresOn:b.expiresOn});
      audit(u.id,'stock_receive','variant',String(b.variantId),b); return json(res,201,{ok:true,quantityBase:qtyBase});
    }
    if(req.method==='POST' && url.pathname==='/api/inventory/transfer'){
      const u=requireUser(req,res); if(!u)return; const b=await bodyJson(req);
      const id=inventory.transferStock({variantId:Number(b.variantId),fromLocationId:Number(b.fromLocationId),toLocationId:Number(b.toLocationId),quantityPurchase:Number(b.quantityPurchase),userId:u.id,note:b.note||null}); audit(u.id,'stock_transfer','transfer',id,b); return json(res,201,{ok:true,id});
    }
    if(req.method==='POST' && url.pathname==='/api/inventory/waste'){
      const u=requireUser(req,res); if(!u)return; const b=await bodyJson(req);
      const id=inventory.recordWaste({variantId:Number(b.variantId),locationId:Number(b.locationId),quantityPurchase:Number(b.quantityPurchase),reason:String(b.reason||'Other'),note:b.note||null,userId:u.id}); audit(u.id,'waste_record','waste',id,b); return json(res,201,{ok:true,id});
    }
    if(req.method==='POST' && url.pathname==='/api/production'){
      const u=requireUser(req,res); if(!u)return; const b=await bodyJson(req);
      const id=inventory.production({inputs:b.inputs||[],outputs:b.outputs||[],note:b.note||null,userId:u.id}); audit(u.id,'production','production',id,b); return json(res,201,{ok:true,id});
    }

    if(req.method==='GET' && url.pathname==='/api/shifts/current'){
      const u=requireUser(req,res); if(!u)return; const row=one("SELECT * FROM shifts WHERE user_id=? AND status='open' ORDER BY opened_at DESC LIMIT 1",u.id); return json(res,200,{shift:row||null});
    }
    if(req.method==='POST' && url.pathname==='/api/shifts/open'){
      const u=requireUser(req,res); if(!u)return; require('./src/validation').number(payload.openingCash??0,'Opening cash',{zero:true});const existing=one("SELECT * FROM shifts WHERE user_id=? AND status='open'",u.id); if(existing)return json(res,409,{error:'A shift is already open',shift:existing}); const b=await bodyJson(req); const r=run('INSERT INTO shifts(user_id,opening_cash,note) VALUES(?,?,?)',u.id,Number(b.openingCash||0),b.note||null); audit(u.id,'shift_open','shift',String(r.lastInsertRowid),b); return json(res,201,{id:Number(r.lastInsertRowid)});
    }
    if(req.method==='POST' && url.pathname==='/api/orders'){
      const u=user,isWeb=false;
      const b=await bodyJson(req);
      let shiftId=null;
      if(!isWeb){ const sh=one("SELECT * FROM shifts WHERE user_id=? AND status='open' ORDER BY opened_at DESC LIMIT 1",u.id); if(!sh)return json(res,409,{error:'Open a cashier shift first'}); shiftId=sh.id; }
      if(Number(b.discount||0)>0){if(isWeb)throw new Error('Public discounts are not allowed');requestContext.getStore().approvedBy=permissions.requirePermission(u,'orders.discount',b.approval)}
      let reservation=null;if(b.rewardId){if(!b.customerId)throw Error('Attach a customer account first');const linked=one('SELECT account_id FROM customer_links WHERE customer_id=?',b.customerId);if(!linked)throw Error('Customer account is not linked');reservation=(await require('./src/sync-service').cloud('/api/sync/loyalty/reserve',{method:'POST',body:JSON.stringify({requestId:b.requestId,items:b.items,customerId:linked.account_id,rewardId:b.rewardId})})).reservation;b.discount=reservation.discount}
      let order;try{order=orders.createOrder({source:isWeb?'web':'pos',userId:u.id,shiftId,customerId:b.customerId||null,reward:reservation?.reward||null,customerName:b.customerName||null,customerPhone:b.customerPhone||null,orderType:b.orderType||'pickup',items:b.items||[],payments:b.payments||[],notes:b.notes||null,requestId:b.requestId||null,discount:b.discount||0,deliveryAddress:b.deliveryAddress||null,deliveryDetails:b.deliveryDetails||{},deliveryFee:b.deliveryFee||0});}catch(e){if(reservation&&!one('SELECT id FROM orders WHERE request_id=?',b.requestId))try{await require('./src/sync-service').cloud('/api/sync/loyalty/release',{method:'POST',body:JSON.stringify({requestId:b.requestId})})}catch{}throw e}
      if(!isWeb)audit(u.id,'order_create','order',order.id,{total:order.total}); return json(res,201,{order});
    }
    if(req.method==='GET' && url.pathname==='/api/orders'){const u=requireUser(req,res); if(!u)return; const rows=orders.listOrders(Number(url.searchParams.get('limit')||100),Object.fromEntries(url.searchParams)); return json(res,200,{orders:rows.map(o=>require('./src/response-views').order(u,{...o,failed_prints:all("SELECT id FROM print_queue WHERE order_id=? AND job_type='kitchen' AND status='failed'",o.id).map(j=>j.id)})),incomingOnlineOrders:require('./src/online-orders').list(u)})}
    if(req.method==='GET' && url.pathname.startsWith('/api/orders/')){const u=requireUser(req,res); if(!u)return; const id=decodeURIComponent(url.pathname.split('/').pop()); const o=orders.getOrder(id); return o?json(res,200,{order:require('./src/response-views').order(u,o)}):json(res,404,{error:'Not found'})}


    if(req.method==='GET' && url.pathname==='/api/suppliers'){
      const u=requireUser(req,res); if(!u)return; return json(res,200,{rows:admin.listSuppliers()});
    }
    if(req.method==='POST' && url.pathname==='/api/suppliers'){
      const u=requireUser(req,res); if(!u)return; const b=await bodyJson(req); const id=admin.addSupplier(b); audit(u.id,'supplier_create','supplier',String(id),b); return json(res,201,{id});
    }
    if(req.method==='GET' && url.pathname==='/api/purchases'){
      const u=requireUser(req,res); if(!u)return; return json(res,200,{rows:admin.listPurchases()});
    }
    if(req.method==='POST' && url.pathname==='/api/purchases'){
      const u=requireUser(req,res); if(!u)return; const b=await bodyJson(req); const out=admin.createPurchase({...b,userId:u.id}); audit(u.id,'purchase_create','purchase',out.id,b); return json(res,201,out);
    }
    if(req.method==='GET' && url.pathname==='/api/expenses'){
      const u=requireUser(req,res); if(!u)return; return json(res,200,{rows:admin.listExpenses()});
    }
    if(req.method==='POST' && url.pathname==='/api/expenses'){
      const u=requireUser(req,res); if(!u)return; const b=await bodyJson(req); const sh=one("SELECT * FROM shifts WHERE user_id=? AND status='open' ORDER BY opened_at DESC LIMIT 1",u.id); const id=admin.createExpense({...b,shiftId:sh?.id||null,userId:u.id}); audit(u.id,'expense_create','expense',id,b); return json(res,201,{id});
    }
    if(req.method==='POST' && url.pathname==='/api/stocktake'){
      const u=requireUser(req,res); if(!u)return; const b=await bodyJson(req); const id=admin.stocktake({...b,userId:u.id}); audit(u.id,'stocktake','stocktake',id,b); return json(res,201,{id});
    }
    if(req.method==='GET' && url.pathname==='/api/stocktakes'){
      const u=requireUser(req,res); if(!u)return; return json(res,200,{rows:admin.listStocktakes()});
    }
    if(req.method==='GET' && url.pathname==='/api/reports/finance'){
      const u=requireUser(req,res); if(!u)return; return json(res,200,admin.financeReport(url.searchParams.get('from'),url.searchParams.get('to')));
    }
    if(req.method==='GET' && url.pathname==='/api/admin/users'){
      const u=requireUser(req,res); if(!u)return; return json(res,200,{rows:admin.listUsers()});
    }
    if(req.method==='POST' && url.pathname==='/api/admin/users'){
      const u=requireUser(req,res); if(!u)return; const b=await bodyJson(req); const id=admin.createUser(b); audit(u.id,'user_create','user',String(id),{...b,password:'***'}); return json(res,201,{id});
    }
    if(req.method==='POST' && url.pathname==='/api/admin/categories'){
      const u=requireUser(req,res); if(!u)return; const b=await bodyJson(req); const id=admin.addCategory(b); audit(u.id,'category_create','category',String(id),b); return json(res,201,{id});
    }
    if(req.method==='POST' && url.pathname==='/api/admin/products'){
      const u=requireUser(req,res); if(!u)return; const b=await bodyJson(req); const id=admin.addProduct(b); audit(u.id,'product_create','product',String(id),b); return json(res,201,{id});
    }
    if(req.method==='POST' && url.pathname==='/api/admin/ingredients'){
      const u=requireUser(req,res); if(!u)return; const b=await bodyJson(req); const id=admin.addIngredient(b); audit(u.id,'ingredient_create','ingredient',String(id),b); return json(res,201,{id});
    }
    if(req.method==='POST' && url.pathname==='/api/admin/variants'){
      const u=requireUser(req,res); if(!u)return; const b=await bodyJson(req); const id=admin.addVariant(b); audit(u.id,'variant_create','variant',String(id),b); return json(res,201,{id});
    }
    if(req.method==='POST' && url.pathname==='/api/admin/recipes'){
      const u=requireUser(req,res); if(!u)return; const b=await bodyJson(req); admin.setRecipe(b); audit(u.id,'recipe_set','product',String(b.productId),b); return json(res,200,{ok:true});
    }
    if(req.method==='GET' && url.pathname==='/api/admin/recipes'){
      const u=requireUser(req,res); if(!u)return; return json(res,200,{rows:admin.getRecipes()});
    }
    if(req.method==='POST' && url.pathname==='/api/admin/backup'){
      const u=requireUser(req,res); if(!u)return; const file=admin.backup(); audit(u.id,'backup','database',file); return json(res,201,{ok:true,file});
    }
    if(req.method==='GET' && url.pathname==='/api/admin/backups'){
      const u=requireUser(req,res); if(!u)return; return json(res,200,{rows:admin.listBackups()});
    }

    if(req.method==='GET' && url.pathname==='/api/reports/today'){const u=requireUser(req,res); if(!u)return; return json(res,200,reports.todayReport())}
    if(req.method==='GET' && url.pathname==='/api/audit'){const u=requireUser(req,res); if(!u)return; return json(res,200,{rows:all('SELECT a.*,u.username,u.display_name_ar FROM audit_log a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.created_at DESC LIMIT 200')})}
    if(req.method==='GET' && url.pathname==='/api/print-queue'){const u=requireUser(req,res); if(!u)return; return json(res,200,{jobs:all("SELECT * FROM print_queue WHERE status='pending' ORDER BY id").filter(j=>permissions.can(u,'customers.pii')||j.job_type==='kitchen').map(j=>!permissions.can(u,'customers.pii')?{id:j.id,order_id:j.order_id,job_type:j.job_type,status:j.status,station_code:j.station_code}:j)})}
    if(req.method==='GET' && url.pathname==='/api/sync/pending'){const u=requireUser(req,res); if(!u)return; return json(res,200,{rows:all("SELECT * FROM sync_queue WHERE status='pending' ORDER BY id LIMIT 500")})}

    if(req.method==='GET' && url.pathname==='/api/public/menu')return json(res,200,{...require('./src/catalog').build(),service:'local',online:sync.getSyncStatus().online});

    return json(res,404,{error:'API endpoint not found'});
  } catch(e){ console.error(e); return json(res,e.status||400,{error:e.message||'Request failed'}); }
}

const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon','.json':'application/json; charset=utf-8'};
function serveStatic(req,res,url){
  if(url.pathname==='/favicon.ico'){res.writeHead(204);res.end();return}
  let pathname=url.pathname;
  if(pathname==='/') pathname='/pos/';
  if(pathname.endsWith('/')) pathname+='index.html';
  const file=path.normalize(path.join(publicDir,pathname));
  if(!file.startsWith(publicDir+path.sep)) return text(res,403,'Forbidden');
  fs.readFile(file,(err,data)=>{if(err)return text(res,404,'Not found');text(res,200,data,mime[path.extname(file)]||'application/octet-stream')});
}

const server=http.createServer((req,res)=>{const url=new URL(req.url,`http://${req.headers.host||'localhost'}`); if(url.pathname.startsWith('/api/')) return api(req,res,url); serveStatic(req,res,url)});
server.listen(PORT,HOST,()=>{console.log(`Track Bite running at http://${HOST}:${PORT}\nPOS: http://${HOST}:${PORT}/pos/\nCustomer site: http://${HOST}:${PORT}/customer/`);sync.startSyncLoop();require('./src/printing/service').start();require('./src/backup-scheduler').start();});
