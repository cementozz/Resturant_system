const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
module.exports=(db,dbPath)=>{
 if(db.prepare('SELECT 1 FROM schema_migrations WHERE version=13').get())return;
 const dir=path.join(path.dirname(dbPath),'backups');fs.mkdirSync(dir,{recursive:true});const file=path.join(dir,'before-v13-'+Date.now()+'.db');db.prepare('VACUUM INTO ?').run(file);const backup=new DatabaseSync(file,{readOnly:true});try{if(backup.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw Error('Backup verification failed')}finally{backup.close()}
 db.exec('BEGIN IMMEDIATE');try{db.exec(`
 ALTER TABLE ingredients ADD COLUMN default_stock_location_id INTEGER REFERENCES stock_locations(id);
 ALTER TABLE ingredients ADD COLUMN material_type TEXT NOT NULL DEFAULT 'purchased' CHECK(material_type IN ('purchased','prepared'));
 ALTER TABLE ingredients ADD COLUMN display_unit TEXT;
 ALTER TABLE purchases ADD COLUMN invoice_date TEXT;
 ALTER TABLE purchases ADD COLUMN notes TEXT;
 CREATE TABLE production_templates(id INTEGER PRIMARY KEY,name TEXT NOT NULL,inputs TEXT NOT NULL,outputs TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1);
 CREATE TABLE ux_requests(request_id TEXT PRIMARY KEY,operation TEXT NOT NULL,body_hash TEXT NOT NULL,result TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
 INSERT INTO schema_migrations(version) VALUES(13);COMMIT`)}catch(e){db.exec('ROLLBACK');throw e}
};
