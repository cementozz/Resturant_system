const {one,run}=require('./db');const admin=require('./admin');let timer;
function tick(){const interval=Number(one("SELECT value FROM settings WHERE key='backup_interval_hours'")?.value||24)*3600000;const last=one("SELECT value FROM settings WHERE key='last_scheduled_backup'")?.value;if(last&&Date.now()-Date.parse(last)<interval)return;try{admin.backup();run("INSERT INTO settings(key,value) VALUES('last_scheduled_backup',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",new Date().toISOString())}catch(e){console.error('Scheduled backup failed:',e.message)}}
function start(){if(timer)return;timer=setInterval(tick,60000);timer.unref()}
module.exports={start};
