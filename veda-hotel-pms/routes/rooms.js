const express = require('express');
const db = require('../db/connection');
const { logActivity } = require('../utils/helpers');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/rooms - full room grid with type info
router.get('/', (req, res) => {
  const propertyId = req.session.propertyId;
  const rooms = db.prepare(`
    SELECT r.*, rt.name as room_type_name, rt.base_rate
    FROM rooms r
    JOIN room_types rt ON r.room_type_id = rt.id
    WHERE r.property_id = ? AND r.is_active = 1
    ORDER BY r.floor, r.room_number
  `).all(propertyId);
  res.json(rooms);
});

// GET /api/rooms/types - list room types (for booking forms)
router.get('/types', (req, res) => {
  const propertyId = req.session.propertyId;
  const types = db.prepare(`
    SELECT * FROM room_types WHERE property_id = ? AND is_active = 1
  `).all(propertyId);
  res.json(types);
});

// POST /api/rooms/types - create a room type (Manager/Admin)
router.post('/types', requireRole('Manager'), (req, res) => {
  const propertyId = req.session.propertyId;
  const { name, description, max_occupancy, base_rate, extra_bed_rate, gst_rate } = req.body;
  if (!name || base_rate === undefined) {
    return res.status(400).json({ error: 'name and base_rate are required' });
  }
  const info = db.prepare(`
    INSERT INTO room_types (property_id, name, description, max_occupancy, base_rate, extra_bed_rate, gst_rate)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(propertyId, name, description || null, max_occupancy || 2, base_rate, extra_bed_rate || 0, gst_rate || 0);
  logActivity(db, req.session.userId, 'room_type_created', 'room_type', info.lastInsertRowid, { name });
  res.json({ success: true, id: info.lastInsertRowid });
});

// PUT /api/rooms/types/:id - update a room type
router.put('/types/:id', requireRole('Manager'), (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM room_types WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Room type not found' });

  const fields = ['name', 'description', 'max_occupancy', 'base_rate', 'extra_bed_rate', 'gst_rate', 'is_active'];
  const updates = [];
  const params = [];
  fields.forEach(f => {
    if (req.body[f] !== undefined) { updates.push(`${f} = ?`); params.push(req.body[f]); }
  });
  if (updates.length === 0) return res.json({ success: true });

  params.push(id);
  db.prepare(`UPDATE room_types SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  logActivity(db, req.session.userId, 'room_type_updated', 'room_type', id, req.body);
  res.json({ success: true });
});

// DELETE /api/rooms/types/:id - soft-delete (blocked if active rooms use it)
router.delete('/types/:id', requireRole('Manager'), (req, res) => {
  const { id } = req.params;
  const roomCount = db.prepare('SELECT COUNT(*) as c FROM rooms WHERE room_type_id = ? AND is_active = 1').get(id).c;
  if (roomCount > 0) {
    return res.status(400).json({ error: `Cannot remove: ${roomCount} active room(s) still use this room type` });
  }
  db.prepare('UPDATE room_types SET is_active = 0 WHERE id = ?').run(id);
  logActivity(db, req.session.userId, 'room_type_deactivated', 'room_type', id, null);
  res.json({ success: true });
});

// POST /api/rooms - create a room (Manager/Admin)
router.post('/', requireRole('Manager'), (req, res) => {
  const propertyId = req.session.propertyId;
  const { room_number, floor, room_type_id } = req.body;
  if (!room_number || !room_type_id) {
    return res.status(400).json({ error: 'room_number and room_type_id are required' });
  }
  try {
    const info = db.prepare(`
      INSERT INTO rooms (property_id, room_type_id, room_number, floor, status, housekeeping_status)
      VALUES (?, ?, ?, ?, 'vacant_clean', 'clean')
    `).run(propertyId, room_type_id, room_number, floor || null);
    logActivity(db, req.session.userId, 'room_created', 'room', info.lastInsertRowid, { room_number });
    res.json({ success: true, id: info.lastInsertRowid });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) {
      return res.status(400).json({ error: `Room ${room_number} already exists` });
    }
    res.status(400).json({ error: e.message });
  }
});

// PUT /api/rooms/:id - edit a room's number/floor/type (Manager/Admin)
router.put('/:id', requireRole('Manager'), (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM rooms WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Room not found' });

  const fields = ['room_number', 'floor', 'room_type_id', 'is_active'];
  const updates = [];
  const params = [];
  fields.forEach(f => {
    if (req.body[f] !== undefined) { updates.push(`${f} = ?`); params.push(req.body[f]); }
  });
  if (updates.length === 0) return res.json({ success: true });

  params.push(id);
  try {
    db.prepare(`UPDATE rooms SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    logActivity(db, req.session.userId, 'room_updated', 'room', id, req.body);
    res.json({ success: true });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) {
      return res.status(400).json({ error: 'A room with that number already exists' });
    }
    res.status(400).json({ error: e.message });
  }
});

// DELETE /api/rooms/:id - deactivate a room (Manager/Admin)
router.delete('/:id', requireRole('Manager'), (req, res) => {
  const { id } = req.params;
  db.prepare('UPDATE rooms SET is_active = 0 WHERE id = ?').run(id);
  logActivity(db, req.session.userId, 'room_deactivated', 'room', id, null);
  res.json({ success: true });
});

// GET /api/rooms/available?arrival=YYYY-MM-DD&departure=YYYY-MM-DD&room_type_id=
router.get('/available', (req, res) => {
  const propertyId = req.session.propertyId;
  const { arrival, departure, room_type_id } = req.query;
  if (!arrival || !departure) {
    return res.status(400).json({ error: 'arrival and departure dates required' });
  }

  // Rooms NOT already booked (overlapping reservation) in that date range
  let query = `
    SELECT r.*, rt.name as room_type_name, rt.base_rate
    FROM rooms r
    JOIN room_types rt ON r.room_type_id = rt.id
    WHERE r.property_id = ? AND r.is_active = 1
      AND r.status NOT IN ('out_of_order', 'out_of_service')
      AND r.id NOT IN (
        SELECT rr.room_id FROM reservation_rooms rr
        JOIN reservations res ON rr.reservation_id = res.id
        WHERE res.status IN ('confirmed', 'checked_in')
          AND rr.room_id IS NOT NULL
          AND NOT (res.departure_date <= ? OR res.arrival_date >= ?)
      )
  `;
  const params = [propertyId, arrival, departure];
  if (room_type_id) {
    query += ' AND r.room_type_id = ?';
    params.push(room_type_id);
  }
  query += ' ORDER BY r.floor, r.room_number';

  const rooms = db.prepare(query).all(...params);
  res.json(rooms);
});

// PATCH /api/rooms/:id/status - update housekeeping/room status
router.patch('/:id/status', (req, res) => {
  const { id } = req.params;
  const { status, housekeeping_status, remarks } = req.body;

  const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(id);
  if (!room) return res.status(404).json({ error: 'Room not found' });

  const newStatus = status || room.status;
  const newHk = housekeeping_status || room.housekeeping_status;

  db.prepare(`
    UPDATE rooms SET status = ?, housekeeping_status = ? WHERE id = ?
  `).run(newStatus, newHk, id);

  db.prepare(`
    INSERT INTO housekeeping_log (room_id, previous_status, new_status, changed_by_user_id, remarks)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, room.status, newStatus, req.session.userId, remarks || null);

  logActivity(db, req.session.userId, 'room_status_update', 'room', id, { from: room.status, to: newStatus });

  res.json({ success: true });
});

module.exports = router;
