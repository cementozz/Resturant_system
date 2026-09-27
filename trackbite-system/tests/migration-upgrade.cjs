const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
module.exports=dir=>{
 const old=fs.readdirSync(path.join(dir,'backups')).find(n=>n.startsWith('before-v9'));
 const target=path.join(dir,'legacy-upgrade.db');fs.copyFileSync(path.join(dir,'backups',old),target);const db=new DatabaseSync(target);
 try{
  db.prepare("INSERT INTO orders(id,sequential_no,subtotal,total) VALUES('legacy-order',999,150,150)").run();
  const stock=db.prepare('SELECT SUM(quantity_base) q FROM stock_movements').get().q;
  const users=db.prepare('SELECT COUNT(*) n FROM users').get().n;
  require('../src/reliability-migration')(db,target);require('../src/loyalty-migration')(db,target);
  assert.equal(db.prepare("SELECT total FROM orders WHERE id='legacy-order'").get().total,150);
  assert.equal(db.prepare('SELECT SUM(quantity_base) q FROM stock_movements').get().q,stock);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM users WHERE global_id IS NOT NULL').get().n,users);
  assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
 }finally{db.close()}
};
