const express = require('express');
const db = require('../db/connection');
const { logActivity } = require('../utils/helpers');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function validateDoctorBody(body, { partial } = {}) {
  if (!partial || body.name !== undefined) {
    if (!body.name || !String(body.name).trim()) return 'name is required';
  }
  if (body.default_commission_pct !== undefined) {
    const pct = parseFloat(body.default_commission_pct);
    if (isNaN(pct) || pct < 0 || pct > 100) return 'default_commission_pct must be between 0 and 100';
  }
  return null;
}

// GET /api/doctors - registry, with lifetime commission accrued (Completed sales only —
// a cancelled sale never counts toward what's owed, no separate reversal bookkeeping needed)
// and commission_unpaid — the actionable "what do I owe this doctor right now" figure.
router.get('/', (req, res) => {
  const { q, include_inactive } = req.query;

  let query = `
    SELECT d.*,
      COALESCE((
        SELECT SUM(s.doctor_commission_amount) FROM sales s
        WHERE s.doctor_id = d.id AND s.status = 'Completed'
      ), 0) AS lifetime_commission_accrued,
      COALESCE((
        SELECT SUM(s.doctor_commission_amount) FROM sales s
        WHERE s.doctor_id = d.id AND s.status = 'Completed' AND s.commission_paid_at IS NULL
      ), 0) AS commission_unpaid,
      COALESCE((
        SELECT COUNT(*) FROM sales s
        WHERE s.doctor_id = d.id AND s.status = 'Completed'
      ), 0) AS referred_sale_count
    FROM doctors d
    WHERE 1 = 1
  `;
  const params = [];
  if (!include_inactive) query += ' AND d.is_active = 1';
  if (q) {
    query += ' AND (d.name LIKE ? OR d.phone LIKE ? OR d.registration_no LIKE ?)';
    const like = `%${q}%`;
    params.push(like, like, like);
  }
  query += ' ORDER BY d.name COLLATE NOCASE';

  res.json(db.prepare(query).all(...params));
});

// GET /api/doctors/:id - single record
router.get('/:id', (req, res) => {
  const doctor = db.prepare('SELECT * FROM doctors WHERE id = ?').get(req.params.id);
  if (!doctor) return res.status(404).json({ error: 'Doctor not found' });
  res.json(doctor);
});

// GET /api/doctors/:id/commissions - the commission-bearing sales behind that lifetime
// total, plus the payout history and unpaid/paid split that drives the "Pay Out" action.
router.get('/:id/commissions', (req, res) => {
  const doctor = db.prepare('SELECT * FROM doctors WHERE id = ?').get(req.params.id);
  if (!doctor) return res.status(404).json({ error: 'Doctor not found' });

  const sales = db.prepare(`
    SELECT s.id, s.invoice_no, s.sale_date, s.total_amount, s.doctor_commission_pct,
      s.doctor_commission_amount, s.commission_paid_at, s.status, p.patient_name
    FROM sales s
    LEFT JOIN prescriptions p ON s.prescription_id = p.id
    WHERE s.doctor_id = ? AND s.store_id = ?
    ORDER BY s.sale_date DESC
  `).all(req.params.id, req.session.storeId);

  const payments = db.prepare(`
    SELECT dcp.*, u.full_name AS created_by_name
    FROM doctor_commission_payments dcp
    LEFT JOIN users u ON dcp.created_by_user_id = u.id
    WHERE dcp.doctor_id = ? AND dcp.store_id = ?
    ORDER BY dcp.payment_date DESC
  `).all(req.params.id, req.session.storeId);

  const unpaidTotal = round2(sales
    .filter(s => s.status === 'Completed' && !s.commission_paid_at)
    .reduce((sum, s) => sum + s.doctor_commission_amount, 0));
  const paidTotal = round2(payments.reduce((sum, p) => sum + p.amount, 0));

  res.json({ ...doctor, sales, payments, unpaid_total: unpaidTotal, paid_total: paidTotal });
});

// POST /api/doctors/:id/pay-commission - settle ALL currently-unpaid commission for this
// doctor in one lump sum. The amount is computed authoritatively here from unpaid Completed
// sales, never accepted from the client, so it can't drift from what's actually owed.
router.post('/:id/pay-commission', requireRole('Accounts'), (req, res) => {
  const { id } = req.params;
  const doctor = db.prepare('SELECT * FROM doctors WHERE id = ?').get(id);
  if (!doctor) return res.status(404).json({ error: 'Doctor not found' });

  const storeId = req.session.storeId;
  const unpaidSales = db.prepare(`
    SELECT id, doctor_commission_amount FROM sales
    WHERE doctor_id = ? AND store_id = ? AND status = 'Completed' AND commission_paid_at IS NULL AND doctor_commission_amount > 0
  `).all(id, storeId);

  const amount = round2(unpaidSales.reduce((sum, s) => sum + s.doctor_commission_amount, 0));
  if (amount <= 0) return res.status(400).json({ error: 'No unpaid commission to settle for this doctor' });

  const paymentId = db.transaction(() => {
    const info = db.prepare(`
      INSERT INTO doctor_commission_payments (doctor_id, store_id, amount, payment_mode, reference_no, notes, created_by_user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, storeId, amount, req.body.payment_mode || null, req.body.reference_no || null, req.body.notes || null, req.session.userId);
    const newPaymentId = info.lastInsertRowid;

    const settle = db.prepare("UPDATE sales SET commission_paid_at = datetime('now'), commission_payment_id = ? WHERE id = ?");
    unpaidSales.forEach(s => settle.run(newPaymentId, s.id));

    return newPaymentId;
  })();

  logActivity(db, req.session.userId, 'doctor_commission_paid', 'doctor', id, { paymentId, amount, salesSettled: unpaidSales.length });
  res.json({ success: true, id: paymentId, amount, sales_settled: unpaidSales.length });
});

// POST /api/doctors - create
router.post('/', requireRole('Pharmacist'), (req, res) => {
  const err = validateDoctorBody(req.body);
  if (err) return res.status(400).json({ error: err });

  const { name, phone, registration_no, default_commission_pct, notes } = req.body;
  const info = db.prepare(`
    INSERT INTO doctors (name, phone, registration_no, default_commission_pct, notes)
    VALUES (?, ?, ?, ?, ?)
  `).run(name.trim(), phone || null, registration_no || null, default_commission_pct || 0, notes || null);

  logActivity(db, req.session.userId, 'doctor_created', 'doctor', info.lastInsertRowid, { name });
  res.json({ success: true, id: info.lastInsertRowid });
});

// PUT /api/doctors/:id - update (rate changes only affect future sales — past sales keep their snapshot)
router.put('/:id', requireRole('Pharmacist'), (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM doctors WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Doctor not found' });

  const err = validateDoctorBody(req.body, { partial: true });
  if (err) return res.status(400).json({ error: err });

  const fields = ['name', 'phone', 'registration_no', 'default_commission_pct', 'notes', 'is_active'];
  const updates = [];
  const params = [];
  fields.forEach(f => {
    if (req.body[f] !== undefined) { updates.push(`${f} = ?`); params.push(req.body[f]); }
  });
  if (updates.length === 0) return res.json({ success: true });

  params.push(id);
  db.prepare(`UPDATE doctors SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  logActivity(db, req.session.userId, 'doctor_updated', 'doctor', id, req.body);
  res.json({ success: true });
});

// DELETE /api/doctors/:id - soft delete (blocked if any sale has accrued commission against them)
router.delete('/:id', requireRole('Pharmacist'), (req, res) => {
  const { id } = req.params;
  const saleCount = db.prepare("SELECT COUNT(*) as c FROM sales WHERE doctor_id = ?").get(id).c;
  if (saleCount > 0) {
    return res.status(400).json({ error: `Cannot remove: ${saleCount} sale(s) are linked to this doctor` });
  }
  db.prepare('UPDATE doctors SET is_active = 0 WHERE id = ?').run(id);
  logActivity(db, req.session.userId, 'doctor_deactivated', 'doctor', id, null);
  res.json({ success: true });
});

module.exports = router;
