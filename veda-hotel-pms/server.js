require('dotenv').config();
const path = require('path');
const fs = require('fs');

// This check MUST run before requiring anything that could transitively
// open the database (middleware/license.js -> db/connection.js, any route
// file, etc.) — better-sqlite3 would otherwise auto-create an empty file
// the moment it's opened, which would silently defeat this check.
const dbPath = path.join(process.env.DB_DIR || path.join(__dirname, 'db'), 'veda_hotel.db');
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
const PORT = process.env.PORT || 4500;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(session({
  secret: process.env.SESSION_SECRET || 'veda-hotel-pms-change-this-secret-in-production',
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

// ---------- Public booking engine (unauthenticated — used by the public booking page / embeds) ----------
app.use('/api/public', require('./routes/public'));

// ---------- Protected API routes ----------
app.use('/api/rooms', requireAuth, require('./routes/rooms'));
app.use('/api/guests', requireAuth, require('./routes/guests'));
app.use('/api/reservations', requireAuth, require('./routes/reservations'));
app.use('/api/billing', requireAuth, require('./routes/billing'));
app.use('/api/dashboard', requireAuth, require('./routes/dashboard'));
app.use('/api/messaging', requireAuth, require('./routes/messaging'));
app.use('/api/property', requireAuth, require('./routes/property'));
app.use('/api/rate-plans', requireAuth, require('./routes/ratePlans'));
app.use('/api/external-calendars', requireAuth, require('./routes/externalCalendars'));
app.use('/api/revenue', requireAuth, require('./routes/revenue'));
app.use('/api/service-requests', requireAuth, require('./routes/serviceRequests'));
app.use('/api/finance', requireAuth, require('./routes/finance'));
app.use('/api/analytics', requireAuth, require('./routes/analytics'));

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
  console.log(`\n🏨 VEDA Hotel PMS running at http://localhost:${PORT}`);
  console.log(`   Login: admin / admin123 (change after first login)\n`);
});
