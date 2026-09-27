const assert=require('node:assert/strict');
module.exports=({db,one,run,transaction},stock)=>{
 const rollback=Error('isolated edge-case rollback');
 try{transaction(()=>{
  const ingredient=Number(run("INSERT INTO ingredients(name_ar,name_en,base_unit) VALUES('Test','Test','pcs')").lastInsertRowid);
  const variant=preferred=>Number(run("INSERT INTO ingredient_variants(ingredient_id,name_ar,name_en,purchase_unit,conversion_to_base,preferred) VALUES(?,'Test','Test','pcs',1,?)",ingredient,preferred).lastInsertRowid);
  const a=variant(0),b=variant(1);
  for(const [v,qty,expiry,received] of [[a,2,'2030-01-01','2029-01-01'],[b,3,'2030-01-03','2029-01-02']]){
   const id=require('node:crypto').randomUUID();run('INSERT INTO stock_batches(id,variant_id,expires_on,batch_number) VALUES(?,?,?,?)',id,v,expiry,id);
   run("INSERT INTO stock_movements(variant_id,location_id,quantity_base,movement_type,reference_type,reference_id,batch_id,created_at) VALUES(?,3,?,'opening','test','edge',?,?)",v,qty,id,received);
  }
  const RealDate=global.Date;global.Date=class extends RealDate{constructor(...args){super(...(args.length?args:['2030-01-01T12:00:00Z']))}static now(){return new RealDate('2030-01-01T12:00:00Z').getTime()}};
  try{
   run("UPDATE settings SET value='Pacific/Honolulu' WHERE key='restaurant_timezone'");
   assert.equal(stock.allocations({ingredientId:ingredient,rule:'fifo'})[0].variant_id,a);
   assert.equal(stock.allocations({ingredientId:ingredient,rule:'fefo'})[0].variant_id,a);
   assert.equal(stock.allocations({ingredientId:ingredient,rule:'preferred'})[0].variant_id,b);
   run("UPDATE settings SET value='Pacific/Kiritimati' WHERE key='restaurant_timezone'");
   assert.deepEqual(stock.allocations({ingredientId:ingredient}).map(r=>r.variant_id),[b]);
   assert.throws(()=>stock.consumeIngredient({ingredientId:ingredient,specificVariantId:a,quantityBase:1,referenceType:'test',referenceId:'expired'}),/Transfer/);
   const used=stock.consumeIngredient({ingredientId:ingredient,quantityBase:1,referenceType:'test',referenceId:'substitution'});assert.equal(used[0].variant_id,b);
  }finally{global.Date=RealDate}
  const count=one('SELECT COUNT(*) n FROM stock_movements').n;
  assert.throws(()=>stock.transferStock({variantId:b,fromLocationId:3,toLocationId:9999,quantityPurchase:1}),/Location/);
  assert.throws(()=>stock.production({userId:1,inputs:[{variantId:b,locationId:3,quantityPurchase:1}],outputs:[{variantId:a,locationId:9999,quantityPurchase:1}]}),/Location|FOREIGN KEY/ );
  assert.equal(one('SELECT COUNT(*) n FROM stock_movements').n,count);
  assert.throws(()=>stock.move({variantId:b,locationId:3,qty:-100,type:'test',refType:'test',refId:'negative'}),/negative/i);
  assert.throws(()=>stock.receiveStock({variantId:b,locationId:3,quantityPurchase:1,expiresOn:'2030-02-30'}),/expiry/);
  assert.throws(()=>require('../src/admin').stocktake({locationId:3,userId:1,counts:[{variantId:b,quantityPurchase:1},{variantId:b,quantityPurchase:1}]}),/Duplicate/);
  throw rollback;
 })}catch(e){if(e!==rollback)throw e}
};
