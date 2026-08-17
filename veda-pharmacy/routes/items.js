const express = require('express');
const db = require('../db/connection');
const { logActivity } = require('../utils/helpers');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

const VALID_SCHEDULES = ['OTC', 'H', 'H1', 'X'];

function validateItemBody(body, { partial } = {}) {
  if (!partial || body.name !== undefined) {
    if (!body.name || !String(body.name).trim()) return 'name is required';
  }
  if (body.schedule !== undefined && !VALID_SCHEDULES.includes(body.schedule)) {
    return `schedule must be one of ${VALID_SCHEDULES.join(', ')}`;
  }
  if (body.gst_rate !== undefined && (isNaN(body.gst_rate) || body.gst_rate < 0)) {
    return 'gst_rate must be a non-negative number';
  }
  if (body.reorder_level !== undefined && (isNaN(body.reorder_level) || body.reorder_level < 0)) {
    return 'reorder_level must be a non-negative number';
  }
  return null;
}

// GET /api/items - list, with optional search/filter/include-inactive
// ?q=paracetamol&schedule=H1&category=Analgesic&include_inactive=1
router.get('/', (req, res) => {
  const { q, schedule, category, include_inactive } = req.query;

  let query = `
    SELECT i.*,
      COALESCE((SELECT SUM(b.quantity) FROM batches b WHERE b.item_id = i.id), 0) AS total_stock
    FROM items i
    WHERE 1 = 1
  `;
  const params = [];

  if (!include_inactive) {
    query += ' AND i.is_active = 1';
  }
  if (q) {
    query += ' AND (i.name LIKE ? OR i.generic_name LIKE ? OR i.hsn_code LIKE ? OR i.manufacturer LIKE ?)';
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }
  if (schedule) {
    query += ' AND i.schedule = ?';
    params.push(schedule);
  }
  if (category) {
    query += ' AND i.category = ?';
    params.push(category);
  }
  query += ' ORDER BY i.name COLLATE NOCASE';

  const items = db.prepare(query).all(...params);
  res.json(items);
});

// GET /api/items/categories - distinct categories already in use, for filter dropdowns
router.get('/categories', (req, res) => {
  const rows = db.prepare(`
    SELECT DISTINCT category FROM items
    WHERE category IS NOT NULL AND category != ''
    ORDER BY category COLLATE NOCASE
  `).all();
  res.json(rows.map(r => r.category));
});

// GET /api/items/:id
router.get('/:id', (req, res) => {
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Item not found' });
  res.json(item);
});

// POST /api/items - create
router.post('/', requireRole('Pharmacist'), (req, res) => {
  const err = validateItemBody(req.body);
  if (err) return res.status(400).json({ error: err });

  const {
    name, generic_name, manufacturer, hsn_code, gst_rate, schedule,
    drug_form, pack_size, unit, category, rack_location, reorder_level
  } = req.body;

  const info = db.prepare(`
    INSERT INTO items (
      name, generic_name, manufacturer, hsn_code, gst_rate, schedule,
      drug_form, pack_size, unit, category, rack_location, reorder_level
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    name.trim(), generic_name || null, manufacturer || null, hsn_code || null,
    gst_rate !== undefined ? gst_rate : 12, schedule || 'OTC',
    drug_form || null, pack_size || null, unit || 'Strip', category || null,
    rack_location || null, reorder_level || 0
  );

  logActivity(db, req.session.userId, 'item_created', 'item', info.lastInsertRowid, { name });
  res.json({ success: true, id: info.lastInsertRowid });
});

// PUT /api/items/:id - update
router.put('/:id', requireRole('Pharmacist'), (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM items WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Item not found' });

  const err = validateItemBody(req.body, { partial: true });
  if (err) return res.status(400).json({ error: err });

  const fields = [
    'name', 'generic_name', 'manufacturer', 'hsn_code', 'gst_rate', 'schedule',
    'drug_form', 'pack_size', 'unit', 'category', 'rack_location', 'reorder_level', 'is_active'
  ];
  const updates = [];
  const params = [];
  fields.forEach(f => {
    if (req.body[f] !== undefined) { updates.push(`${f} = ?`); params.push(req.body[f]); }
  });
  if (updates.length === 0) return res.json({ success: true });

  updates.push("updated_at = datetime('now')");
  params.push(id);
  db.prepare(`UPDATE items SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  logActivity(db, req.session.userId, 'item_updated', 'item', id, req.body);
  res.json({ success: true });
});

// DELETE /api/items/:id - soft delete (blocked if stock remains on any batch)
router.delete('/:id', requireRole('Pharmacist'), (req, res) => {
  const { id } = req.params;
  const stock = db.prepare('SELECT COALESCE(SUM(quantity), 0) as qty FROM batches WHERE item_id = ?').get(id).qty;
  if (stock > 0) {
    return res.status(400).json({ error: `Cannot remove: ${stock} unit(s) of this item are still in stock` });
  }
  db.prepare('UPDATE items SET is_active = 0 WHERE id = ?').run(id);
  logActivity(db, req.session.userId, 'item_deactivated', 'item', id, null);
  res.json({ success: true });
});

module.exports = router;
