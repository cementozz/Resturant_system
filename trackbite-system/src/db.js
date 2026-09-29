const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const { hashPassword } = require('./auth');

const dataDir = path.join(__dirname, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });
const dbPath = process.env.TRACKBITE_DB || path.join(dataDir, 'trackbite.db');
const db = new DatabaseSync(dbPath);
db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));

function one(sql, ...params) { return db.prepare(sql).get(...params); }
function all(sql, ...params) { return db.prepare(sql).all(...params); }
function run(sql, ...params) { return db.prepare(sql).run(...params); }
function transaction(fn) {
  const savepoint = `tx_${++transaction.sequence}`;
  db.exec(`SAVEPOINT ${savepoint}`);
  try { const result = fn(); db.exec(`RELEASE ${savepoint}`); return result; }
  catch (e) { db.exec(`ROLLBACK TO ${savepoint}; RELEASE ${savepoint}`); throw e; }
}
transaction.sequence = 0;

function seed() {
  const hasUsers = one('SELECT COUNT(*) AS c FROM users').c;
  if (hasUsers) return;
  transaction(() => {
    const users = [
      ['owner','المالك','Owner','owner','1234'],
      ['manager','المدير','Manager','manager','1234'],
      ['cashier','الكاشير','Cashier','cashier','1234'],
      ['store','مسؤول المخزن','Store Keeper','storekeeper','1234'],
      ['accountant','المحاسب','Accountant','accountant','1234'],
      ['kitchen','المطبخ','Kitchen','kitchen','1234']
    ];
    if(process.env.DEMO_MODE!=='true'){require('./auth').validateCredentials('owner',process.env.INITIAL_OWNER_PASSWORD);users[0][4]=process.env.INITIAL_OWNER_PASSWORD;users.splice(1)}
    for (const u of users) run('INSERT INTO users(username,display_name_ar,display_name_en,role,password_hash) VALUES(?,?,?,?,?)', u[0],u[1],u[2],u[3],hashPassword(u[4]));

    [['BURGERS','برجر','Burgers'],['LOADED','لودد فرايز','Loaded Fries'],['SIDES','إضافات','Sides'],['DRINKS','مشروبات','Drinks']].forEach((c,i)=>run('INSERT INTO categories(id,name_ar,name_en,sort_order) VALUES(?,?,?,?)',i+1,c[1],c[2],i));
    [['grill','الشواية','Grill'],['fryer','القلاية','Fryer'],['drinks','المشروبات','Drinks']].forEach((s,i)=>run('INSERT INTO preparation_stations(id,code,name_ar,name_en) VALUES(?,?,?,?)',i+1,...s));
    [['main','المخزن الرئيسي','Main Store',50],['freezer','الفريزر','Freezer',20],['kitchen','المطبخ','Kitchen',10],['fridge','ثلاجة المشروبات','Drinks Fridge',5]].forEach((l,i)=>run('INSERT INTO stock_locations(id,code,name_ar,name_en,priority) VALUES(?,?,?,?,?)',i+1,...l));
    [['cash','نقدي','Cash',0],['vodafone','فودافون كاش','Vodafone Cash',1],['instapay','إنستا باي','InstaPay',1],['visa','فيزا / كارت','Visa / Card',0]].forEach((p,i)=>run('INSERT INTO payment_methods(id,code,name_ar,name_en,requires_reference,sort_order) VALUES(?,?,?,?,?,?)',i+1,...p,i));

    const ingredients = [
      ['لحم مفروم','Minced Beef','g'],['قطعة برجر','Burger Patty','pcs'],['خبز برجر','Burger Bun','pcs'],['جبنة','Cheese','pcs'],['صوص برجر','Burger Sauce','g'],['بطاطس','French Fries','g'],['كولا','Cola','pcs'],['علبة برجر','Burger Box','pcs'],['علبة فرايز','Fries Box','pcs']
    ];
    ingredients.forEach((x,i)=>run('INSERT INTO ingredients(id,name_ar,name_en,base_unit) VALUES(?,?,?,?)',i+1,...x));
    const variants = [
      [1,1,'لحم محلي','Local Beef','Local','kg',1000,1],
      [2,2,'باتي المطعم','House Patty','House','pcs',1,1],
      [3,3,'خبز مورد A','Supplier A Bun','Supplier A','pcs',1,1],
      [4,4,'جبنة شيدر','Cheddar Cheese','Generic','pcs',1,1],
      [5,5,'هاينز صوص','Heinz Sauce','Heinz','kg',1000,1],
      [6,6,'فارم فرايتس','Farm Frites','Farm Frites','kg',1000,1],
      [7,6,'ماكين بطاطس','McCain Fries','McCain','kg',1000,0],
      [8,7,'كوكاكولا','Coca-Cola','Coca-Cola','carton',24,1],
      [9,8,'علبة برجر','Burger Box','Packaging','pcs',1,1],
      [10,9,'علبة فرايز','Fries Box','Packaging','pcs',1,1]
    ];
    variants.forEach(v=>run('INSERT INTO ingredient_variants(id,ingredient_id,name_ar,name_en,brand,purchase_unit,conversion_to_base,preferred) VALUES(?,?,?,?,?,?,?,?)',...v));

    const products = [
      [1,1,1,'كلاسيك برجر','Classic Burger','BUR-CLASSIC',150],
      [2,1,1,'دبل برجر','Double Burger','BUR-DOUBLE',210],
      [3,2,2,'لودد فرايز','Loaded Fries','LOAD-001',145],
      [4,4,3,'كولا','Cola','DRINK-COLA',35]
    ];
    products.forEach(p=>run('INSERT INTO products(id,category_id,station_id,name_ar,name_en,sku,price) VALUES(?,?,?,?,?,?,?)',...p));
    [[1,1],[2,2],[3,3],[4,4]].forEach(r=>run('INSERT INTO recipes(id,product_id) VALUES(?,?)',...r));
    const lines = [
      [1,2,1],[1,3,1],[1,4,1],[1,5,20],[1,8,1],
      [2,2,2],[2,3,1],[2,4,2],[2,5,25],[2,8,1],
      [3,6,250],[3,4,2],[3,5,30],[3,9,1],
      [4,7,1]
    ];
    lines.forEach(l=>run('INSERT INTO recipe_lines(recipe_id,ingredient_id,quantity_base) VALUES(?,?,?)',...l));

    const nowUser = 1;
    const initial = [
      [1,1,20000],[2,3,120],[3,3,150],[4,3,250],[5,3,6000],[6,2,20000],[7,2,7000],[8,4,120],[9,3,300],[10,3,300]
    ];
    initial.forEach(x=>run("INSERT INTO stock_movements(variant_id,location_id,quantity_base,movement_type,reference_type,reference_id,user_id,note) VALUES(?,?,?,'opening','seed','initial',?,'Initial stock')",x[0],x[1],x[2],nowUser));

    [['restaurant_name_ar','تراك بايت'],['restaurant_name_en','Track Bite'],['language_default','ar'],['currency','EGP'],['next_order_no','1001']].forEach(s=>run('INSERT INTO settings(key,value) VALUES(?,?)',...s));
  });
}
seed();
require('./migrations').migrate(db);
require('./commercial-migration')(db);
require('./printing/migration')(db);
require('./settlement-migration')(db);
require('./compatibility-migration')(db);
require('./daily-orders-migration')(db,dbPath);
require('./reliability-migration')(db,dbPath);
require('./loyalty-migration')(db,dbPath);
require('./online-orders-migration')(db,dbPath);
require('./menu-setup-migration')(db,dbPath);
require('./ux-migration')(db,dbPath);require('./customer-migration')(db,dbPath);

module.exports = { db, one, all, run, transaction, dbPath };
