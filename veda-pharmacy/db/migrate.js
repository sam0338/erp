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

  // Distributor ledger — dates the payment credit separately from the purchase debit
  ensureColumn(db, 'purchases', 'paid_at', 'TEXT');

  // Partial-line sale returns
  ensureTable(db, 'sale_returns', `
    CREATE TABLE sale_returns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL,
      store_id INTEGER NOT NULL,
      return_no TEXT,
      return_date TEXT DEFAULT (datetime('now')),
      refund_amount REAL NOT NULL DEFAULT 0,
      reason TEXT,
      created_by_user_id INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (sale_id) REFERENCES sales(id),
      FOREIGN KEY (store_id) REFERENCES stores(id),
      FOREIGN KEY (created_by_user_id) REFERENCES users(id)
    )
  `);
  ensureTable(db, 'sale_return_items', `
    CREATE TABLE sale_return_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_return_id INTEGER NOT NULL,
      sale_item_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      refund_amount REAL NOT NULL DEFAULT 0,
      FOREIGN KEY (sale_return_id) REFERENCES sale_returns(id),
      FOREIGN KEY (sale_item_id) REFERENCES sale_items(id)
    )
  `);
  db.exec('CREATE INDEX IF NOT EXISTS idx_sale_returns_sale ON sale_returns(sale_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_sale_return_items_return ON sale_return_items(sale_return_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_sale_return_items_sale_item ON sale_return_items(sale_item_id)');

  // Doctor commission payout tracking
  ensureTable(db, 'doctor_commission_payments', `
    CREATE TABLE doctor_commission_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      doctor_id INTEGER NOT NULL,
      store_id INTEGER NOT NULL,
      payment_date TEXT DEFAULT (datetime('now')),
      amount REAL NOT NULL,
      payment_mode TEXT,
      reference_no TEXT,
      notes TEXT,
      created_by_user_id INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (doctor_id) REFERENCES doctors(id),
      FOREIGN KEY (store_id) REFERENCES stores(id),
      FOREIGN KEY (created_by_user_id) REFERENCES users(id)
    )
  `);
  ensureColumn(db, 'sales', 'commission_paid_at', 'TEXT');
  ensureColumn(db, 'sales', 'commission_payment_id', 'INTEGER REFERENCES doctor_commission_payments(id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_doctor_commission_payments_doctor ON doctor_commission_payments(doctor_id)');

  // Shop Settings — self-service profile/billing-preference fields on the
  // operator's own store, distinct from the Admin-only Stores CRUD.
  ensureColumn(db, 'stores', 'tagline', 'TEXT');
  ensureColumn(db, 'stores', 'owner_name', 'TEXT');
  ensureColumn(db, 'stores', 'phone_alt', 'TEXT');
  ensureColumn(db, 'stores', 'email', 'TEXT');
  ensureColumn(db, 'stores', 'fssai_no', 'TEXT');
  ensureColumn(db, 'stores', 'bill_prefix', "TEXT NOT NULL DEFAULT 'INV'");
  ensureColumn(db, 'stores', 'default_gst_rate', 'REAL NOT NULL DEFAULT 12');
  ensureColumn(db, 'stores', 'invoice_footer', 'TEXT');

  // Categories — managed list for the item form's Category field;
  // items.category itself stays plain TEXT (see the note in schema.sql).
  ensureTable(db, 'categories', `
    CREATE TABLE categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      icon TEXT,
      description TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Purchase Orders — a request out to a distributor, separate from a GRN
  // (an actual receipt); see the note in schema.sql for why "GRN status"
  // is derived rather than stored, and why purchases.purchase_order_id is
  // nullable (the original direct-GRN-with-no-PO flow stays supported).
  ensureTable(db, 'purchase_orders', `
    CREATE TABLE purchase_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      store_id INTEGER NOT NULL,
      distributor_id INTEGER NOT NULL,
      po_no TEXT NOT NULL,
      po_date TEXT DEFAULT (date('now')),
      expected_date TEXT,
      status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft','Sent','Cancelled')),
      notes TEXT,
      taxable_amount REAL NOT NULL DEFAULT 0,
      tax_amount REAL NOT NULL DEFAULT 0,
      total_amount REAL NOT NULL DEFAULT 0,
      created_by_user_id INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (store_id) REFERENCES stores(id),
      FOREIGN KEY (distributor_id) REFERENCES distributors(id),
      FOREIGN KEY (created_by_user_id) REFERENCES users(id)
    )
  `);
  ensureTable(db, 'purchase_order_items', `
    CREATE TABLE purchase_order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_order_id INTEGER NOT NULL,
      item_id INTEGER NOT NULL,
      quantity_ordered INTEGER NOT NULL,
      quantity_received INTEGER NOT NULL DEFAULT 0,
      rate REAL NOT NULL DEFAULT 0,
      gst_rate REAL NOT NULL DEFAULT 0,
      line_total REAL NOT NULL DEFAULT 0,
      FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id),
      FOREIGN KEY (item_id) REFERENCES items(id)
    )
  `);
  ensureColumn(db, 'purchases', 'purchase_order_id', 'INTEGER REFERENCES purchase_orders(id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_purchase_orders_store ON purchase_orders(store_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_purchase_order_items_po ON purchase_order_items(purchase_order_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_purchases_po ON purchases(purchase_order_id)');

  // Stock adjustment types grew to match MediStore Pro's list (see the
  // README's Architecture Decisions entry on the reskin) — 'Return to
  // Supplier' and 'Sample' joined the original Expired/Damaged/Lost/
  // Correction. Unlike a plain ALTER TABLE ADD COLUMN, SQLite CHECK
  // constraints ARE enforced on every insert (verified — this isn't the
  // "constraints are advisory" behavior some other databases have) and
  // aren't ALTER-able in place, so an existing install's stock_adjustments
  // table — created back when the CHECK only listed four values — would
  // reject 'Sample'/'Return to Supplier' with a constraint-violation error
  // forever unless the table itself is rebuilt. Detected by checking the
  // table's own stored CREATE-TABLE SQL for the new marker value, then
  // rebuilt the standard SQLite way (new table with the wider CHECK, copy
  // rows across, drop the old one, rename) — the only ALTER-TABLE-proof
  // way to widen a CHECK constraint.
  const stockAdjSql = db.prepare(
    `SELECT sql FROM sqlite_master WHERE type='table' AND name='stock_adjustments'`
  ).get();
  if (stockAdjSql && !stockAdjSql.sql.includes('Sample')) {
    db.exec(`
      CREATE TABLE stock_adjustments_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        store_id INTEGER NOT NULL,
        batch_id INTEGER NOT NULL,
        adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('Expired','Damaged','Lost','Correction','Return to Supplier','Sample')),
        quantity INTEGER NOT NULL,
        reason TEXT,
        created_by_user_id INTEGER,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (store_id) REFERENCES stores(id),
        FOREIGN KEY (batch_id) REFERENCES batches(id),
        FOREIGN KEY (created_by_user_id) REFERENCES users(id)
      );
      INSERT INTO stock_adjustments_new SELECT * FROM stock_adjustments;
      DROP TABLE stock_adjustments;
      ALTER TABLE stock_adjustments_new RENAME TO stock_adjustments;
      CREATE INDEX IF NOT EXISTS idx_stock_adjustments_batch ON stock_adjustments(batch_id);
    `);
    console.log('✔ Migrated: widened stock_adjustments.adjustment_type CHECK constraint');
  }

  // Direct Stock In — old/opening stock a store already has on its shelves
  // when it adopts this app, with no distributor invoice to key a GRN off.
  // See the note in schema.sql on why this is its own table rather than
  // more nullable columns on purchases.
  ensureTable(db, 'stock_in_entries', `
    CREATE TABLE stock_in_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      store_id INTEGER NOT NULL,
      item_id INTEGER NOT NULL,
      batch_id INTEGER NOT NULL,
      entry_no TEXT,
      quantity INTEGER NOT NULL,
      purchase_rate REAL NOT NULL DEFAULT 0,
      mrp REAL NOT NULL DEFAULT 0,
      distributor_id INTEGER,
      supplier_name TEXT,
      reference_no TEXT,
      notes TEXT,
      source TEXT NOT NULL DEFAULT 'Manual' CHECK (source IN ('Manual', 'Bulk Excel Import')),
      created_by_user_id INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (store_id) REFERENCES stores(id),
      FOREIGN KEY (item_id) REFERENCES items(id),
      FOREIGN KEY (batch_id) REFERENCES batches(id),
      FOREIGN KEY (distributor_id) REFERENCES distributors(id),
      FOREIGN KEY (created_by_user_id) REFERENCES users(id)
    )
  `);
  db.exec('CREATE INDEX IF NOT EXISTS idx_stock_in_entries_store ON stock_in_entries(store_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_stock_in_entries_item ON stock_in_entries(item_id)');
}

module.exports = { migrate, ensureColumn, ensureTable };
