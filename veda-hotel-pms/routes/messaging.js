const express = require('express');
const db = require('../db/connection');
const { sendMail } = require('../utils/mailer');
const { reservationConfirmationText, invoiceSummaryText } = require('../utils/messageTemplates');

const router = express.Router();

function getReservationBundle(id) {
  const reservation = db.prepare(`
    SELECT res.*, g.full_name as guest_name, g.phone as guest_phone, g.email as guest_email
    FROM reservations res JOIN guests g ON res.guest_id = g.id WHERE res.id = ?
  `).get(id);
  if (!reservation) return null;
  const property = db.prepare('SELECT * FROM properties WHERE id = ?').get(reservation.property_id);
  const rooms = db.prepare(`
    SELECT rr.*, r.room_number, rt.name as room_type_name
    FROM reservation_rooms rr
    LEFT JOIN rooms r ON rr.room_id = r.id
    JOIN room_types rt ON rr.room_type_id = rt.id
    WHERE rr.reservation_id = ?
  `).all(id);
  return { reservation, property, rooms };
}

function toWhatsappLink(phone, text) {
  const countryCode = process.env.WHATSAPP_COUNTRY_CODE || '91';
  let cleaned = (phone || '').replace(/\D/g, '');
  if (!cleaned) return null;
  // If it looks like a bare 10-digit local number, prefix the country code
  if (cleaned.length === 10) cleaned = countryCode + cleaned;
  return `https://wa.me/${cleaned}?text=${encodeURIComponent(text)}`;
}

function folioTotals(folioId) {
  const charges = db.prepare('SELECT * FROM folio_charges WHERE folio_id = ?').all(folioId);
  const payments = db.prepare('SELECT * FROM payments WHERE folio_id = ?').all(folioId);
  const subtotal = charges.reduce((s, c) => s + c.amount, 0);
  const totalTax = charges.reduce((s, c) => s + c.tax_amount, 0);
  const grandTotal = subtotal + totalTax;
  const paidTotal = payments.reduce((s, p) => s + p.amount, 0);
  return { grand_total: grandTotal, paid_total: paidTotal, balance: grandTotal - paidTotal };
}

// ---------- Reservation confirmation ----------

// GET /api/messaging/reservation/:id/whatsapp-link
router.get('/reservation/:id/whatsapp-link', (req, res) => {
  const bundle = getReservationBundle(req.params.id);
  if (!bundle) return res.status(404).json({ error: 'Reservation not found' });
  if (!bundle.reservation.guest_phone) return res.status(400).json({ error: 'Guest has no phone number on file' });

  const text = reservationConfirmationText(bundle.property, bundle.reservation, bundle.rooms);
  const link = toWhatsappLink(bundle.reservation.guest_phone, text);
  res.json({ link, text });
});

// POST /api/messaging/reservation/:id/email
router.post('/reservation/:id/email', async (req, res) => {
  const bundle = getReservationBundle(req.params.id);
  if (!bundle) return res.status(404).json({ error: 'Reservation not found' });
  if (!bundle.reservation.guest_email) return res.status(400).json({ error: 'Guest has no email on file' });

  const text = reservationConfirmationText(bundle.property, bundle.reservation, bundle.rooms);
  const html = `<pre style="font-family:Arial,sans-serif;white-space:pre-wrap;font-size:14px;line-height:1.6;">${text.replace(/</g, '&lt;').replace(/\*/g, '')}</pre>`;

  try {
    await sendMail({ to: bundle.reservation.guest_email, subject: `Booking Confirmation — ${bundle.reservation.booking_ref}`, html });
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ---------- Invoice / checkout receipt ----------

// GET /api/messaging/invoice/:folioId/whatsapp-link
router.get('/invoice/:folioId/whatsapp-link', (req, res) => {
  const { folioId } = req.params;
  const folio = db.prepare('SELECT * FROM folios WHERE id = ?').get(folioId);
  if (!folio) return res.status(404).json({ error: 'Folio not found' });
  const bundle = getReservationBundle(folio.reservation_id);
  if (!bundle) return res.status(404).json({ error: 'Reservation not found' });
  if (!bundle.reservation.guest_phone) return res.status(400).json({ error: 'Guest has no phone number on file' });

  const summary = folioTotals(folioId);
  const text = invoiceSummaryText(bundle.property, bundle.reservation, summary, folio);
  const link = toWhatsappLink(bundle.reservation.guest_phone, text);
  res.json({ link, text });
});

// POST /api/messaging/invoice/:folioId/email
router.post('/invoice/:folioId/email', async (req, res) => {
  const { folioId } = req.params;
  const folio = db.prepare('SELECT * FROM folios WHERE id = ?').get(folioId);
  if (!folio) return res.status(404).json({ error: 'Folio not found' });
  const bundle = getReservationBundle(folio.reservation_id);
  if (!bundle) return res.status(404).json({ error: 'Reservation not found' });
  if (!bundle.reservation.guest_email) return res.status(400).json({ error: 'Guest has no email on file' });

  const summary = folioTotals(folioId);
  const text = invoiceSummaryText(bundle.property, bundle.reservation, summary, folio);
  const html = `<pre style="font-family:Arial,sans-serif;white-space:pre-wrap;font-size:14px;line-height:1.6;">${text.replace(/</g, '&lt;').replace(/\*/g, '')}</pre>`;

  try {
    await sendMail({ to: bundle.reservation.guest_email, subject: `Invoice — ${folio.folio_number}`, html });
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
