const crypto = require('crypto');

const PUBLIC_SETTING_KEYS = new Set([
  'restaurant_name_ar', 'restaurant_name_en', 'restaurant_phone', 'restaurant_address',
  'restaurant_hours', 'restaurant_logo', 'pickup_enabled', 'delivery_enabled',
  'delivery_fee', 'receipt_footer_ar', 'receipt_footer_en', 'currency',
  'tax_enabled', 'tax_type', 'tax_value', 'service_enabled', 'service_type', 'service_value',
  'packaging_enabled', 'packaging_type', 'packaging_value', 'other_enabled', 'other_type', 'other_value'
]);

function syncMigration(db) {
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT DEFAULT CURRENT_TIMESTAMP)');
  if (db.prepare('SELECT 1 FROM schema_migrations WHERE version=8').get()) return;

  db.exec('BEGIN IMMEDIATE');
  try {
    const addTableTriggers = (table, idColumn = 'id') => {
      const columns = db.prepare(`PRAGMA table_info(${table})`).all().map(column => column.name);
      for (const operation of ['INSERT', 'UPDATE', 'DELETE']) {
        const trigger = `outbox_sync_${table}_${operation}`;
        const reference = operation === 'DELETE' ? 'OLD' : 'NEW';
        const payload = `json_object(${columns.map(column => `'${column}',${reference}.${column}`).join(',')})`;
        db.exec(`DROP TRIGGER IF EXISTS ${trigger}`);
        db.exec(`CREATE TRIGGER ${trigger} AFTER ${operation} ON ${table} BEGIN INSERT INTO sync_queue(entity_type,entity_id,operation,payload,event_key) VALUES('${table}',CAST(${reference}.${idColumn} AS TEXT),'${operation === 'DELETE' ? 'delete' : 'upsert'}',${payload},lower(hex(randomblob(16)))); END`);
      }
      const insert = db.prepare('INSERT INTO sync_queue(entity_type,entity_id,operation,payload,event_key) VALUES(?,?,?,?,?)');
      for (const row of db.prepare(`SELECT * FROM ${table}`).all()) {
        insert.run(table, String(row[idColumn]), 'upsert', JSON.stringify(row), crypto.randomUUID());
      }
    };

    addTableTriggers('order_types', 'code');
    addTableTriggers('waste_reasons');

    for (const operation of ['INSERT', 'UPDATE', 'DELETE']) {
      const trigger = `outbox_sync_settings_${operation}`;
      const reference = operation === 'DELETE' ? 'OLD' : 'NEW';
      db.exec(`DROP TRIGGER IF EXISTS ${trigger}`);
      db.exec(`CREATE TRIGGER ${trigger} AFTER ${operation} ON settings WHEN ${reference}.key IN (${[...PUBLIC_SETTING_KEYS].map(key => `'${key}'`).join(',')}) BEGIN INSERT INTO sync_queue(entity_type,entity_id,operation,payload,event_key) VALUES('settings',${reference}.key,'${operation === 'DELETE' ? 'delete' : 'upsert'}',json_object('key',${reference}.key,'value',${reference}.value),lower(hex(randomblob(16)))); END`);
    }
    const insertSetting = db.prepare('INSERT INTO sync_queue(entity_type,entity_id,operation,payload,event_key) VALUES(?,?,?,?,?)');
    for (const row of db.prepare('SELECT key,value FROM settings WHERE key IN (' + [...PUBLIC_SETTING_KEYS].map(key => '?').join(',') + ')').all(...PUBLIC_SETTING_KEYS)) {
      insertSetting.run('settings', row.key, 'upsert', JSON.stringify(row), crypto.randomUUID());
    }

    db.prepare('INSERT INTO schema_migrations(version) VALUES(8)').run();
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

module.exports = syncMigration;
