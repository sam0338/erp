const express = require('express');
const db = require('../db/connection');

const router = express.Router();

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function defaultDateRange(query) {
  const to = query.to || new Date().toISOString().slice(0, 10);
  const from = query.from || to.slice(0, 8) + '01'; // first of the same month as `to`
  return { from, to };
}

// GET /api/reports/gst-summary?from=YYYY-MM-DD&to=YYYY-MM-DD
// Output tax (from Completed sales) vs input tax (from purchases received)
// in the range, plus a simplified net-payable estimate. This is a
// reference figure for the operator, NOT a substitute for an actual GSTR
// filing — real GST set-off rules (head-wise CGST/SGST/IGST matching,
// reverse charge, ITC eligibility) are more involved than a flat subtraction.
router.get('/gst-summary', (req, res) => {
  const { from, to } = defaultDateRange(req.query);
  const storeId = req.session.storeId;

  const output = db.prepare(`
    SELECT COUNT(*) AS count,
      COALESCE(SUM(taxable_amount), 0) AS taxable_amount,
      COALESCE(SUM(cgst_amount), 0) AS cgst_amount,
      COALESCE(SUM(sgst_amount), 0) AS sgst_amount,
      COALESCE(SUM(igst_amount), 0) AS igst_amount,
      COALESCE(SUM(total_amount), 0) AS total_amount
    FROM sales
    WHERE store_id = ? AND status = 'Completed' AND date(sale_date) BETWEEN ? AND ?
  `).get(storeId, from, to);

  const input = db.prepare(`
    SELECT COUNT(*) AS count,
      COALESCE(SUM(taxable_amount), 0) AS taxable_amount,
      COALESCE(SUM(cgst_amount), 0) AS cgst_amount,
      COALESCE(SUM(sgst_amount), 0) AS sgst_amount,
      COALESCE(SUM(igst_amount), 0) AS igst_amount,
      COALESCE(SUM(total_amount), 0) AS total_amount
    FROM purchases
    WHERE store_id = ? AND invoice_date BETWEEN ? AND ?
  `).get(storeId, from, to);

  const outputTax = round2(output.cgst_amount + output.sgst_amount + output.igst_amount);
  const inputTax = round2(input.cgst_amount + input.sgst_amount + input.igst_amount);

  res.json({
    from, to,
    output,
    input,
    output_tax: outputTax,
    input_tax: inputTax,
    net_tax_payable_estimate: round2(outputTax - inputTax)
  });
});

// GET /api/reports/expiry?days=90 - batches expiring within `days` (already-expired
// ones included), soonest first, with value at cost and at MRP so the
// operator can see what's actually at risk, not just how many packs.
router.get('/expiry', (req, res) => {
  const days = parseInt(req.query.days, 10) || 90;
  const storeId = req.session.storeId;

  const rows = db.prepare(`
    SELECT b.*, i.name AS item_name, i.unit, i.schedule,
      CASE WHEN b.expiry_date < date('now') THEN 'expired' ELSE 'near' END AS expiry_status
    FROM batches b JOIN items i ON b.item_id = i.id
    WHERE b.store_id = ? AND b.quantity > 0 AND b.expiry_date <= date('now', '+' || ? || ' day')
    ORDER BY b.expiry_date ASC
  `).all(storeId, days);

  const withValue = rows.map(b => ({
    ...b,
    value_at_cost: round2(b.quantity * b.purchase_rate),
    value_at_mrp: round2(b.quantity * b.mrp)
  }));

  const totals = withValue.reduce((acc, b) => {
    acc.quantity += b.quantity;
    acc.value_at_cost = round2(acc.value_at_cost + b.value_at_cost);
    acc.value_at_mrp = round2(acc.value_at_mrp + b.value_at_mrp);
    return acc;
  }, { quantity: 0, value_at_cost: 0, value_at_mrp: 0 });

  res.json({ days, batches: withValue, totals });
});

// GET /api/reports/low-stock - active items at or below their reorder level,
// with how much is needed to top back up to that level (not a smarter
// reorder-point/lead-time forecast — just "how far below threshold").
router.get('/low-stock', (req, res) => {
  const storeId = req.session.storeId;

  const rows = db.prepare(`
    SELECT i.id, i.name, i.generic_name, i.category, i.unit, i.reorder_level,
      COALESCE((SELECT SUM(b.quantity) FROM batches b WHERE b.item_id = i.id AND b.store_id = ?), 0) AS total_stock
    FROM items i
    WHERE i.is_active = 1
  `).all(storeId);

  const lowStock = rows
    .filter(i => i.total_stock <= i.reorder_level)
    .map(i => ({ ...i, qty_to_reorder_level: Math.max(i.reorder_level - i.total_stock, 0) }))
    .sort((a, b) => (a.total_stock - a.reorder_level) - (b.total_stock - b.reorder_level));

  res.json({ items: lowStock });
});

// GET /api/reports/sales-register?from=YYYY-MM-DD&to=YYYY-MM-DD
// The date-ranged sales list plus aggregate/payment-mode totals — a
// formatted register for accounting/audit, distinct from the operational
// Sales History list on the POS page (same underlying data, different lens).
router.get('/sales-register', (req, res) => {
  const { from, to } = defaultDateRange(req.query);
  const storeId = req.session.storeId;

  const sales = db.prepare(`
    SELECT s.*, (SELECT COUNT(*) FROM sale_items si WHERE si.sale_id = s.id) AS item_count
    FROM sales s
    WHERE s.store_id = ? AND date(s.sale_date) BETWEEN ? AND ?
    ORDER BY s.sale_date ASC
  `).all(storeId, from, to);

  const completed = sales.filter(s => s.status === 'Completed');
  const cancelled = sales.filter(s => s.status === 'Cancelled');

  const totals = completed.reduce((acc, s) => {
    acc.taxable_amount = round2(acc.taxable_amount + s.taxable_amount);
    acc.cgst_amount = round2(acc.cgst_amount + s.cgst_amount);
    acc.sgst_amount = round2(acc.sgst_amount + s.sgst_amount);
    acc.discount_amount = round2(acc.discount_amount + s.discount_amount);
    acc.patient_incentive_amount = round2(acc.patient_incentive_amount + s.patient_incentive_amount);
    acc.total_amount = round2(acc.total_amount + s.total_amount);
    acc.by_payment_mode[s.payment_mode] = round2((acc.by_payment_mode[s.payment_mode] || 0) + s.total_amount);
    return acc;
  }, {
    taxable_amount: 0, cgst_amount: 0, sgst_amount: 0, discount_amount: 0,
    patient_incentive_amount: 0, total_amount: 0, by_payment_mode: {}
  });

  res.json({
    from, to,
    sales,
    completed_count: completed.length,
    cancelled_count: cancelled.length,
    totals
  });
});

module.exports = router;
