const express = require('express');
const db = require('../db/connection');
const { logActivity, generatePoNo } = require('../utils/helpers');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// A Purchase Order is a *request* out to a distributor — Draft while being
// built, Sent once issued, or Cancelled. It is deliberately NOT the same
// thing as a GRN (routes/purchases.js), which is the actual receipt of
// goods: one PO can be received against over several GRNs (partial
// deliveries are normal), or a GRN can happen with no PO at all (direct
// receiving, the original VEDA flow, stays fully supported —
// purchases.purchase_order_id is nullable). Accordingly "GRN status" here
// is always derived by comparing quantity_received to quantity_ordered
// across a PO's line items, never stored as its own column — storing it
// separately would just be a second place for the same fact to go stale
// (the same class of bug already hit once this session with doctor
// commission clawbacks, fixed by recomputing from source rows instead of
// mutating a running total).
function computeGrnStatus(items) {
  if (items.length === 0) return 'Pending';
  const totalOrdered = items.reduce((s, i) => s + i.quantity_ordered, 0);
  const totalReceived = items.reduce((s, i) => s + Math.min(i.quantity_received, i.quantity_ordered), 0);
  if (totalReceived <= 0) return 'Pending';
  if (totalReceived >= totalOrdered) return 'Fully Received';
  return 'Partial GRN';
}

function validatePoBody(body) {
  if (!body.distributor_id) return 'distributor_id is required';
  if (!Array.isArray(body.items) || body.items.length === 0) return 'At least one line item is required';
  for (const [i, line] of body.items.entries()) {
    const n = i + 1;
    if (!line.item_id) return `Line ${n}: item is required`;
    const qty = parseInt(line.quantity_ordered, 10);
    if (!Number.isFinite(qty) || qty <= 0) return `Line ${n}: quantity must be a positive number`;
  }
  return null;
}

// GET /api/purchase-orders - list, with the derived GRN status + item count.
// ?status=Draft|Sent|Cancelled  ?grn_status=Pending|Partial GRN|Fully Received
// ?distributor_id=
router.get('/', (req, res) => {
  const { status, grn_status, distributor_id } = req.query;

  let query = `
    SELECT po.*, d.name AS distributor_name,
      (SELECT COUNT(*) FROM purchase_order_items poi WHERE poi.purchase_order_id = po.id) AS item_count
    FROM purchase_orders po
    JOIN distributors d ON po.distributor_id = d.id
    WHERE po.store_id = ?
  `;
  const params = [req.session.storeId];
  if (status) { query += ' AND po.status = ?'; params.push(status); }
  if (distributor_id) { query += ' AND po.distributor_id = ?'; params.push(distributor_id); }
  query += ' ORDER BY po.po_date DESC, po.id DESC';

  const pos = db.prepare(query).all(...params);
  const itemsStmt = db.prepare('SELECT quantity_ordered, quantity_received FROM purchase_order_items WHERE purchase_order_id = ?');
  let result = pos.map(po => ({ ...po, grn_status: computeGrnStatus(itemsStmt.all(po.id)) }));
  if (grn_status) result = result.filter(po => po.grn_status === grn_status);

  res.json(result);
});

// GET /api/purchase-orders/:id - header + line items, each with its own
// derived received/pending quantity (drives the "Receive as GRN" screen).
router.get('/:id', (req, res) => {
  const po = db.prepare(`
    SELECT po.*, d.name AS distributor_name, d.gstin AS distributor_gstin, d.state AS distributor_state
    FROM purchase_orders po JOIN distributors d ON po.distributor_id = d.id
    WHERE po.id = ? AND po.store_id = ?
  `).get(req.params.id, req.session.storeId);
  if (!po) return res.status(404).json({ error: 'Purchase order not found' });

  const items = db.prepare(`
    SELECT poi.*, i.name AS item_name, i.unit, i.hsn_code, i.gst_rate AS item_gst_rate,
      (poi.quantity_ordered - MIN(poi.quantity_received, poi.quantity_ordered)) AS quantity_pending
    FROM purchase_order_items poi JOIN items i ON poi.item_id = i.id
    WHERE poi.purchase_order_id = ?
    ORDER BY poi.id
  `).all(req.params.id);

  const grns = db.prepare(`
    SELECT id, grn_no, grn_date, total_amount FROM purchases WHERE purchase_order_id = ? ORDER BY grn_date DESC
  `).all(req.params.id);

  res.json({ ...po, items, grn_status: computeGrnStatus(items), grns });
});

// POST /api/purchase-orders - create (always starts life as Draft; use
// PUT /:id/status to move it to Sent once it's ready to go out).
router.post('/', requireRole('Pharmacist', 'Accounts'), (req, res) => {
  const err = validatePoBody(req.body);
  if (err) return res.status(400).json({ error: err });

  const storeId = req.session.storeId;
  const distributor = db.prepare('SELECT * FROM distributors WHERE id = ? AND is_active = 1').get(req.body.distributor_id);
  if (!distributor) return res.status(400).json({ error: 'Distributor not found or inactive' });

  const lines = req.body.items.map(raw => {
    const quantity_ordered = parseInt(raw.quantity_ordered, 10);
    const rate = parseFloat(raw.rate) || 0;
    const gst_rate = parseFloat(raw.gst_rate) || 0;
    const taxable = round2(quantity_ordered * rate);
    const tax = round2(taxable * gst_rate / 100);
    return { item_id: raw.item_id, quantity_ordered, rate, gst_rate, taxable, tax, line_total: round2(taxable + tax) };
  });
  const taxableAmount = round2(lines.reduce((s, l) => s + l.taxable, 0));
  const taxAmount = round2(lines.reduce((s, l) => s + l.tax, 0));
  const totalAmount = round2(taxableAmount + taxAmount);

  const insertPo = db.prepare(`
    INSERT INTO purchase_orders (
      store_id, distributor_id, po_no, expected_date, notes,
      taxable_amount, tax_amount, total_amount, created_by_user_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertLine = db.prepare(`
    INSERT INTO purchase_order_items (purchase_order_id, item_id, quantity_ordered, rate, gst_rate, line_total)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const poId = db.transaction(() => {
    const poNo = generatePoNo(db, storeId);
    const info = insertPo.run(
      storeId, distributor.id, poNo, req.body.expected_date || null, req.body.notes || null,
      taxableAmount, taxAmount, totalAmount, req.session.userId
    );
    const newPoId = info.lastInsertRowid;
    lines.forEach(l => insertLine.run(newPoId, l.item_id, l.quantity_ordered, l.rate, l.gst_rate, l.line_total));
    return newPoId;
  })();

  logActivity(db, req.session.userId, 'po_created', 'purchase_order', poId, { distributor: distributor.name, total_amount: totalAmount });
  res.json({ success: true, id: poId, total_amount: totalAmount });
});

// PUT /api/purchase-orders/:id - edit header/items. Only while still Draft —
// once Sent, a distributor may already be acting on it, and once any GRN
// has been received against it the ordered quantities are the basis
// receiving math already depends on, so both are locked from here on
// (Cancel is still available via PUT /:id/status).
router.put('/:id', requireRole('Pharmacist', 'Accounts'), (req, res) => {
  const { id } = req.params;
  const po = db.prepare('SELECT * FROM purchase_orders WHERE id = ? AND store_id = ?').get(id, req.session.storeId);
  if (!po) return res.status(404).json({ error: 'Purchase order not found' });
  if (po.status !== 'Draft') return res.status(400).json({ error: 'Only a Draft purchase order can be edited' });

  const err = validatePoBody(req.body);
  if (err) return res.status(400).json({ error: err });

  const distributor = db.prepare('SELECT * FROM distributors WHERE id = ? AND is_active = 1').get(req.body.distributor_id);
  if (!distributor) return res.status(400).json({ error: 'Distributor not found or inactive' });

  const lines = req.body.items.map(raw => {
    const quantity_ordered = parseInt(raw.quantity_ordered, 10);
    const rate = parseFloat(raw.rate) || 0;
    const gst_rate = parseFloat(raw.gst_rate) || 0;
    const taxable = round2(quantity_ordered * rate);
    const tax = round2(taxable * gst_rate / 100);
    return { item_id: raw.item_id, quantity_ordered, rate, gst_rate, taxable, tax, line_total: round2(taxable + tax) };
  });
  const taxableAmount = round2(lines.reduce((s, l) => s + l.taxable, 0));
  const taxAmount = round2(lines.reduce((s, l) => s + l.tax, 0));
  const totalAmount = round2(taxableAmount + taxAmount);

  const insertLine = db.prepare(`
    INSERT INTO purchase_order_items (purchase_order_id, item_id, quantity_ordered, rate, gst_rate, line_total)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  db.transaction(() => {
    db.prepare('UPDATE purchase_orders SET distributor_id = ?, expected_date = ?, notes = ?, taxable_amount = ?, tax_amount = ?, total_amount = ? WHERE id = ?')
      .run(distributor.id, req.body.expected_date || null, req.body.notes || null, taxableAmount, taxAmount, totalAmount, id);
    db.prepare('DELETE FROM purchase_order_items WHERE purchase_order_id = ?').run(id);
    lines.forEach(l => insertLine.run(id, l.item_id, l.quantity_ordered, l.rate, l.gst_rate, l.line_total));
  })();

  logActivity(db, req.session.userId, 'po_updated', 'purchase_order', id, { total_amount: totalAmount });
  res.json({ success: true });
});

// PUT /api/purchase-orders/:id/status - Draft -> Sent -> Cancelled. Cancelling
// is allowed at any point before Fully Received (an already-partially-received
// PO can still be cancelled — the GRNs already recorded against it stand,
// only the still-outstanding quantity is written off).
router.put('/:id/status', requireRole('Pharmacist', 'Accounts'), (req, res) => {
  const { id } = req.params;
  const po = db.prepare('SELECT * FROM purchase_orders WHERE id = ? AND store_id = ?').get(id, req.session.storeId);
  if (!po) return res.status(404).json({ error: 'Purchase order not found' });

  const { status } = req.body;
  const allowed = { Draft: ['Sent', 'Cancelled'], Sent: ['Cancelled'], Cancelled: [] };
  if (!['Draft', 'Sent', 'Cancelled'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  if (!allowed[po.status].includes(status)) {
    return res.status(400).json({ error: `Cannot move a ${po.status} purchase order to ${status}` });
  }

  db.prepare('UPDATE purchase_orders SET status = ? WHERE id = ?').run(status, id);
  logActivity(db, req.session.userId, 'po_status_changed', 'purchase_order', id, { from: po.status, to: status });
  res.json({ success: true, status });
});

// DELETE /api/purchase-orders/:id - only a still-Draft, never-received PO
// can be removed outright; anything Sent (or with any GRN recorded) should
// be Cancelled instead so the paper trail stays intact.
router.delete('/:id', requireRole('Pharmacist', 'Accounts'), (req, res) => {
  const { id } = req.params;
  const po = db.prepare('SELECT * FROM purchase_orders WHERE id = ? AND store_id = ?').get(id, req.session.storeId);
  if (!po) return res.status(404).json({ error: 'Purchase order not found' });
  if (po.status !== 'Draft') return res.status(400).json({ error: 'Only a Draft purchase order can be deleted — cancel it instead' });

  db.transaction(() => {
    db.prepare('DELETE FROM purchase_order_items WHERE purchase_order_id = ?').run(id);
    db.prepare('DELETE FROM purchase_orders WHERE id = ?').run(id);
  })();
  logActivity(db, req.session.userId, 'po_deleted', 'purchase_order', id, null);
  res.json({ success: true });
});

module.exports = router;
