const express = require('express');
const dayjs = require('dayjs');
const db = require('../db/connection');

const router = express.Router();

router.get('/summary', (req, res) => {
  const propertyId = req.session.propertyId;
  const today = dayjs().format('YYYY-MM-DD');

  const totalRooms = db.prepare('SELECT COUNT(*) as c FROM rooms WHERE property_id = ? AND is_active = 1').get(propertyId).c;
  const occupied = db.prepare(`
    SELECT COUNT(*) as c FROM rooms WHERE property_id = ? AND status IN ('occupied_clean','occupied_dirty')
  `).get(propertyId).c;
  const outOfOrder = db.prepare(`
    SELECT COUNT(*) as c FROM rooms WHERE property_id = ? AND status IN ('out_of_order','out_of_service')
  `).get(propertyId).c;

  const arrivalsToday = db.prepare(`
    SELECT COUNT(*) as c FROM reservations
    WHERE property_id = ? AND arrival_date = ? AND status = 'confirmed'
  `).get(propertyId, today).c;

  const departuresToday = db.prepare(`
    SELECT COUNT(*) as c FROM reservations
    WHERE property_id = ? AND departure_date = ? AND status = 'checked_in'
  `).get(propertyId, today).c;

  const inHouse = db.prepare(`
    SELECT COUNT(*) as c FROM reservations WHERE property_id = ? AND status = 'checked_in'
  `).get(propertyId).c;

  const revenueToday = db.prepare(`
    SELECT COALESCE(SUM(p.amount), 0) as t
    FROM payments p
    JOIN folios f ON p.folio_id = f.id
    JOIN reservations res ON f.reservation_id = res.id
    WHERE res.property_id = ? AND date(p.paid_at) = ?
  `).get(propertyId, today).t;

  const occupancyPct = totalRooms > 0 ? Math.round((occupied / totalRooms) * 1000) / 10 : 0;

  res.json({
    total_rooms: totalRooms,
    occupied_rooms: occupied,
    vacant_rooms: totalRooms - occupied - outOfOrder,
    out_of_order_rooms: outOfOrder,
    occupancy_pct: occupancyPct,
    arrivals_today: arrivalsToday,
    departures_today: departuresToday,
    in_house: inHouse,
    revenue_today: revenueToday
  });
});

module.exports = router;
