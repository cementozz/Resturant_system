function migrate(db,dbPath) {
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT DEFAULT CURRENT_TIMESTAMP)');
  if (db.prepare('SELECT 1 FROM schema_migrations WHERE version=8').get()) return;
  const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');const dir=path.join(path.dirname(dbPath),'backups');fs.mkdirSync(dir,{recursive:true});const target=path.join(dir,'before-v8-'+Date.now()+'.db');db.prepare('VACUUM INTO ?').run(target);const backup=new DatabaseSync(target,{readOnly:true});try{if(backup.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw Error('Daily numbering backup verification failed')}finally{backup.close()}
  db.exec('BEGIN IMMEDIATE');
  try {
    const columns = db.prepare('PRAGMA table_info(orders)').all().map(column => column.name);
    if (!columns.includes('order_date')) db.exec("ALTER TABLE orders ADD COLUMN order_date TEXT");
    if (!columns.includes('daily_no')) db.exec('ALTER TABLE orders ADD COLUMN daily_no INTEGER');
    db.exec("UPDATE orders SET order_date=date(created_at,'localtime') WHERE order_date IS NULL");
    for (const order of db.prepare('SELECT id,order_date FROM orders WHERE daily_no IS NULL ORDER BY created_at,id').all()) {
      const used = db.prepare('SELECT COUNT(*) count FROM orders WHERE order_date=? AND daily_no IS NOT NULL').get(order.order_date).count;
      db.prepare('UPDATE orders SET daily_no=? WHERE id=?').run(Number(used) + 1, order.id);
    }
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS orders_daily_number ON orders(order_date,daily_no)');
    db.prepare('INSERT INTO schema_migrations(version) VALUES(8)').run();
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
module.exports = migrate;
