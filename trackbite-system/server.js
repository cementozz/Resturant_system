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
  const body = JSON.stringify(data);
  res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
  res.end(body);
}
function text(res,status,body,type='text/plain; charset=utf-8'){res.writeHead(status,{'Content-Type':type});res.end(body)}
function bodyJson(req){return req.bodyPromise ||= new Promise((resolve,reject)=>{let b='';req.on('data',c=>{b+=c;if(b.length>2e6)reject(new Error('Body too large'))});req.on('end',()=>{try{resolve(b?JSON.parse(b):{})}catch(e){reject(new Error('Invalid JSON'))}});req.on('error',reject)})}
function session(req){return auth.getSession(req)}
function requireUser(req,res){const u=session(req);if(!u){json(res,401,{error:'Unauthorized'});return null}return u}
function audit(userId,action,entityType,entityId,newValue=null,reason=null){const context=requestContext.getStore()||{};const clean=newValue?{...newValue}:null;if(clean){delete clean.approval;delete clean.managerPassword}run('INSERT INTO audit_log(user_id,action,entity_type,entity_id,new_value,reason,approved_by) VALUES(?,?,?,?,?,?,?)',userId,action,entityType,entityId,clean?JSON.stringify(clean):null,reason||context.reason||null,context.approvedBy||null)}

function api(req,res,url){return requestContext.run({},()=>apiRequest(req,res,url))}
async function apiRequest(req,res,url){
  try {
    const user=session(req), payload=['POST','PATCH','PUT'].includes(req.method)?await bodyJson(req):{};
    const permission=platform.routePermission(req.method,url.pathname);
    const publicOrder=url.pathname==='/api/orders'&&req.method==='POST'&&!user&&req.headers['x-public-order']==='1';
    if(permission&&!publicOrder){if(!user)return json(res,401,{error:'Unauthorized'});if(permission!=='authenticated')requestContext.getStore().approvedBy=permissions.requirePermission(user,permission,payload.approval);requestContext.getStore().reason=payload.reason||payload.note||null}
    if(await platform.handle(req,res,url,user,payload,json))return;
    if(req.method==='GET' && url.pathname==='/api/status') return json(res,200,{ok:true,restaurant:one("SELECT value FROM settings WHERE key='restaurant_name_en'")?.value||'Track Bite',time:new Date().toISOString(),db:dbPath,sync:sync.getSyncStatus()});
    if(req.method==='POST' && url.pathname==='/api/login'){
      const b=await bodyJson(req); const u=one('SELECT * FROM users WHERE username=? AND active=1',String(b.username||''));
      if(!u||!auth.verifyPassword(String(b.password||''),u.password_hash)) return json(res,401,{error:'Invalid username or password'});
      const token=auth.createSession(u); return json(res,200,{token,user:{id:u.id,username:u.username,role:u.role,display_name_ar:u.display_name_ar,display_name_en:u.display_name_en}});
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
      return json(res,200,data);
    }

    if(req.method==='GET' && url.pathname==='/api/inventory/summary'){const u=requireUser(req,res); if(!u)return; return json(res,200,{summary:inventory.stockSummary(),rows:inventory.stockRows()})}
    if(req.method==='POST' && url.pathname==='/api/inventory/receive'){
      const u=requireUser(req,res,['owner','manager','storekeeper']); if(!u)return; const b=await bodyJson(req);
      const qtyBase=inventory.receiveStock({variantId:Number(b.variantId),locationId:Number(b.locationId),quantityPurchase:Number(b.quantityPurchase),unitPricePurchase:Number(b.unitPricePurchase||0),userId:u.id,note:b.note||null,batchNumber:b.batchNumber,expiresOn:b.expiresOn});
      audit(u.id,'stock_receive','variant',String(b.variantId),b); return json(res,201,{ok:true,quantityBase:qtyBase});
    }
    if(req.method==='POST' && url.pathname==='/api/inventory/transfer'){
      const u=requireUser(req,res,['owner','manager','storekeeper']); if(!u)return; const b=await bodyJson(req);
      const id=inventory.transferStock({variantId:Number(b.variantId),fromLocationId:Number(b.fromLocationId),toLocationId:Number(b.toLocationId),quantityPurchase:Number(b.quantityPurchase),userId:u.id,note:b.note||null}); audit(u.id,'stock_transfer','transfer',id,b); return json(res,201,{ok:true,id});
    }
    if(req.method==='POST' && url.pathname==='/api/inventory/waste'){
      const u=requireUser(req,res,['owner','manager','storekeeper']); if(!u)return; const b=await bodyJson(req);
      const id=inventory.recordWaste({variantId:Number(b.variantId),locationId:Number(b.locationId),quantityPurchase:Number(b.quantityPurchase),reason:String(b.reason||'Other'),note:b.note||null,userId:u.id}); audit(u.id,'waste_record','waste',id,b); return json(res,201,{ok:true,id});
    }
    if(req.method==='POST' && url.pathname==='/api/production'){
      const u=requireUser(req,res,['owner','manager','storekeeper']); if(!u)return; const b=await bodyJson(req);
      const id=inventory.production({inputs:b.inputs||[],outputs:b.outputs||[],note:b.note||null,userId:u.id}); audit(u.id,'production','production',id,b); return json(res,201,{ok:true,id});
    }

    if(req.method==='GET' && url.pathname==='/api/shifts/current'){
      const u=requireUser(req,res); if(!u)return; const row=one("SELECT * FROM shifts WHERE user_id=? AND status='open' ORDER BY opened_at DESC LIMIT 1",u.id); return json(res,200,{shift:row||null});
    }
    if(req.method==='POST' && url.pathname==='/api/shifts/open'){
      const u=requireUser(req,res,['owner','manager','cashier']); if(!u)return; require('./src/validation').number(payload.openingCash??0,'Opening cash',{zero:true});const existing=one("SELECT * FROM shifts WHERE user_id=? AND status='open'",u.id); if(existing)return json(res,409,{error:'A shift is already open',shift:existing}); const b=await bodyJson(req); const r=run('INSERT INTO shifts(user_id,opening_cash,note) VALUES(?,?,?)',u.id,Number(b.openingCash||0),b.note||null); audit(u.id,'shift_open','shift',String(r.lastInsertRowid),b); return json(res,201,{id:Number(r.lastInsertRowid)});
    }
    if(req.method==='POST' && url.pathname==='/api/shifts/close'){
      const u=requireUser(req,res,['owner','manager','cashier']); if(!u)return; const shift=one("SELECT * FROM shifts WHERE user_id=? AND status='open' ORDER BY opened_at DESC LIMIT 1",u.id); if(!shift)return json(res,404,{error:'No open shift'}); const b=await bodyJson(req); const methods=all(`SELECT pm.code,pm.name_ar,pm.name_en,COALESCE(SUM(CASE WHEN o.shift_id=? THEN p.amount ELSE 0 END),0) amount FROM payment_methods pm LEFT JOIN payments p ON p.payment_method_id=pm.id LEFT JOIN orders o ON o.id=p.order_id GROUP BY pm.id`,shift.id); const cash=methods.find(x=>x.code==='cash')?.amount||0; const cashExpenses=Number(one(`SELECT COALESCE(SUM(e.amount),0) amount FROM expenses e JOIN payment_methods pm ON pm.id=e.payment_method_id WHERE e.shift_id=? AND pm.code='cash'`,shift.id)?.amount||0); const expected=Number(shift.opening_cash)+Number(cash)-cashExpenses; run("UPDATE shifts SET status='closed',closed_at=CURRENT_TIMESTAMP,closing_cash_counted=? WHERE id=?",Number(b.closingCash||0),shift.id); audit(u.id,'shift_close','shift',String(shift.id),b); return json(res,200,{ok:true,expectedCash:expected,cashExpenses,counted:Number(b.closingCash||0),difference:Number(b.closingCash||0)-expected,payments:methods});
    }

    if(req.method==='POST' && url.pathname==='/api/orders'){
      let u=session(req); let isWeb=false;
      if(!u){ if(String(req.headers['x-public-order']||'')==='1'){isWeb=true;u={id:null,role:'public'}} else return json(res,401,{error:'Unauthorized'}); }
      const b=await bodyJson(req);
      let shiftId=null;
      if(!isWeb){ const sh=one("SELECT * FROM shifts WHERE user_id=? AND status='open' ORDER BY opened_at DESC LIMIT 1",u.id); if(!sh)return json(res,409,{error:'Open a cashier shift first'}); shiftId=sh.id; }
      if(Number(b.discount||0)>0){if(isWeb)throw new Error('Public discounts are not allowed');requestContext.getStore().approvedBy=permissions.requirePermission(u,'orders.discount',b.approval)}
      const order=orders.createOrder({source:isWeb?'web':'pos',userId:u.id,shiftId,customerName:b.customerName||null,customerPhone:b.customerPhone||null,orderType:b.orderType||'pickup',items:b.items||[],payments:b.payments||[],notes:b.notes||null,requestId:b.requestId||null,discount:b.discount||0,deliveryAddress:b.deliveryAddress||null,deliveryDetails:b.deliveryDetails||{},deliveryFee:b.deliveryFee||0});
      if(!isWeb)audit(u.id,'order_create','order',order.id,{total:order.total}); return json(res,201,{order});
    }
    if(req.method==='GET' && url.pathname==='/api/orders'){const u=requireUser(req,res); if(!u)return; return json(res,200,{orders:orders.listOrders(Number(url.searchParams.get('limit')||100),Object.fromEntries(url.searchParams))})}
    if(req.method==='GET' && url.pathname.startsWith('/api/orders/')){const u=requireUser(req,res); if(!u)return; const id=decodeURIComponent(url.pathname.split('/').pop()); const o=orders.getOrder(id); return o?json(res,200,{order:o}):json(res,404,{error:'Not found'})}


    if(req.method==='GET' && url.pathname==='/api/suppliers'){
      const u=requireUser(req,res,['owner','manager','accountant','storekeeper']); if(!u)return; return json(res,200,{rows:admin.listSuppliers()});
    }
    if(req.method==='POST' && url.pathname==='/api/suppliers'){
      const u=requireUser(req,res,['owner','manager','storekeeper']); if(!u)return; const b=await bodyJson(req); const id=admin.addSupplier(b); audit(u.id,'supplier_create','supplier',String(id),b); return json(res,201,{id});
    }
    if(req.method==='GET' && url.pathname==='/api/purchases'){
      const u=requireUser(req,res,['owner','manager','accountant','storekeeper']); if(!u)return; return json(res,200,{rows:admin.listPurchases()});
    }
    if(req.method==='POST' && url.pathname==='/api/purchases'){
      const u=requireUser(req,res,['owner','manager','storekeeper']); if(!u)return; const b=await bodyJson(req); const out=admin.createPurchase({...b,userId:u.id}); audit(u.id,'purchase_create','purchase',out.id,b); return json(res,201,out);
    }
    if(req.method==='GET' && url.pathname==='/api/expenses'){
      const u=requireUser(req,res,['owner','manager','accountant']); if(!u)return; return json(res,200,{rows:admin.listExpenses()});
    }
    if(req.method==='POST' && url.pathname==='/api/expenses'){
      const u=requireUser(req,res,['owner','manager','accountant']); if(!u)return; const b=await bodyJson(req); const sh=one("SELECT * FROM shifts WHERE user_id=? AND status='open' ORDER BY opened_at DESC LIMIT 1",u.id); const id=admin.createExpense({...b,shiftId:sh?.id||null,userId:u.id}); audit(u.id,'expense_create','expense',id,b); return json(res,201,{id});
    }
    if(req.method==='POST' && url.pathname==='/api/stocktake'){
      const u=requireUser(req,res,['owner','manager','storekeeper']); if(!u)return; const b=await bodyJson(req); const id=admin.stocktake({...b,userId:u.id}); audit(u.id,'stocktake','stocktake',id,b); return json(res,201,{id});
    }
    if(req.method==='GET' && url.pathname==='/api/stocktakes'){
      const u=requireUser(req,res,['owner','manager','accountant','storekeeper']); if(!u)return; return json(res,200,{rows:admin.listStocktakes()});
    }
    if(req.method==='GET' && url.pathname==='/api/reports/finance'){
      const u=requireUser(req,res,['owner','manager','accountant']); if(!u)return; return json(res,200,admin.financeReport(url.searchParams.get('from'),url.searchParams.get('to')));
    }
    if(req.method==='GET' && url.pathname==='/api/admin/users'){
      const u=requireUser(req,res,['owner','manager']); if(!u)return; return json(res,200,{rows:admin.listUsers()});
    }
    if(req.method==='POST' && url.pathname==='/api/admin/users'){
      const u=requireUser(req,res,['owner']); if(!u)return; const b=await bodyJson(req); const id=admin.createUser(b); audit(u.id,'user_create','user',String(id),{...b,password:'***'}); return json(res,201,{id});
    }
    if(req.method==='POST' && url.pathname==='/api/admin/categories'){
      const u=requireUser(req,res,['owner','manager']); if(!u)return; const b=await bodyJson(req); const id=admin.addCategory(b); audit(u.id,'category_create','category',String(id),b); return json(res,201,{id});
    }
    if(req.method==='POST' && url.pathname==='/api/admin/products'){
      const u=requireUser(req,res,['owner','manager']); if(!u)return; const b=await bodyJson(req); const id=admin.addProduct(b); audit(u.id,'product_create','product',String(id),b); return json(res,201,{id});
    }
    if(req.method==='POST' && url.pathname==='/api/admin/ingredients'){
      const u=requireUser(req,res,['owner','manager','storekeeper']); if(!u)return; const b=await bodyJson(req); const id=admin.addIngredient(b); audit(u.id,'ingredient_create','ingredient',String(id),b); return json(res,201,{id});
    }
    if(req.method==='POST' && url.pathname==='/api/admin/variants'){
      const u=requireUser(req,res,['owner','manager','storekeeper']); if(!u)return; const b=await bodyJson(req); const id=admin.addVariant(b); audit(u.id,'variant_create','variant',String(id),b); return json(res,201,{id});
    }
    if(req.method==='POST' && url.pathname==='/api/admin/recipes'){
      const u=requireUser(req,res,['owner','manager']); if(!u)return; const b=await bodyJson(req); admin.setRecipe(b); audit(u.id,'recipe_set','product',String(b.productId),b); return json(res,200,{ok:true});
    }
    if(req.method==='GET' && url.pathname==='/api/admin/recipes'){
      const u=requireUser(req,res,['owner','manager','storekeeper']); if(!u)return; return json(res,200,{rows:admin.getRecipes()});
    }
    if(req.method==='POST' && url.pathname==='/api/admin/backup'){
      const u=requireUser(req,res,['owner','manager']); if(!u)return; const file=admin.backup(); audit(u.id,'backup','database',file); return json(res,201,{ok:true,file});
    }
    if(req.method==='GET' && url.pathname==='/api/admin/backups'){
      const u=requireUser(req,res,['owner','manager']); if(!u)return; return json(res,200,{rows:admin.listBackups()});
    }

    if(req.method==='GET' && url.pathname==='/api/reports/today'){const u=requireUser(req,res,['owner','manager','accountant','cashier']); if(!u)return; return json(res,200,reports.todayReport())}
    if(req.method==='GET' && url.pathname==='/api/audit'){const u=requireUser(req,res,['owner','manager']); if(!u)return; return json(res,200,{rows:all('SELECT a.*,u.username,u.display_name_ar FROM audit_log a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.created_at DESC LIMIT 200')})}
    if(req.method==='GET' && url.pathname==='/api/print-queue'){const u=requireUser(req,res); if(!u)return; return json(res,200,{jobs:all("SELECT * FROM print_queue WHERE status='pending' ORDER BY id")})}
    if(req.method==='GET' && url.pathname==='/api/sync/pending'){const u=requireUser(req,res,['owner','manager']); if(!u)return; return json(res,200,{rows:all("SELECT * FROM sync_queue WHERE status='pending' ORDER BY id LIMIT 500")})}

    if(req.method==='GET' && url.pathname==='/api/public/menu'){
      const products=all(`SELECT p.id,p.name_ar,p.name_en,p.price,p.image_url,p.description_ar,p.description_en,c.name_ar category_ar,c.name_en category_en,c.id category_id FROM products p JOIN categories c ON c.id=p.category_id WHERE p.active=1 AND p.in_stock=1 AND p.available_online=1 AND c.active=1 AND EXISTS(SELECT 1 FROM recipes r WHERE r.product_id=p.id) ORDER BY c.sort_order,p.id`);
      const categories=all('SELECT id,name_ar,name_en FROM categories WHERE active=1 ORDER BY sort_order,id');
      return json(res,200,{service:'local',orderTypes:all('SELECT code id,* FROM order_types WHERE active=1 AND online=1'),settings:Object.fromEntries(all("SELECT key,value FROM settings WHERE key IN ('delivery_fee','restaurant_name_ar','restaurant_name_en','restaurant_phone','restaurant_address','restaurant_hours') OR key LIKE 'tax_%' OR key LIKE 'service_%' OR key LIKE 'packaging_%' OR key LIKE 'other_%'").map(r=>[r.key,r.value])),categories,products,modifiers:all('SELECT id,product_id,name_ar,name_en,price FROM modifiers WHERE active=1'),restaurant:{name_ar:'تراك بايت',name_en:'Track Bite'},online:true});
    }

    return json(res,404,{error:'API endpoint not found'});
  } catch(e){ console.error(e); return json(res,e.status||400,{error:e.message||'Request failed'}); }
}

const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon','.json':'application/json; charset=utf-8'};
function serveStatic(req,res,url){
  let pathname=url.pathname;
  if(pathname==='/') pathname='/pos/';
  if(pathname.endsWith('/')) pathname+='index.html';
  const file=path.normalize(path.join(publicDir,pathname));
  if(!file.startsWith(publicDir+path.sep)) return text(res,403,'Forbidden');
  fs.readFile(file,(err,data)=>{if(err)return text(res,404,'Not found');text(res,200,data,mime[path.extname(file)]||'application/octet-stream')});
}

const server=http.createServer((req,res)=>{const url=new URL(req.url,`http://${req.headers.host||'localhost'}`); if(url.pathname.startsWith('/api/')) return api(req,res,url); serveStatic(req,res,url)});
server.listen(PORT,HOST,()=>{console.log(`Track Bite running at http://${HOST}:${PORT}\nPOS: http://${HOST}:${PORT}/pos/\nCustomer site: http://${HOST}:${PORT}/customer/`);sync.startSyncLoop();require('./src/printing/service').start();require('./src/backup-scheduler').start();});
