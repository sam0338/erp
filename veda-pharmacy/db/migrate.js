// VEDA Pharmacy - Schema migration helper
// Safe to run every time the app starts: only adds columns/tables that
// don't already exist, never touches existing data. Empty today (the app
// just launched) — this is the slot future schema tweaks drop into,
// following the same pattern as veda-hotel-pms/db/migrate.js.

function ensureColumn(db, table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  if (!cols.includes(column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    console.log(`✔ Migrated: added ${table}.${column}`);
  }
}

function ensureTable(db, name, createSql) {
  const exists = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(name);
  if (!exists) {
    db.exec(createSql);
    console.log(`✔ Migrated: created table ${name}`);
  }
}

function migrate(db) {
  // Skip entirely if tables don't exist yet (fresh DB, schema.sql not applied yet)
  const hasStores = db.prepare(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='stores'`
  ).get();
  if (!hasStores) return;

  // Doctors registry + patient incentive / doctor commission tracking on sales
  ensureTable(db, 'doctors', `
    CREATE TABLE doctors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      registration_no TEXT,
      default_commission_pct REAL NOT NULL DEFAULT 0,
      notes TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  ensureColumn(db, 'prescriptions', 'doctor_id', 'INTEGER REFERENCES doctors(id)');
  ensureColumn(db, 'sales', 'patient_incentive_pct', 'REAL NOT NULL DEFAULT 0');
  ensureColumn(db, 'sales', 'patient_incentive_amount', 'REAL NOT NULL DEFAULT 0');
  ensureColumn(db, 'sales', 'doctor_id', 'INTEGER REFERENCES doctors(id)');
  ensureColumn(db, 'sales', 'doctor_commission_pct', 'REAL NOT NULL DEFAULT 0');
  ensureColumn(db, 'sales', 'doctor_commission_amount', 'REAL NOT NULL DEFAULT 0');
  // CREATE INDEX IF NOT EXISTS is already idempotent — no ensureTable wrapper needed.
  db.exec('CREATE INDEX IF NOT EXISTS idx_sales_doctor ON sales(doctor_id)');
}

module.exports = { migrate, ensureColumn, ensureTable };
