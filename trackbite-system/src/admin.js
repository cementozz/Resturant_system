const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { db, one, all, run, transaction, dbPath } = require('./db');
const { hashPassword } = require('./auth');
const {number,required}=require('./validation');

function listSuppliers(){return all('SELECT * FROM suppliers WHERE active=1 ORDER BY name')}
function addSupplier({name,phone,notes}){const r=run('INSERT INTO suppliers(name,phone,notes) VALUES(?,?,?)',name,phone||null,notes||null);return Number(r.lastInsertRowid)}

function createPurchase({supplierId,invoiceNo,items,userId}){
  if(!Array.isArray(items)||!items.length)throw new Error('Purchase items required');
  const id=crypto.randomUUID();
  let total=0;
  transaction(()=>{
    run('INSERT INTO purchases(id,supplier_id,invoice_no,total,user_id) VALUES(?,?,?,?,?)',id,supplierId||null,invoiceNo||null,0,userId);
    for(const item of items||[]){
      const v=one('SELECT conversion_to_base FROM ingredient_variants WHERE id=?',Number(item.variantId));
      if(!v) throw new Error('Purchase variant not found');
      const qPurchase=number(item.quantityPurchase); const qBase=qPurchase*Number(v.conversion_to_base); const unitPrice=number(item.unitPricePurchase,'Cost',{zero:true}); const line=qPurchase*unitPrice; total+=line;
      run('INSERT INTO purchase_items(purchase_id,variant_id,location_id,quantity_purchase,quantity_base,unit_price_purchase,line_total) VALUES(?,?,?,?,?,?,?)',id,Number(item.variantId),Number(item.locationId),qPurchase,qBase,unitPrice,line);
      require('./inventory').receiveStock({...item,variantId:Number(item.variantId),locationId:Number(item.locationId),quantityPurchase:qPurchase,unitPricePurchase:unitPrice,userId,referenceId:id,note:invoiceNo?`Invoice ${invoiceNo}`:null});
    }
    run('UPDATE purchases SET total=? WHERE id=?',total,id);require('./purchase-details').save(db,id);
  });
  return {id,total};
}
function listPurchases(){return all(`SELECT p.*,s.name supplier_name,u.display_name_ar user_ar FROM purchases p LEFT JOIN suppliers s ON s.id=p.supplier_id LEFT JOIN users u ON u.id=p.user_id ORDER BY p.created_at DESC LIMIT 100`)}

function createExpense({category,description,amount,paymentMethodId,shiftId,userId,date,notes,recurring}){return transaction(()=>{number(amount,'Expense');required(category,'Category');required(description,'Description');if(date&&(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))))throw new Error('Invalid expense date');if(recurring&&!['daily','weekly','monthly','yearly'].includes(recurring))throw new Error('Invalid recurrence');if(!one('SELECT id FROM payment_methods WHERE id=? AND active=1',Number(paymentMethodId)))throw new Error('Payment method required');const id=crypto.randomUUID();run('INSERT INTO expenses(id,category,description,amount,payment_method_id,shift_id,user_id,expense_date,notes,recurring) VALUES(?,?,?,?,?,?,?,?,?,?)',id,category,description,number(amount),Number(paymentMethodId),shiftId||null,userId,date||new Date().toISOString().slice(0,10),notes||null,recurring||null);return id})}
function listExpenses(){return all(`SELECT e.*,pm.name_ar payment_ar,pm.name_en payment_en,u.display_name_ar user_ar FROM expenses e LEFT JOIN payment_methods pm ON pm.id=e.payment_method_id LEFT JOIN users u ON u.id=e.user_id ORDER BY e.created_at DESC LIMIT 200`)}

function stocktake({locationId,counts,note,userId}){
  if(!counts?.length)throw new Error('Stocktake counts required');
  if(new Set(counts.map(c=>Number(c.variantId))).size!==counts.length)throw new Error('Duplicate stocktake variant');
  const id=crypto.randomUUID();
  transaction(()=>{
    run('INSERT INTO stocktakes(id,location_id,user_id,note) VALUES(?,?,?,?)',id,locationId,userId,note||null);
    for(const c of counts||[]){
      const v=one('SELECT conversion_to_base FROM ingredient_variants WHERE id=?',Number(c.variantId)); if(!v)throw new Error('Variant not found');
      const counted=number(c.quantityPurchase,'Count',{zero:true})*Number(v.conversion_to_base);
      const expected=Number(one('SELECT COALESCE(SUM(quantity_base),0) q FROM stock_movements WHERE variant_id=? AND location_id=?',Number(c.variantId),Number(locationId)).q);
      const diff=counted-expected;
      run('INSERT INTO stocktake_lines(stocktake_id,variant_id,expected_base,counted_base,difference_base) VALUES(?,?,?,?,?)',id,Number(c.variantId),expected,counted,diff);
      if(diff < -1e-9)require('./inventory').consume({variantId:Number(c.variantId),locationId:Number(locationId),qty:-diff,type:'stocktake_adjustment',refType:'stocktake',refId:id,userId,note:note||'Physical stocktake',allowExpired:true});
      if(diff > 1e-9)require('./inventory').move({variantId:Number(c.variantId),locationId:Number(locationId),qty:diff,type:'stocktake_adjustment',refType:'stocktake',refId:id,userId,note:note||'Physical stocktake'});
    }
  });
  return id;
}
function listStocktakes(){return all(`SELECT s.*,l.name_ar location_ar,l.name_en location_en,u.display_name_ar user_ar FROM stocktakes s JOIN stock_locations l ON l.id=s.location_id LEFT JOIN users u ON u.id=s.user_id ORDER BY s.created_at DESC LIMIT 100`)}

function financeReport(from=null,to=null){
  const start=from||new Date().toISOString().slice(0,10); const end=to||start;
  const sales=one(`SELECT COUNT(*) orders_count,COALESCE(SUM(total),0) sales FROM orders WHERE date(created_at,'localtime') BETWEEN ? AND ? AND status='completed'`,start,end);
  const pays=all(`SELECT pm.code,pm.name_ar,pm.name_en,COALESCE(SUM(CASE WHEN date(p.created_at,'localtime') BETWEEN ? AND ? THEN p.amount ELSE 0 END),0) amount FROM payment_methods pm LEFT JOIN payments p ON p.payment_method_id=pm.id GROUP BY pm.id ORDER BY pm.sort_order,pm.id`,start,end);
  const expenses=one(`SELECT COALESCE(SUM(amount),0) amount FROM expenses WHERE COALESCE(expense_date,date(created_at,'localtime')) BETWEEN ? AND ?`,start,end).amount;
  return {from:start,to:end,sales,payments:pays,expenses,netOperating:Number(sales.sales)-Number(expenses)};
}

function listUsers(){return all('SELECT id,global_id,username,display_name_ar,display_name_en,role,active,created_at,last_login,password_changed_at FROM users ORDER BY id')}
function createUser({username,displayNameAr,displayNameEn,role,password}){require('./auth').validateCredentials(username,password);if(!require('./auth').roles.includes(role))throw Error('Invalid role');const r=run('INSERT INTO users(global_id,username,display_name_ar,display_name_en,role,password_hash,password_changed_at) VALUES(?,?,?,?,?,?,CURRENT_TIMESTAMP)',crypto.randomUUID(),username,required(displayNameAr),displayNameEn||null,role,hashPassword(password));return Number(r.lastInsertRowid)}

function addCategory({nameAr,nameEn}){const max=one('SELECT COALESCE(MAX(sort_order),0) m FROM categories').m;const r=run('INSERT INTO categories(name_ar,name_en,sort_order) VALUES(?,?,?)',nameAr,nameEn||null,Number(max)+1);return Number(r.lastInsertRowid)}
function addProduct({categoryId,stationId,nameAr,nameEn,sku,price}){const r=run('INSERT INTO products(category_id,station_id,name_ar,name_en,sku,price) VALUES(?,?,?,?,?,?)',categoryId,stationId||null,nameAr,nameEn||null,sku||null,Number(price));return Number(r.lastInsertRowid)}
function addIngredient({nameAr,nameEn,baseUnit}){const r=run('INSERT INTO ingredients(name_ar,name_en,base_unit) VALUES(?,?,?)',nameAr,nameEn||null,baseUnit);return Number(r.lastInsertRowid)}
function addVariant({ingredientId,nameAr,nameEn,brand,purchaseUnit,conversionToBase,preferred}){const r=run('INSERT INTO ingredient_variants(ingredient_id,name_ar,name_en,brand,purchase_unit,conversion_to_base,preferred) VALUES(?,?,?,?,?,?,?)',ingredientId,nameAr,nameEn||null,brand||null,purchaseUnit,number(conversionToBase||1,'Conversion'),preferred?1:0);return Number(r.lastInsertRowid)}
function setRecipe({productId,lines}){if(!lines?.length)throw new Error('Recipe needs components');for(const l of lines){number(l.quantityBase,'Recipe quantity');if(l.specificVariantId){const v=one('SELECT ingredient_id FROM ingredient_variants WHERE id=?',Number(l.specificVariantId));if(!v||v.ingredient_id!==Number(l.ingredientId))throw new Error('Recipe variant must match ingredient')}}transaction(()=>{let r=one('SELECT id FROM recipes WHERE product_id=?',productId);let id;if(r){id=r.id;run('DELETE FROM recipe_lines WHERE recipe_id=?',id)}else{id=Number(run('INSERT INTO recipes(product_id) VALUES(?)',productId).lastInsertRowid)}run('UPDATE products SET recipe_verified=1,experimental=0 WHERE id=?',productId);for(const l of lines||[])run('INSERT INTO recipe_lines(recipe_id,ingredient_id,specific_variant_id,quantity_base,optional) VALUES(?,?,?,?,?)',id,l.ingredientId,l.specificVariantId||null,Number(l.quantityBase),l.optional?1:0)});}
function getRecipes(){return all(`SELECT r.id recipe_id,p.id product_id,p.name_ar product_ar,p.name_en product_en,i.id ingredient_id,i.name_ar ingredient_ar,i.name_en ingredient_en,rl.quantity_base,rl.specific_variant_id FROM recipes r JOIN products p ON p.id=r.product_id LEFT JOIN recipe_lines rl ON rl.recipe_id=r.id LEFT JOIN ingredients i ON i.id=rl.ingredient_id ORDER BY p.id,rl.id`)}

function backup(){
  const dir=path.join(path.dirname(dbPath),'backups');fs.mkdirSync(dir,{recursive:true});
  const stamp=new Date().toISOString().replace(/[:.]/g,'-');const dest=path.join(dir,`trackbite-${stamp}.db`);db.prepare('VACUUM INTO ?').run(dest);return dest;
}
function listBackups(){const dir=path.join(path.dirname(dbPath),'backups');if(!fs.existsSync(dir))return[];return fs.readdirSync(dir).filter(x=>x.endsWith('.db')).sort().reverse().map(name=>({name,path:path.join(dir,name),size:fs.statSync(path.join(dir,name)).size}))}

module.exports={listSuppliers,addSupplier,createPurchase,listPurchases,createExpense,listExpenses,stocktake,listStocktakes,financeReport,listUsers,createUser,addCategory,addProduct,addIngredient,addVariant,setRecipe,getRecipes,backup,listBackups};
