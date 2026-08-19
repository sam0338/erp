const express = require('express');
const db = require('../db/connection');
const { logActivity } = require('../utils/helpers');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

const ADJUSTMENT_TYPES = ['Expired', 'Damaged', 'Lost', 'Correction', 'Return to Supplier', 'Sample'];

// GET /api/batches - store-scoped stock lots, FEFO order (soonest expiry first)
// ?q=paracetamol&item_id=&expiry=all|expired|near|ok&include_exhausted=1&near_days=90
router.get('/', (req, res) => {
  const { q, item_id, expiry, include_exhausted, near_days } = req.query;
  const nearDays = parseInt(near_days, 10) || 90;

  let query = `
    SELECT b.*, i.name AS item_name, i.unit, i.schedule, i.gst_rate, i.category,
      d.name AS distributor_name,
      CASE
        WHEN b.expiry_date < date('now') THEN 'expired'
        WHEN b.expiry_date <= date('now', '+' || ? || ' day') THEN 'near'
        ELSE 'ok'
      END AS expiry_status
    FROM batches b
    JOIN items i ON b.item_id = i.id
    LEFT JOIN distributors d ON b.distributor_id = d.id
    WHERE b.store_id = ?
  `;
  const params = [nearDays, req.session.storeId];

  if (!include_exhausted) {
    query += ' AND b.quantity > 0';
  }
  if (item_id) {
    query += ' AND b.item_id = ?';
    params.push(item_id);
  }
  if (q) {
    query += ' AND (i.name LIKE ? OR b.batch_no LIKE ?)';
    const like = `%${q}%`;
    params.push(like, like);
  }

  query += ' ORDER BY b.expiry_date ASC, i.name COLLATE NOCASE';

  let batches = db.prepare(query).all(...params);
  if (expiry && expiry !== 'all') {
    batches = batches.filter(b => b.expiry_status === expiry);
  }
  res.json(batches);
});

// ---- Stock adjustments (expiry write-off / damage / loss / correction) ----
// Registered before '/:id' below — otherwise Express would match
// '/adjustments' against the ':id' wildcard first.

// GET /api/batches/adjustments - adjustment history for this store
router.get('/adjustments', (req, res) => {
  const { batch_id, adjustment_type } = req.query;
  let query = `
    SELECT sa.*, b.batch_no, i.name AS item_name, i.unit, u.full_name AS created_by_name
    FROM stock_adjustments sa
    JOIN batches b ON sa.batch_id = b.id
    JOIN items i ON b.item_id = i.id
    LEFT JOIN users u ON sa.created_by_user_id = u.id
    WHERE sa.store_id = ?
  `;
  const params = [req.session.storeId];
  if (batch_id) { query += ' AND sa.batch_id = ?'; params.push(batch_id); }
  if (adjustment_type) { query += ' AND sa.adjustment_type = ?'; params.push(adjustment_type); }
  query += ' ORDER BY sa.created_at DESC, sa.id DESC';

  res.json(db.prepare(query).all(...params));
});

// POST /api/batches/adjustments - write off quantity from a batch
router.post('/adjustments', requireRole('Pharmacist'), (req, res) => {
  const { batch_id, adjustment_type, quantity, reason } = req.body;

  if (!batch_id) return res.status(400).json({ error: 'batch_id is required' });
  if (!ADJUSTMENT_TYPES.includes(adjustment_type)) {
    return res.status(400).json({ error: `adjustment_type must be one of ${ADJUSTMENT_TYPES.join(', ')}` });
  }
  const qty = parseInt(quantity, 10);
  if (!Number.isFinite(qty) || qty <= 0) {
    return res.status(400).json({ error: 'quantity must be a positive number' });
  }

  const batch = db.prepare('SELECT * FROM batches WHERE id = ? AND store_id = ?').get(batch_id, req.session.storeId);
  if (!batch) return res.status(404).json({ error: 'Batch not found' });
  if (qty > batch.quantity) {
    return res.status(400).json({ error: `Cannot adjust ${qty} — only ${batch.quantity} unit(s) remain in this batch` });
  }

  const adjustmentId = db.transaction(() => {
    const info = db.prepare(`
      INSERT INTO stock_adjustments (store_id, batch_id, adjustment_type, quantity, reason, created_by_user_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(req.session.storeId, batch_id, adjustment_type, qty, reason || null, req.session.userId);

    db.prepare('UPDATE batches SET quantity = quantity - ? WHERE id = ?').run(qty, batch_id);

    return info.lastInsertRowid;
  })();

  logActivity(db, req.session.userId, 'stock_adjusted', 'batch', batch_id, { adjustment_type, quantity: qty, reason });
  res.json({ success: true, id: adjustmentId });
});

// GET /api/batches/:id
router.get('/:id', (req, res) => {
  const batch = db.prepare(`
    SELECT b.*, i.name AS item_name, i.unit, d.name AS distributor_name
    FROM batches b JOIN items i ON b.item_id = i.id
    LEFT JOIN distributors d ON b.distributor_id = d.id
    WHERE b.id = ? AND b.store_id = ?
  `).get(req.params.id, req.session.storeId);
  if (!batch) return res.status(404).json({ error: 'Batch not found' });
  res.json(batch);
});

module.exports = router;
