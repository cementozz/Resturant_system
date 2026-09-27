(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TrackBitePricing=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
 const round=n=>Math.round((n+Number.EPSILON)*100)/100;
 function amount(v,label){const n=Number(v??0);if(!Number.isFinite(n)||n<0||n>1e10)throw new Error('Invalid '+label);return round(n)}
 function calculate({subtotal,discount=0,deliveryFee=0,settings={}}){subtotal=amount(subtotal,'subtotal');discount=amount(discount,'discount');if(discount>subtotal)throw new Error('Discount exceeds subtotal');const net=round(subtotal-discount);const charge=(key,base)=>{if(String(settings[key+'_enabled'])!=='true')return 0;const value=amount(settings[key+'_value'],key);return settings[key+'_type']==='fixed'?value:round(base*value/100)};const service=charge('service',net),tax=charge('tax',net+service),packaging=charge('packaging',net),other=charge('other',net),delivery=amount(deliveryFee,'delivery');return {subtotal,discount,service,tax,packaging,other,delivery,total:round(net+service+tax+packaging+other+delivery)}}
 return {calculate,round};
});
