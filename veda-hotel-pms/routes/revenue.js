const express = require('express');
const dayjs = require('dayjs');
const db = require('../db/connection');
const { requireRole } = require('../middleware/auth');
const { getEffectiveRate, logActivity } = require('../utils/helpers');

const router = express.Router();

// ---------- Pricing suggestions (rule-based, not ML) ----------
// GET /api/revenue/suggestions?days=14
// For each of the next N days, computes occupancy % and suggests a rate
// bump/discount per room type based on the property's configured thresholds,
// plus a weekend multiplier on Fri/Sat nights.
router.get('/suggestions', (req, res) => {
  const propertyId = req.session.propertyId;
  const days = Math.min(parseInt(req.query.days) || 14, 60);
  const property = db.prepare('SELECT * FROM properties WHERE id = ?').get(propertyId);
  const roomTypes = db.prepare('SELECT * FROM room_types WHERE property_id = ? AND is_active = 1').all(propertyId);
  const totalRoomsByType = {};
  roomTypes.forEach(rt => {
    totalRoomsByType[rt.id] = db.prepare(
      'SELECT COUNT(*) as c FROM rooms WHERE room_type_id = ? AND is_active = 1'
    ).get(rt.id).c;
  });

  const suggestions = [];

  for (let i = 0; i < days; i++) {
    const date = dayjs().add(i, 'day').format('YYYY-MM-DD');
    const nextDate = dayjs().add(i + 1, 'day').format('YYYY-MM-DD');
    const isWeekend = [5, 6].includes(dayjs(date).day()); // Fri=5, Sat=6

    roomTypes.forEach(rt => {
      const totalRooms = totalRoomsByType[rt.id];
      if (!totalRooms) return;

      const bookedCount = db.prepare(`
        SELECT COUNT(DISTINCT rr.id) as c
        FROM reservation_rooms rr
        JOIN reservations res ON rr.reservation_id = res.id
        WHERE rr.room_type_id = ? AND res.status IN ('confirmed', 'checked_in')
          AND NOT (res.departure_date <= ? OR res.arrival_date >= ?)
      `).get(rt.id, date, nextDate).c;

      const occupancyPct = totalRooms > 0 ? Math.round((bookedCount / totalRooms) * 1000) / 10 : 0;
      const effective = getEffectiveRate(db, rt.id, date);
      const currentRate = effective.rate;

      let suggestedRate = currentRate;
      let reason = null;

      if (occupancyPct >= property.high_occ_threshold) {
        suggestedRate = Math.round(currentRate * (1 + property.high_occ_bump_pct / 100));
        reason = `${occupancyPct}% occupancy — consider raising`;
      } else if (occupancyPct <= property.low_occ_threshold && occupancyPct > 0) {
        suggestedRate = Math.round(currentRate * (1 - property.low_occ_discount_pct / 100));
        reason = `${occupancyPct}% occupancy — consider a discount to fill rooms`;
      }

      if (isWeekend && property.weekend_multiplier && property.weekend_multiplier !== 1) {
        suggestedRate = Math.round(suggestedRate * property.weekend_multiplier);
        reason = (reason ? reason + '; ' : '') + 'weekend rate applied';
      }

      if (suggestedRate !== currentRate) {
        suggestions.push({
          date, room_type_id: rt.id, room_type_name: rt.name,
          occupancy_pct: occupancyPct, is_weekend: isWeekend,
          current_rate: currentRate, suggested_rate: suggestedRate, reason
        });
      }
    });
  }

  res.json({ suggestions, settings: {
    weekend_multiplier: property.weekend_multiplier,
    high_occ_threshold: property.high_occ_threshold,
    high_occ_bump_pct: property.high_occ_bump_pct,
    low_occ_threshold: property.low_occ_threshold,
    low_occ_discount_pct: property.low_occ_discount_pct
  }});
});

// PUT /api/revenue/settings - tune the suggestion thresholds (Manager/Admin)
router.put('/settings', requireRole('Manager'), (req, res) => {
  const propertyId = req.session.propertyId;
  const fields = ['weekend_multiplier', 'high_occ_threshold', 'high_occ_bump_pct', 'low_occ_threshold', 'low_occ_discount_pct'];
  const updates = [];
  const params = [];
  fields.forEach(f => {
    if (req.body[f] !== undefined) { updates.push(`${f} = ?`); params.push(req.body[f]); }
  });
  if (updates.length === 0) return res.json({ success: true });
  params.push(propertyId);
  db.prepare(`UPDATE properties SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  res.json({ success: true });
});

// POST /api/revenue/apply-suggestion - creates a single-day rate_plan from a suggestion
router.post('/apply-suggestion', requireRole('Manager'), (req, res) => {
  const propertyId = req.session.propertyId;
  const { room_type_id, date, rate, reason } = req.body;
  if (!room_type_id || !date || !rate) {
    return res.status(400).json({ error: 'room_type_id, date, and rate are required' });
  }
  const info = db.prepare(`
    INSERT INTO rate_plans (property_id, room_type_id, name, rate, valid_from, valid_to)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(propertyId, room_type_id, `Suggested: ${reason || date}`, rate, date, date);
  logActivity(db, req.session.userId, 'pricing_suggestion_applied', 'rate_plan', info.lastInsertRowid, { date, rate });
  res.json({ success: true, id: info.lastInsertRowid });
});

// ---------- Competitor rates (manual entry) ----------
router.get('/competitor-rates', (req, res) => {
  const propertyId = req.session.propertyId;
  const rates = db.prepare(`
    SELECT cr.*, rt.name as room_type_name
    FROM competitor_rates cr
    LEFT JOIN room_types rt ON cr.room_type_id = rt.id
    WHERE cr.property_id = ?
    ORDER BY cr.rate_date DESC LIMIT 100
  `).all(propertyId);
  res.json(rates);
});

router.post('/competitor-rates', requireRole('Manager'), (req, res) => {
  const propertyId = req.session.propertyId;
  const { room_type_id, competitor_name, rate, rate_date } = req.body;
  if (!competitor_name || !rate || !rate_date) {
    return res.status(400).json({ error: 'competitor_name, rate, and rate_date are required' });
  }
  const info = db.prepare(`
    INSERT INTO competitor_rates (property_id, room_type_id, competitor_name, rate, rate_date, created_by_user_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(propertyId, room_type_id || null, competitor_name, rate, rate_date, req.session.userId);
  res.json({ success: true, id: info.lastInsertRowid });
});

router.delete('/competitor-rates/:id', requireRole('Manager'), (req, res) => {
  db.prepare('DELETE FROM competitor_rates WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ---------- Add-ons / upsell catalog ----------
router.get('/addons', (req, res) => {
  const propertyId = req.session.propertyId;
  const addons = db.prepare('SELECT * FROM addons WHERE property_id = ? AND is_active = 1').all(propertyId);
  res.json(addons);
});

router.post('/addons', requireRole('Manager'), (req, res) => {
  const propertyId = req.session.propertyId;
  const { name, description, price, tax_rate } = req.body;
  if (!name || price === undefined) return res.status(400).json({ error: 'name and price are required' });
  const info = db.prepare(`
    INSERT INTO addons (property_id, name, description, price, tax_rate)
    VALUES (?, ?, ?, ?, ?)
  `).run(propertyId, name, description || null, price, tax_rate || 0);
  res.json({ success: true, id: info.lastInsertRowid });
});

router.put('/addons/:id', requireRole('Manager'), (req, res) => {
  const { id } = req.params;
  const fields = ['name', 'description', 'price', 'tax_rate', 'is_active'];
  const updates = [];
  const params = [];
  fields.forEach(f => { if (req.body[f] !== undefined) { updates.push(`${f} = ?`); params.push(req.body[f]); } });
  if (updates.length === 0) return res.json({ success: true });
  params.push(id);
  db.prepare(`UPDATE addons SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  res.json({ success: true });
});

router.delete('/addons/:id', requireRole('Manager'), (req, res) => {
  db.prepare('UPDATE addons SET is_active = 0 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// POST /api/revenue/addons/:id/apply/:folioId - post an add-on straight to a folio as a charge
router.post('/addons/:id/apply/:folioId', (req, res) => {
  const { id, folioId } = req.params;
  const addon = db.prepare('SELECT * FROM addons WHERE id = ?').get(id);
  if (!addon) return res.status(404).json({ error: 'Add-on not found' });
  const folio = db.prepare('SELECT * FROM folios WHERE id = ?').get(folioId);
  if (!folio) return res.status(404).json({ error: 'Folio not found' });
  if (folio.status !== 'open') return res.status(400).json({ error: 'Folio is not open' });

  const taxAmount = Math.round((addon.price * addon.tax_rate / 100) * 100) / 100;
  const info = db.prepare(`
    INSERT INTO folio_charges (folio_id, charge_type, description, amount, tax_rate, tax_amount, posted_by_user_id)
    VALUES (?, 'addon', ?, ?, ?, ?, ?)
  `).run(folioId, addon.name, addon.price, addon.tax_rate, taxAmount, req.session.userId);

  logActivity(db, req.session.userId, 'addon_applied', 'folio', folioId, { addon: addon.name });
  res.json({ success: true, id: info.lastInsertRowid });
});

module.exports = router;
