-- ============================================================
-- VEDA Hotel PMS - Core Schema
-- SQLite | LAN-deployable | Multi-property capable
-- ============================================================

PRAGMA foreign_keys = ON;

-- ---------- PROPERTIES (multi-property from day 1) ----------
CREATE TABLE IF NOT EXISTS properties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,          -- e.g. 'SKR-DEWAS'
    address TEXT,
    city TEXT,
    state TEXT,
    gstin TEXT,
    is_gst_registered INTEGER DEFAULT 1,
    ical_token TEXT,                    -- secures the public iCal export URL
    -- Revenue intelligence rule settings
    weekend_multiplier REAL DEFAULT 1.0,      -- e.g. 1.15 = +15% on Fri/Sat nights
    high_occ_threshold REAL DEFAULT 80,       -- % occupancy that triggers a rate-bump suggestion
    high_occ_bump_pct REAL DEFAULT 15,
    low_occ_threshold REAL DEFAULT 30,        -- % occupancy that triggers a discount suggestion
    low_occ_discount_pct REAL DEFAULT 10,
    phone TEXT,
    email TEXT,
    checkin_time TEXT DEFAULT '12:00',
    checkout_time TEXT DEFAULT '11:00',
    currency TEXT DEFAULT 'INR',
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
);

-- ---------- USERS / ROLES ----------
CREATE TABLE IF NOT EXISTS roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,          -- Admin, FrontOffice, Housekeeping, Accounts, Manager
    permissions TEXT                    -- JSON array of permission strings
);

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    property_id INTEGER,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT,
    role_id INTEGER,
    is_active INTEGER DEFAULT 1,
    last_login TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (property_id) REFERENCES properties(id),
    FOREIGN KEY (role_id) REFERENCES roles(id)
);

-- ---------- LICENSING ----------
-- Single-row table. installed_at is the trial clock — set once, on first
-- run, and never touched again. Deleting it means deleting the whole
-- database (and all hotel data with it), which is enough of a deterrent
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

-- ---------- REVENUE INTELLIGENCE ----------
CREATE TABLE IF NOT EXISTS competitor_rates (
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
);

-- ---------- UPSELL ADD-ONS ----------
CREATE TABLE IF NOT EXISTS addons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    property_id INTEGER NOT NULL,
    name TEXT NOT NULL,                 -- Airport Pickup, Breakfast, Early Check-in, etc.
    description TEXT,
    price REAL NOT NULL DEFAULT 0,
    tax_rate REAL DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    FOREIGN KEY (property_id) REFERENCES properties(id)
);

-- ---------- GUEST SERVICE REQUESTS (self-service portal) ----------
CREATE TABLE IF NOT EXISTS service_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reservation_id INTEGER NOT NULL,
    request_type TEXT NOT NULL,         -- housekeeping | food | laundry | extend_stay | other
    details TEXT,
    status TEXT DEFAULT 'pending',      -- pending | in_progress | completed | cancelled
    created_at TEXT DEFAULT (datetime('now')),
    resolved_at TEXT,
    resolved_by_user_id INTEGER,
    FOREIGN KEY (reservation_id) REFERENCES reservations(id)
);

-- ---------- DAILY CASH CLOSING ----------
CREATE TABLE IF NOT EXISTS cash_closings (
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
);

-- ---------- EXTERNAL CALENDARS (lightweight OTA sync via iCal) ----------
-- Lets front office subscribe to an OTA's iCal feed (Booking.com, Airbnb,
-- Google Calendar, etc.) so externally-booked dates get blocked here too.
CREATE TABLE IF NOT EXISTS external_calendars (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    property_id INTEGER NOT NULL,
    room_type_id INTEGER NOT NULL,
    name TEXT NOT NULL,                 -- e.g. 'Booking.com - Deluxe'
    ical_url TEXT NOT NULL,
    last_synced_at TEXT,
    last_sync_status TEXT,              -- 'ok' | 'error'
    last_sync_error TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (property_id) REFERENCES properties(id),
    FOREIGN KEY (room_type_id) REFERENCES room_types(id)
);

-- ---------- ROOM TYPES & TARIFFS ----------
CREATE TABLE IF NOT EXISTS room_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    property_id INTEGER NOT NULL,
    name TEXT NOT NULL,                 -- Deluxe, Suite, Standard
    description TEXT,
    max_occupancy INTEGER DEFAULT 2,
    base_rate REAL NOT NULL DEFAULT 0,
    extra_bed_rate REAL DEFAULT 0,
    gst_rate REAL DEFAULT 0,            -- % applied to room charges for this type (e.g. 12, 18)
    is_active INTEGER DEFAULT 1,
    FOREIGN KEY (property_id) REFERENCES properties(id)
);

CREATE TABLE IF NOT EXISTS rate_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    property_id INTEGER NOT NULL,
    room_type_id INTEGER NOT NULL,
    name TEXT NOT NULL,                 -- EP, CP, MAP, AP / Corporate / OTA
    rate REAL NOT NULL,
    valid_from TEXT,
    valid_to TEXT,
    is_active INTEGER DEFAULT 1,
    FOREIGN KEY (property_id) REFERENCES properties(id),
    FOREIGN KEY (room_type_id) REFERENCES room_types(id)
);

-- ---------- ROOMS ----------
CREATE TABLE IF NOT EXISTS rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    property_id INTEGER NOT NULL,
    room_type_id INTEGER NOT NULL,
    room_number TEXT NOT NULL,
    floor TEXT,
    status TEXT DEFAULT 'vacant_clean',
        -- vacant_clean | vacant_dirty | occupied_clean | occupied_dirty
        -- | out_of_order | out_of_service | blocked
    housekeeping_status TEXT DEFAULT 'clean',  -- clean | dirty | inspected
    is_active INTEGER DEFAULT 1,
    notes TEXT,
    UNIQUE(property_id, room_number),
    FOREIGN KEY (property_id) REFERENCES properties(id),
    FOREIGN KEY (room_type_id) REFERENCES room_types(id)
);

-- ---------- GUESTS ----------
CREATE TABLE IF NOT EXISTS guests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    id_proof_type TEXT,                 -- Aadhar, Passport, DL, Voter ID
    id_proof_number TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    country TEXT DEFAULT 'India',
    company_name TEXT,
    gstin TEXT,
    nationality TEXT DEFAULT 'Indian',
    vip_status TEXT,                    -- NULL | 'VIP' | 'Corporate' | 'Repeat'
    preferences TEXT,                   -- free text: high floor, non-smoking, extra pillow, etc.
    date_of_birth TEXT,
    anniversary_date TEXT,
    loyalty_points INTEGER DEFAULT 0,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- ---------- RESERVATIONS ----------
CREATE TABLE IF NOT EXISTS reservations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    property_id INTEGER NOT NULL,
    booking_ref TEXT UNIQUE NOT NULL,   -- e.g. RES-2026-00001
    guest_id INTEGER NOT NULL,
    source TEXT DEFAULT 'walk_in',      -- walk_in | phone | ota | corporate | agent
    status TEXT DEFAULT 'confirmed',    -- confirmed | checked_in | checked_out | cancelled | no_show
    arrival_date TEXT NOT NULL,
    departure_date TEXT NOT NULL,
    adults INTEGER DEFAULT 1,
    children INTEGER DEFAULT 0,
    booked_by_user_id INTEGER,
    special_requests TEXT,
    external_uid TEXT,                  -- dedupe key for iCal-imported OTA bookings
    created_at TEXT DEFAULT (datetime('now')),
    cancelled_at TEXT,
    cancel_reason TEXT,
    FOREIGN KEY (property_id) REFERENCES properties(id),
    FOREIGN KEY (guest_id) REFERENCES guests(id),
    FOREIGN KEY (booked_by_user_id) REFERENCES users(id)
);

-- A reservation can span multiple rooms (group booking)
CREATE TABLE IF NOT EXISTS reservation_rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reservation_id INTEGER NOT NULL,
    room_id INTEGER,                    -- NULL until assigned
    room_type_id INTEGER NOT NULL,
    rate_per_night REAL NOT NULL,
    checkin_datetime TEXT,
    checkout_datetime TEXT,
    status TEXT DEFAULT 'reserved',     -- reserved | checked_in | checked_out
    FOREIGN KEY (reservation_id) REFERENCES reservations(id),
    FOREIGN KEY (room_id) REFERENCES rooms(id),
    FOREIGN KEY (room_type_id) REFERENCES room_types(id)
);

-- ---------- FOLIO / BILLING ----------
CREATE TABLE IF NOT EXISTS folios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reservation_id INTEGER NOT NULL,
    folio_number TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'open',         -- open | settled | void
    -- Billing party: defaults to the guest, but can be redirected to a
    -- company or another person (e.g. business-trip reimbursement billing).
    bill_to_same_as_guest INTEGER DEFAULT 1,
    bill_to_name TEXT,
    bill_to_address TEXT,
    bill_to_city TEXT,
    bill_to_state TEXT,
    bill_to_gstin TEXT,
    bill_to_phone TEXT,
    bill_to_email TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    settled_at TEXT,
    FOREIGN KEY (reservation_id) REFERENCES reservations(id)
);

CREATE TABLE IF NOT EXISTS folio_charges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    folio_id INTEGER NOT NULL,
    charge_type TEXT NOT NULL,          -- room | fnb | laundry | minibar | misc | tax | discount
    description TEXT,
    amount REAL NOT NULL,
    tax_rate REAL DEFAULT 0,
    tax_amount REAL DEFAULT 0,
    charge_date TEXT DEFAULT (datetime('now')),
    posted_by_user_id INTEGER,
    FOREIGN KEY (folio_id) REFERENCES folios(id),
    FOREIGN KEY (posted_by_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    folio_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    mode TEXT NOT NULL,                 -- cash | card | upi | bank_transfer | ota_prepaid
    reference_number TEXT,
    paid_at TEXT DEFAULT (datetime('now')),
    received_by_user_id INTEGER,
    FOREIGN KEY (folio_id) REFERENCES folios(id),
    FOREIGN KEY (received_by_user_id) REFERENCES users(id)
);

-- ---------- HOUSEKEEPING LOG ----------
CREATE TABLE IF NOT EXISTS housekeeping_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id INTEGER NOT NULL,
    previous_status TEXT,
    new_status TEXT NOT NULL,
    changed_by_user_id INTEGER,
    changed_at TEXT DEFAULT (datetime('now')),
    remarks TEXT,
    FOREIGN KEY (room_id) REFERENCES rooms(id),
    FOREIGN KEY (changed_by_user_id) REFERENCES users(id)
);

-- ---------- AUDIT / ACTIVITY LOG ----------
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
CREATE INDEX IF NOT EXISTS idx_reservations_dates ON reservations(arrival_date, departure_date);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);
CREATE INDEX IF NOT EXISTS idx_reservation_rooms_res ON reservation_rooms(reservation_id);
CREATE INDEX IF NOT EXISTS idx_folio_charges_folio ON folio_charges(folio_id);
CREATE INDEX IF NOT EXISTS idx_guests_phone ON guests(phone);
