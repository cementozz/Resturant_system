const crypto = require('crypto');
const hash=token=>crypto.createHash('sha256').update(token).digest('hex');
const roles=['owner','manager','accountant','cashier','storekeeper','kitchen'];
function validateCredentials(username,password){if(!/^[A-Za-z0-9_.-]{3,60}$/.test(String(username)))throw Error('Invalid username');if(typeof password!=='string'||password.length>128||password.length<(process.env.DEMO_MODE==='true'?4:12))throw Error('Password must contain '+(process.env.DEMO_MODE==='true'?4:12)+'–128 characters');if(process.env.DEMO_MODE!=='true'&&['123456789012','password1234'].includes(password.toLowerCase()))throw Error('Choose a stronger password')}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password, stored) {
  const [salt, expected] = String(stored).split(':');
  if (!salt || !/^[a-f0-9]{128}$/.test(expected)) return false;
  const actual = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(actual, Buffer.from(expected, 'hex'));
}

function createSession(user) {
  const token = crypto.randomBytes(32).toString('hex');
  const {run}=require('./db'),now=Date.now();
  run('INSERT INTO staff_sessions(token_hash,user_id,session_version,expires_at,last_used_at,created_at) VALUES(?,?,?,?,?,?)',hash(token),user.id,user.session_version||1,now+12*3600000,now,now);
  run('UPDATE users SET last_login=CURRENT_TIMESTAMP WHERE id=?',user.id);
  return token;
}

function getSession(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if(!token)return null;
  const {one,run}=require('./db'),now=Date.now();
  const user=one('SELECT u.id,u.global_id,u.username,u.role,u.display_name_ar,u.display_name_en FROM staff_sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>? AND u.active=1 AND u.session_version=s.session_version',hash(token),now);
  if(user)run('UPDATE staff_sessions SET last_used_at=? WHERE token_hash=?',now,hash(token));
  return user||null;
}

function logout(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (token) require('./db').run('UPDATE staff_sessions SET revoked_at=? WHERE token_hash=?',Date.now(),hash(token));
}

function can(user, roles) { return !!user && roles.includes(user.role); }

function revoke(userId){const {run}=require('./db');run('UPDATE users SET session_version=session_version+1 WHERE id=?',userId);run('UPDATE staff_sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL',Date.now(),userId)}
function limit(req,username){const {one,run}=require('./db'),minute=Math.floor(Date.now()/60000),bucket=hash((req.socket.remoteAddress||'')+':'+username+':'+minute);const r=one('INSERT INTO auth_attempts(bucket,count,expires_at) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET count=count+1 RETURNING count',bucket,(minute+2)*60000);run('DELETE FROM auth_attempts WHERE expires_at<?',Date.now());if(r.count>10){const e=Error('Too many login attempts. Try again shortly.');e.status=429;throw e}}
module.exports = { roles,validateCredentials,hashPassword, verifyPassword, createSession, getSession, logout, revoke,limit,can };
