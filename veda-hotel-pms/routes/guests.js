const express = require('express');
const db = require('../db/connection');
const { logActivity } = require('../utils/helpers');

const router = express.Router();

// GET /api/guests/upcoming-occasions?days=7 - birthdays/anniversaries in the next N days
router.get('/upcoming-occasions', (req, res) => {
  const days = Math.min(parseInt(req.query.days) || 7, 60);
  const dayjs = require('dayjs');
  const windowDates = [];
  for (let i = 0; i <= days; i++) {
    windowDates.push(dayjs().add(i, 'day').format('MM-DD'));
  }
  const placeholders = windowDates.map(() => '?').join(',');

  const birthdays = db.prepare(`
    SELECT id, full_name, phone, email, date_of_birth
    FROM guests
    WHERE date_of_birth IS NOT NULL AND strftime('%m-%d', date_of_birth) IN (${placeholders})
  `).all(...windowDates);

  const anniversaries = db.prepare(`
    SELECT id, full_name, phone, email, anniversary_date
    FROM guests
    WHERE anniversary_date IS NOT NULL AND strftime('%m-%d', anniversary_date) IN (${placeholders})
  `).all(...windowDates);

  res.json({ birthdays, anniversaries });
});

// GET /api/guests?search=
router.get('/', (req, res) => {
  const { search } = req.query;
  let guests;
  if (search) {
    const like = `%${search}%`;
    guests = db.prepare(`
      SELECT * FROM guests
      WHERE full_name LIKE ? OR phone LIKE ? OR email LIKE ? OR id_proof_number LIKE ?
      ORDER BY full_name LIMIT 50
    `).all(like, like, like, like);
  } else {
    guests = db.prepare('SELECT * FROM guests ORDER BY id DESC LIMIT 50').all();
  }
  res.json(guests);
});

// GET /api/guests/:id
router.get('/:id', (req, res) => {
  const guest = db.prepare('SELECT * FROM guests WHERE id = ?').get(req.params.id);
  if (!guest) return res.status(404).json({ error: 'Guest not found' });

  const history = db.prepare(`
    SELECT res.id, res.booking_ref, res.status, res.arrival_date, res.departure_date,
      (SELECT GROUP_CONCAT(r.room_number, ', ')
         FROM reservation_rooms rr JOIN rooms r ON rr.room_id = r.id
         WHERE rr.reservation_id = res.id) as room_numbers,
      (SELECT GROUP_CONCAT(DISTINCT rt.name)
         FROM reservation_rooms rr JOIN room_types rt ON rr.room_type_id = rt.id
         WHERE rr.reservation_id = res.id) as room_types,
      (SELECT GROUP_CONCAT(DISTINCT p.mode)
         FROM payments p JOIN folios f ON p.folio_id = f.id
         WHERE f.reservation_id = res.id) as payment_modes,
      (SELECT COALESCE(SUM(p.amount), 0)
         FROM payments p JOIN folios f ON p.folio_id = f.id
         WHERE f.reservation_id = res.id) as total_paid
    FROM reservations res WHERE res.guest_id = ? ORDER BY res.arrival_date DESC
  `).all(req.params.id);

  res.json({ ...guest, reservation_history: history });
});

// POST /api/guests
router.post('/', (req, res) => {
  const {
    full_name, email, phone, id_proof_type, id_proof_number,
    address, city, state, country, company_name, gstin, nationality, notes
  } = req.body;

  if (!full_name) return res.status(400).json({ error: 'full_name is required' });

  const info = db.prepare(`
    INSERT INTO guests (full_name, email, phone, id_proof_type, id_proof_number,
      address, city, state, country, company_name, gstin, nationality, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(full_name, email, phone, id_proof_type, id_proof_number,
    address, city, state, country || 'India', company_name, gstin, nationality || 'Indian', notes);

  logActivity(db, req.session.userId, 'guest_created', 'guest', info.lastInsertRowid, { full_name });

  res.json({ success: true, id: info.lastInsertRowid });
});

// PUT /api/guests/:id
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM guests WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Guest not found' });

  const fields = ['full_name', 'email', 'phone', 'id_proof_type', 'id_proof_number',
    'address', 'city', 'state', 'country', 'company_name', 'gstin', 'nationality', 'notes',
    'vip_status', 'preferences', 'date_of_birth', 'anniversary_date'];
  const updates = [];
  const params = [];
  fields.forEach(f => {
    if (req.body[f] !== undefined) {
      updates.push(`${f} = ?`);
      params.push(req.body[f]);
    }
  });
  if (updates.length === 0) return res.json({ success: true });

  params.push(id);
  db.prepare(`UPDATE guests SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  res.json({ success: true });
});

module.exports = router;
