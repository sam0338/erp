const express = require('express');
const db = require('../db/connection');
const {
  generateBookingRef, generateFolioNumber, nightsBetween, logActivity
} = require('../utils/helpers');
const { createReservation } = require('../utils/reservationEngine');

const router = express.Router();

// GET /api/reservations?status=&date=
router.get('/', (req, res) => {
  const propertyId = req.session.propertyId;
  const { status, date } = req.query;

  let query = `
    SELECT res.*, g.full_name as guest_name, g.phone as guest_phone
    FROM reservations res
    JOIN guests g ON res.guest_id = g.id
    WHERE res.property_id = ?
  `;
  const params = [propertyId];

  if (status) {
    query += ' AND res.status = ?';
    params.push(status);
  }
  if (date) {
    query += ' AND ? BETWEEN res.arrival_date AND res.departure_date';
    params.push(date);
  }
  query += ' ORDER BY res.arrival_date DESC LIMIT 200';

  const reservations = db.prepare(query).all(...params);
  res.json(reservations);
});

// GET /api/reservations/:id - full detail
router.get('/:id', (req, res) => {
  const { id } = req.params;
  const reservation = db.prepare(`
    SELECT res.*, g.full_name as guest_name, g.phone as guest_phone, g.email as guest_email,
           g.id_proof_type, g.id_proof_number
    FROM reservations res
    JOIN guests g ON res.guest_id = g.id
    WHERE res.id = ?
  `).get(id);
  if (!reservation) return res.status(404).json({ error: 'Reservation not found' });

  const rooms = db.prepare(`
    SELECT rr.*, r.room_number, rt.name as room_type_name
    FROM reservation_rooms rr
    LEFT JOIN rooms r ON rr.room_id = r.id
    JOIN room_types rt ON rr.room_type_id = rt.id
    WHERE rr.reservation_id = ?
  `).all(id);

  const folio = db.prepare('SELECT * FROM folios WHERE reservation_id = ?').get(id);
  let charges = [], payments = [];
  if (folio) {
    charges = db.prepare('SELECT * FROM folio_charges WHERE folio_id = ? ORDER BY charge_date').all(folio.id);
    payments = db.prepare('SELECT * FROM payments WHERE folio_id = ? ORDER BY paid_at').all(folio.id);
  }

  res.json({ ...reservation, rooms, folio, charges, payments });
});

// POST /api/reservations - create new booking
// body: { guest: {...} OR guest_id, arrival_date, departure_date, adults, children,
//         rooms: [{ room_type_id, room_id (optional), rate_per_night }], source, special_requests }
router.post('/', (req, res) => {
  const propertyId = req.session.propertyId;
  const {
    guest_id, guest, arrival_date, departure_date, adults, children,
    rooms, source, special_requests
  } = req.body;

  try {
    const result = createReservation(db, {
      propertyId, guestId: guest_id, guest, arrivalDate: arrival_date, departureDate: departure_date,
      adults, children, rooms, source, specialRequests: special_requests, bookedByUserId: req.session.userId
    });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /api/reservations/:id/assign-room
// body: { reservation_room_id, room_id }
// Lets front office assign/re-assign a specific room any time after booking,
// independent of check-in. Room must be vacant and not already booked over
// the reservation's date range.
router.patch('/:id/assign-room', (req, res) => {
  const { id } = req.params;
  const { reservation_room_id, room_id } = req.body;

  if (!reservation_room_id || !room_id) {
    return res.status(400).json({ error: 'reservation_room_id and room_id are required' });
  }

  const reservation = db.prepare('SELECT * FROM reservations WHERE id = ?').get(id);
  if (!reservation) return res.status(404).json({ error: 'Reservation not found' });
  if (!['confirmed', 'checked_in'].includes(reservation.status)) {
    return res.status(400).json({ error: `Cannot assign a room on a reservation with status '${reservation.status}'` });
  }

  const rr = db.prepare('SELECT * FROM reservation_rooms WHERE id = ? AND reservation_id = ?').get(reservation_room_id, id);
  if (!rr) return res.status(404).json({ error: 'Reservation room line not found' });

  const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(room_id);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  if (room.property_id !== reservation.property_id) {
    return res.status(400).json({ error: 'Room belongs to a different property' });
  }
  if (room.room_type_id !== rr.room_type_id) {
    return res.status(400).json({ error: `Room ${room.room_number} is a different room type than booked` });
  }
  if (['out_of_order', 'out_of_service'].includes(room.status)) {
    return res.status(400).json({ error: `Room ${room.room_number} is ${room.status.replace('_', ' ')}` });
  }

  // Check for a clashing reservation on this room over the stay dates (excluding this reservation itself)
  const clash = db.prepare(`
    SELECT res.booking_ref FROM reservation_rooms rr2
    JOIN reservations res ON rr2.reservation_id = res.id
    WHERE rr2.room_id = ? AND rr2.reservation_id != ?
      AND res.status IN ('confirmed', 'checked_in')
      AND NOT (res.departure_date <= ? OR res.arrival_date >= ?)
  `).get(room_id, id, reservation.arrival_date, reservation.departure_date);
  if (clash) {
    return res.status(400).json({ error: `Room ${room.room_number} is already booked under ${clash.booking_ref} for overlapping dates` });
  }

  db.prepare('UPDATE reservation_rooms SET room_id = ? WHERE id = ?').run(room_id, reservation_room_id);
  logActivity(db, req.session.userId, 'room_assigned', 'reservation', id, { room_id, room_number: room.room_number });

  res.json({ success: true, room_number: room.room_number });
});

// Finds the first available, matching-type room for a stay window.
// Excludes OOO/OOS rooms and rooms already booked by an overlapping
// confirmed/checked_in reservation (other than the one being checked in).
function findAvailableRoom(propertyId, roomTypeId, arrival, departure, excludeReservationId) {
  return db.prepare(`
    SELECT r.* FROM rooms r
    WHERE r.property_id = ? AND r.room_type_id = ? AND r.is_active = 1
      AND r.status NOT IN ('out_of_order', 'out_of_service')
      AND r.id NOT IN (
        SELECT rr.room_id FROM reservation_rooms rr
        JOIN reservations res ON rr.reservation_id = res.id
        WHERE res.status IN ('confirmed', 'checked_in')
          AND rr.room_id IS NOT NULL
          AND res.id != ?
          AND NOT (res.departure_date <= ? OR res.arrival_date >= ?)
      )
    ORDER BY r.room_number
    LIMIT 1
  `).get(propertyId, roomTypeId, excludeReservationId, arrival, departure);
}

// POST /api/reservations/:id/checkin
// body: { room_assignments: [{ reservation_room_id, room_id }], auto_assign }
// auto_assign defaults to true — any room line still unassigned after
// room_assignments is applied gets the first available matching room.
// Pass auto_assign: false to require explicit assignment instead.
router.post('/:id/checkin', (req, res) => {
  const { id } = req.params;
  const { room_assignments, auto_assign } = req.body;
  const shouldAutoAssign = auto_assign !== false;

  const reservation = db.prepare('SELECT * FROM reservations WHERE id = ?').get(id);
  if (!reservation) return res.status(404).json({ error: 'Reservation not found' });
  if (reservation.status !== 'confirmed') {
    return res.status(400).json({ error: `Cannot check in a reservation with status '${reservation.status}'` });
  }

  const tx = db.transaction(() => {
    const rrRows = db.prepare('SELECT * FROM reservation_rooms WHERE reservation_id = ?').all(id);
    const autoAssigned = [];

    rrRows.forEach(rr => {
      let roomId = rr.room_id;
      if (!roomId && room_assignments) {
        const assignment = room_assignments.find(a => a.reservation_room_id === rr.id);
        if (assignment) roomId = assignment.room_id;
      }
      if (!roomId && shouldAutoAssign) {
        const found = findAvailableRoom(reservation.property_id, rr.room_type_id, reservation.arrival_date, reservation.departure_date, reservation.id);
        if (found) {
          roomId = found.id;
          autoAssigned.push(found.room_number);
        }
      }
      if (!roomId) throw new Error(`No room available to assign for this booking's room type — it may be fully booked for these dates`);

      const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId);
      if (!room) throw new Error(`Room ${roomId} not found`);
      if (!['vacant_clean', 'vacant_dirty'].includes(room.status)) {
        throw new Error(`Room ${room.room_number} is not available (status: ${room.status})`);
      }

      db.prepare(`
        UPDATE reservation_rooms SET room_id = ?, status = 'checked_in', checkin_datetime = datetime('now')
        WHERE id = ?
      `).run(roomId, rr.id);

      db.prepare(`UPDATE rooms SET status = 'occupied_clean' WHERE id = ?`).run(roomId);
      db.prepare(`
        INSERT INTO housekeeping_log (room_id, previous_status, new_status, changed_by_user_id, remarks)
        VALUES (?, ?, 'occupied_clean', ?, 'Guest checked in')
      `).run(roomId, room.status, req.session.userId);
    });

    db.prepare(`UPDATE reservations SET status = 'checked_in' WHERE id = ?`).run(id);
    logActivity(db, req.session.userId, 'checked_in', 'reservation', id, { autoAssigned });
    return autoAssigned;
  });

  try {
    const autoAssigned = tx();
    res.json({ success: true, auto_assigned: autoAssigned });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/reservations/:id/checkout
router.post('/:id/checkout', (req, res) => {
  const { id } = req.params;
  const reservation = db.prepare('SELECT * FROM reservations WHERE id = ?').get(id);
  if (!reservation) return res.status(404).json({ error: 'Reservation not found' });
  if (reservation.status !== 'checked_in') {
    return res.status(400).json({ error: `Cannot check out a reservation with status '${reservation.status}'` });
  }

  // Ensure folio is settled (balance <= 0) before allowing checkout
  const folio = db.prepare('SELECT * FROM folios WHERE reservation_id = ?').get(id);
  if (folio) {
    const chargeTotal = db.prepare('SELECT COALESCE(SUM(amount + tax_amount),0) as t FROM folio_charges WHERE folio_id = ?').get(folio.id).t;
    const paidTotal = db.prepare('SELECT COALESCE(SUM(amount),0) as t FROM payments WHERE folio_id = ?').get(folio.id).t;
    const balance = chargeTotal - paidTotal;
    if (balance > 0.5) {
      return res.status(400).json({ error: `Outstanding balance of ${balance.toFixed(2)} must be settled before checkout`, balance });
    }
  }

  const tx = db.transaction(() => {
    const rrRows = db.prepare('SELECT * FROM reservation_rooms WHERE reservation_id = ?').all(id);
    rrRows.forEach(rr => {
      if (!rr.room_id) return;
      db.prepare(`UPDATE reservation_rooms SET status = 'checked_out', checkout_datetime = datetime('now') WHERE id = ?`).run(rr.id);
      const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(rr.room_id);
      db.prepare(`UPDATE rooms SET status = 'vacant_dirty', housekeeping_status = 'dirty' WHERE id = ?`).run(rr.room_id);
      db.prepare(`
        INSERT INTO housekeeping_log (room_id, previous_status, new_status, changed_by_user_id, remarks)
        VALUES (?, ?, 'vacant_dirty', ?, 'Guest checked out')
      `).run(rr.room_id, room.status, req.session.userId);
    });

    db.prepare(`UPDATE reservations SET status = 'checked_out' WHERE id = ?`).run(id);
    if (folio) {
      db.prepare(`UPDATE folios SET status = 'settled', settled_at = datetime('now') WHERE id = ?`).run(folio.id);
      // Award loyalty points: 1 point per Rs.100 paid on this stay
      const paidTotal = db.prepare('SELECT COALESCE(SUM(amount),0) as t FROM payments WHERE folio_id = ?').get(folio.id).t;
      const pointsEarned = Math.floor(paidTotal / 100);
      if (pointsEarned > 0) {
        db.prepare('UPDATE guests SET loyalty_points = loyalty_points + ? WHERE id = ?').run(pointsEarned, reservation.guest_id);
      }
    }
    logActivity(db, req.session.userId, 'checked_out', 'reservation', id, null);
  });

  try {
    tx();
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/reservations/:id/no-show
router.post('/:id/no-show', (req, res) => {
  const { id } = req.params;
  const reservation = db.prepare('SELECT * FROM reservations WHERE id = ?').get(id);
  if (!reservation) return res.status(404).json({ error: 'Reservation not found' });
  if (reservation.status !== 'confirmed') {
    return res.status(400).json({ error: `Cannot mark a reservation with status '${reservation.status}' as no-show` });
  }
  db.prepare(`UPDATE reservations SET status = 'no_show' WHERE id = ?`).run(id);
  logActivity(db, req.session.userId, 'marked_no_show', 'reservation', id, null);
  res.json({ success: true });
});

// POST /api/reservations/:id/cancel
router.post('/:id/cancel', (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const reservation = db.prepare('SELECT * FROM reservations WHERE id = ?').get(id);
  if (!reservation) return res.status(404).json({ error: 'Reservation not found' });
  if (!['confirmed'].includes(reservation.status)) {
    return res.status(400).json({ error: `Cannot cancel a reservation with status '${reservation.status}'` });
  }

  db.prepare(`
    UPDATE reservations SET status = 'cancelled', cancelled_at = datetime('now'), cancel_reason = ?
    WHERE id = ?
  `).run(reason || null, id);

  logActivity(db, req.session.userId, 'cancelled', 'reservation', id, { reason });
  res.json({ success: true });
});

module.exports = router;
