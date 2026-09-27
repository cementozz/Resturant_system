const crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
module.exports=function migrate(db,dbPath){
 if(db.prepare('SELECT 1 FROM schema_migrations WHERE version=9').get())return;
 const dir=path.join(path.dirname(dbPath),'backups');fs.mkdirSync(dir,{recursive:true});
 const backup=path.join(dir,'before-v9-'+Date.now()+'.db');db.prepare('VACUUM INTO ?').run(backup);
 const check=new DatabaseSync(backup,{readOnly:true});try{if(check.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw Error('Migration backup verification failed')}finally{check.close()}
 db.exec('BEGIN IMMEDIATE');
 try{
  const add=(table,column,type)=>{if(!db.prepare(`PRAGMA table_info(${table})`).all().some(c=>c.name===column))db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`)};
  add('users','global_id',"TEXT NOT NULL DEFAULT ''");add('users','last_login','TEXT');add('users','password_changed_at','TEXT');add('users','session_version','INTEGER NOT NULL DEFAULT 1');add('users','remote_access_enabled','INTEGER NOT NULL DEFAULT 0');
  for(const row of db.prepare("SELECT id FROM users WHERE global_id='' ").all())db.prepare('UPDATE users SET global_id=? WHERE id=?').run(crypto.randomUUID(),row.id);
  db.exec(`CREATE UNIQUE INDEX users_global ON users(global_id);
   CREATE TRIGGER users_global_immutable BEFORE UPDATE OF global_id ON users WHEN NEW.global_id!=OLD.global_id BEGIN SELECT RAISE(ABORT,'Staff global identity is immutable');END;
   CREATE TRIGGER stock_prevent_negative BEFORE INSERT ON stock_movements WHEN NEW.quantity_base<0 AND COALESCE((SELECT SUM(quantity_base) FROM stock_movements WHERE variant_id=NEW.variant_id AND location_id=NEW.location_id AND batch_id IS NEW.batch_id),0)+NEW.quantity_base < -0.000001 BEGIN SELECT RAISE(ABORT,'Negative stock is not allowed');END;
   CREATE TRIGGER users_global_required BEFORE INSERT ON users WHEN length(NEW.global_id)!=36 BEGIN SELECT RAISE(ABORT,'Staff global ID required'); END;
   CREATE TABLE staff_sessions(token_hash TEXT PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id),session_version INTEGER NOT NULL,expires_at INTEGER NOT NULL,last_used_at INTEGER NOT NULL,created_at INTEGER NOT NULL,revoked_at INTEGER);
   CREATE INDEX staff_sessions_user ON staff_sessions(user_id);
   CREATE TABLE auth_attempts(bucket TEXT PRIMARY KEY,count INTEGER NOT NULL,expires_at INTEGER NOT NULL);
   CREATE TABLE consumption_locations(station_code TEXT NOT NULL,location_id INTEGER NOT NULL REFERENCES stock_locations(id),PRIMARY KEY(station_code,location_id));
   CREATE TRIGGER variant_stock_guard BEFORE UPDATE OF active ON ingredient_variants WHEN NEW.active=0 AND OLD.active=1 AND EXISTS(SELECT 1 FROM stock_movements WHERE variant_id=OLD.id GROUP BY location_id HAVING SUM(quantity_base)>0.000001) BEGIN SELECT RAISE(ABORT,'Transfer or deplete stock before disabling this variant'); END;
  `);
  add('sync_queue','next_retry_at','INTEGER NOT NULL DEFAULT 0');add('customers','member_code','TEXT');add('customers','account_linked','INTEGER NOT NULL DEFAULT 0');
  db.exec('CREATE UNIQUE INDEX customer_member ON customers(member_code) WHERE member_code IS NOT NULL');
  const locations=db.prepare('SELECT id,code FROM stock_locations').all();
  for(const station of ['grill','fryer','drinks','default'])for(const loc of locations)if((station==='drinks'?['fridge','drinks_fridge','counter','kitchen']:['kitchen','prep']).includes(loc.code))db.prepare('INSERT OR IGNORE INTO consumption_locations VALUES(?,?)').run(station,loc.id);
  db.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES('restaurant_timezone','Africa/Cairo')").run();db.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES('guest_checkout_enabled','true')").run();
  for(const row of db.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND (name LIKE 'outbox_%' OR name LIKE 'outbox_sync_%')").all())db.exec('DROP TRIGGER "'+row.name.replaceAll('"','""')+'"');
  db.prepare("UPDATE sync_queue SET status='synced',last_error='Superseded by explicit v9 projection' WHERE entity_type!='orders' AND status!='synced'").run();
  const cols=['id','status','fulfillment_status','payment_status','customer_id','total','source','sequential_no','created_at'];
  for(const op of ['INSERT','UPDATE'])db.exec(`CREATE TRIGGER outbox_orders_${op} AFTER ${op} ON orders BEGIN INSERT INTO sync_queue(entity_type,entity_id,operation,payload,event_key) VALUES('orders',NEW.id,'upsert',json_object(${cols.map(c=>`'${c}',NEW.${c}`).join(',')}),lower(hex(randomblob(16)))); END`);
  db.exec('INSERT INTO schema_migrations(version) VALUES(9); COMMIT');
 }catch(e){db.exec('ROLLBACK');throw e}
};
