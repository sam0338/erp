const express = require('express');
const dayjs = require('dayjs');
const db = require('../db/connection');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

function computePropertyAnalytics(propertyId, from, to) {
  const totalRooms = db.prepare('SELECT COUNT(*) as c FROM rooms WHERE property_id = ? AND is_active = 1').get(propertyId).c;
  const numDays = Math.max(dayjs(to).diff(dayjs(from), 'day') + 1, 1);

  // Occupancy trend: for each day, count distinct occupied room-nights
  const occupancyTrend = [];
  for (let i = 0; i < numDays; i++) {
    const date = dayjs(from).add(i, 'day').format('YYYY-MM-DD');
    const nextDate = dayjs(from).add(i + 1, 'day').format('YYYY-MM-DD');
    const occupied = db.prepare(`
      SELECT COUNT(DISTINCT rr.room_id) as c
      FROM reservation_rooms rr
      JOIN reservations res ON rr.reservation_id = res.id
      WHERE res.property_id = ? AND res.status IN ('confirmed', 'checked_in', 'checked_out')
        AND rr.room_id IS NOT NULL
        AND NOT (res.departure_date <= ? OR res.arrival_date >= ?)
    `).get(propertyId, date, nextDate).c;
    occupancyTrend.push({ date, occupied, total: totalRooms, occupancy_pct: totalRooms > 0 ? Math.round((occupied / totalRooms) * 1000) / 10 : 0 });
  }

  // Room revenue in range (by charge_date)
  const roomRevenueRow = db.prepare(`
    SELECT COALESCE(SUM(fc.amount + fc.tax_amount), 0) as total, COUNT(*) as charge_count
    FROM folio_charges fc
    JOIN folios f ON fc.folio_id = f.id
    JOIN reservations res ON f.reservation_id = res.id
    WHERE res.property_id = ? AND fc.charge_type = 'room' AND date(fc.charge_date) BETWEEN ? AND ?
  `).get(propertyId, from, to);

  const roomNightsSold = db.prepare(`
    SELECT COUNT(*) as c
    FROM reservation_rooms rr
    JOIN reservations res ON rr.reservation_id = res.id
    WHERE res.property_id = ? AND res.status IN ('confirmed', 'checked_in', 'checked_out')
      AND res.arrival_date BETWEEN ? AND ?
  `).get(propertyId, from, to).c;

  const adr = roomNightsSold > 0 ? Math.round((roomRevenueRow.total / roomNightsSold) * 100) / 100 : 0;
  const revpar = (totalRooms * numDays) > 0 ? Math.round((roomRevenueRow.total / (totalRooms * numDays)) * 100) / 100 : 0;

  // Booking source breakdown
  const sourceBreakdown = db.prepare(`
    SELECT source, COUNT(*) as count
    FROM reservations
    WHERE property_id = ? AND arrival_date BETWEEN ? AND ?
    GROUP BY source
  `).all(propertyId, from, to);

  // Cancellation / no-show rates
  const statusCounts = db.prepare(`
    SELECT status, COUNT(*) as count
    FROM reservations
    WHERE property_id = ? AND arrival_date BETWEEN ? AND ?
    GROUP BY status
  `).all(propertyId, from, to);
  const totalReservations = statusCounts.reduce((s, r) => s + r.count, 0);
  const cancelledCount = (statusCounts.find(r => r.status === 'cancelled') || {}).count || 0;
  const noShowCount = (statusCounts.find(r => r.status === 'no_show') || {}).count || 0;

  // Revenue by room type
  const revenueByRoomType = db.prepare(`
    SELECT rt.name as room_type_name, COALESCE(SUM(fc.amount + fc.tax_amount), 0) as revenue
    FROM folio_charges fc
    JOIN folios f ON fc.folio_id = f.id
    JOIN reservations res ON f.reservation_id = res.id
    JOIN reservation_rooms rr ON rr.reservation_id = res.id
    JOIN room_types rt ON rr.room_type_id = rt.id
    WHERE res.property_id = ? AND fc.charge_type = 'room' AND date(fc.charge_date) BETWEEN ? AND ?
    GROUP BY rt.id
    ORDER BY revenue DESC
  `).all(propertyId, from, to);

  return {
    total_rooms: totalRooms,
    occupancy_trend: occupancyTrend,
    adr, revpar,
    total_room_revenue: roomRevenueRow.total,
    room_nights_sold: roomNightsSold,
    source_breakdown: sourceBreakdown,
    total_reservations: totalReservations,
    cancellation_pct: totalReservations > 0 ? Math.round((cancelledCount / totalReservations) * 1000) / 10 : 0,
    no_show_pct: totalReservations > 0 ? Math.round((noShowCount / totalReservations) * 1000) / 10 : 0,
    revenue_by_room_type: revenueByRoomType
  };
}

// GET /api/analytics/summary?from=&to=
router.get('/summary', (req, res) => {
  const propertyId = req.session.propertyId;
  const from = req.query.from || dayjs().subtract(30, 'day').format('YYYY-MM-DD');
  const to = req.query.to || dayjs().format('YYYY-MM-DD');
  res.json(computePropertyAnalytics(propertyId, from, to));
});

// GET /api/analytics/multi-property?from=&to= - comparison across all properties (Admin only)
router.get('/multi-property', requireRole('Manager'), (req, res) => {
  const from = req.query.from || dayjs().subtract(30, 'day').format('YYYY-MM-DD');
  const to = req.query.to || dayjs().format('YYYY-MM-DD');
  const properties = db.prepare('SELECT id, name, city FROM properties WHERE is_active = 1').all();

  const comparison = properties.map(p => {
    const stats = computePropertyAnalytics(p.id, from, to);
    return {
      property_id: p.id, property_name: p.name, city: p.city,
      total_rooms: stats.total_rooms, adr: stats.adr, revpar: stats.revpar,
      total_room_revenue: stats.total_room_revenue, total_reservations: stats.total_reservations,
      cancellation_pct: stats.cancellation_pct
    };
  });

  res.json({ from, to, properties: comparison });
});

module.exports = router;
