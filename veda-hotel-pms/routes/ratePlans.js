const express = require('express');
const db = require('../db/connection');
const { requireRole } = require('../middleware/auth');
const { logActivity, getEffectiveRate } = require('../utils/helpers');

const router = express.Router();

// GET /api/rate-plans/effective?room_type_id=&date= - suggested rate for the booking form
router.get('/effective', (req, res) => {
  const { room_type_id, date } = req.query;
  if (!room_type_id || !date) {
    return res.status(400).json({ error: 'room_type_id and date are required' });
  }
  const result = getEffectiveRate(db, room_type_id, date);
  if (!result) return res.status(404).json({ error: 'Room type not found' });
  res.json(result);
});

// GET /api/rate-plans - list all seasonal rate plans for this property
router.get('/', (req, res) => {
  const propertyId = req.session.propertyId;
  const plans = db.prepare(`
    SELECT rp.*, rt.name as room_type_name
    FROM rate_plans rp
    JOIN room_types rt ON rp.room_type_id = rt.id
    WHERE rp.property_id = ? AND rp.is_active = 1
    ORDER BY rp.valid_from DESC
  `).all(propertyId);
  res.json(plans);
});

// POST /api/rate-plans - create a seasonal rate (Manager/Admin)
router.post('/', requireRole('Manager'), (req, res) => {
  const propertyId = req.session.propertyId;
  const { room_type_id, name, rate, valid_from, valid_to } = req.body;

  if (!room_type_id || !name || rate === undefined || !valid_from || !valid_to) {
    return res.status(400).json({ error: 'room_type_id, name, rate, valid_from, and valid_to are required' });
  }
  if (valid_to < valid_from) {
    return res.status(400).json({ error: 'valid_to must be on or after valid_from' });
  }

  const info = db.prepare(`
    INSERT INTO rate_plans (property_id, room_type_id, name, rate, valid_from, valid_to)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(propertyId, room_type_id, name, rate, valid_from, valid_to);

  logActivity(db, req.session.userId, 'rate_plan_created', 'rate_plan', info.lastInsertRowid, { name, rate });
  res.json({ success: true, id: info.lastInsertRowid });
});

// PUT /api/rate-plans/:id - update a seasonal rate
router.put('/:id', requireRole('Manager'), (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM rate_plans WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Rate plan not found' });

  const fields = ['room_type_id', 'name', 'rate', 'valid_from', 'valid_to', 'is_active'];
  const updates = [];
  const params = [];
  fields.forEach(f => {
    if (req.body[f] !== undefined) { updates.push(`${f} = ?`); params.push(req.body[f]); }
  });
  if (updates.length === 0) return res.json({ success: true });

  params.push(id);
  db.prepare(`UPDATE rate_plans SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  logActivity(db, req.session.userId, 'rate_plan_updated', 'rate_plan', id, req.body);
  res.json({ success: true });
});

// DELETE /api/rate-plans/:id - soft delete
router.delete('/:id', requireRole('Manager'), (req, res) => {
  const { id } = req.params;
  db.prepare('UPDATE rate_plans SET is_active = 0 WHERE id = ?').run(id);
  logActivity(db, req.session.userId, 'rate_plan_deactivated', 'rate_plan', id, null);
  res.json({ success: true });
});

module.exports = router;
