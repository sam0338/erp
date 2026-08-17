const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { migrate } = require('./migrate');

// Defaults to this folder next to server.js — fine for development and for
// running straight from source. The packaged Windows installer sets DB_DIR
// to a folder under %PROGRAMDATA% instead, so the data survives an
// uninstall/reinstall/upgrade cleanly rather than living inside Program
// Files (which a reinstall would wipe, and which needs admin rights to
// write to on some machines).
const dbDir = process.env.DB_DIR || __dirname;
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
const DB_PATH = path.join(dbDir, 'veda_pharmacy.db');

let db;
try {
  // fileMustExist stops better-sqlite3 from silently creating an empty
  // database if it doesn't exist yet — without this, a missing DB fails
  // invisibly (empty file gets created, then every query fails with
  // "no such table") instead of failing clearly up front.
  db = new Database(DB_PATH, { fileMustExist: true });
} catch (err) {
  console.error('\n❌ Could not open the database at', DB_PATH);
  console.error('   Run "npm run initdb" first, then try again.\n');
  process.exit(1);
}

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

migrate(db);

module.exports = db;
