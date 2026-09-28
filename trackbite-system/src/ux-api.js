const {all,one,transaction}=require('./db'),s=require('./ux-service'),p=require('./permissions');
function handle(req,res,url,user,b,json){const path=url.pathname,method=req.method,done=d=>{json(res,200,d);return true};
 if(path==='/api/materials'&&method==='GET')return done({rows:s.materials(user)});
 if(path==='/api/materials'&&method==='POST')return done(s.material(b,user));
 const edit=path.match(/^\/api\/materials\/(\d+)$/);if(edit&&method==='PATCH')return done(s.material(b,user,Number(edit[1])));
 if(path==='/api/ux/suppliers'&&method==='POST')return done(transaction(()=>s.supplier(b,user)));
 if(path==='/api/ux/categories'&&method==='POST'){return done(transaction(()=>{const name=require('./validation').required(b.nameAr),old=s.match('categories',name);if(old)return {id:old.id};const id=require('./admin').addCategory({...b,nameAr:name});p.audit(user,'category.create','categories',id,null,b);return {id}}))}
 if(path==='/api/ux/customers'&&method==='POST'){return done(transaction(()=>{const phone=require('./customers').phone(b.phone);require('./validation').required(phone,'Phone');const old=one('SELECT * FROM customers WHERE phone=?',phone);if(old)return {id:old.id};const id=require('./customers').save({customerName:require('./validation').required(b.name),customerPhone:phone});p.audit(user,'customer.create','customers',id,null,{name:b.name});return {id}}))}
 if(path==='/api/ux/purchases'&&method==='POST')return done(s.purchase(b,user));
 if(path==='/api/ux/transfer'&&method==='POST')return done(s.transfer(b,user));
 if(path==='/api/ux/production'&&method==='POST')return done(s.production(b,user));
 if(path==='/api/production-templates'){if(method==='GET')return done({rows:all('SELECT * FROM production_templates WHERE active=1').map(r=>({...r,inputs:JSON.parse(r.inputs),outputs:JSON.parse(r.outputs)}))});return done(s.template(b,user))}
 const imp=path.match(/^\/api\/imports\/(materials|menu|prices|purchases)\/(preview|commit)$/);if(imp)return done(require('./ux-import').handle(imp[1],imp[2],b,user));
 return false;
}
module.exports={handle};
