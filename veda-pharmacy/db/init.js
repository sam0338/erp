// VEDA Pharmacy - Database Initializer
// Run: node db/init.js
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const { migrate } = require('./migrate');

// Keep in sync with db/connection.js's DB_DIR resolution.
const dbDir = process.env.DB_DIR || __dirname;
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
const DB_PATH = path.join(dbDir, 'veda_pharmacy.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

console.log('Initializing VEDA Pharmacy database at:', DB_PATH);

const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
db.exec(schema);
console.log('✔ Schema applied.');

migrate(db);

// ---------- Seed: Roles ----------
const roleCount = db.prepare('SELECT COUNT(*) as c FROM roles').get().c;
if (roleCount === 0) {
  const insertRole = db.prepare('INSERT INTO roles (name, permissions) VALUES (?, ?)');
  const roles = [
    ['Admin', JSON.stringify(['*'])],
    ['Pharmacist', JSON.stringify(['items.*', 'batches.*', 'sales.*', 'purchases.*', 'prescriptions.*', 'distributors.view'])],
    ['Cashier', JSON.stringify(['sales.create', 'sales.view', 'items.view', 'batches.view'])],
    ['Accounts', JSON.stringify(['purchases.*', 'distributors.*', 'reports.view'])]
  ];
  const tx = db.transaction((rows) => rows.forEach(r => insertRole.run(...r)));
  tx(roles);
  console.log('✔ Roles seeded.');
}

// ---------- Seed: Default Store ----------
const storeCount = db.prepare('SELECT COUNT(*) as c FROM stores').get().c;
let storeId;
if (storeCount === 0) {
  const info = db.prepare(`
    INSERT INTO stores (name, code, address, city, state, is_active)
    VALUES (?, ?, ?, ?, ?, 1)
  `).run('Demo Store', 'VP-DEMO-01', 'Sample Address', 'Indore', 'Madhya Pradesh');
  storeId = info.lastInsertRowid;
  console.log('✔ Default store seeded (id=' + storeId + ').');
} else {
  storeId = db.prepare('SELECT id FROM stores LIMIT 1').get().id;
}

// ---------- Seed: Admin user ----------
const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
if (userCount === 0) {
  const adminRoleId = db.prepare(`SELECT id FROM roles WHERE name = 'Admin'`).get().id;
  const passwordHash = bcrypt.hashSync('admin123', 10);
  db.prepare(`
    INSERT INTO users (store_id, username, password_hash, full_name, role_id, is_active)
    VALUES (?, 'admin', ?, 'Administrator', ?, 1)
  `).run(storeId, passwordHash, adminRoleId);
  console.log('✔ Admin user seeded (admin / admin123 — change this after first login).');
}

// ---------- Seed: License install record (starts the 7-day trial clock) ----------
const licenseCount = db.prepare('SELECT COUNT(*) as c FROM license_state').get().c;
if (licenseCount === 0) {
  const installId = crypto.randomBytes(8).toString('hex');
  db.prepare(`INSERT INTO license_state (id, install_id, installed_at) VALUES (1, ?, datetime('now'))`).run(installId);
  console.log('✔ License trial clock started.');
}

console.log('\nDone. Run "npm start" (or double-click the launcher) to start VEDA Pharmacy.\n');
