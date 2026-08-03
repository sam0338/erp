const express = require('express');
const db = require('../db/connection');
const { requireRole } = require('../middleware/auth');
const { logActivity } = require('../utils/helpers');

const router = express.Router();

// GET /api/property - current property's full details
router.get('/', (req, res) => {
  const property = db.prepare('SELECT * FROM properties WHERE id = ?').get(req.session.propertyId);
  if (!property) return res.status(404).json({ error: 'Property not found' });
  res.json(property);
});

// GET /api/property/all - list all active properties (for the property switcher)
router.get('/all', (req, res) => {
  const properties = db.prepare('SELECT id, name, city, code FROM properties WHERE is_active = 1 ORDER BY name').all();
  res.json(properties);
});

// POST /api/property/switch - switch which property this session is scoped to (Admin only)
router.post('/switch', requireRole('Manager'), (req, res) => {
  const { property_id } = req.body;
  const property = db.prepare('SELECT * FROM properties WHERE id = ? AND is_active = 1').get(property_id);
  if (!property) return res.status(404).json({ error: 'Property not found' });
  req.session.propertyId = property.id;
  logActivity(db, req.session.userId, 'switched_property', 'property', property.id, null);
  res.json({ success: true, property });
});

// PUT /api/property - update property details (Admin/Manager only)
router.put('/', requireRole('Manager'), (req, res) => {
  const fields = ['name', 'address', 'city', 'state', 'gstin', 'phone', 'email',
    'checkin_time', 'checkout_time', 'currency', 'is_gst_registered'];
  const updates = [];
  const params = [];
  fields.forEach(f => {
    if (req.body[f] !== undefined) {
      updates.push(`${f} = ?`);
      params.push(f === 'is_gst_registered' ? (req.body[f] ? 1 : 0) : req.body[f]);
    }
  });
  if (updates.length === 0) return res.json({ success: true });

  params.push(req.session.propertyId);
  db.prepare(`UPDATE properties SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  logActivity(db, req.session.userId, 'property_updated', 'property', req.session.propertyId, req.body);
  res.json({ success: true });
});

module.exports = router;
