const crypto = require('crypto');
const sessions = new Map();

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password, stored) {
  const [salt, expected] = stored.split(':');
  if (!salt || !expected) return false;
  const actual = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(actual, Buffer.from(expected, 'hex'));
}

function createSession(user) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { id: user.id, username: user.username, role: user.role, display_name_ar: user.display_name_ar, display_name_en: user.display_name_en, createdAt: Date.now() });
  return token;
}

function getSession(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  const stored=token?sessions.get(token):null;
  if(!stored)return null;
  if(Date.now()-stored.createdAt>12*60*60*1000){sessions.delete(token);return null}
  const user=require('./db').one('SELECT id,username,role,display_name_ar,display_name_en FROM users WHERE id=? AND active=1',stored.id);
  return user||null;
}

function logout(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (token) sessions.delete(token);
}

function can(user, roles) { return !!user && roles.includes(user.role); }

module.exports = { hashPassword, verifyPassword, createSession, getSession, logout, can };
