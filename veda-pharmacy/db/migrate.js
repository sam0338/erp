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

  // No migrations yet — add ensureColumn(...)/ensureTable(...) calls here
  // as the schema evolves after launch.
}

module.exports = { migrate, ensureColumn, ensureTable };
