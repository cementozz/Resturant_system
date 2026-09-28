const {one,all,run,transaction}=require('./db');
const {verifyPassword}=require('./auth');
const catalog={
 'orders.confirm':['owner','manager','cashier'], 'orders.reject':['owner','manager'],
 'orders.amend':['owner','manager'], 'customers.read':['owner','manager','cashier'], 'customers.pii':['owner','manager','cashier'], 'customers.edit':['owner','manager','cashier'],
 'inventory.receive':['owner','manager','storekeeper'], 'inventory.transfer':['owner','manager','storekeeper'],
 'menu.read':['owner','manager','cashier','accountant','storekeeper','kitchen'], 'payments.manage':['owner','manager','accountant'], 'printing.manage':['owner','manager'], 'sync.manage':['owner','manager'],
 'loyalty.read':['owner','manager','cashier'], 'loyalty.adjust':['owner','manager'],
 'pos.sell':['owner','manager','cashier'], 'orders.read':['owner','manager','cashier','accountant','kitchen'],
 'orders.refund':['owner','manager'], 'orders.discount':['owner','manager'], 'orders.fulfill':['owner','manager','cashier','kitchen'],
 'inventory.read':['owner','manager','storekeeper','accountant'], 'inventory.write':['owner','manager','storekeeper'], 'inventory.adjust':['owner','manager'],
 'purchases.read':['owner','manager','accountant','storekeeper'], 'purchases.write':['owner','manager','storekeeper'],
 'expenses.read':['owner','manager','accountant'], 'expenses.write':['owner','manager','accountant'],
 'reports.sales':['owner','manager','accountant'], 'reports.costs':['owner','manager','accountant'],
 'menu.write':['owner','manager'], 'users.manage':['owner'], 'settings.manage':['owner','manager'],
 'audit.read':['owner','manager'], 'printing.use':['owner','manager','cashier','kitchen'], 'backup.manage':['owner','manager']
};
function can(user,permission){if(!user)return false;if(user.role==='owner')return true;const override=one('SELECT allowed FROM role_permissions WHERE role=? AND permission=?',user.role,permission);return override?!!override.allowed:!!catalog[permission]?.includes(user.role)}
function list(user){return Object.keys(catalog).filter(p=>can(user,p))}
function requirePermission(user,permission,approval){if(can(user,permission))return null;if(approval?.username&&approval?.password){const m=one("SELECT * FROM users WHERE username=? AND active=1 AND role IN ('owner','manager')",approval.username);if(m&&can(m,permission)&&verifyPassword(String(approval.password),m.password_hash))return m.id}const e=new Error(`Permission required: ${permission}`);e.status=403;throw e}
function redact(v){if(Array.isArray(v))return v.map(redact);if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).filter(([k])=>!/(password|secret|token|approval)/i.test(k)).map(([k,x])=>[k,redact(x)]));return v}
function audit(user,action,type,id,oldValue,newValue,reason=null,approvedBy=null){run('INSERT INTO audit_log(user_id,action,entity_type,entity_id,old_value,new_value,reason,approved_by) VALUES(?,?,?,?,?,?,?,?)',user?.id||null,action,type,String(id),oldValue==null?null:JSON.stringify(redact(oldValue)),newValue==null?null:JSON.stringify(redact(newValue)),reason,approvedBy)}
function save(role,permissions,user){if(!['manager','accountant','cashier','storekeeper','kitchen'].includes(role))throw new Error('Invalid editable role');transaction(()=>{const before=all('SELECT * FROM role_permissions WHERE role=?',role);for(const [p,allowed] of Object.entries(permissions)){if(!catalog[p]||typeof allowed!=='boolean')throw new Error('Invalid permission');run('INSERT INTO role_permissions(role,permission,allowed) VALUES(?,?,?) ON CONFLICT(role,permission) DO UPDATE SET allowed=excluded.allowed',role,p,allowed?1:0)}audit(user,'permissions.change','role',role,before,permissions)})}
module.exports={catalog,can,list,requirePermission,audit,save};
