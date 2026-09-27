process.env.DEMO_MODE='true';process.env.CLOUD_API_URL='';
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const port = 4191;
const db = path.join(__dirname, 'smoke.db');
for (const suffix of ['', '-wal', '-shm']) { try { fs.unlinkSync(db+suffix); } catch {} }
const child = spawn(process.execPath, ['server.js'], { cwd:path.join(__dirname,'..'), env:{...process.env,PORT:String(port),TRACKBITE_DB:db}, stdio:['ignore','pipe','pipe'] });
let logs=''; child.stdout.on('data',d=>logs+=d); child.stderr.on('data',d=>logs+=d);
const base=`http://127.0.0.1:${port}`;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function j(url,opt={}){const r=await fetch(base+url,opt);const d=await r.json();if(!r.ok)throw new Error(`${url}: ${JSON.stringify(d)}`);return d}
async function wait(){for(let i=0;i<30;i++){try{await j('/api/status');return}catch{}await sleep(100)}throw new Error('Server did not start\n'+logs)}
(async()=>{try{
 await wait();
 const login=await j('/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:'owner',password:'1234'})});
 const h={'content-type':'application/json',authorization:`Bearer ${login.token}`};
 await j('/api/shifts/open',{method:'POST',headers:h,body:JSON.stringify({openingCash:2000})});
 let inv=await j('/api/inventory/summary',{headers:h});
 const pattyBefore=Number(inv.summary.find(x=>x.ingredient_id===2).quantity_base);
 const beefBefore=Number(inv.summary.find(x=>x.ingredient_id===1).quantity_base);
 const order=await j('/api/orders',{method:'POST',headers:h,body:JSON.stringify({items:[{productId:1,qty:2}],payments:[{methodId:1,amount:150},{methodId:4,amount:150}]})});
 if(order.order.total!==300) throw new Error('Unexpected order total');
 inv=await j('/api/inventory/summary',{headers:h});
 const pattyAfter=Number(inv.summary.find(x=>x.ingredient_id===2).quantity_base);
 if(pattyBefore-pattyAfter!==2) throw new Error('Recipe did not deduct patties');
 await j('/api/inventory/receive',{method:'POST',headers:h,body:JSON.stringify({variantId:6,locationId:1,quantityPurchase:5,unitPricePurchase:100})});
 await j('/api/inventory/transfer',{method:'POST',headers:h,body:JSON.stringify({variantId:6,fromLocationId:1,toLocationId:3,quantityPurchase:1})});
 await j('/api/inventory/waste',{method:'POST',headers:h,body:JSON.stringify({variantId:6,locationId:3,quantityPurchase:0.1,reason:'Smoke test'})});
 await j('/api/production',{method:'POST',headers:h,body:JSON.stringify({inputs:[{variantId:1,locationId:1,quantityPurchase:10}],outputs:[{variantId:2,locationId:3,quantityPurchase:150}],note:'Smoke production'})});
 inv=await j('/api/inventory/summary',{headers:h});
 const beefAfter=Number(inv.summary.find(x=>x.ingredient_id===1).quantity_base);
 if(beefBefore-beefAfter!==10000) throw new Error('Production did not consume beef');
 const publicOrder=await j('/api/public/orders',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({items:[{productId:4,qty:1}],payments:[{methodId:1,amount:35}],customerName:'Website Smoke',customerPhone:'01012345678',requestId:require('crypto').randomUUID(),expectedTotal:35})});
 const supplier=await j('/api/suppliers',{method:'POST',headers:h,body:JSON.stringify({name:'Smoke Supplier',phone:'0100'})});
 await j('/api/purchases',{method:'POST',headers:h,body:JSON.stringify({supplierId:supplier.id,invoiceNo:'SM-1',items:[{variantId:3,locationId:1,quantityPurchase:10,unitPricePurchase:4}]})});
 await j('/api/expenses',{method:'POST',headers:h,body:JSON.stringify({category:'Gas',description:'Smoke expense',amount:50,paymentMethodId:1})});
 await j('/api/stocktake',{method:'POST',headers:h,body:JSON.stringify({locationId:1,counts:[{variantId:3,quantityPurchase:5}],note:'Smoke count'})});
 const newUser=await j('/api/admin/users',{method:'POST',headers:h,body:JSON.stringify({username:'smokeuser',displayNameAr:'اختبار',displayNameEn:'Smoke',role:'cashier',password:'pass1234'})});
 if(!newUser.id) throw new Error('User creation failed');
 const finance=await j('/api/reports/finance',{headers:h});
 if(Number(finance.expenses)!==50) throw new Error('Expense report mismatch');
 const backup=await j('/api/admin/backup',{method:'POST',headers:h,body:'{}'}); if(!backup.file) throw new Error('Backup failed');
 const report=await j('/api/reports/today',{headers:h});
 if(Number(report.sales.total_sales)!==335) throw new Error('Report total mismatch');
 const close=await j('/api/shifts/close',{method:'POST',headers:h,body:JSON.stringify({closingCash:2300})});
 console.log(JSON.stringify({ok:true,posOrder:order.order.sequential_no,websiteOrder:publicOrder.order.sequential_no,pattyDeduction:pattyBefore-pattyAfter,productionBeefConsumed:beefBefore-beefAfter,totalSales:report.sales.total_sales,expenses:finance.expenses,backup:!!backup.file,closeDifference:close.difference},null,2));
 } finally { child.kill(); await sleep(100); for (const suffix of ['', '-wal', '-shm']) { try { fs.unlinkSync(db+suffix); } catch {} } try { fs.rmSync(path.join(__dirname,'backups'),{recursive:true,force:true}); } catch {} }
})().catch(e=>{console.error(e);child.kill();process.exit(1)});
