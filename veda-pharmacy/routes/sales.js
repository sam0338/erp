const express = require('express');
const db = require('../db/connection');
const { logActivity, generateInvoiceNo, generateReturnNo } = require('../utils/helpers');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

const RX_SCHEDULES = ['H1', 'X'];

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// A stock-taking error, distinct from a plain validation error — carries
// enough detail for the UI to say exactly which line came up short.
class InsufficientStockError extends Error {
  constructor(itemName, requested, available) {
    super(`Only ${available} unit(s) of "${itemName}" in stock (requested ${requested})`);
    this.name = 'InsufficientStockError';
  }
}

// FEFO: pick the soonest-expiring, non-expired batches first, and split
// the requested quantity across as many lots as it takes to cover it.
// Must run inside the same transaction as the stock deduction below it —
// better-sqlite3 transactions are synchronous, so there's no race between
// reading availability here and writing it back a few lines later.
function allocateFefo(itemId, storeId, quantity) {
  const batches = db.prepare(`
    SELECT * FROM batches
    WHERE item_id = ? AND store_id = ? AND quantity > 0 AND expiry_date >= date('now')
    ORDER BY expiry_date ASC, id ASC
  `).all(itemId, storeId);

  const allocations = [];
  let remaining = quantity;
  for (const batch of batches) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, batch.quantity);
    allocations.push({ batch, quantity: take });
    remaining -= take;
  }
  if (remaining > 0) {
    const available = quantity - remaining;
    return { allocations: null, shortfall: { requested: quantity, available } };
  }
  return { allocations, shortfall: null };
}

// Indian pharmacy retail detail that's easy to get backwards: the MRP
// printed on the strip is GST-INCLUSIVE (unlike a distributor's purchase
// rate, which is exclusive — see routes/purchases.js). So the customer
// pays exactly qty * rate, and the tax invoice back-calculates the
// taxable value and GST out of that inclusive amount rather than adding
// GST on top of it.
function computeInclusiveChunk(quantity, unitRate, gstRate) {
  const gross = round2(quantity * unitRate);
  const tax = round2(gross * gstRate / (100 + gstRate));
  const taxable = round2(gross - tax); // subtraction, not independent rounding — guarantees taxable + tax === gross
  const cgst = round2(tax / 2);
  const sgst = round2(tax - cgst);
  return { gross, taxable, cgst, sgst };
}

function validateSaleBody(body) {
  if (!Array.isArray(body.items) || body.items.length === 0) return 'At least one item is required';
  for (const [i, line] of body.items.entries()) {
    const n = i + 1;
    if (!line.item_id) return `Line ${n}: item is required`;
    const qty = parseInt(line.quantity, 10);
    if (!Number.isFinite(qty) || qty <= 0) return `Line ${n}: quantity must be a positive number`;
  }
  if (body.payment_mode && !['Cash', 'UPI', 'Card', 'Credit'].includes(body.payment_mode)) {
    return 'Invalid payment_mode';
  }
  if (body.patient_incentive_pct !== undefined) {
    const pct = parseFloat(body.patient_incentive_pct);
    if (isNaN(pct) || pct < 0 || pct > 100) return 'patient_incentive_pct must be between 0 and 100';
  }
  return null;
}

// GET /api/sales - list, with optional filters
// ?payment_status=&from=YYYY-MM-DD&to=YYYY-MM-DD&q=customer name/phone/invoice
router.get('/', (req, res) => {
  const { payment_status, from, to, q } = req.query;
  let query = `
    SELECT s.*, (SELECT COUNT(*) FROM sale_items si WHERE si.sale_id = s.id) AS item_count
    FROM sales s
    WHERE s.store_id = ?
  `;
  const params = [req.session.storeId];
  if (payment_status) { query += ' AND s.payment_status = ?'; params.push(payment_status); }
  if (from) { query += ' AND date(s.sale_date) >= ?'; params.push(from); }
  if (to) { query += ' AND date(s.sale_date) <= ?'; params.push(to); }
  if (q) {
    query += ' AND (s.customer_name LIKE ? OR s.customer_phone LIKE ? OR s.invoice_no LIKE ?)';
    const like = `%${q}%`;
    params.push(like, like, like);
  }
  query += ' ORDER BY s.id DESC';

  res.json(db.prepare(query).all(...params));
});

// GET /api/sales/:id - header + line items + prescription (if any)
router.get('/:id', (req, res) => {
  const sale = db.prepare(`
    SELECT s.*, d.name AS doctor_name
    FROM sales s LEFT JOIN doctors d ON s.doctor_id = d.id
    WHERE s.id = ? AND s.store_id = ?
  `).get(req.params.id, req.session.storeId);
  if (!sale) return res.status(404).json({ error: 'Sale not found' });

  const items = db.prepare(`
    SELECT si.*, i.name AS item_name, i.unit, i.schedule, b.batch_no, b.expiry_date,
      COALESCE((SELECT SUM(sri.quantity) FROM sale_return_items sri WHERE sri.sale_item_id = si.id), 0) AS returned_quantity
    FROM sale_items si
    JOIN items i ON si.item_id = i.id
    JOIN batches b ON si.batch_id = b.id
    WHERE si.sale_id = ?
    ORDER BY si.id
  `).all(sale.id);

  const prescription = sale.prescription_id
    ? db.prepare('SELECT * FROM prescriptions WHERE id = ?').get(sale.prescription_id)
    : null;

  const returns = db.prepare(`
    SELECT sr.*, u.full_name AS created_by_name
    FROM sale_returns sr LEFT JOIN users u ON sr.created_by_user_id = u.id
    WHERE sr.sale_id = ?
    ORDER BY sr.id
  `).all(sale.id).map(r => ({
    ...r,
    items: db.prepare(`
      SELECT sri.*, i.name AS item_name
      FROM sale_return_items sri
      JOIN sale_items si ON sri.sale_item_id = si.id
      JOIN items i ON si.item_id = i.id
      WHERE sri.sale_return_id = ?
    `).all(r.id)
  }));

  res.json({ ...sale, items, prescription, returns });
});

// POST /api/sales - ring up a sale: FEFO-allocates stock, computes
// MRP-inclusive GST per line, optionally records a prescription for any
// Schedule H1/X items, and decrements every batch it draws from — all in
// one transaction, so a mid-sale stock shortfall rolls back cleanly with
// nothing partially sold.
router.post('/', requireRole('Cashier', 'Pharmacist'), (req, res) => {
  const err = validateSaleBody(req.body);
  if (err) return res.status(400).json({ error: err });

  const storeId = req.session.storeId;
  const itemIds = [...new Set(req.body.items.map(l => l.item_id))];
  const placeholders = itemIds.map(() => '?').join(',');
  const items = db.prepare(`SELECT * FROM items WHERE id IN (${placeholders}) AND is_active = 1`).all(...itemIds);
  const itemsById = Object.fromEntries(items.map(i => [String(i.id), i]));

  const missing = itemIds.filter(id => !itemsById[String(id)]);
  if (missing.length > 0) return res.status(400).json({ error: 'One or more items could not be found' });

  const rxItems = req.body.items
    .map(l => itemsById[String(l.item_id)])
    .filter(i => RX_SCHEDULES.includes(i.schedule));
  const rxNames = [...new Set(rxItems.map(i => i.name))];

  const prescriptionInput = req.body.prescription;
  if (rxNames.length > 0 && (!prescriptionInput || !prescriptionInput.patient_name || !prescriptionInput.doctor_name)) {
    return res.status(400).json({
      error: `Prescription (patient name + doctor name) is required to sell: ${rxNames.join(', ')}`
    });
  }

  const insertSale = db.prepare(`
    INSERT INTO sales (
      store_id, invoice_no, customer_name, customer_phone, prescription_id,
      payment_mode, payment_status, created_by_user_id
    ) VALUES (?, ?, ?, ?, ?, ?, 'Paid', ?)
  `);
  const updateSaleTotals = db.prepare(`
    UPDATE sales SET taxable_amount = ?, cgst_amount = ?, sgst_amount = ?,
      discount_amount = ?, patient_incentive_pct = ?, patient_incentive_amount = ?,
      round_off = ?, total_amount = ?,
      doctor_id = ?, doctor_commission_pct = ?, doctor_commission_amount = ?
    WHERE id = ?
  `);
  const insertSaleItem = db.prepare(`
    INSERT INTO sale_items (
      sale_id, item_id, batch_id, quantity, sale_rate, mrp, discount_pct,
      gst_rate, taxable_amount, cgst_amount, sgst_amount, igst_amount, line_total
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
  `);
  const insertPrescription = db.prepare(`
    INSERT INTO prescriptions (patient_name, patient_age, patient_gender, doctor_name, doctor_id, doctor_reg_no, rx_ref_no, rx_date, notes, created_by_user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const decrementBatch = db.prepare('UPDATE batches SET quantity = quantity - ? WHERE id = ?');

  // A prescribing doctor only accrues commission when they're a registered,
  // active row in the doctors table — see the note on that table in
  // db/schema.sql. Free-typing a name on the Rx panel that doesn't match a
  // registered doctor (prescriptionInput.doctor_id absent) accrues nothing.
  let referredDoctor = null;
  if (prescriptionInput && prescriptionInput.doctor_id) {
    referredDoctor = db.prepare('SELECT * FROM doctors WHERE id = ? AND is_active = 1').get(prescriptionInput.doctor_id) || null;
  }

  try {
    const saleId = db.transaction(() => {
      let prescriptionId = null;
      if (prescriptionInput && prescriptionInput.patient_name && prescriptionInput.doctor_name) {
        const pInfo = insertPrescription.run(
          prescriptionInput.patient_name.trim(), prescriptionInput.patient_age || null,
          prescriptionInput.patient_gender || null, prescriptionInput.doctor_name.trim(),
          referredDoctor ? referredDoctor.id : null,
          prescriptionInput.doctor_reg_no || null, prescriptionInput.rx_ref_no || null,
          prescriptionInput.rx_date || null, prescriptionInput.notes || null, req.session.userId
        );
        prescriptionId = pInfo.lastInsertRowid;
      }

      // Insert the header first, with placeholder (zero) totals — sale_items
      // rows need a real sale_id to insert against (it's NOT NULL), but the
      // header's totals aren't known until every line has been allocated
      // and priced. Both get reconciled in the UPDATE at the end.
      const invoiceNo = generateInvoiceNo(db, storeId);
      const saleInfo = insertSale.run(
        storeId, invoiceNo, req.body.customer_name || null, req.body.customer_phone || null, prescriptionId,
        req.body.payment_mode || 'Cash', req.session.userId
      );
      const newSaleId = saleInfo.lastInsertRowid;

      const lineTotals = [];
      for (const line of req.body.items) {
        const item = itemsById[String(line.item_id)];
        const qty = parseInt(line.quantity, 10);
        const discountPct = parseFloat(line.discount_pct) || 0;

        const { allocations, shortfall } = allocateFefo(item.id, storeId, qty);
        if (!allocations) {
          throw new InsufficientStockError(item.name, shortfall.requested, shortfall.available);
        }

        for (const alloc of allocations) {
          const unitRate = round2(alloc.batch.mrp * (1 - discountPct / 100));
          const { gross, taxable, cgst, sgst } = computeInclusiveChunk(alloc.quantity, unitRate, item.gst_rate);

          insertSaleItem.run(
            newSaleId, item.id, alloc.batch.id, alloc.quantity, unitRate, alloc.batch.mrp, discountPct,
            item.gst_rate, taxable, cgst, sgst, gross
          );
          decrementBatch.run(alloc.quantity, alloc.batch.id);

          lineTotals.push({ gross, taxable, cgst, sgst });
        }
      }

      const taxableAmount = round2(lineTotals.reduce((s, l) => s + l.taxable, 0));
      const cgstAmount = round2(lineTotals.reduce((s, l) => s + l.cgst, 0));
      const sgstAmount = round2(lineTotals.reduce((s, l) => s + l.sgst, 0));
      const grossSum = round2(lineTotals.reduce((s, l) => s + l.gross, 0));
      const discountAmount = round2(parseFloat(req.body.discount_amount) || 0);

      // Patient loyalty/incentive discount — a % of the gross, same
      // reduces-what-the-patient-pays treatment as discount_amount, just
      // tracked as its own figure so reporting can tell the two apart.
      const patientIncentivePct = round2(parseFloat(req.body.patient_incentive_pct) || 0);
      const patientIncentiveAmount = round2(grossSum * patientIncentivePct / 100);

      const beforeRounding = grossSum - discountAmount - patientIncentiveAmount;
      const totalAmount = Math.round(beforeRounding);
      const roundOff = round2(totalAmount - beforeRounding);

      // Doctor commission is computed off the final total but — unlike the
      // discount/incentive above — does NOT reduce it. The patient pays
      // totalAmount either way; this is a separate liability the pharmacy
      // owes the doctor, not visible on the customer's receipt math.
      const doctorId = referredDoctor ? referredDoctor.id : null;
      const doctorCommissionPct = referredDoctor ? referredDoctor.default_commission_pct : 0;
      const doctorCommissionAmount = referredDoctor ? round2(totalAmount * doctorCommissionPct / 100) : 0;

      updateSaleTotals.run(
        taxableAmount, cgstAmount, sgstAmount, discountAmount, patientIncentivePct, patientIncentiveAmount,
        roundOff, totalAmount, doctorId, doctorCommissionPct, doctorCommissionAmount, newSaleId
      );

      return newSaleId;
    })();

    logActivity(db, req.session.userId, 'sale_created', 'sale', saleId, { total: req.body.items.length });
    const sale = db.prepare('SELECT invoice_no, total_amount FROM sales WHERE id = ?').get(saleId);
    res.json({ success: true, id: saleId, invoice_no: sale.invoice_no, total_amount: sale.total_amount });
  } catch (e) {
    if (e instanceof InsufficientStockError) {
      return res.status(400).json({ error: e.message });
    }
    res.status(400).json({ error: e.message });
  }
});

// POST /api/sales/:id/returns - process a partial-line return: restores
// stock to the exact batch each returned unit came from, records the
// return as its own header+lines (the original sale is never mutated —
// see the note on sale_returns in db/schema.sql), and proportionally
// claws back any accrued doctor commission on the refunded portion, using
// the sale's original, immutable total_amount as the basis so the math
// stays correct across multiple partial returns over time.
router.post('/:id/returns', requireRole('Cashier', 'Pharmacist'), (req, res) => {
  const { id } = req.params;
  const sale = db.prepare('SELECT * FROM sales WHERE id = ? AND store_id = ?').get(id, req.session.storeId);
  if (!sale) return res.status(404).json({ error: 'Sale not found' });
  if (sale.status === 'Cancelled') return res.status(400).json({ error: 'This sale was cancelled — there is nothing left to return' });
  if (sale.status === 'Returned') return res.status(400).json({ error: 'This sale has already been fully returned' });
  if (!Array.isArray(req.body.items) || req.body.items.length === 0) {
    return res.status(400).json({ error: 'At least one line is required' });
  }

  const saleItems = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(id);
  const saleItemsById = Object.fromEntries(saleItems.map(si => [si.id, si]));

  const lines = [];
  for (const [i, line] of req.body.items.entries()) {
    const n = i + 1;
    const saleItem = saleItemsById[line.sale_item_id];
    if (!saleItem) return res.status(400).json({ error: `Line ${n}: not a line item on this sale` });
    const qty = parseInt(line.quantity, 10);
    if (!Number.isFinite(qty) || qty <= 0) return res.status(400).json({ error: `Line ${n}: quantity must be a positive number` });

    const alreadyReturned = db.prepare(
      'SELECT COALESCE(SUM(quantity), 0) as q FROM sale_return_items WHERE sale_item_id = ?'
    ).get(saleItem.id).q;
    const remaining = saleItem.quantity - alreadyReturned;
    if (qty > remaining) {
      return res.status(400).json({ error: `Line ${n}: only ${remaining} unit(s) remain returnable on this line` });
    }

    lines.push({ saleItem, qty, refund: round2(saleItem.line_total * qty / saleItem.quantity) });
  }

  const refundAmount = round2(lines.reduce((s, l) => s + l.refund, 0));

  try {
    const returnId = db.transaction(() => {
      const returnNo = generateReturnNo(db, sale.store_id);
      const info = db.prepare(`
        INSERT INTO sale_returns (sale_id, store_id, return_no, refund_amount, reason, created_by_user_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(id, sale.store_id, returnNo, refundAmount, req.body.reason || null, req.session.userId);
      const newReturnId = info.lastInsertRowid;

      lines.forEach(l => {
        db.prepare(`
          INSERT INTO sale_return_items (sale_return_id, sale_item_id, quantity, refund_amount)
          VALUES (?, ?, ?, ?)
        `).run(newReturnId, l.saleItem.id, l.qty, l.refund);
        db.prepare('UPDATE batches SET quantity = quantity + ? WHERE id = ?').run(l.qty, l.saleItem.batch_id);
      });

      // Recomputed from scratch each time using the fixed original rate
      // (doctor_commission_pct is a checkout-time snapshot, never mutated —
      // see routes/doctors.js) against the net (non-returned) sale value.
      // Deriving it this way instead of repeatedly shaving a percentage off
      // the CURRENT commission_amount matters: two returns covering 40%
      // then the remaining 60% of a sale must zero the commission out
      // completely, not compound down to 40% of 60% of the original.
      // Skipped once commission_paid_at is set: the doctor's already been paid out
      // for this sale (see routes/doctors.js POST /:id/pay-commission), so silently
      // shrinking doctor_commission_amount here would understate what was actually
      // paid without ever getting the money back — that reconciliation is a manual
      // call for the operator, not something to automate.
      if (sale.doctor_commission_pct > 0 && sale.total_amount > 0 && !sale.commission_paid_at) {
        const totalRefunded = db.prepare(
          'SELECT COALESCE(SUM(refund_amount), 0) as r FROM sale_returns WHERE sale_id = ?'
        ).get(id).r;
        const netSaleValue = Math.max(0, sale.total_amount - totalRefunded);
        const newCommission = round2(netSaleValue * sale.doctor_commission_pct / 100);
        db.prepare('UPDATE sales SET doctor_commission_amount = ? WHERE id = ?').run(newCommission, id);
      }

      // If every line is now fully returned, the sale is done.
      const stillOutstanding = db.prepare(`
        SELECT COUNT(*) as c FROM sale_items si
        WHERE si.sale_id = ? AND si.quantity > COALESCE((SELECT SUM(sri.quantity) FROM sale_return_items sri WHERE sri.sale_item_id = si.id), 0)
      `).get(id).c;
      if (stillOutstanding === 0) {
        db.prepare("UPDATE sales SET status = 'Returned' WHERE id = ?").run(id);
      }

      return newReturnId;
    })();

    logActivity(db, req.session.userId, 'sale_return_created', 'sale', id, { returnId, refundAmount });
    const ret = db.prepare('SELECT return_no, refund_amount FROM sale_returns WHERE id = ?').get(returnId);
    res.json({ success: true, id: returnId, return_no: ret.return_no, refund_amount: ret.refund_amount });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// PUT /api/sales/:id/cancel - void a sale and restore every batch it drew from
router.put('/:id/cancel', requireRole('Pharmacist'), (req, res) => {
  const { id } = req.params;
  const sale = db.prepare('SELECT * FROM sales WHERE id = ? AND store_id = ?').get(id, req.session.storeId);
  if (!sale) return res.status(404).json({ error: 'Sale not found' });
  if (sale.status === 'Cancelled') return res.status(400).json({ error: 'Sale is already cancelled' });

  // A full cancel restores every sale_item's ORIGINAL quantity. If any
  // partial return already ran, part of that quantity is already back in
  // the batch — cancelling on top would double-restore it. Simplest safe
  // fix: once any return exists, the return flow is the only way to give
  // back the rest (it already tracks per-line remaining quantity correctly).
  const returnCount = db.prepare('SELECT COUNT(*) as c FROM sale_returns WHERE sale_id = ?').get(id).c;
  if (returnCount > 0) {
    return res.status(400).json({
      error: 'This sale has return(s) recorded against it — cancel is not available. Process the remaining quantity as a return instead.'
    });
  }

  const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(id);

  db.transaction(() => {
    items.forEach(si => {
      db.prepare('UPDATE batches SET quantity = quantity + ? WHERE id = ?').run(si.quantity, si.batch_id);
    });
    db.prepare("UPDATE sales SET status = 'Cancelled' WHERE id = ?").run(id);
  })();

  logActivity(db, req.session.userId, 'sale_cancelled', 'sale', id, { invoice_no: sale.invoice_no });
  res.json({ success: true });
});

module.exports = router;
