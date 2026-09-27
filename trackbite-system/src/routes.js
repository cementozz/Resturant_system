// Authoritative method + path + capability registry. Unknown routes fail closed.
const routes=[];
function add(methods,path,permission){for(const method of methods.split(' '))routes.push({method,path,permission,regex:new RegExp('^'+path.replace(/:[a-z]+/g,'[^/]+')+'$')})}
add('GET','/api/status',null);add('POST','/api/login',null);add('POST','/api/logout','authenticated');
add('GET','/api/public/menu',null);add('POST','/api/public/orders',null);add('GET','/api/tracking/:token',null);
add('GET','/api/me','authenticated');add('GET','/api/bootstrap','authenticated');
add('GET','/api/orders','orders.read');add('GET','/api/orders/:id','orders.read');add('POST','/api/orders','pos.sell');
for(const [action,cap] of Object.entries({refund:'orders.refund',amend:'orders.amend',fulfill:'orders.fulfill',collect:'pos.sell',reprint:'printing.use'}))add('POST','/api/orders/:id/'+action,cap);
for(const action of ['current','history'])add('GET','/api/shifts/'+action,'pos.sell');
for(const action of ['open','close'])add('POST','/api/shifts/'+action,'pos.sell');
for(const action of ['summary','alerts','movements'])add('GET','/api/inventory/'+action,'inventory.read');
for(const [action,cap] of Object.entries({receive:'inventory.receive','receive-simple':'inventory.receive',transfer:'inventory.transfer',waste:'inventory.write',threshold:'inventory.write'}))add('POST','/api/inventory/'+action,cap);
add('POST','/api/production','inventory.write');add('POST','/api/stocktake','inventory.adjust');add('GET','/api/stocktakes','inventory.read');
for(const name of ['suppliers','purchases','expenses']){const cap=name==='suppliers'?'purchases':name;add('GET','/api/'+name,cap+'.read');add('POST','/api/'+name,cap+'.write')}
add('GET','/api/reports/today','reports.sales');add('GET','/api/reports/finance','reports.costs');add('GET','/api/reports/platform','reports.costs');
add('GET','/api/menu/costing','reports.costs');add('GET','/api/menu/history','menu.read');add('POST DELETE','/api/menu/item','menu.write');add('GET','/api/menu/publication','menu.read');
add('GET','/api/customers','customers.read');add('GET','/api/customers/lookup','customers.read');add('GET','/api/customers/:id','customers.read');add('POST','/api/customers/link','customers.edit');
add('GET POST','/api/permissions','users.manage');add('GET POST','/api/admin/users','users.manage');add('PATCH','/api/admin/users/:id','users.manage');
for(const name of ['categories','products','stations'])add('POST','/api/admin/'+name,'menu.write');add('PATCH','/api/admin/products/:id','menu.write');
for(const name of ['ingredients','variants','locations','waste-reasons'])add('POST','/api/admin/'+name,'inventory.write');add('PATCH','/api/admin/variants/:id','inventory.write');
add('GET','/api/admin/recipes','menu.read');add('POST','/api/admin/recipes','menu.write');
add('GET POST','/api/admin/modifiers','menu.write');add('GET POST','/api/admin/payment-methods','payments.manage');
add('GET POST','/api/settings','settings.manage');add('GET POST','/api/settings/order-types','settings.manage');add('GET POST','/api/settings/consumption-locations','inventory.adjust');
add('GET','/api/audit','audit.read');add('POST','/api/admin/backup','backup.manage');add('GET','/api/admin/backups','backup.manage');
add('GET','/api/print-queue','printing.use');add('GET','/api/printing/jobs','printing.use');add('GET','/api/printing/jobs/:id/preview','printing.use');
for(const action of ['retry','confirm'])add('POST','/api/printing/jobs/:id/'+action,'printing.use');
add('POST','/api/printing/reprint','printing.use');add('POST','/api/printing/complete','printing.use');add('GET POST','/api/printing/settings','printing.manage');add('POST','/api/printing/test','printing.manage');add('GET','/api/printing/devices','printing.manage');
add('GET','/api/sync/status','sync.manage');add('GET','/api/sync/pending','sync.manage');add('POST','/api/sync/retry','sync.manage');
add('GET POST','/api/loyalty/settings','loyalty.adjust');add('POST','/api/loyalty/rewards','loyalty.adjust');add('POST','/api/loyalty/adjust','loyalty.adjust');add('GET','/api/loyalty/customer','loyalty.read');add('GET','/api/remote/status','users.manage');
add('GET','/api/updates/check','users.manage');
function resolve(method,path){return routes.find(r=>r.method===method&&r.regex.test(path))||null}
module.exports={routes,resolve};
