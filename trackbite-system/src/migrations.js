const crypto = require('crypto');
function migrate(db) {
  db.exec('PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT DEFAULT CURRENT_TIMESTAMP)');
  if (db.prepare('SELECT 1 FROM schema_migrations WHERE version=3').get()) return;
  db.exec('BEGIN IMMEDIATE');
  try {
    const add=(table,column,type)=>{if(!db.prepare(`PRAGMA table_info(${table})`).all().some(c=>c.name===column))db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`)};
    add('orders','request_id','TEXT'); add('orders','request_hash','TEXT');
    add('orders','fulfillment_status',"TEXT NOT NULL DEFAULT 'accepted'");
    add('orders','payment_status',"TEXT NOT NULL DEFAULT 'paid'");
    add('orders','delivery_address','TEXT');
    add('order_items','modifiers',"TEXT NOT NULL DEFAULT '[]'");
    add('order_items','station_code','TEXT');
    add('stock_movements','batch_id','TEXT');
    add('ingredients','low_stock_base','REAL NOT NULL DEFAULT 0');
    add('audit_log','approved_by','INTEGER REFERENCES users(id)');
    add('print_queue','reprint','INTEGER NOT NULL DEFAULT 0');
    add('sync_queue','event_key','TEXT');
    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS orders_request ON orders(request_id) WHERE request_id IS NOT NULL;
      CREATE TABLE role_permissions(role TEXT NOT NULL, permission TEXT NOT NULL, allowed INTEGER NOT NULL, PRIMARY KEY(role,permission));
      CREATE TABLE modifiers(id INTEGER PRIMARY KEY AUTOINCREMENT, product_id INTEGER NOT NULL REFERENCES products(id), name_ar TEXT NOT NULL, name_en TEXT, price REAL NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1);
      CREATE TABLE modifier_lines(id INTEGER PRIMARY KEY AUTOINCREMENT, modifier_id INTEGER NOT NULL REFERENCES modifiers(id), ingredient_id INTEGER NOT NULL REFERENCES ingredients(id), quantity_base REAL NOT NULL);
      CREATE TABLE stock_batches(id TEXT PRIMARY KEY, variant_id INTEGER NOT NULL REFERENCES ingredient_variants(id), batch_number TEXT NOT NULL, expires_on TEXT, received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE refunds(id TEXT PRIMARY KEY, order_id TEXT NOT NULL UNIQUE REFERENCES orders(id), user_id INTEGER NOT NULL REFERENCES users(id), approved_by INTEGER REFERENCES users(id), shift_id INTEGER REFERENCES shifts(id), reason TEXT NOT NULL, restock INTEGER NOT NULL DEFAULT 0, total REAL NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE refund_payments(id TEXT PRIMARY KEY, refund_id TEXT NOT NULL REFERENCES refunds(id), payment_method_id INTEGER NOT NULL REFERENCES payment_methods(id), amount REAL NOT NULL);
      CREATE TABLE waste_reasons(id INTEGER PRIMARY KEY AUTOINCREMENT, name_ar TEXT NOT NULL, name_en TEXT, active INTEGER NOT NULL DEFAULT 1);
      CREATE TABLE sync_log(id INTEGER PRIMARY KEY AUTOINCREMENT, ok INTEGER NOT NULL, message TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
      CREATE INDEX batch_movements ON stock_movements(batch_id,location_id);
      CREATE TRIGGER stock_no_update BEFORE UPDATE ON stock_movements BEGIN SELECT RAISE(ABORT,'Stock ledger is immutable'); END;
      CREATE TRIGGER stock_no_delete BEFORE DELETE ON stock_movements BEGIN SELECT RAISE(ABORT,'Stock ledger is immutable'); END;
    `);
    const settings={installation_id:crypto.randomUUID(),consumption_rule:'preferred',pickup_enabled:'true',delivery_enabled:'false',backup_interval_hours:'24'};
    for(const [k,v] of Object.entries(settings))db.prepare('INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)').run(k,v);
    for(const r of [['تالف','Damaged'],['منتهي الصلاحية','Expired'],['خطأ تحضير','Preparation error'],['أخرى','Other']])db.prepare('INSERT INTO waste_reasons(name_ar,name_en) VALUES(?,?)').run(...r);
    for(const r of [['prep','منطقة التحضير','Preparation Area',15],['counter','الكاونتر','Front Counter',30]])db.prepare('INSERT OR IGNORE INTO stock_locations(code,name_ar,name_en,priority) VALUES(?,?,?,?)').run(...r);
    for(const r of [['customer','Customer Receipt',null],['grill','Grill','grill'],['fryer','Fryer','fryer'],['drinks','Drinks','drinks']])db.prepare('INSERT OR IGNORE INTO printer_settings(code,name,station_code) VALUES(?,?,?)').run(...r);
    for(const product of db.prepare('SELECT id FROM products WHERE id IN (1,2,3)').all()) {
      for(const m of [['إضافة جبنة','Extra Cheese',15,4,1],['بدون صوص','No Sauce',0,5,-(product.id===1?20:product.id===2?25:30)]]) {
        const id=db.prepare('INSERT INTO modifiers(product_id,name_ar,name_en,price) VALUES(?,?,?,?)').run(product.id,...m.slice(0,3)).lastInsertRowid;
        db.prepare('INSERT INTO modifier_lines(modifier_id,ingredient_id,quantity_base) VALUES(?,?,?)').run(id,m[3],m[4]);
      }
      if(product.id!==3){const id=db.prepare('INSERT INTO modifiers(product_id,name_ar,name_en,price) VALUES(?,?,?,?)').run(product.id,'إضافة قطعة برجر','Extra Patty',60).lastInsertRowid;db.prepare('INSERT INTO modifier_lines(modifier_id,ingredient_id,quantity_base) VALUES(?,?,1)').run(id,2)}
    }
    db.prepare('UPDATE sync_queue SET event_key=? || id WHERE event_key IS NULL').run(crypto.randomUUID()+'-legacy-');
    db.exec('CREATE UNIQUE INDEX sync_event_key ON sync_queue(event_key)');
    // Outbox snapshots are recorded by the same SQLite transaction as each mutation.
    const tables=['categories','products','ingredients','ingredient_variants','stock_locations','recipes','recipe_lines','modifiers','modifier_lines','stock_batches','stock_movements','orders','order_items','payments','shifts','production_batches','production_lines','waste_records','suppliers','purchases','purchase_items','expenses','stocktakes','stocktake_lines','refunds','refund_payments','audit_log','payment_methods','preparation_stations'];
    const installation=db.prepare("SELECT value FROM settings WHERE key='installation_id'").get().value;
    for(const table of tables){
      const cols=db.prepare(`PRAGMA table_info(${table})`).all().map(c=>c.name);
      for(const op of ['INSERT','UPDATE','DELETE']){
        const ref=op==='DELETE'?'OLD':'NEW';
        const json=`json_object(${cols.map(c=>`'${c}',${ref}.${c}`).join(',')})`;
        db.exec(`CREATE TRIGGER outbox_${table}_${op} AFTER ${op} ON ${table} BEGIN INSERT INTO sync_queue(entity_type,entity_id,operation,payload,event_key) VALUES('${table}',CAST(${ref}.id AS TEXT),'${op==='DELETE'?'delete':'upsert'}',${json},lower(hex(randomblob(16)))); END`);
      }
      const insert=db.prepare('INSERT INTO sync_queue(entity_type,entity_id,operation,payload,event_key) VALUES(?,?,?,?,?)');
      for(const row of db.prepare(`SELECT * FROM ${table}`).all())insert.run(table,String(row.id),'upsert',JSON.stringify(row),crypto.randomUUID());
    }
    db.exec('INSERT INTO schema_migrations(version) VALUES(3); COMMIT');
  } catch(e){db.exec('ROLLBACK');throw e}
}
module.exports={migrate};
