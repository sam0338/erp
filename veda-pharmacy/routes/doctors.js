const express = require('express');
const db = require('../db/connection');
const { logActivity } = require('../utils/helpers');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

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
router.get('/', (req, res) => {
  const { q, include_inactive } = req.query;

  let query = `
    SELECT d.*,
      COALESCE((
        SELECT SUM(s.doctor_commission_amount) FROM sales s
        WHERE s.doctor_id = d.id AND s.status = 'Completed'
      ), 0) AS lifetime_commission_accrued,
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

// GET /api/doctors/:id/commissions - the commission-bearing sales behind that lifetime total
router.get('/:id/commissions', (req, res) => {
  const doctor = db.prepare('SELECT * FROM doctors WHERE id = ?').get(req.params.id);
  if (!doctor) return res.status(404).json({ error: 'Doctor not found' });

  const sales = db.prepare(`
    SELECT s.id, s.invoice_no, s.sale_date, s.total_amount, s.doctor_commission_pct,
      s.doctor_commission_amount, s.status, p.patient_name
    FROM sales s
    LEFT JOIN prescriptions p ON s.prescription_id = p.id
    WHERE s.doctor_id = ? AND s.store_id = ?
    ORDER BY s.sale_date DESC
  `).all(req.params.id, req.session.storeId);

  res.json({ ...doctor, sales });
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
