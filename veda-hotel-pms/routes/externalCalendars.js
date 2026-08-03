const express = require('express');
const db = require('../db/connection');
const { requireRole } = require('../middleware/auth');
const { createReservation } = require('../utils/reservationEngine');

const router = express.Router();

function parseIcs(icsText) {
  const events = [];
  const blocks = icsText.split('BEGIN:VEVENT').slice(1);
  blocks.forEach(block => {
    const endIdx = block.indexOf('END:VEVENT');
    const body = endIdx >= 0 ? block.slice(0, endIdx) : block;
    const lines = body.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const event = {};
    lines.forEach(line => {
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) return;
      const rawKey = line.slice(0, colonIdx);
      const value = line.slice(colonIdx + 1);
      const key = rawKey.split(';')[0];
      if (key === 'UID') event.uid = value;
      if (key === 'DTSTART') event.dtstart = value;
      if (key === 'DTEND') event.dtend = value;
      if (key === 'SUMMARY') event.summary = value;
    });
    if (event.uid && event.dtstart && event.dtend) events.push(event);
  });
  return events;
}

function icsDateToIso(val) {
  const datePart = val.slice(0, 8);
  if (datePart.length !== 8) return null;
  return `${datePart.slice(0, 4)}-${datePart.slice(4, 6)}-${datePart.slice(6, 8)}`;
}

// GET /api/external-calendars - list subscriptions for this property
router.get('/', (req, res) => {
  const propertyId = req.session.propertyId;
  const calendars = db.prepare(`
    SELECT ec.*, rt.name as room_type_name
    FROM external_calendars ec
    JOIN room_types rt ON ec.room_type_id = rt.id
    WHERE ec.property_id = ? AND ec.is_active = 1
    ORDER BY ec.created_at DESC
  `).all(propertyId);
  res.json(calendars);
});

// POST /api/external-calendars - add a subscription (Manager/Admin)
router.post('/', requireRole('Manager'), (req, res) => {
  const propertyId = req.session.propertyId;
  const { room_type_id, name, ical_url } = req.body;
  if (!room_type_id || !name || !ical_url) {
    return res.status(400).json({ error: 'room_type_id, name, and ical_url are required' });
  }
  const info = db.prepare(`
    INSERT INTO external_calendars (property_id, room_type_id, name, ical_url)
    VALUES (?, ?, ?, ?)
  `).run(propertyId, room_type_id, name, ical_url);
  res.json({ success: true, id: info.lastInsertRowid });
});

// DELETE /api/external-calendars/:id
router.delete('/:id', requireRole('Manager'), (req, res) => {
  db.prepare('UPDATE external_calendars SET is_active = 0 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// POST /api/external-calendars/:id/sync - fetch the feed and block new dates
// Note: this only adds new blocks; if a booking is cancelled on the OTA side,
// it must still be cancelled here manually (we don't auto-cancel based on a
// feed disappearing, to avoid accidentally releasing a room over a parsing hiccup).
router.post('/:id/sync', requireRole('Manager'), async (req, res) => {
  const { id } = req.params;
  const cal = db.prepare('SELECT * FROM external_calendars WHERE id = ?').get(id);
  if (!cal) return res.status(404).json({ error: 'Calendar subscription not found' });

  let icsText;
  try {
    const response = await fetch(cal.ical_url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    icsText = await response.text();
  } catch (e) {
    db.prepare(`
      UPDATE external_calendars SET last_synced_at = datetime('now'), last_sync_status = 'error', last_sync_error = ?
      WHERE id = ?
    `).run(e.message, id);
    return res.status(400).json({ error: `Could not fetch calendar feed: ${e.message}` });
  }

  const events = parseIcs(icsText);
  let created = 0;
  let skipped = 0;
  let failed = 0;

  events.forEach(ev => {
    const existing = db.prepare('SELECT id FROM reservations WHERE external_uid = ?').get(ev.uid);
    if (existing) { skipped++; return; }

    const arrivalDate = icsDateToIso(ev.dtstart);
    const departureDate = icsDateToIso(ev.dtend);
    if (!arrivalDate || !departureDate || departureDate <= arrivalDate) { failed++; return; }

    try {
      const result = createReservation(db, {
        propertyId: cal.property_id,
        guest: { full_name: `OTA Guest — ${cal.name}` },
        arrivalDate, departureDate,
        rooms: [{ room_type_id: cal.room_type_id, rate_per_night: 0 }],
        source: 'ota_ical',
        bookedByUserId: req.session.userId
      });
      db.prepare('UPDATE reservations SET external_uid = ? WHERE id = ?').run(ev.uid, result.reservationId);
      created++;
    } catch (e) {
      failed++;
    }
  });

  db.prepare(`
    UPDATE external_calendars SET last_synced_at = datetime('now'), last_sync_status = 'ok', last_sync_error = NULL
    WHERE id = ?
  `).run(id);

  res.json({ success: true, total_events: events.length, created, skipped, failed });
});

module.exports = router;
