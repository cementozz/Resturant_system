const {all,one,transaction}=require('./db'),s=require('./ux-service'),p=require('./permissions');
async function handle(req,res,url,user,b,json){const path=url.pathname,method=req.method,done=d=>{json(res,200,d);return true};
 const invoice=path.match(/^\/api\/purchases\/([^/]+)$/);if(invoice&&method==='GET')return done({purchase:require('./purchase-details').get(invoice[1])});
 if(path==='/api/menu/categories'&&method==='GET')return done({rows:all('SELECT c.*,(SELECT COUNT(*) FROM products p WHERE p.category_id=c.id) item_count FROM categories c ORDER BY c.sort_order,c.id')});
 const categoryEdit=path.match(/^\/api\/menu\/categories\/(\d+)$/);if(categoryEdit)return done(transaction(()=>{const id=Number(categoryEdit[1]),old=one('SELECT * FROM categories WHERE id=?',id);if(!old)throw Error('Category not found');if(method==='DELETE'){if(one('SELECT COUNT(*) n FROM products WHERE category_id=?',id).n)throw Error('Category has items. Move them to another category first.');require('./db').run('DELETE FROM categories WHERE id=?',id);p.audit(user,'category.delete','categories',id,old,null)}else{const name=require('./validation').required(b.nameAr);if(name.length>100||String(b.nameEn||'').length>100)throw Error('Category name is too long');require('./db').run('UPDATE categories SET name_ar=?,name_en=? WHERE id=?',name,b.nameEn||null,id);p.audit(user,'category.update','categories',id,old,b)}return {ok:true}}));
 if(path==='/api/materials'&&method==='GET')return done({rows:s.materials(user)});
 if(path==='/api/materials'&&method==='POST')return done(s.material(b,user));
 const edit=path.match(/^\/api\/materials\/(\d+)$/);if(edit&&method==='PATCH')return done(s.material(b,user,Number(edit[1])));
 if(path==='/api/ux/suppliers'&&method==='POST')return done(transaction(()=>s.supplier(b,user)));
 if(path==='/api/ux/categories'&&method==='POST'){return done(transaction(()=>{const name=require('./validation').required(b.nameAr),old=s.match('categories',name);if(old)return {id:old.id};const id=require('./admin').addCategory({...b,nameAr:name});p.audit(user,'category.create','categories',id,null,b);return {id}}))}
 if(path==='/api/ux/customers'&&method==='POST')return done(require('./customer-management').create(b,user));
 const customerEdit=path.match(/^\/api\/customers\/([^/]+)$/);if(customerEdit&&method==='PATCH')return done(await require('./customer-management').update(customerEdit[1],b,user));
 const customerMerge=path.match(/^\/api\/customers\/([^/]+)\/merge$/);if(customerMerge&&method==='POST')return done(require('./customer-management').merge(customerMerge[1],b,user));
 const customerMatches=path.match(/^\/api\/customers\/([^/]+)\/matches$/);if(customerMatches&&method==='GET'){const c=require('./customer-management').primary(customerMatches[1]);if(!c)throw Error('Customer not found');const data=await require('./sync-service').cloud('/api/sync/customers');return done({accounts:data.customers.filter(a=>require('./customer-management').canonical(a.phone)===require('./customer-management').canonical(c.phone)).map(a=>({id:a.id,name:a.name,phone:a.phone,member_code:a.member_code}))})}
 if(path==='/api/ux/purchases'&&method==='POST')return done(s.purchase(b,user));
 if(path==='/api/ux/transfer'&&method==='POST')return done(s.transfer(b,user));
 if(path==='/api/ux/production'&&method==='POST')return done(s.production(b,user));
 if(path==='/api/production-templates'){if(method==='GET')return done({rows:all('SELECT * FROM production_templates WHERE active=1').map(r=>({...r,inputs:JSON.parse(r.inputs),outputs:JSON.parse(r.outputs)}))});return done(s.template(b,user))}
 const imp=path.match(/^\/api\/imports\/(materials|menu|prices|purchases)\/(preview|commit)$/);if(imp)return done(require('./ux-import').handle(imp[1],imp[2],b,user));
 return false;
}
module.exports={handle};
