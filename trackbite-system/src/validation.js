function number(value,label='Quantity',{zero=false}={}) { const n=Number(value);if(value===null||value===''||!Number.isFinite(n)||(zero?n<0:n<=0)||n>1e12)throw new Error(`${label} must be a finite ${zero?'non-negative':'positive'} number`);return n }
function money(v){return Math.round((Number(v)+Number.EPSILON)*100)/100}
function required(v,label='Value'){if(typeof v!=='string'||!v.trim()||v.length>2000)throw new Error(`${label} is required`);return v.trim()}
module.exports={number,money,required};
