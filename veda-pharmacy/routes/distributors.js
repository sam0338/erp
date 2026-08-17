const express = require('express');
const db = require('../db/connection');
const { logActivity } = require('../utils/helpers');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

function validateDistributorBody(body, { partial } = {}) {
  if (!partial || body.name !== undefined) {
    if (!body.name || !String(body.name).trim()) return 'name is required';
  }
  if (body.opening_balance !== undefined && isNaN(body.opening_balance)) {
    return 'opening_balance must be a number';
  }
  return null;
}

// GET /api/distributors - list, with optional search/include-inactive
router.get('/', (req, res) => {
  const { q, include_inactive } = req.query;

  let query = `
    SELECT d.*,
      COALESCE((SELECT SUM(p.total_amount) FROM purchases p WHERE p.distributor_id = d.id), 0) AS lifetime_purchases,
      d.opening_balance + COALESCE((SELECT SUM(p.total_amount - p.amount_paid) FROM purchases p WHERE p.distributor_id = d.id), 0) AS outstanding_balance
    FROM distributors d
    WHERE 1 = 1
  `;
  const params = [];

  if (!include_inactive) {
    query += ' AND d.is_active = 1';
  }
  if (q) {
    query += ' AND (d.name LIKE ? OR d.contact_person LIKE ? OR d.phone LIKE ? OR d.gstin LIKE ?)';
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }
  query += ' ORDER BY d.name COLLATE NOCASE';

  const distributors = db.prepare(query).all(...params);
  res.json(distributors);
});

// GET /api/distributors/:id
router.get('/:id', (req, res) => {
  const distributor = db.prepare('SELECT * FROM distributors WHERE id = ?').get(req.params.id);
  if (!distributor) return res.status(404).json({ error: 'Distributor not found' });
  res.json(distributor);
});

// GET /api/distributors/:id/ledger - statement: opening balance, then every
// purchase (debit) and payment (credit) as separate dated entries, with a
// running balance. Same total as the "outstanding_balance" figure in the
// list above, just itemized — see routes/purchases.js for how paid_at
// dates the payment entry separately from the purchase's invoice_date.
router.get('/:id/ledger', (req, res) => {
  const distributor = db.prepare('SELECT * FROM distributors WHERE id = ?').get(req.params.id);
  if (!distributor) return res.status(404).json({ error: 'Distributor not found' });

  const purchases = db.prepare(`
    SELECT * FROM purchases WHERE distributor_id = ? AND store_id = ?
    ORDER BY invoice_date ASC, id ASC
  `).all(req.params.id, req.session.storeId);

  const entries = [];
  purchases.forEach(p => {
    entries.push({
      type: 'purchase',
      date: p.invoice_date,
      reference: p.grn_no || p.invoice_no,
      description: `GRN ${p.grn_no || '—'} — Invoice ${p.invoice_no}`,
      debit: p.total_amount,
      credit: 0
    });
    if (p.amount_paid > 0) {
      entries.push({
        type: 'payment',
        date: p.paid_at || p.invoice_date,
        reference: p.grn_no || p.invoice_no,
        description: `Payment against ${p.grn_no || p.invoice_no}`,
        debit: 0,
        credit: p.amount_paid
      });
    }
  });
  // Lexicographic sort works here without reformatting: invoice_date is
  // 'YYYY-MM-DD' and paid_at is 'YYYY-MM-DD HH:MM:SS' — the bare date
  // string is always < any datetime string sharing that prefix, so a
  // same-day purchase always sorts before its own payment.
  entries.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  let balance = distributor.opening_balance;
  entries.forEach(e => {
    balance = Math.round((balance + e.debit - e.credit + Number.EPSILON) * 100) / 100;
    e.balance = balance;
  });

  res.json({
    distributor,
    opening_balance: distributor.opening_balance,
    entries,
    closing_balance: balance
  });
});

// POST /api/distributors - create
router.post('/', requireRole('Pharmacist', 'Accounts'), (req, res) => {
  const err = validateDistributorBody(req.body);
  if (err) return res.status(400).json({ error: err });

  const {
    name, contact_person, phone, email, address, city, state,
    gstin, drug_license_no, opening_balance
  } = req.body;

  const info = db.prepare(`
    INSERT INTO distributors (
      name, contact_person, phone, email, address, city, state,
      gstin, drug_license_no, opening_balance
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    name.trim(), contact_person || null, phone || null, email || null,
    address || null, city || null, state || null, gstin || null,
    drug_license_no || null, opening_balance || 0
  );

  logActivity(db, req.session.userId, 'distributor_created', 'distributor', info.lastInsertRowid, { name });
  res.json({ success: true, id: info.lastInsertRowid });
});

// PUT /api/distributors/:id - update
router.put('/:id', requireRole('Pharmacist', 'Accounts'), (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM distributors WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Distributor not found' });

  const err = validateDistributorBody(req.body, { partial: true });
  if (err) return res.status(400).json({ error: err });

  const fields = [
    'name', 'contact_person', 'phone', 'email', 'address', 'city', 'state',
    'gstin', 'drug_license_no', 'opening_balance', 'is_active'
  ];
  const updates = [];
  const params = [];
  fields.forEach(f => {
    if (req.body[f] !== undefined) { updates.push(`${f} = ?`); params.push(req.body[f]); }
  });
  if (updates.length === 0) return res.json({ success: true });

  params.push(id);
  db.prepare(`UPDATE distributors SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  logActivity(db, req.session.userId, 'distributor_updated', 'distributor', id, req.body);
  res.json({ success: true });
});

// DELETE /api/distributors/:id - soft delete (blocked if any purchases reference it)
router.delete('/:id', requireRole('Pharmacist', 'Accounts'), (req, res) => {
  const { id } = req.params;
  const purchaseCount = db.prepare('SELECT COUNT(*) as c FROM purchases WHERE distributor_id = ?').get(id).c;
  if (purchaseCount > 0) {
    return res.status(400).json({ error: `Cannot remove: ${purchaseCount} purchase(s) are recorded against this distributor` });
  }
  db.prepare('UPDATE distributors SET is_active = 0 WHERE id = ?').run(id);
  logActivity(db, req.session.userId, 'distributor_deactivated', 'distributor', id, null);
  res.json({ success: true });
});

module.exports = router;
