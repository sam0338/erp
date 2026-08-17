const express = require('express');
const db = require('../db/connection');
const { logActivity, generateGrnNo } = require('../utils/helpers');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// Builds the tax/total figures for one GRN line, splitting GST into
// CGST+SGST (same state as the receiving store — the common case for a
// small pharmacy's local distributor) or IGST (distributor in a different
// state). Free-scheme quantity adds to stock but is never taxed.
function computeLine(raw, sameState) {
  const quantity = parseInt(raw.quantity, 10);
  const freeQuantity = parseInt(raw.free_quantity, 10) || 0;
  const purchaseRate = parseFloat(raw.purchase_rate);
  const mrp = parseFloat(raw.mrp);
  const discountPct = parseFloat(raw.discount_pct) || 0;
  const gstRate = parseFloat(raw.gst_rate) || 0;

  const gross = quantity * purchaseRate;
  const taxableAmount = round2(gross * (1 - discountPct / 100));
  const taxAmount = round2(taxableAmount * gstRate / 100);
  const cgstAmount = sameState ? round2(taxAmount / 2) : 0;
  const sgstAmount = sameState ? round2(taxAmount - cgstAmount) : 0;
  const igstAmount = sameState ? 0 : taxAmount;
  const lineTotal = round2(taxableAmount + taxAmount);

  return {
    item_id: raw.item_id,
    batch_no: String(raw.batch_no || '').trim(),
    mfg_date: raw.mfg_date || null,
    expiry_date: raw.expiry_date,
    quantity, freeQuantity, purchaseRate, mrp, discountPct, gstRate,
    taxableAmount, cgstAmount, sgstAmount, igstAmount, lineTotal
  };
}

function validatePurchaseBody(body) {
  if (!body.distributor_id) return 'distributor_id is required';
  if (!body.invoice_no || !String(body.invoice_no).trim()) return 'invoice_no is required';
  if (!body.invoice_date) return 'invoice_date is required';
  if (!Array.isArray(body.items) || body.items.length === 0) return 'At least one line item is required';

  for (const [i, line] of body.items.entries()) {
    const n = i + 1;
    if (!line.item_id) return `Line ${n}: item is required`;
    if (!line.batch_no || !String(line.batch_no).trim()) return `Line ${n}: batch no. is required`;
    if (!line.expiry_date) return `Line ${n}: expiry date is required`;
    if (!Number.isFinite(parseInt(line.quantity, 10)) || parseInt(line.quantity, 10) <= 0) return `Line ${n}: quantity must be a positive number`;
    if (!Number.isFinite(parseFloat(line.purchase_rate)) || parseFloat(line.purchase_rate) < 0) return `Line ${n}: purchase rate must be a non-negative number`;
    if (!Number.isFinite(parseFloat(line.mrp)) || parseFloat(line.mrp) < 0) return `Line ${n}: MRP must be a non-negative number`;
  }
  return null;
}

// GET /api/purchases - list, with optional filters
// ?distributor_id=&payment_status=&from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/', (req, res) => {
  const { distributor_id, payment_status, from, to } = req.query;

  let query = `
    SELECT p.*, d.name AS distributor_name,
      (SELECT COUNT(*) FROM purchase_items pi WHERE pi.purchase_id = p.id) AS item_count
    FROM purchases p
    JOIN distributors d ON p.distributor_id = d.id
    WHERE p.store_id = ?
  `;
  const params = [req.session.storeId];

  if (distributor_id) { query += ' AND p.distributor_id = ?'; params.push(distributor_id); }
  if (payment_status) { query += ' AND p.payment_status = ?'; params.push(payment_status); }
  if (from) { query += ' AND p.invoice_date >= ?'; params.push(from); }
  if (to) { query += ' AND p.invoice_date <= ?'; params.push(to); }
  query += ' ORDER BY p.grn_date DESC, p.id DESC';

  res.json(db.prepare(query).all(...params));
});

// GET /api/purchases/:id - header + line items
router.get('/:id', (req, res) => {
  const purchase = db.prepare(`
    SELECT p.*, d.name AS distributor_name, d.gstin AS distributor_gstin
    FROM purchases p JOIN distributors d ON p.distributor_id = d.id
    WHERE p.id = ?
  `).get(req.params.id);
  if (!purchase) return res.status(404).json({ error: 'Purchase not found' });

  const items = db.prepare(`
    SELECT pi.*, i.name AS item_name, i.unit
    FROM purchase_items pi JOIN items i ON pi.item_id = i.id
    WHERE pi.purchase_id = ?
    ORDER BY pi.id
  `).all(req.params.id);

  res.json({ ...purchase, items });
});

// POST /api/purchases - create a GRN: header + line items + the batches those lines put into stock.
// An optional purchase_order_id links this receipt back to an open PO (see
// routes/purchase-orders.js) — quantity_received on each matching PO line
// is bumped by however much of that item this GRN actually received, which
// is what drives the PO's derived GRN status (Pending/Partial/Fully
// Received). Receiving with no purchase_order_id at all — the original
// VEDA flow — stays fully supported; nothing here requires a PO to exist.
router.post('/', requireRole('Pharmacist', 'Accounts'), (req, res) => {
  const err = validatePurchaseBody(req.body);
  if (err) return res.status(400).json({ error: err });

  const storeId = req.session.storeId;
  const store = db.prepare('SELECT * FROM stores WHERE id = ?').get(storeId);
  const distributor = db.prepare('SELECT * FROM distributors WHERE id = ? AND is_active = 1').get(req.body.distributor_id);
  if (!distributor) return res.status(400).json({ error: 'Distributor not found or inactive' });

  let purchaseOrder = null;
  if (req.body.purchase_order_id) {
    purchaseOrder = db.prepare(
      "SELECT * FROM purchase_orders WHERE id = ? AND store_id = ? AND status != 'Cancelled'"
    ).get(req.body.purchase_order_id, storeId);
    if (!purchaseOrder) return res.status(400).json({ error: 'Purchase order not found or cancelled' });
  }

  const sameState = !store.state || !distributor.state ||
    store.state.trim().toLowerCase() === distributor.state.trim().toLowerCase();

  const lines = req.body.items.map(raw => computeLine(raw, sameState));

  const taxableAmount = round2(lines.reduce((s, l) => s + l.taxableAmount, 0));
  const cgstAmount = round2(lines.reduce((s, l) => s + l.cgstAmount, 0));
  const sgstAmount = round2(lines.reduce((s, l) => s + l.sgstAmount, 0));
  const igstAmount = round2(lines.reduce((s, l) => s + l.igstAmount, 0));
  const discountAmount = round2(parseFloat(req.body.discount_amount) || 0);
  const beforeRounding = taxableAmount + cgstAmount + sgstAmount + igstAmount - discountAmount;
  const totalAmount = Math.round(beforeRounding);
  const roundOff = round2(totalAmount - beforeRounding);

  const insertPurchase = db.prepare(`
    INSERT INTO purchases (
      store_id, distributor_id, purchase_order_id, invoice_no, invoice_date, grn_no, grn_date,
      taxable_amount, cgst_amount, sgst_amount, igst_amount,
      discount_amount, round_off, total_amount, notes, created_by_user_id
    ) VALUES (?, ?, ?, ?, ?, ?, date('now'), ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertLine = db.prepare(`
    INSERT INTO purchase_items (
      purchase_id, item_id, batch_no, mfg_date, expiry_date, quantity, free_quantity,
      purchase_rate, mrp, discount_pct, gst_rate, taxable_amount, cgst_amount, sgst_amount, igst_amount, line_total
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertBatch = db.prepare(`
    INSERT INTO batches (
      item_id, store_id, batch_no, mfg_date, expiry_date, quantity,
      purchase_rate, mrp, purchase_item_id, distributor_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  // Bumps the matching PO line's quantity_received — matched by item_id
  // within this PO, since one GRN line always maps to a single item.
  // Deliberately not capped at quantity_ordered: an over-delivery still
  // needs to be recorded as received stock, it just leaves the PO's
  // derived status at "Fully Received" rather than pretending the extra
  // units don't exist (see computeGrnStatus in routes/purchase-orders.js).
  const bumpPoReceived = db.prepare(`
    UPDATE purchase_order_items SET quantity_received = quantity_received + ?
    WHERE purchase_order_id = ? AND item_id = ?
  `);

  try {
    const purchaseId = db.transaction(() => {
      const grnNo = generateGrnNo(db);
      const info = insertPurchase.run(
        storeId, distributor.id, purchaseOrder ? purchaseOrder.id : null,
        req.body.invoice_no.trim(), req.body.invoice_date, grnNo,
        taxableAmount, cgstAmount, sgstAmount, igstAmount, discountAmount, roundOff, totalAmount,
        req.body.notes || null, req.session.userId
      );
      const newPurchaseId = info.lastInsertRowid;

      lines.forEach(l => {
        const lineInfo = insertLine.run(
          newPurchaseId, l.item_id, l.batch_no, l.mfg_date, l.expiry_date, l.quantity, l.freeQuantity,
          l.purchaseRate, l.mrp, l.discountPct, l.gstRate, l.taxableAmount, l.cgstAmount, l.sgstAmount, l.igstAmount, l.lineTotal
        );
        insertBatch.run(
          l.item_id, storeId, l.batch_no, l.mfg_date, l.expiry_date, l.quantity + l.freeQuantity,
          l.purchaseRate, l.mrp, lineInfo.lastInsertRowid, distributor.id
        );
        if (purchaseOrder) bumpPoReceived.run(l.quantity, purchaseOrder.id, l.item_id);
      });

      return newPurchaseId;
    })();

    logActivity(db, req.session.userId, 'purchase_created', 'purchase', purchaseId, {
      distributor: distributor.name, invoice_no: req.body.invoice_no, total_amount: totalAmount
    });
    res.json({ success: true, id: purchaseId, total_amount: totalAmount });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) {
      return res.status(400).json({ error: `Invoice ${req.body.invoice_no} is already recorded for this distributor` });
    }
    if (String(e.message).includes('FOREIGN KEY')) {
      return res.status(400).json({ error: 'One or more items in this GRN could not be found' });
    }
    res.status(400).json({ error: e.message });
  }
});

// PUT /api/purchases/:id/payment - record a payment against this GRN
router.put('/:id/payment', requireRole('Accounts'), (req, res) => {
  const { id } = req.params;
  const purchase = db.prepare('SELECT * FROM purchases WHERE id = ?').get(id);
  if (!purchase) return res.status(404).json({ error: 'Purchase not found' });

  const amountPaid = parseFloat(req.body.amount_paid);
  if (!Number.isFinite(amountPaid) || amountPaid < 0) {
    return res.status(400).json({ error: 'amount_paid must be a non-negative number' });
  }

  const paymentStatus = amountPaid <= 0 ? 'Unpaid' : (amountPaid >= purchase.total_amount ? 'Paid' : 'Partial');

  // paid_at dates the payment credit for the distributor ledger (routes/distributors.js)
  // — cleared back to NULL if amount_paid is reset to 0, so an unpaid invoice
  // doesn't leave a stale payment entry behind. Uses SQLite's datetime('now')
  // rather than a JS timestamp to match created_at's format elsewhere (so
  // string sort order == chronological order in the ledger query).
  db.prepare(`
    UPDATE purchases SET amount_paid = ?, payment_status = ?, paid_at = ${amountPaid > 0 ? "datetime('now')" : 'NULL'}
    WHERE id = ?
  `).run(amountPaid, paymentStatus, id);
  logActivity(db, req.session.userId, 'purchase_payment_updated', 'purchase', id, { amountPaid, paymentStatus });
  res.json({ success: true, payment_status: paymentStatus });
});

module.exports = router;
