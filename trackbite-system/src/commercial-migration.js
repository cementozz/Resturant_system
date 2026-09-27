const crypto=require('crypto');
module.exports=function migrate(db){if(db.prepare('SELECT 1 FROM schema_migrations WHERE version=4').get())return;db.exec('BEGIN IMMEDIATE');try{
 const add=(t,c,type)=>{if(!db.prepare(`PRAGMA table_info(${t})`).all().some(x=>x.name===c))db.exec(`ALTER TABLE ${t} ADD COLUMN ${c} ${type}`)};
 add('orders','delivery_details',"TEXT NOT NULL DEFAULT '{}'");add('orders','delivery_fee','REAL NOT NULL DEFAULT 0');add('orders','customer_id','TEXT');
 add('products','description_ar','TEXT');add('products','description_en','TEXT');add('products','in_stock','INTEGER NOT NULL DEFAULT 1');
 add('expenses','expense_date','TEXT');add('expenses','notes','TEXT');add('expenses','recurring','TEXT');
 db.exec(`CREATE TABLE customers(id TEXT PRIMARY KEY,name TEXT,phone TEXT NOT NULL UNIQUE,alternative_phone TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);CREATE TABLE customer_addresses(id TEXT PRIMARY KEY,customer_id TEXT NOT NULL REFERENCES customers(id),details TEXT NOT NULL,updated_at TEXT DEFAULT CURRENT_TIMESTAMP);CREATE TABLE order_types(code TEXT PRIMARY KEY,name_ar TEXT NOT NULL,name_en TEXT,requires_delivery INTEGER NOT NULL DEFAULT 0,active INTEGER NOT NULL DEFAULT 1,online INTEGER NOT NULL DEFAULT 0);`);
 for(const r of [['pickup','استلام','Pickup',0,1],['delivery','توصيل','Delivery',1,1],['takeaway','تيك أواي','Takeaway',0,0],['dine_in','داخل المطعم','Dine in',0,0]])db.prepare('INSERT INTO order_types(code,name_ar,name_en,requires_delivery,online) VALUES(?,?,?,?,?)').run(...r);
 for(const r of [['costing_method','average'],['target_food_cost_percent','30'],['low_margin_percent','50'],['delivery_fee','0']])db.prepare('INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)').run(...r);
 for(const table of ['orders','products','expenses','customers','customer_addresses']){
  const cols=db.prepare(`PRAGMA table_info(${table})`).all().map(c=>c.name);
  for(const op of ['INSERT','UPDATE','DELETE']){const ref=op==='DELETE'?'OLD':'NEW';db.exec(`DROP TRIGGER IF EXISTS outbox_${table}_${op};CREATE TRIGGER outbox_${table}_${op} AFTER ${op} ON ${table} BEGIN INSERT INTO sync_queue(entity_type,entity_id,operation,payload,event_key) VALUES('${table}',CAST(${ref}.id AS TEXT),'${op==='DELETE'?'delete':'upsert'}',json_object(${cols.map(c=>`'${c}',${ref}.${c}`).join(',')}),lower(hex(randomblob(16)))); END`)}
 }
 db.exec('INSERT INTO schema_migrations(version) VALUES(4);COMMIT');
 }catch(e){db.exec('ROLLBACK');throw e}};
