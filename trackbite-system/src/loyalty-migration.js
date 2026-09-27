module.exports=(db,dbPath)=>{if(db.prepare('SELECT 1 FROM schema_migrations WHERE version=10').get())return;
 const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');const directory=path.join(path.dirname(dbPath),'backups');fs.mkdirSync(directory,{recursive:true});const target=path.join(directory,'before-v10-'+Date.now()+'.db');db.prepare('VACUUM INTO ?').run(target);const check=new DatabaseSync(target,{readOnly:true});try{if(check.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw Error('Loyalty migration backup verification failed')}finally{check.close()}
 try{db.exec(`BEGIN IMMEDIATE;
 CREATE TABLE loyalty_settings(id INTEGER PRIMARY KEY CHECK(id=1),value TEXT NOT NULL);
 INSERT INTO loyalty_settings VALUES(1,'{"enabled":true,"amountPerPoint":10,"rounding":"floor","qualifyingState":"paid_fulfilled","minimumSpend":0}');
 CREATE TABLE loyalty_rewards(id TEXT PRIMARY KEY,payload TEXT NOT NULL);
 CREATE TABLE loyalty_ledger(id TEXT PRIMARY KEY,customer_id TEXT NOT NULL REFERENCES customers(id),order_id TEXT,type TEXT NOT NULL,delta INTEGER NOT NULL,idempotency_key TEXT UNIQUE NOT NULL,reason TEXT NOT NULL,actor TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
 CREATE TRIGGER loyalty_no_update BEFORE UPDATE ON loyalty_ledger BEGIN SELECT RAISE(ABORT,'Loyalty ledger is immutable');END;
 CREATE TRIGGER loyalty_no_delete BEFORE DELETE ON loyalty_ledger BEGIN SELECT RAISE(ABORT,'Loyalty ledger is immutable');END;
 CREATE TRIGGER loyalty_outbox AFTER INSERT ON loyalty_ledger BEGIN INSERT INTO sync_queue(entity_type,entity_id,operation,payload,event_key) VALUES('loyalty',NEW.customer_id,'upsert',json_object('id',NEW.id,'customer_id',NEW.customer_id,'order_id',NEW.order_id,'type',NEW.type,'delta',NEW.delta,'idempotency_key',NEW.idempotency_key,'reason',NEW.reason,'actor',NEW.actor,'created_at',NEW.created_at),lower(hex(randomblob(16))));END;
 CREATE TABLE customer_links(account_id TEXT PRIMARY KEY,customer_id TEXT NOT NULL UNIQUE REFERENCES customers(id),member_code TEXT NOT NULL UNIQUE);
 CREATE TABLE command_receipts(id TEXT PRIMARY KEY,status TEXT NOT NULL,result TEXT NOT NULL,applied_at TEXT DEFAULT CURRENT_TIMESTAMP);
 ALTER TABLE orders ADD COLUMN reward_snapshot TEXT;
 ALTER TABLE orders ADD COLUMN loyalty_rules TEXT;
 INSERT INTO schema_migrations(version) VALUES(10);COMMIT;`)}catch(e){if(db.isTransaction)db.exec('ROLLBACK');throw e}};
