const express = require('express');
const db = require('../db/connection');
const { logActivity } = require('../utils/helpers');

const router = express.Router();

// GET /api/service-requests?status=pending
router.get('/', (req, res) => {
  const propertyId = req.session.propertyId;
  const { status } = req.query;

  let query = `
    SELECT sr.*, res.booking_ref, g.full_name as guest_name, g.phone as guest_phone,
      (SELECT GROUP_CONCAT(r.room_number, ', ') FROM reservation_rooms rr JOIN rooms r ON rr.room_id = r.id WHERE rr.reservation_id = res.id) as room_numbers
    FROM service_requests sr
    JOIN reservations res ON sr.reservation_id = res.id
    JOIN guests g ON res.guest_id = g.id
    WHERE res.property_id = ?
  `;
  const params = [propertyId];
  if (status) { query += ' AND sr.status = ?'; params.push(status); }
  query += ' ORDER BY sr.created_at DESC LIMIT 200';

  res.json(db.prepare(query).all(...params));
});

// PATCH /api/service-requests/:id
router.patch('/:id', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!['pending', 'in_progress', 'completed', 'cancelled'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  const resolvedAt = ['completed', 'cancelled'].includes(status) ? "datetime('now')" : 'NULL';
  db.prepare(`
    UPDATE service_requests SET status = ?, resolved_at = ${resolvedAt}, resolved_by_user_id = ?
    WHERE id = ?
  `).run(status, req.session.userId, id);
  logActivity(db, req.session.userId, 'service_request_updated', 'service_request', id, { status });
  res.json({ success: true });
});

module.exports = router;
