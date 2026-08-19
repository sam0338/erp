const express = require('express');
const db = require('../db/connection');

const router = express.Router();

// GET /api/movements - a unified, read-only, chronological ledger of every
// stock-affecting event for the current store: GRN receipts (in), direct
// stock in (in), sales (out), sale returns (in) and manual stock
// adjustments (out) — matching MediStore Pro's Item Movement Log. This is
// pure aggregation over existing rows, nothing is stored separately, so
// there's no way for it to drift from the tables it reads.
// ?item_id=  ?type=Purchase|Stock In|Sale|Return|Adjustment  ?q=  ?limit=200
router.get('/', (req, res) => {
  const storeId = req.session.storeId;
  const { item_id, type, q } = req.query;
  const limit = Math.min(parseInt(req.query.limit, 10) || 200, 1000);

  const rows = [];

  if (!type || type === 'Purchase') {
    let sql = `
      SELECT p.grn_date AS date, i.id AS item_id, i.name AS item_name, 'Purchase' AS type,
        (pi.quantity + pi.free_quantity) AS quantity, p.grn_no AS reference,
        ('Batch ' || pi.batch_no || ' from ' || d.name) AS note
      FROM purchase_items pi
      JOIN purchases p ON pi.purchase_id = p.id
      JOIN items i ON pi.item_id = i.id
      JOIN distributors d ON p.distributor_id = d.id
      WHERE p.store_id = ?
    `;
    const params = [storeId];
    if (item_id) { sql += ' AND i.id = ?'; params.push(item_id); }
    if (q) { sql += ' AND (i.name LIKE ? OR p.grn_no LIKE ?)'; params.push(`%${q}%`, `%${q}%`); }
    rows.push(...db.prepare(sql).all(...params));
  }

  if (!type || type === 'Stock In') {
    let sql = `
      SELECT sie.created_at AS date, i.id AS item_id, i.name AS item_name, 'Stock In' AS type,
        sie.quantity AS quantity, sie.entry_no AS reference,
        ('Batch ' || b.batch_no || COALESCE(' · ' || sie.supplier_name, '')) AS note
      FROM stock_in_entries sie
      JOIN items i ON sie.item_id = i.id
      JOIN batches b ON sie.batch_id = b.id
      WHERE sie.store_id = ?
    `;
    const params = [storeId];
    if (item_id) { sql += ' AND i.id = ?'; params.push(item_id); }
    if (q) { sql += ' AND (i.name LIKE ? OR sie.entry_no LIKE ?)'; params.push(`%${q}%`, `%${q}%`); }
    rows.push(...db.prepare(sql).all(...params));
  }

  if (!type || type === 'Sale') {
    let sql = `
      SELECT s.sale_date AS date, i.id AS item_id, i.name AS item_name, 'Sale' AS type,
        -si.quantity AS quantity, s.invoice_no AS reference,
        ('Sold to ' || COALESCE(s.customer_name, 'Walk-in')) AS note
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      JOIN items i ON si.item_id = i.id
      WHERE s.store_id = ? AND s.status = 'Completed'
    `;
    const params = [storeId];
    if (item_id) { sql += ' AND i.id = ?'; params.push(item_id); }
    if (q) { sql += ' AND (i.name LIKE ? OR s.invoice_no LIKE ?)'; params.push(`%${q}%`, `%${q}%`); }
    rows.push(...db.prepare(sql).all(...params));
  }

  if (!type || type === 'Return') {
    let sql = `
      SELECT sr.return_date AS date, i.id AS item_id, i.name AS item_name, 'Return' AS type,
        sri.quantity AS quantity, sr.return_no AS reference,
        COALESCE(sr.reason, 'Sale return') AS note
      FROM sale_return_items sri
      JOIN sale_returns sr ON sri.sale_return_id = sr.id
      JOIN sale_items si ON sri.sale_item_id = si.id
      JOIN items i ON si.item_id = i.id
      WHERE sr.store_id = ?
    `;
    const params = [storeId];
    if (item_id) { sql += ' AND i.id = ?'; params.push(item_id); }
    if (q) { sql += ' AND (i.name LIKE ? OR sr.return_no LIKE ?)'; params.push(`%${q}%`, `%${q}%`); }
    rows.push(...db.prepare(sql).all(...params));
  }

  if (!type || type === 'Adjustment') {
    let sql = `
      SELECT sa.created_at AS date, i.id AS item_id, i.name AS item_name, 'Adjustment' AS type,
        -sa.quantity AS quantity, sa.adjustment_type AS reference,
        COALESCE(sa.reason, sa.adjustment_type) AS note
      FROM stock_adjustments sa
      JOIN batches b ON sa.batch_id = b.id
      JOIN items i ON b.item_id = i.id
      WHERE sa.store_id = ?
    `;
    const params = [storeId];
    if (item_id) { sql += ' AND i.id = ?'; params.push(item_id); }
    if (q) { sql += ' AND (i.name LIKE ? OR sa.adjustment_type LIKE ?)'; params.push(`%${q}%`, `%${q}%`); }
    rows.push(...db.prepare(sql).all(...params));
  }

  rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  res.json(rows.slice(0, limit));
});

module.exports = router;
