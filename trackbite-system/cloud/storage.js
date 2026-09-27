const fs=require('fs'),path=require('path');
const {AsyncLocalStorage}=require('async_hooks');
async function createStore(){
 if(process.env.DATABASE_URL){
  let Pool;try{({Pool}=require('pg'))}catch{throw new Error('PostgreSQL mode requires npm install (pg dependency)')}
  const pool=new Pool({connectionString:process.env.DATABASE_URL}),context=new AsyncLocalStorage();
  const query=(sql,args=[])=>{let i=0;return (context.getStore()||pool).query(sql.replace(/\?/g,()=>`$${++i}`),args)};
  return {kind:'postgresql',exec:sql=>query(sql),all:async(sql,...args)=>(await query(sql,args)).rows,one:async(sql,...args)=>(await query(sql,args)).rows[0],run:(sql,...args)=>query(sql,args),transaction:async fn=>{const client=await pool.connect();try{await client.query('BEGIN');const out=await context.run(client,fn);await client.query('COMMIT');return out}catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}}};
 }
 const {DatabaseSync}=require('node:sqlite');const filename=process.env.CLOUD_DB||path.join(__dirname,'data','cloud.db');fs.mkdirSync(path.dirname(filename),{recursive:true});const db=new DatabaseSync(filename);db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000');let tail=Promise.resolve();
 return {kind:'sqlite-demo',exec:async sql=>db.exec(sql),all:async(sql,...args)=>db.prepare(sql).all(...args),one:async(sql,...args)=>db.prepare(sql).get(...args),run:async(sql,...args)=>db.prepare(sql).run(...args),transaction:fn=>{const job=tail.then(async()=>{db.exec('BEGIN IMMEDIATE');try{const out=await fn();db.exec('COMMIT');return out}catch(e){db.exec('ROLLBACK');throw e}});tail=job.catch(()=>{});return job}};
}
module.exports={createStore};
