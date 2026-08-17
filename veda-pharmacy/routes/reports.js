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

// Returns processed within [from, to] (by return_date, NOT the original
// sale's date — matches how a GST credit note reduces liability in the
// period it's issued, not retroactively amends the original sale's
// period). taxable/cgst/sgst are derived proportionally from the
// originating sale_items row (SUM(x * returned_qty / original_qty)) since
// sale_return_items only stores the GST-inclusive refund_amount directly;
// total_amount here IS that stored refund_amount (no need to re-derive
// it — it's exact, unlike the proportional tax split which can drift by a
// paisa or two from rounding, hence the round2() on the way out).
function getReturnsSummary(storeId, from, to) {
  const row = db.prepare(`
    SELECT COUNT(DISTINCT sr.id) AS count,
      COALESCE(SUM(si.taxable_amount * sri.quantity * 1.0 / si.quantity), 0) AS taxable_amount,
      COALESCE(SUM(si.cgst_amount * sri.quantity * 1.0 / si.quantity), 0) AS cgst_amount,
      COALESCE(SUM(si.sgst_amount * sri.quantity * 1.0 / si.quantity), 0) AS sgst_amount,
      COALESCE(SUM(sri.refund_amount), 0) AS total_amount
    FROM sale_return_items sri
    JOIN sale_returns sr ON sri.sale_return_id = sr.id
    JOIN sale_items si ON sri.sale_item_id = si.id
    WHERE sr.store_id = ? AND date(sr.return_date) BETWEEN ? AND ?
  `).get(storeId, from, to);

  return {
    count: row.count,
    taxable_amount: round2(row.taxable_amount),
    cgst_amount: round2(row.cgst_amount),
    sgst_amount: round2(row.sgst_amount),
    total_amount: round2(row.total_amount)
  };
}

// GET /api/reports/gst-summary?from=YYYY-MM-DD&to=YYYY-MM-DD
// Output tax (Completed + Returned sales, net of any returns processed in
// this same window) vs input tax (from purchases received), plus a
// simplified net-payable estimate. This is a reference figure for the
// operator, NOT a substitute for an actual GSTR filing — real GST set-off
// rules (head-wise CGST/SGST/IGST matching, reverse charge, ITC
// eligibility) are more involved than a flat subtraction.
router.get('/gst-summary', (req, res) => {
  const { from, to } = defaultDateRange(req.query);
  const storeId = req.session.storeId;

  // 'Returned' sales still count in gross output — the invoice legitimately
  // happened in this period; the return (if it also falls in this window)
  // nets it back out below. Only 'Cancelled' is excluded — that's a void,
  // not a sale that happened and was later reversed.
  const output = db.prepare(`
    SELECT COUNT(*) AS count,
      COALESCE(SUM(taxable_amount), 0) AS taxable_amount,
      COALESCE(SUM(cgst_amount), 0) AS cgst_amount,
      COALESCE(SUM(sgst_amount), 0) AS sgst_amount,
      COALESCE(SUM(igst_amount), 0) AS igst_amount,
      COALESCE(SUM(total_amount), 0) AS total_amount
    FROM sales
    WHERE store_id = ? AND status IN ('Completed', 'Returned') AND date(sale_date) BETWEEN ? AND ?
  `).get(storeId, from, to);

  const returns = getReturnsSummary(storeId, from, to);

  const outputNet = {
    taxable_amount: round2(output.taxable_amount - returns.taxable_amount),
    cgst_amount: round2(output.cgst_amount - returns.cgst_amount),
    sgst_amount: round2(output.sgst_amount - returns.sgst_amount),
    total_amount: round2(output.total_amount - returns.total_amount)
  };

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

  const outputTax = round2(outputNet.cgst_amount + outputNet.sgst_amount + output.igst_amount);
  const inputTax = round2(input.cgst_amount + input.sgst_amount + input.igst_amount);

  res.json({
    from, to,
    output,
    returns,
    output_net: outputNet,
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

  // 'Returned' sales are legitimate invoices that later came back — they
  // still count toward gross totals here (the return list + returns_amount
  // below is what nets it out), same reasoning as the GST summary above.
  // Only 'Cancelled' (a void, not a completed-then-reversed sale) is excluded.
  const valid = sales.filter(s => s.status !== 'Cancelled');
  const completedCount = sales.filter(s => s.status === 'Completed').length;
  const returnedCount = sales.filter(s => s.status === 'Returned').length;
  const cancelledCount = sales.filter(s => s.status === 'Cancelled').length;

  const totals = valid.reduce((acc, s) => {
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

  // Returns are keyed to when they were PROCESSED, not the original sale's
  // date — a return this week against last month's sale reduces this
  // week's net figures, not last month's (same as the GST summary).
  const returnRows = db.prepare(`
    SELECT sr.*, s.invoice_no AS sale_invoice_no
    FROM sale_returns sr JOIN sales s ON sr.sale_id = s.id
    WHERE sr.store_id = ? AND date(sr.return_date) BETWEEN ? AND ?
    ORDER BY sr.return_date ASC
  `).all(storeId, from, to);
  const returnsAmount = round2(returnRows.reduce((s, r) => s + r.refund_amount, 0));

  totals.returns_amount = returnsAmount;
  totals.net_total_amount = round2(totals.total_amount - returnsAmount);

  res.json({
    from, to,
    sales,
    returns: returnRows,
    completed_count: completedCount,
    returned_count: returnedCount,
    cancelled_count: cancelledCount,
    totals
  });
});

module.exports = router;
