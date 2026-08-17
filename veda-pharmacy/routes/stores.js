const express = require('express');
const db = require('../db/connection');
const { logActivity } = require('../utils/helpers');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

function validateStoreBody(body, { partial } = {}) {
  if (!partial || body.name !== undefined) {
    if (!body.name || !String(body.name).trim()) return 'name is required';
  }
  if (!partial || body.code !== undefined) {
    if (!body.code || !String(body.code).trim()) return 'code is required';
  }
  return null;
}

// GET /api/stores - list, open to any authenticated user (every role needs to
// know its own store's name; only Admin gets to switch/manage them — see below)
router.get('/', (req, res) => {
  const { include_inactive } = req.query;
  let query = 'SELECT * FROM stores WHERE 1 = 1';
  if (!include_inactive) query += ' AND is_active = 1';
  query += ' ORDER BY name COLLATE NOCASE';
  res.json(db.prepare(query).all());
});

// GET /api/stores/:id
router.get('/:id', (req, res) => {
  const store = db.prepare('SELECT * FROM stores WHERE id = ?').get(req.params.id);
  if (!store) return res.status(404).json({ error: 'Store not found' });
  res.json(store);
});

// POST /api/stores/switch - Admin-only. requireRole() with no allowed-roles
// list still lets Admin through (see middleware/auth.js) and rejects
// everyone else — that's exactly the gate this needs, no custom check.
// Every other role stays pinned to the store on their user record.
router.post('/switch', requireRole(), (req, res) => {
  const { store_id } = req.body;
  if (!store_id) return res.status(400).json({ error: 'store_id is required' });

  const store = db.prepare('SELECT * FROM stores WHERE id = ? AND is_active = 1').get(store_id);
  if (!store) return res.status(404).json({ error: 'Store not found or inactive' });

  req.session.storeId = store.id;
  req.session.storeName = store.name;
  logActivity(db, req.session.userId, 'store_switched', 'store', store.id, { name: store.name });
  res.json({ success: true, store: { id: store.id, name: store.name } });
});

// POST /api/stores - create (Admin-only)
router.post('/', requireRole(), (req, res) => {
  const err = validateStoreBody(req.body);
  if (err) return res.status(400).json({ error: err });

  const {
    name, code, address, city, state, pincode, phone, gstin,
    drug_license_no, drug_license_no_2, drug_license_expiry,
    tagline, owner_name, phone_alt, email, fssai_no,
    bill_prefix, default_gst_rate, invoice_footer
  } = req.body;

  try {
    const info = db.prepare(`
      INSERT INTO stores (
        name, code, address, city, state, pincode, phone, gstin,
        drug_license_no, drug_license_no_2, drug_license_expiry,
        tagline, owner_name, phone_alt, email, fssai_no,
        bill_prefix, default_gst_rate, invoice_footer
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name.trim(), code.trim(), address || null, city || null, state || null,
      pincode || null, phone || null, gstin || null,
      drug_license_no || null, drug_license_no_2 || null, drug_license_expiry || null,
      tagline || null, owner_name || null, phone_alt || null, email || null, fssai_no || null,
      (bill_prefix && String(bill_prefix).trim()) || 'INV',
      default_gst_rate !== undefined && default_gst_rate !== '' ? default_gst_rate : 12,
      invoice_footer || null
    );
    logActivity(db, req.session.userId, 'store_created', 'store', info.lastInsertRowid, { name });
    res.json({ success: true, id: info.lastInsertRowid });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) {
      return res.status(400).json({ error: `Store code "${code}" is already in use` });
    }
    res.status(400).json({ error: e.message });
  }
});

// PUT /api/stores/:id - update (Admin-only)
router.put('/:id', requireRole(), (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM stores WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Store not found' });

  const err = validateStoreBody(req.body, { partial: true });
  if (err) return res.status(400).json({ error: err });

  const fields = [
    'name', 'code', 'address', 'city', 'state', 'pincode', 'phone', 'gstin',
    'drug_license_no', 'drug_license_no_2', 'drug_license_expiry', 'is_active',
    // Shop Settings fields (public/settings.html) — self-service profile/
    // billing-preference columns, edited via this same endpoint against the
    // operator's current store id (see the note in schema.sql).
    'tagline', 'owner_name', 'phone_alt', 'email', 'fssai_no',
    'bill_prefix', 'default_gst_rate', 'invoice_footer'
  ];
  const updates = [];
  const params = [];
  fields.forEach(f => {
    if (req.body[f] !== undefined) { updates.push(`${f} = ?`); params.push(req.body[f]); }
  });
  if (updates.length === 0) return res.json({ success: true });

  params.push(id);
  try {
    db.prepare(`UPDATE stores SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    logActivity(db, req.session.userId, 'store_updated', 'store', id, req.body);
    res.json({ success: true });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) {
      return res.status(400).json({ error: `Store code "${req.body.code}" is already in use` });
    }
    res.status(400).json({ error: e.message });
  }
});

// DELETE /api/stores/:id - soft delete (Admin-only). Blocked if it's the last
// active store (the app always needs at least one to operate in), or if any
// active user still calls it their home store (reassign them first) — but
// NOT blocked by historical batches/sales/etc., which stay fully intact and
// queryable once switched back into; deactivating just hides it from the
// switcher and from being assigned to new users.
router.delete('/:id', requireRole(), (req, res) => {
  const { id } = req.params;

  const activeStoreCount = db.prepare('SELECT COUNT(*) as c FROM stores WHERE is_active = 1').get().c;
  const target = db.prepare('SELECT * FROM stores WHERE id = ?').get(id);
  if (!target) return res.status(404).json({ error: 'Store not found' });
  if (target.is_active && activeStoreCount <= 1) {
    return res.status(400).json({ error: 'Cannot remove the only active store' });
  }

  const userCount = db.prepare('SELECT COUNT(*) as c FROM users WHERE store_id = ? AND is_active = 1').get(id).c;
  if (userCount > 0) {
    return res.status(400).json({ error: `Cannot remove: ${userCount} active user(s) still call this their home store` });
  }

  db.prepare('UPDATE stores SET is_active = 0 WHERE id = ?').run(id);
  logActivity(db, req.session.userId, 'store_deactivated', 'store', id, null);
  res.json({ success: true });
});

module.exports = router;
