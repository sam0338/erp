// VEDA Hotel PMS - Schema migration helper
// Safe to run every time the app starts: only adds columns that don't
// already exist, never touches existing data.

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
  const hasProperties = db.prepare(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='properties'`
  ).get();
  if (!hasProperties) return;

  ensureColumn(db, 'properties', 'is_gst_registered', 'INTEGER DEFAULT 1');
  ensureColumn(db, 'properties', 'ical_token', 'TEXT');
  ensureColumn(db, 'room_types', 'gst_rate', 'REAL DEFAULT 0');
  ensureColumn(db, 'folios', 'bill_to_same_as_guest', 'INTEGER DEFAULT 1');
  ensureColumn(db, 'folios', 'bill_to_name', 'TEXT');
  ensureColumn(db, 'folios', 'bill_to_address', 'TEXT');
  ensureColumn(db, 'folios', 'bill_to_city', 'TEXT');
  ensureColumn(db, 'folios', 'bill_to_state', 'TEXT');
  ensureColumn(db, 'folios', 'bill_to_gstin', 'TEXT');
  ensureColumn(db, 'folios', 'bill_to_phone', 'TEXT');
  ensureColumn(db, 'folios', 'bill_to_email', 'TEXT');
  ensureColumn(db, 'reservations', 'external_uid', 'TEXT');

  // Revenue intelligence
  ensureColumn(db, 'properties', 'weekend_multiplier', 'REAL DEFAULT 1.0');
  ensureColumn(db, 'properties', 'high_occ_threshold', 'REAL DEFAULT 80');
  ensureColumn(db, 'properties', 'high_occ_bump_pct', 'REAL DEFAULT 15');
  ensureColumn(db, 'properties', 'low_occ_threshold', 'REAL DEFAULT 30');
  ensureColumn(db, 'properties', 'low_occ_discount_pct', 'REAL DEFAULT 10');

  // Guest CRM / loyalty
  ensureColumn(db, 'guests', 'preferences', 'TEXT');
  ensureColumn(db, 'guests', 'date_of_birth', 'TEXT');
  ensureColumn(db, 'guests', 'anniversary_date', 'TEXT');
  ensureColumn(db, 'guests', 'loyalty_points', 'INTEGER DEFAULT 0');

  ensureTable(db, 'competitor_rates', `
    CREATE TABLE competitor_rates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      property_id INTEGER NOT NULL,
      room_type_id INTEGER,
      competitor_name TEXT NOT NULL,
      rate REAL NOT NULL,
      rate_date TEXT NOT NULL,
      created_by_user_id INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (property_id) REFERENCES properties(id),
      FOREIGN KEY (room_type_id) REFERENCES room_types(id)
    )
  `);

  ensureTable(db, 'addons', `
    CREATE TABLE addons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      property_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL DEFAULT 0,
      tax_rate REAL DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      FOREIGN KEY (property_id) REFERENCES properties(id)
    )
  `);

  ensureTable(db, 'service_requests', `
    CREATE TABLE service_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reservation_id INTEGER NOT NULL,
      request_type TEXT NOT NULL,
      details TEXT,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now')),
      resolved_at TEXT,
      resolved_by_user_id INTEGER,
      FOREIGN KEY (reservation_id) REFERENCES reservations(id)
    )
  `);

  ensureTable(db, 'cash_closings', `
    CREATE TABLE cash_closings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      property_id INTEGER NOT NULL,
      closing_date TEXT NOT NULL,
      expected_cash REAL DEFAULT 0,
      expected_upi REAL DEFAULT 0,
      expected_card REAL DEFAULT 0,
      expected_bank_transfer REAL DEFAULT 0,
      actual_cash REAL DEFAULT 0,
      discrepancy REAL DEFAULT 0,
      notes TEXT,
      closed_by_user_id INTEGER,
      closed_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (property_id) REFERENCES properties(id),
      UNIQUE(property_id, closing_date)
    )
  `);

  ensureTable(db, 'license_state', `
    CREATE TABLE license_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      install_id TEXT NOT NULL,
      installed_at TEXT NOT NULL,
      license_key TEXT,
      licensed_to TEXT,
      valid_until TEXT,
      activated_at TEXT
    )
  `);

  ensureTable(db, 'external_calendars', `
    CREATE TABLE external_calendars (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      property_id INTEGER NOT NULL,
      room_type_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      ical_url TEXT NOT NULL,
      last_synced_at TEXT,
      last_sync_status TEXT,
      last_sync_error TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (property_id) REFERENCES properties(id),
      FOREIGN KEY (room_type_id) REFERENCES room_types(id)
    )
  `);

  // Backfill a random iCal export token for any property that doesn't have one yet
  const propsWithoutToken = db.prepare(`SELECT id FROM properties WHERE ical_token IS NULL OR ical_token = ''`).all();
  if (propsWithoutToken.length > 0) {
    const crypto = require('crypto');
    const upd = db.prepare('UPDATE properties SET ical_token = ? WHERE id = ?');
    propsWithoutToken.forEach(p => upd.run(crypto.randomBytes(16).toString('hex'), p.id));
    console.log(`✔ Migrated: generated iCal export token for ${propsWithoutToken.length} propert(y/ies)`);
  }
}

module.exports = { migrate };
