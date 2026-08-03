const express = require('express');
const db = require('../db/connection');
const { getEffectiveRate, nightsBetween } = require('../utils/helpers');
const { createReservation } = require('../utils/reservationEngine');

const router = express.Router();

function resolveProperty(code) {
  if (code) {
    return db.prepare('SELECT * FROM properties WHERE code = ? AND is_active = 1').get(code);
  }
  return db.prepare('SELECT * FROM properties WHERE is_active = 1 ORDER BY id LIMIT 1').get();
}

// GET /api/public/property?code=
router.get('/property', (req, res) => {
  const property = resolveProperty(req.query.code);
  if (!property) return res.status(404).json({ error: 'Property not found' });
  res.json({
    name: property.name, address: property.address, city: property.city, state: property.state,
    phone: property.phone, email: property.email, checkin_time: property.checkin_time,
    checkout_time: property.checkout_time, currency: property.currency, code: property.code
  });
});

// GET /api/public/availability?arrival=&departure=&code=&adults=
router.get('/availability', (req, res) => {
  const { arrival, departure, code } = req.query;
  if (!arrival || !departure) {
    return res.status(400).json({ error: 'arrival and departure dates are required' });
  }
  if (departure <= arrival) {
    return res.status(400).json({ error: 'departure must be after arrival' });
  }
  const property = resolveProperty(code);
  if (!property) return res.status(404).json({ error: 'Property not found' });

  const types = db.prepare(`
    SELECT rt.id, rt.name, rt.description, rt.max_occupancy, rt.base_rate, rt.extra_bed_rate,
      (SELECT COUNT(*) FROM rooms r
       WHERE r.room_type_id = rt.id AND r.property_id = ? AND r.is_active = 1
         AND r.status NOT IN ('out_of_order', 'out_of_service')
         AND r.id NOT IN (
           SELECT rr.room_id FROM reservation_rooms rr
           JOIN reservations res ON rr.reservation_id = res.id
           WHERE res.status IN ('confirmed', 'checked_in') AND rr.room_id IS NOT NULL
             AND NOT (res.departure_date <= ? OR res.arrival_date >= ?)
         )
      ) as available_count
    FROM room_types rt
    WHERE rt.property_id = ? AND rt.is_active = 1
  `).all(property.id, arrival, departure, property.id);

  const nights = nightsBetween(arrival, departure);

  const result = types.map(t => {
    const effective = getEffectiveRate(db, t.id, arrival);
    return {
      room_type_id: t.id,
      name: t.name,
      description: t.description,
      max_occupancy: t.max_occupancy,
      available_count: t.available_count,
      rate_per_night: effective ? effective.rate : t.base_rate,
      rate_source: effective ? effective.source : 'base',
      total_for_stay: (effective ? effective.rate : t.base_rate) * nights
    };
  }).filter(t => t.available_count > 0);

  res.json({ nights, room_types: result });
});

// POST /api/public/booking
// body: { code, arrival_date, departure_date, room_type_id, adults, children,
//         guest: { full_name, phone, email, address, city, state } }
router.post('/booking', (req, res) => {
  const { code, arrival_date, departure_date, room_type_id, adults, children, guest } = req.body;

  if (!arrival_date || !departure_date || !room_type_id) {
    return res.status(400).json({ error: 'arrival_date, departure_date, and room_type_id are required' });
  }
  if (!guest || !guest.full_name || !guest.phone) {
    return res.status(400).json({ error: 'Guest full name and phone are required' });
  }

  const property = resolveProperty(code);
  if (!property) return res.status(404).json({ error: 'Property not found' });

  // Re-check availability at the moment of booking to avoid a race with
  // someone else grabbing the last room between page-load and submit.
  const availableCount = db.prepare(`
    SELECT COUNT(*) as c FROM rooms r
    WHERE r.room_type_id = ? AND r.property_id = ? AND r.is_active = 1
      AND r.status NOT IN ('out_of_order', 'out_of_service')
      AND r.id NOT IN (
        SELECT rr.room_id FROM reservation_rooms rr
        JOIN reservations res ON rr.reservation_id = res.id
        WHERE res.status IN ('confirmed', 'checked_in') AND rr.room_id IS NOT NULL
          AND NOT (res.departure_date <= ? OR res.arrival_date >= ?)
      )
  `).get(room_type_id, property.id, arrival_date, departure_date).c;

  if (availableCount === 0) {
    return res.status(400).json({ error: 'Sorry, this room type just became fully booked for those dates. Please try different dates.' });
  }

  const effective = getEffectiveRate(db, room_type_id, arrival_date);
  if (!effective) return res.status(404).json({ error: 'Room type not found' });

  try {
    const result = createReservation(db, {
      propertyId: property.id,
      guest: {
        full_name: guest.full_name, phone: guest.phone, email: guest.email,
        address: guest.address, city: guest.city, state: guest.state
      },
      arrivalDate: arrival_date, departureDate: departure_date,
      adults: adults || 1, children: children || 0,
      rooms: [{ room_type_id, rate_per_night: effective.rate }],
      source: 'website',
      bookedByUserId: null
    });
    res.json({ success: true, booking_ref: result.bookingRef });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ---------- Guest self-service portal ----------
// Verifies a guest owns a booking by matching booking_ref + phone (last digits),
// since there's no login for the portal. Not bulletproof security, but keeps
// casual snooping out while requiring no account setup for guests.
function verifyGuestAccess(bookingRef, phone) {
  if (!bookingRef || !phone) return null;
  const cleanedPhone = phone.replace(/\D/g, '');
  const reservation = db.prepare(`
    SELECT res.*, g.full_name as guest_name, g.phone as guest_phone, g.email as guest_email
    FROM reservations res JOIN guests g ON res.guest_id = g.id
    WHERE res.booking_ref = ?
  `).get(bookingRef);
  if (!reservation || !reservation.guest_phone) return null;
  const storedPhone = reservation.guest_phone.replace(/\D/g, '');
  if (!storedPhone.endsWith(cleanedPhone.slice(-6)) && !cleanedPhone.endsWith(storedPhone.slice(-6))) return null;
  return reservation;
}

// POST /api/public/guest-lookup { booking_ref, phone }
router.post('/guest-lookup', (req, res) => {
  const { booking_ref, phone } = req.body;
  const reservation = verifyGuestAccess(booking_ref, phone);
  if (!reservation) return res.status(404).json({ error: 'No matching booking found. Check your booking reference and phone number.' });

  const rooms = db.prepare(`
    SELECT rr.*, r.room_number, rt.name as room_type_name
    FROM reservation_rooms rr LEFT JOIN rooms r ON rr.room_id = r.id
    JOIN room_types rt ON rr.room_type_id = rt.id WHERE rr.reservation_id = ?
  `).all(reservation.id);

  const folio = db.prepare('SELECT * FROM folios WHERE reservation_id = ?').get(reservation.id);
  let balance = 0;
  if (folio) {
    const charges = db.prepare('SELECT COALESCE(SUM(amount + tax_amount),0) as t FROM folio_charges WHERE folio_id = ?').get(folio.id).t;
    const paid = db.prepare('SELECT COALESCE(SUM(amount),0) as t FROM payments WHERE folio_id = ?').get(folio.id).t;
    balance = charges - paid;
  }

  res.json({
    booking_ref: reservation.booking_ref, guest_name: reservation.guest_name,
    status: reservation.status, arrival_date: reservation.arrival_date, departure_date: reservation.departure_date,
    rooms, balance, folio_id: folio ? folio.id : null
  });
});

// POST /api/public/service-request { booking_ref, phone, request_type, details }
router.post('/service-request', (req, res) => {
  const { booking_ref, phone, request_type, details } = req.body;
  const reservation = verifyGuestAccess(booking_ref, phone);
  if (!reservation) return res.status(404).json({ error: 'No matching booking found.' });
  if (!['housekeeping', 'food', 'laundry', 'extend_stay', 'other'].includes(request_type)) {
    return res.status(400).json({ error: 'Invalid request type' });
  }
  const info = db.prepare(`
    INSERT INTO service_requests (reservation_id, request_type, details)
    VALUES (?, ?, ?)
  `).run(reservation.id, request_type, details || null);
  res.json({ success: true, id: info.lastInsertRowid });
});

// POST /api/public/invoice { booking_ref, phone } - simplified invoice for guest download
router.post('/invoice', (req, res) => {
  const { booking_ref, phone } = req.body;
  const reservation = verifyGuestAccess(booking_ref, phone);
  if (!reservation) return res.status(404).json({ error: 'No matching booking found.' });

  const folio = db.prepare('SELECT * FROM folios WHERE reservation_id = ?').get(reservation.id);
  if (!folio) return res.status(404).json({ error: 'No folio found for this booking' });

  const charges = db.prepare('SELECT * FROM folio_charges WHERE folio_id = ? ORDER BY charge_date').all(folio.id);
  const payments = db.prepare('SELECT * FROM payments WHERE folio_id = ? ORDER BY paid_at').all(folio.id);
  const property = db.prepare('SELECT name, address, city, phone FROM properties WHERE id = ?').get(reservation.property_id);

  const subtotal = charges.reduce((s, c) => s + c.amount, 0);
  const tax = charges.reduce((s, c) => s + c.tax_amount, 0);
  const paid = payments.reduce((s, p) => s + p.amount, 0);

  res.json({
    property, reservation: { booking_ref: reservation.booking_ref, arrival_date: reservation.arrival_date, departure_date: reservation.departure_date, guest_name: reservation.guest_name },
    folio_number: folio.folio_number, charges, payments,
    summary: { subtotal, tax, grand_total: subtotal + tax, paid, balance: subtotal + tax - paid }
  });
});

// GET /api/public/ical/:roomTypeId.ics?token=
// Exports booked date ranges for a room type as a standard iCal feed —
// paste this URL into Booking.com/Airbnb/Google Calendar's "import
// calendar" field so they block dates that are already taken here.
router.get('/ical/:roomTypeId.ics', (req, res) => {
  const { roomTypeId } = req.params;
  const { token } = req.query;

  const roomType = db.prepare('SELECT * FROM room_types WHERE id = ?').get(roomTypeId);
  if (!roomType) return res.status(404).send('Not found');

  const property = db.prepare('SELECT * FROM properties WHERE id = ?').get(roomType.property_id);
  if (!property || !property.ical_token || property.ical_token !== token) {
    return res.status(403).send('Invalid or missing token');
  }

  const bookings = db.prepare(`
    SELECT DISTINCT res.booking_ref, res.arrival_date, res.departure_date
    FROM reservation_rooms rr
    JOIN reservations res ON rr.reservation_id = res.id
    WHERE rr.room_type_id = ? AND res.status IN ('confirmed', 'checked_in')
    ORDER BY res.arrival_date
  `).all(roomTypeId);

  const toIcalDate = (d) => d.replace(/-/g, '');
  const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  const events = bookings.map(b => [
    'BEGIN:VEVENT',
    `UID:${b.booking_ref}@veda-hotel-pms`,
    `DTSTAMP:${now}`,
    `DTSTART;VALUE=DATE:${toIcalDate(b.arrival_date)}`,
    `DTEND;VALUE=DATE:${toIcalDate(b.departure_date)}`,
    `SUMMARY:Booked - ${roomType.name}`,
    'END:VEVENT'
  ].join('\r\n')).join('\r\n');

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//VEDA Hotel PMS//EN',
    'CALSCALE:GREGORIAN',
    events,
    'END:VCALENDAR'
  ].join('\r\n');

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${roomType.name}-availability.ics"`);
  res.send(ics);
});

module.exports = router;
