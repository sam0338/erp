const express = require('express');
const dayjs = require('dayjs');
const db = require('../db/connection');
const { requireRole } = require('../middleware/auth');
const { logActivity } = require('../utils/helpers');

const router = express.Router();

function paymentSummaryForDate(propertyId, date) {
  const rows = db.prepare(`
    SELECT p.mode, COALESCE(SUM(p.amount), 0) as total
    FROM payments p
    JOIN folios f ON p.folio_id = f.id
    JOIN reservations res ON f.reservation_id = res.id
    WHERE res.property_id = ? AND date(p.paid_at) = ?
    GROUP BY p.mode
  `).all(propertyId, date);

  const summary = { cash: 0, upi: 0, card: 0, bank_transfer: 0 };
  rows.forEach(r => { if (summary[r.mode] !== undefined) summary[r.mode] = r.total; });
  return summary;
}

// GET /api/finance/day-summary?date=YYYY-MM-DD
router.get('/day-summary', (req, res) => {
  const propertyId = req.session.propertyId;
  const date = req.query.date || dayjs().format('YYYY-MM-DD');
  const summary = paymentSummaryForDate(propertyId, date);
  const existing = db.prepare('SELECT * FROM cash_closings WHERE property_id = ? AND closing_date = ?').get(propertyId, date);
  res.json({ date, expected: summary, already_closed: !!existing, closing: existing || null });
});

// POST /api/finance/close-day
// body: { closing_date, actual_cash, notes }
router.post('/close-day', requireRole('Accounts'), (req, res) => {
  const propertyId = req.session.propertyId;
  const { closing_date, actual_cash, notes } = req.body;
  if (!closing_date || actual_cash === undefined) {
    return res.status(400).json({ error: 'closing_date and actual_cash are required' });
  }

  const summary = paymentSummaryForDate(propertyId, closing_date);
  const discrepancy = Math.round((actual_cash - summary.cash) * 100) / 100;

  const existing = db.prepare('SELECT * FROM cash_closings WHERE property_id = ? AND closing_date = ?').get(propertyId, closing_date);
  if (existing) {
    db.prepare(`
      UPDATE cash_closings SET expected_cash = ?, expected_upi = ?, expected_card = ?, expected_bank_transfer = ?,
        actual_cash = ?, discrepancy = ?, notes = ?, closed_by_user_id = ?, closed_at = datetime('now')
      WHERE id = ?
    `).run(summary.cash, summary.upi, summary.card, summary.bank_transfer, actual_cash, discrepancy, notes || null, req.session.userId, existing.id);
  } else {
    db.prepare(`
      INSERT INTO cash_closings (property_id, closing_date, expected_cash, expected_upi, expected_card, expected_bank_transfer, actual_cash, discrepancy, notes, closed_by_user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(propertyId, closing_date, summary.cash, summary.upi, summary.card, summary.bank_transfer, actual_cash, discrepancy, notes || null, req.session.userId);
  }

  logActivity(db, req.session.userId, 'day_closed', 'cash_closing', null, { closing_date, discrepancy });
  res.json({ success: true, discrepancy });
});

// GET /api/finance/closings - history
router.get('/closings', (req, res) => {
  const propertyId = req.session.propertyId;
  const closings = db.prepare(`
    SELECT cc.*, u.full_name as closed_by_name
    FROM cash_closings cc LEFT JOIN users u ON cc.closed_by_user_id = u.id
    WHERE cc.property_id = ? ORDER BY cc.closing_date DESC LIMIT 60
  `).all(propertyId);
  res.json(closings);
});

// GET /api/finance/tally-export?from=&to= - Tally-compatible XML voucher export
router.get('/tally-export', requireRole('Accounts'), (req, res) => {
  const propertyId = req.session.propertyId;
  const { from, to } = req.query;
  if (!from || !to) return res.status(400).json({ error: 'from and to dates are required' });

  const property = db.prepare('SELECT name FROM properties WHERE id = ?').get(propertyId);

  const payments = db.prepare(`
    SELECT p.*, res.booking_ref, g.full_name as guest_name, f.folio_number
    FROM payments p
    JOIN folios f ON p.folio_id = f.id
    JOIN reservations res ON f.reservation_id = res.id
    JOIN guests g ON res.guest_id = g.id
    WHERE res.property_id = ? AND date(p.paid_at) BETWEEN ? AND ?
    ORDER BY p.paid_at
  `).all(propertyId, from, to);

  const modeToLedger = { cash: 'Cash', upi: 'UPI Collections', card: 'Card Collections', bank_transfer: 'Bank Account' };

  const escapeXml = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const vouchers = payments.map(p => `
    <VOUCHER VCHTYPE="Receipt" ACTION="Create">
      <DATE>${dayjs(p.paid_at).format('YYYYMMDD')}</DATE>
      <VOUCHERTYPENAME>Receipt</VOUCHERTYPENAME>
      <PARTYLEDGERNAME>${escapeXml(p.guest_name)}</PARTYLEDGERNAME>
      <NARRATION>${escapeXml(`${p.booking_ref} / ${p.folio_number} - ${p.mode}${p.reference_number ? ' - ' + p.reference_number : ''}`)}</NARRATION>
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>${escapeXml(modeToLedger[p.mode] || 'Cash')}</LEDGERNAME>
        <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
        <AMOUNT>${p.amount}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>${escapeXml(p.guest_name)}</LEDGERNAME>
        <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
        <AMOUNT>-${p.amount}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>
    </VOUCHER>`).join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC><REPORTNAME>Vouchers</REPORTNAME><STATICVARIABLES><SVCURRENTCOMPANY>${escapeXml(property.name)}</SVCURRENTCOMPANY></STATICVARIABLES></REQUESTDESC>
      <REQUESTDATA>${vouchers}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

  res.setHeader('Content-Type', 'application/xml');
  res.setHeader('Content-Disposition', `attachment; filename="tally-export-${from}-to-${to}.xml"`);
  res.send(xml);
});

module.exports = router;
