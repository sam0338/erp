require('dotenv').config();
const path = require('path');
const fs = require('fs');

// This check MUST run before requiring anything that could transitively
// open the database (middleware/license.js -> db/connection.js, any route
// file, etc.) — better-sqlite3 would otherwise auto-create an empty file
// the moment it's opened, which would silently defeat this check.
const dbPath = path.join(process.env.DB_DIR || path.join(__dirname, 'db'), 'veda_pharmacy.db');
if (!fs.existsSync(dbPath)) {
  console.log('\nNo database found — run "npm run initdb" first, then try again.\n');
  process.exit(1);
}

const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');

const { requireAuth } = require('./middleware/auth');
const { requireLicense } = require('./middleware/license');

const app = express();
const PORT = process.env.PORT || 4600;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(session({
  secret: process.env.SESSION_SECRET || 'veda-pharmacy-change-this-secret-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 8 * 60 * 60 * 1000, // 8 hour session
    httpOnly: true
  }
}));

// ---------- Licensing gate (runs before everything else) ----------
app.use(requireLicense);

// ---------- License API (always accessible — this is the way out of a lockout) ----------
app.use('/api/license', require('./routes/license'));

// ---------- Auth routes (public) ----------
app.use('/api/auth', require('./routes/auth'));

// ---------- Protected API routes ----------
app.use('/api/items', requireAuth, require('./routes/items'));

// ---------- Static frontend ----------
app.use(express.static(path.join(__dirname, 'public')));

// Protect dashboard.html and other app pages — redirect to login if not authed
app.get('/', (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect('/dashboard.html');
  }
  return res.redirect('/login.html');
});

app.listen(PORT, () => {
  console.log(`\n💊 VEDA Pharmacy running at http://localhost:${PORT}`);
  console.log(`   Login: admin / admin123 (change after first login)\n`);
});
