// VEDA Hotel PMS - Database Initializer
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
const DB_PATH = path.join(dbDir, 'veda_hotel.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

console.log('Initializing VEDA Hotel PMS database at:', DB_PATH);

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
    ['FrontOffice', JSON.stringify(['reservations.*', 'guests.*', 'rooms.view', 'folio.*'])],
    ['Housekeeping', JSON.stringify(['rooms.view', 'rooms.update_status'])],
    ['Accounts', JSON.stringify(['folio.*', 'payments.*', 'reports.view'])],
    ['Manager', JSON.stringify(['*.view', 'reports.*'])]
  ];
  const tx = db.transaction((rows) => rows.forEach(r => insertRole.run(...r)));
  tx(roles);
  console.log('✔ Roles seeded.');
}

// ---------- Seed: Default Property ----------
const propCount = db.prepare('SELECT COUNT(*) as c FROM properties').get().c;
let propertyId;
if (propCount === 0) {
  const crypto = require('crypto');
  const info = db.prepare(`
    INSERT INTO properties (name, code, address, city, state, currency, is_active, ical_token)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?)
  `).run('Demo Property', 'DEMO-01', 'Sample Address', 'Dewas', 'Madhya Pradesh', 'INR', crypto.randomBytes(16).toString('hex'));
  propertyId = info.lastInsertRowid;
  console.log('✔ Default property seeded (id=' + propertyId + ').');
} else {
  propertyId = db.prepare('SELECT id FROM properties LIMIT 1').get().id;
}

// ---------- Seed: Admin user ----------
const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
if (userCount === 0) {
  const adminRoleId = db.prepare("SELECT id FROM roles WHERE name = 'Admin'").get().id;
  const passwordHash = bcrypt.hashSync('admin123', 10);
  db.prepare(`
    INSERT INTO users (property_id, username, password_hash, full_name, role_id, is_active)
    VALUES (?, ?, ?, ?, ?, 1)
  `).run(propertyId, 'admin', passwordHash, 'Administrator', adminRoleId);
  console.log('✔ Default admin user created — username: admin / password: admin123 (CHANGE THIS)');
}

// ---------- Seed: Room types ----------
const rtCount = db.prepare('SELECT COUNT(*) as c FROM room_types').get().c;
if (rtCount === 0) {
  const insertRT = db.prepare(`
    INSERT INTO room_types (property_id, name, description, max_occupancy, base_rate, extra_bed_rate, gst_rate)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const types = [
    [propertyId, 'Standard', 'Standard room with basic amenities', 2, 2500, 500, 12],
    [propertyId, 'Deluxe', 'Deluxe room with premium furnishing', 2, 3800, 700, 12],
    [propertyId, 'Suite', 'Spacious suite with living area', 3, 6500, 1000, 18]
  ];
  const tx = db.transaction((rows) => rows.forEach(r => insertRT.run(...r)));
  tx(types);
  console.log('✔ Room types seeded.');

  // ---------- Seed: Rooms ----------
  const rtRows = db.prepare('SELECT id, name FROM room_types WHERE property_id = ?').all(propertyId);
  const insertRoom = db.prepare(`
    INSERT INTO rooms (property_id, room_type_id, room_number, floor, status, housekeeping_status)
    VALUES (?, ?, ?, ?, 'vacant_clean', 'clean')
  `);
  const roomTx = db.transaction(() => {
    rtRows.forEach((rt, typeIdx) => {
      for (let i = 1; i <= 5; i++) {
        const floor = String(typeIdx + 1);
        const roomNum = `${floor}0${i}`;
        insertRoom.run(propertyId, rt.id, roomNum, floor);
      }
    });
  });
  roomTx();
  console.log('✔ Sample rooms seeded (15 rooms across 3 room types).');
}

console.log('\nDatabase ready ✅');
console.log('Login with: admin / admin123');

// ---------- Start the licensing trial clock ----------
const licenseRow = db.prepare('SELECT * FROM license_state WHERE id = 1').get();
if (!licenseRow) {
  const installId = crypto.randomBytes(8).toString('hex');
  db.prepare(`INSERT INTO license_state (id, install_id, installed_at) VALUES (1, ?, datetime('now'))`).run(installId);
  console.log(`✔ 7-day trial started (install id: ${installId}).`);
}

db.close();
