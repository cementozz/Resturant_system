const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
module.exports=(db,dbPath)=>{
 if(db.prepare('SELECT 1 FROM schema_migrations WHERE version=11').get())return;
 const dir=path.join(path.dirname(dbPath),'backups');fs.mkdirSync(dir,{recursive:true});const file=path.join(dir,'before-v11-'+Date.now()+'.db');db.prepare('VACUUM INTO ?').run(file);const check=new DatabaseSync(file,{readOnly:true});try{if(check.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw Error('Backup failed integrity check')}finally{check.close()}
 db.exec('BEGIN IMMEDIATE');try{
  db.exec(`CREATE TABLE online_order_inbox(cloud_id TEXT PRIMARY KEY,cloud_no INTEGER NOT NULL,payload TEXT NOT NULL,received_at TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'awaiting_restaurant_confirmation' CHECK(status IN ('awaiting_restaurant_confirmation','needs_review','confirmed','rejected')),local_order_id TEXT UNIQUE REFERENCES orders(id),reason_code TEXT,validation_details TEXT,technical_error TEXT,rejection_reason TEXT,actor_id INTEGER REFERENCES users(id),decided_at TEXT,decision_pending INTEGER NOT NULL DEFAULT 0,delivery_attempts INTEGER NOT NULL DEFAULT 0,next_retry_at INTEGER NOT NULL DEFAULT 0,last_delivery_error TEXT,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
   CREATE INDEX online_inbox_status ON online_order_inbox(status,received_at);
   CREATE UNIQUE INDEX IF NOT EXISTS cloud_import_local_unique ON cloud_imports(local_order_id);`);
  for(const [key,value] of [['online_confirmation_timeout_minutes','10'],['online_order_alert_sound','true'],['kitchen_warning_minutes','10'],['kitchen_late_minutes','15']])db.prepare('INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)').run(key,value);
  db.exec('INSERT INTO schema_migrations(version) VALUES(11);COMMIT');
 }catch(e){db.exec('ROLLBACK');throw e}
};
