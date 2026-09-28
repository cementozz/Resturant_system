const {one,all}=require('./db'),stock=require('./stock-ledger');
function availability(id){try{const item=require('./orders').normalize([{productId:id,qty:1}])[0],station=one('SELECT code FROM preparation_stations WHERE id=?',item.p.station_id)?.code||'default',locations=all('SELECT location_id FROM consumption_locations WHERE station_code=?',station).map(r=>r.location_id),remaining=new Map();
 for(const line of item.requirements){if(line.quantity_base<=0)continue;let needed=line.quantity_base;for(const r of stock.allocations({ingredientId:line.ingredient_id,variantId:line.specific_variant_id||undefined,allowedLocations:locations})){const key=[r.variant_id,r.location_id,r.batch_id].join(':');if(!remaining.has(key))remaining.set(key,r.qty);const take=Math.min(remaining.get(key),needed);remaining.set(key,remaining.get(key)-take);needed-=take;if(needed<1e-8)break}if(needed>1e-8)return false}return true;
 }catch{return false}}
module.exports={availability};
