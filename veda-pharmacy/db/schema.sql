-- ============================================================
-- VEDA Pharmacy - Core Schema
-- SQLite | LAN-deployable | Multi-store capable
--
-- FEFO note: "first expiry, first out" batch selection is application
-- logic, not a DB feature — see utils/fefo.js. It walks batches for an
-- (item_id, store_id) with quantity > 0 ordered by expiry_date ASC and
-- allocates across as many lots as needed to cover the sold quantity.
-- The idx_batches_fefo index below exists to make that query cheap.
-- ============================================================

PRAGMA foreign_keys = ON;

-- ---------- STORES (multi-branch from day 1) ----------
CREATE TABLE IF NOT EXISTS stores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,          -- e.g. 'VP-INDORE'
    address TEXT,
    city TEXT,
    state TEXT,
    pincode TEXT,
    phone TEXT,
    gstin TEXT,
    drug_license_no TEXT,               -- Form 20/21 retail license (allopathic)
    drug_license_no_2 TEXT,             -- many pharmacies hold a second license for Sch. H1/X stocking
    drug_license_expiry TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
);

-- ---------- USERS / ROLES ----------
CREATE TABLE IF NOT EXISTS roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,          -- Admin, Pharmacist, Cashier, Accounts
    permissions TEXT                    -- JSON array of permission strings
);

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    store_id INTEGER,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT,
    role_id INTEGER,
    is_active INTEGER DEFAULT 1,
    last_login TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (store_id) REFERENCES stores(id),
    FOREIGN KEY (role_id) REFERENCES roles(id)
);

-- ---------- LICENSING ----------
-- Single-row table. installed_at is the trial clock — set once, on first
-- run, and never touched again. Deleting it means deleting the whole
-- database (and all pharmacy data with it), which is enough of a deterrent
-- without extra anti-tamper complexity.
CREATE TABLE IF NOT EXISTS license_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    install_id TEXT NOT NULL,
    installed_at TEXT NOT NULL,
    license_key TEXT,
    licensed_to TEXT,
    valid_until TEXT,
    activated_at TEXT
);

-- ---------- DISTRIBUTORS (supplier ledger) ----------
CREATE TABLE IF NOT EXISTS distributors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    gstin TEXT,
    drug_license_no TEXT,               -- Form 20B/21B wholesale license
    opening_balance REAL NOT NULL DEFAULT 0,  -- +ve = we owe them, carried in from before this system
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
);

-- ---------- ITEMS (item master) ----------
-- Shared catalog across all stores — batches/stock below are store-scoped.
CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    generic_name TEXT,
    manufacturer TEXT,
    hsn_code TEXT,
    gst_rate REAL NOT NULL DEFAULT 12,  -- India pharma slabs: 0 / 5 / 12 / 18 / 28
    schedule TEXT NOT NULL DEFAULT 'OTC' CHECK (schedule IN ('OTC','H','H1','X')),
    drug_form TEXT,                     -- Tablet, Capsule, Syrup, Injection, Ointment, Drops, Other
    pack_size TEXT,                     -- e.g. '1x10', '100ml', '30gm'
    unit TEXT NOT NULL DEFAULT 'Strip', -- Strip, Box, Bottle, Tube, Vial, Piece
    category TEXT,                      -- Antibiotic, Analgesic, Antacid, Cardiac, Diabetic, Cosmetic, Surgical, General...
    rack_location TEXT,
    reorder_level INTEGER NOT NULL DEFAULT 0,  -- low-stock threshold, summed across a store's batches
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- ---------- DOCTORS (referral commission registry) ----------
-- Deliberately opt-in: a sale only accrues doctor_commission_amount (see
-- SALES below) when the prescribing doctor is a row in this table with a
-- commission rate set. Free-typing a doctor's name on the Rx panel at POS
-- that doesn't match a registered doctor here accrues nothing — see the
-- "Doctor commission" note in README.md's Architecture Decisions for the
-- compliance context (India restricts referral commissions to doctors
-- under NMC/MCI ethics regulations; this table exists because the
-- operator asked for it after that was explicitly flagged to them).
CREATE TABLE IF NOT EXISTS doctors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    registration_no TEXT,               -- medical council registration number
    default_commission_pct REAL NOT NULL DEFAULT 0,  -- applied to a sale's total_amount, snapshotted onto the sale at checkout
    notes TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
);

-- ---------- PRESCRIPTIONS (Schedule H1/X sales) ----------
-- One prescription per sale transaction — covers every H1/X line on that
-- sale. Text reference fields plus an optional photo of the physical Rx
-- (image_path, uploaded via multer — see routes/prescriptions.js).
CREATE TABLE IF NOT EXISTS prescriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_name TEXT NOT NULL,
    patient_age INTEGER,
    patient_gender TEXT CHECK (patient_gender IN ('M','F','O') OR patient_gender IS NULL),
    doctor_name TEXT NOT NULL,
    doctor_id INTEGER,                  -- set only if doctor_name was picked from the doctors registry (drives commission)
    doctor_reg_no TEXT,                 -- doctor's medical council registration number, if noted
    rx_ref_no TEXT,                     -- Rx slip/reference number, if the prescription has one
    rx_date TEXT,
    image_path TEXT,                    -- relative path under uploads/rx/ to the photographed Rx
    notes TEXT,
    created_by_user_id INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (doctor_id) REFERENCES doctors(id),
    FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);

-- ---------- PURCHASES / GRN ----------
CREATE TABLE IF NOT EXISTS purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    store_id INTEGER NOT NULL,
    distributor_id INTEGER NOT NULL,
    invoice_no TEXT NOT NULL,           -- distributor's own invoice/bill number
    invoice_date TEXT NOT NULL,
    grn_no TEXT,                        -- our internal GRN number (see utils/helpers.js)
    grn_date TEXT DEFAULT (date('now')),
    taxable_amount REAL NOT NULL DEFAULT 0,
    cgst_amount REAL NOT NULL DEFAULT 0,
    sgst_amount REAL NOT NULL DEFAULT 0,
    igst_amount REAL NOT NULL DEFAULT 0,
    discount_amount REAL NOT NULL DEFAULT 0,
    round_off REAL NOT NULL DEFAULT 0,
    total_amount REAL NOT NULL DEFAULT 0,
    payment_status TEXT NOT NULL DEFAULT 'Unpaid' CHECK (payment_status IN ('Unpaid','Partial','Paid')),
    amount_paid REAL NOT NULL DEFAULT 0,
    paid_at TEXT,                       -- when amount_paid last changed to > 0 (see routes/purchases.js) —
                                         -- lets the distributor ledger date the payment credit separately
                                         -- from the purchase debit, instead of collapsing them into one row
    notes TEXT,
    created_by_user_id INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (store_id) REFERENCES stores(id),
    FOREIGN KEY (distributor_id) REFERENCES distributors(id),
    FOREIGN KEY (created_by_user_id) REFERENCES users(id),
    UNIQUE(distributor_id, invoice_no)
);

CREATE TABLE IF NOT EXISTS purchase_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_id INTEGER NOT NULL,
    item_id INTEGER NOT NULL,
    batch_no TEXT NOT NULL,
    mfg_date TEXT,
    expiry_date TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    free_quantity INTEGER NOT NULL DEFAULT 0,  -- scheme/bonus qty: added to batch stock, not taxable
    purchase_rate REAL NOT NULL,               -- rate per unit, excl. tax
    mrp REAL NOT NULL,
    discount_pct REAL NOT NULL DEFAULT 0,
    gst_rate REAL NOT NULL DEFAULT 0,
    taxable_amount REAL NOT NULL DEFAULT 0,
    cgst_amount REAL NOT NULL DEFAULT 0,
    sgst_amount REAL NOT NULL DEFAULT 0,
    igst_amount REAL NOT NULL DEFAULT 0,
    line_total REAL NOT NULL DEFAULT 0,
    FOREIGN KEY (purchase_id) REFERENCES purchases(id),
    FOREIGN KEY (item_id) REFERENCES items(id)
);

-- ---------- BATCHES (store-scoped stock lots) ----------
-- One row per lot received into a store. A repeat delivery of the same
-- batch_no (e.g. a split shipment) gets its own row rather than being
-- merged into an existing one — keeps every lot traceable back to the
-- exact GRN line it came from, and FEFO/quantity totals just sum across
-- rows that share an expiry date.
CREATE TABLE IF NOT EXISTS batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL,
    store_id INTEGER NOT NULL,
    batch_no TEXT NOT NULL,
    mfg_date TEXT,
    expiry_date TEXT NOT NULL,          -- YYYY-MM-DD (use YYYY-MM-01 if the pack only prints month/year)
    quantity INTEGER NOT NULL DEFAULT 0,-- current quantity remaining in this lot (unit = items.unit)
    purchase_rate REAL NOT NULL DEFAULT 0,
    mrp REAL NOT NULL DEFAULT 0,
    purchase_item_id INTEGER,           -- GRN line this lot was received on (NULL for opening-stock entries)
    distributor_id INTEGER,             -- denormalized for quick "who supplied this lot" lookups
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (item_id) REFERENCES items(id),
    FOREIGN KEY (store_id) REFERENCES stores(id),
    FOREIGN KEY (purchase_item_id) REFERENCES purchase_items(id),
    FOREIGN KEY (distributor_id) REFERENCES distributors(id)
);

-- ---------- SALES (POS) ----------
CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    store_id INTEGER NOT NULL,
    invoice_no TEXT NOT NULL,
    sale_date TEXT DEFAULT (datetime('now')),
    customer_name TEXT,
    customer_phone TEXT,
    prescription_id INTEGER,            -- set when any line on this sale is a Schedule H1/X item
    taxable_amount REAL NOT NULL DEFAULT 0,
    cgst_amount REAL NOT NULL DEFAULT 0,
    sgst_amount REAL NOT NULL DEFAULT 0,
    igst_amount REAL NOT NULL DEFAULT 0,
    discount_amount REAL NOT NULL DEFAULT 0,
    patient_incentive_pct REAL NOT NULL DEFAULT 0,     -- loyalty/incentive discount %, applied to gross like discount_amount
    patient_incentive_amount REAL NOT NULL DEFAULT 0,  -- computed amount, kept separate from discount_amount for reporting
    round_off REAL NOT NULL DEFAULT 0,
    total_amount REAL NOT NULL DEFAULT 0,
    doctor_id INTEGER,                  -- denormalized from prescriptions.doctor_id at checkout, for commission reporting
    doctor_commission_pct REAL NOT NULL DEFAULT 0,     -- snapshot of doctors.default_commission_pct at time of sale —
                                                        -- later rate changes must not alter historical accrued amounts
    doctor_commission_amount REAL NOT NULL DEFAULT 0,  -- % of total_amount; does NOT reduce what the patient pays
    payment_mode TEXT NOT NULL DEFAULT 'Cash' CHECK (payment_mode IN ('Cash','UPI','Card','Credit')),
    payment_status TEXT NOT NULL DEFAULT 'Paid' CHECK (payment_status IN ('Paid','Partial','Unpaid')),
    status TEXT NOT NULL DEFAULT 'Completed' CHECK (status IN ('Completed','Returned','Cancelled')),
    created_by_user_id INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (store_id) REFERENCES stores(id),
    FOREIGN KEY (prescription_id) REFERENCES prescriptions(id),
    FOREIGN KEY (doctor_id) REFERENCES doctors(id),
    FOREIGN KEY (created_by_user_id) REFERENCES users(id),
    UNIQUE(store_id, invoice_no)
);

CREATE TABLE IF NOT EXISTS sale_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER NOT NULL,
    item_id INTEGER NOT NULL,
    batch_id INTEGER NOT NULL,          -- the specific FEFO-selected lot this line was sold from
    quantity INTEGER NOT NULL,
    sale_rate REAL NOT NULL,            -- rate charged per unit, GST-INCLUSIVE like mrp (<= batch mrp) —
                                         -- taxable/cgst/sgst below are back-calculated out of this, not added on top
    mrp REAL NOT NULL,
    discount_pct REAL NOT NULL DEFAULT 0,
    gst_rate REAL NOT NULL DEFAULT 0,
    taxable_amount REAL NOT NULL DEFAULT 0,
    cgst_amount REAL NOT NULL DEFAULT 0,
    sgst_amount REAL NOT NULL DEFAULT 0,
    igst_amount REAL NOT NULL DEFAULT 0,
    line_total REAL NOT NULL DEFAULT 0,
    FOREIGN KEY (sale_id) REFERENCES sales(id),
    FOREIGN KEY (item_id) REFERENCES items(id),
    FOREIGN KEY (batch_id) REFERENCES batches(id)
);

-- ---------- STOCK ADJUSTMENTS (expiry write-off, damage, loss, correction) ----------
CREATE TABLE IF NOT EXISTS stock_adjustments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    store_id INTEGER NOT NULL,
    batch_id INTEGER NOT NULL,
    adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('Expired','Damaged','Lost','Correction')),
    quantity INTEGER NOT NULL,          -- always positive; always reduces batches.quantity
    reason TEXT,
    created_by_user_id INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (store_id) REFERENCES stores(id),
    FOREIGN KEY (batch_id) REFERENCES batches(id),
    FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);

-- ---------- ACTIVITY LOG ----------
CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id INTEGER,
    details TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- ---------- INDEXES ----------
CREATE INDEX IF NOT EXISTS idx_items_schedule ON items(schedule);
CREATE INDEX IF NOT EXISTS idx_items_active ON items(is_active);
CREATE INDEX IF NOT EXISTS idx_batches_fefo ON batches(item_id, store_id, expiry_date);
CREATE INDEX IF NOT EXISTS idx_batches_store ON batches(store_id);
CREATE INDEX IF NOT EXISTS idx_batches_expiry ON batches(expiry_date);
CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON purchase_items(purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchases_store ON purchases(store_id);
CREATE INDEX IF NOT EXISTS idx_sales_store_date ON sales(store_id, sale_date);
CREATE INDEX IF NOT EXISTS idx_sales_doctor ON sales(doctor_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_batch ON sale_items(batch_id);
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_batch ON stock_adjustments(batch_id);
