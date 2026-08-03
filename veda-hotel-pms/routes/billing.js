const express = require('express');
const db = require('../db/connection');
const { logActivity } = require('../utils/helpers');

const router = express.Router();

// GET /api/billing/folio/:folioId/invoice - full data needed to print a bill
router.get('/folio/:folioId/invoice', (req, res) => {
  const { folioId } = req.params;
  const folio = db.prepare('SELECT * FROM folios WHERE id = ?').get(folioId);
  if (!folio) return res.status(404).json({ error: 'Folio not found' });

  const reservation = db.prepare(`
    SELECT res.id, res.booking_ref, res.arrival_date, res.departure_date, res.adults, res.children,
           g.full_name as guest_name, g.phone as guest_phone, g.email as guest_email,
           g.address as guest_address, g.city as guest_city, g.state as guest_state,
           g.gstin as guest_gstin, g.company_name as guest_company,
           p.name as property_name, p.address as property_address, p.city as property_city,
           p.state as property_state, p.gstin as property_gstin, p.phone as property_phone,
           p.email as property_email, p.is_gst_registered as property_is_gst_registered
    FROM reservations res
    JOIN guests g ON res.guest_id = g.id
    JOIN properties p ON res.property_id = p.id
    WHERE res.id = ?
  `).get(folio.reservation_id);

  const rooms = db.prepare(`
    SELECT rr.rate_per_night, r.room_number, rt.name as room_type_name
    FROM reservation_rooms rr
    LEFT JOIN rooms r ON rr.room_id = r.id
    JOIN room_types rt ON rr.room_type_id = rt.id
    WHERE rr.reservation_id = ?
  `).all(folio.reservation_id);

  const chargesRaw = db.prepare('SELECT * FROM folio_charges WHERE folio_id = ? ORDER BY charge_date').all(folioId);
  const payments = db.prepare('SELECT * FROM payments WHERE folio_id = ? ORDER BY paid_at').all(folioId);

  // Resolve who the invoice is actually billed to: the guest by default,
  // or a redirected company/other person (e.g. for reimbursement billing).
  const billTo = folio.bill_to_same_as_guest ? {
    same_as_guest: true,
    name: reservation.guest_name,
    address: reservation.guest_address,
    city: reservation.guest_city,
    state: reservation.guest_state,
    gstin: reservation.guest_gstin,
    phone: reservation.guest_phone,
    email: reservation.guest_email
  } : {
    same_as_guest: false,
    name: folio.bill_to_name,
    address: folio.bill_to_address,
    city: folio.bill_to_city,
    state: folio.bill_to_state,
    gstin: folio.bill_to_gstin,
    phone: folio.bill_to_phone,
    email: folio.bill_to_email
  };

  // GST place-of-supply logic: same state as the property => CGST+SGST,
  // different state => IGST. Falls back to intra-state if state is unknown.
  const propState = (reservation.property_state || '').trim().toLowerCase();
  const billState = (billTo.state || '').trim().toLowerCase();
  const supplyType = (billState && billState !== propState) ? 'inter_state' : 'intra_state';

  const charges = chargesRaw.map(c => {
    if (supplyType === 'inter_state') {
      return { ...c, cgst: 0, sgst: 0, igst: Math.round(c.tax_amount * 100) / 100, line_total: Math.round((c.amount + c.tax_amount) * 100) / 100 };
    }
    return {
      ...c,
      cgst: Math.round((c.tax_amount / 2) * 100) / 100,
      sgst: Math.round((c.tax_amount / 2) * 100) / 100,
      igst: 0,
      line_total: Math.round((c.amount + c.tax_amount) * 100) / 100
    };
  });

  const subtotal = Math.round(chargesRaw.reduce((s, c) => s + c.amount, 0) * 100) / 100;
  const totalTax = Math.round(chargesRaw.reduce((s, c) => s + c.tax_amount, 0) * 100) / 100;
  const grandTotal = Math.round((subtotal + totalTax) * 100) / 100;
  const paidTotal = Math.round(payments.reduce((s, p) => s + p.amount, 0) * 100) / 100;

  res.json({
    folio, reservation, rooms, charges, payments, billTo, supplyType,
    summary: {
      subtotal,
      cgst: supplyType === 'intra_state' ? Math.round((totalTax / 2) * 100) / 100 : 0,
      sgst: supplyType === 'intra_state' ? Math.round((totalTax / 2) * 100) / 100 : 0,
      igst: supplyType === 'inter_state' ? totalTax : 0,
      total_tax: totalTax, grand_total: grandTotal, paid_total: paidTotal, balance: grandTotal - paidTotal
    }
  });
});

// PATCH /api/billing/folio/:folioId/bill-to
// Redirects the invoice to a company or other person instead of the guest.
// body: { bill_to_same_as_guest, bill_to_name, bill_to_address, bill_to_city,
//         bill_to_state, bill_to_gstin, bill_to_phone, bill_to_email }
router.patch('/folio/:folioId/bill-to', (req, res) => {
  const { folioId } = req.params;
  const folio = db.prepare('SELECT * FROM folios WHERE id = ?').get(folioId);
  if (!folio) return res.status(404).json({ error: 'Folio not found' });

  const sameAsGuest = req.body.bill_to_same_as_guest !== false && req.body.bill_to_same_as_guest !== 0;

  db.prepare(`
    UPDATE folios SET
      bill_to_same_as_guest = ?, bill_to_name = ?, bill_to_address = ?, bill_to_city = ?,
      bill_to_state = ?, bill_to_gstin = ?, bill_to_phone = ?, bill_to_email = ?
    WHERE id = ?
  `).run(
    sameAsGuest ? 1 : 0,
    sameAsGuest ? null : (req.body.bill_to_name || null),
    sameAsGuest ? null : (req.body.bill_to_address || null),
    sameAsGuest ? null : (req.body.bill_to_city || null),
    sameAsGuest ? null : (req.body.bill_to_state || null),
    sameAsGuest ? null : (req.body.bill_to_gstin || null),
    sameAsGuest ? null : (req.body.bill_to_phone || null),
    sameAsGuest ? null : (req.body.bill_to_email || null),
    folioId
  );

  logActivity(db, req.session.userId, 'bill_to_updated', 'folio', folioId, { sameAsGuest, name: req.body.bill_to_name });
  res.json({ success: true });
});

// GET /api/billing/folio/:folioId
router.get('/folio/:folioId', (req, res) => {
  const { folioId } = req.params;
  const folio = db.prepare('SELECT * FROM folios WHERE id = ?').get(folioId);
  if (!folio) return res.status(404).json({ error: 'Folio not found' });

  const charges = db.prepare('SELECT * FROM folio_charges WHERE folio_id = ? ORDER BY charge_date').all(folioId);
  const payments = db.prepare('SELECT * FROM payments WHERE folio_id = ? ORDER BY paid_at').all(folioId);

  const chargeTotal = charges.reduce((s, c) => s + c.amount + c.tax_amount, 0);
  const paidTotal = payments.reduce((s, p) => s + p.amount, 0);

  res.json({
    folio, charges, payments,
    summary: {
      charge_total: chargeTotal,
      paid_total: paidTotal,
      balance: chargeTotal - paidTotal
    }
  });
});

// POST /api/billing/folio/:folioId/charge
// body: { charge_type, description, amount, tax_rate }
router.post('/folio/:folioId/charge', (req, res) => {
  const { folioId } = req.params;
  const { charge_type, description, amount, tax_rate } = req.body;

  if (!charge_type || amount === undefined) {
    return res.status(400).json({ error: 'charge_type and amount are required' });
  }

  const folio = db.prepare('SELECT * FROM folios WHERE id = ?').get(folioId);
  if (!folio) return res.status(404).json({ error: 'Folio not found' });
  if (folio.status !== 'open') return res.status(400).json({ error: 'Folio is not open' });

  const taxRate = tax_rate || 0;
  const taxAmount = Math.round((amount * taxRate / 100) * 100) / 100;

  const info = db.prepare(`
    INSERT INTO folio_charges (folio_id, charge_type, description, amount, tax_rate, tax_amount, posted_by_user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(folioId, charge_type, description || null, amount, taxRate, taxAmount, req.session.userId);

  logActivity(db, req.session.userId, 'charge_posted', 'folio', folioId, { charge_type, amount });

  res.json({ success: true, id: info.lastInsertRowid });
});

// POST /api/billing/folio/:folioId/payment
// body: { amount, mode, reference_number }
router.post('/folio/:folioId/payment', (req, res) => {
  const { folioId } = req.params;
  const { amount, mode, reference_number } = req.body;

  if (!amount || !mode) {
    return res.status(400).json({ error: 'amount and mode are required' });
  }

  const folio = db.prepare('SELECT * FROM folios WHERE id = ?').get(folioId);
  if (!folio) return res.status(404).json({ error: 'Folio not found' });

  const info = db.prepare(`
    INSERT INTO payments (folio_id, amount, mode, reference_number, received_by_user_id)
    VALUES (?, ?, ?, ?, ?)
  `).run(folioId, amount, mode, reference_number || null, req.session.userId);

  logActivity(db, req.session.userId, 'payment_recorded', 'folio', folioId, { amount, mode });

  res.json({ success: true, id: info.lastInsertRowid });
});

// DELETE /api/billing/charge/:chargeId - void a charge (Admin/Accounts only, folio must be open)
router.delete('/charge/:chargeId', (req, res) => {
  const { chargeId } = req.params;
  const charge = db.prepare('SELECT * FROM folio_charges WHERE id = ?').get(chargeId);
  if (!charge) return res.status(404).json({ error: 'Charge not found' });

  const folio = db.prepare('SELECT * FROM folios WHERE id = ?').get(charge.folio_id);
  if (folio.status !== 'open') return res.status(400).json({ error: 'Cannot modify a settled folio' });

  db.prepare('DELETE FROM folio_charges WHERE id = ?').run(chargeId);
  logActivity(db, req.session.userId, 'charge_voided', 'folio_charge', chargeId, charge);

  res.json({ success: true });
});

module.exports = router;
