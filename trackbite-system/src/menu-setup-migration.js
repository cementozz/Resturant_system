const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
module.exports=(db,dbPath)=>{if(db.prepare('SELECT 1 FROM schema_migrations WHERE version=12').get())return;
 const dir=path.join(path.dirname(dbPath),'backups');fs.mkdirSync(dir,{recursive:true});const backup=path.join(dir,'before-v12-'+Date.now()+'.db');db.prepare('VACUUM INTO ?').run(backup);const check=new DatabaseSync(backup,{readOnly:true});try{if(check.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw Error('Backup verification failed')}finally{check.close()}
 db.exec('BEGIN IMMEDIATE');try{db.exec(`ALTER TABLE categories ADD COLUMN code TEXT;
 ALTER TABLE ingredients ADD COLUMN code TEXT;
 ALTER TABLE ingredients ADD COLUMN cost_group TEXT NOT NULL DEFAULT 'ingredient';
 ALTER TABLE products ADD COLUMN setup_required INTEGER NOT NULL DEFAULT 0;
 ALTER TABLE products ADD COLUMN price_known INTEGER NOT NULL DEFAULT 1;
 ALTER TABLE products ADD COLUMN recipe_verified INTEGER NOT NULL DEFAULT 1;
 ALTER TABLE products ADD COLUMN experimental INTEGER NOT NULL DEFAULT 0;
 CREATE TABLE experimental_menu_archive(product_id INTEGER PRIMARY KEY,payload TEXT NOT NULL,archived_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
 CREATE UNIQUE INDEX category_code ON categories(code) WHERE code IS NOT NULL;
 CREATE UNIQUE INDEX ingredient_code ON ingredients(code) WHERE code IS NOT NULL;
 CREATE TABLE modifier_templates(code TEXT PRIMARY KEY,name_ar TEXT NOT NULL,name_en TEXT NOT NULL,price REAL,active INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE real_menu_seed_links(kind TEXT NOT NULL,code TEXT NOT NULL,entity_id INTEGER NOT NULL,PRIMARY KEY(kind,code));
 INSERT INTO schema_migrations(version) VALUES(12); COMMIT`)}catch(e){db.exec('ROLLBACK');throw e}};
