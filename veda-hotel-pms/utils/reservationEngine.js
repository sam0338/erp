const { generateBookingRef, generateFolioNumber, nightsBetween, logActivity } = require('./helpers');

// Creates a full reservation: resolves/creates the guest, inserts the
// reservation + reservation_rooms, opens a folio, and pre-posts room
// charges with GST auto-applied from the room type + property settings.
// Returns { reservationId, bookingRef, folioId, folioNumber }.
// Throws a plain Error on validation failure — callers should catch and
// respond with 400.
function createReservation(db, {
  propertyId, guestId, guest, arrivalDate, departureDate, adults, children,
  rooms, source, specialRequests, bookedByUserId
}) {
  if (!arrivalDate || !departureDate || !rooms || !rooms.length) {
    throw new Error('arrival_date, departure_date, and at least one room are required');
  }
  if (departureDate <= arrivalDate) {
    throw new Error('departure_date must be after arrival_date');
  }

  const tx = db.transaction(() => {
    let resolvedGuestId = guestId;
    if (!resolvedGuestId && guest && guest.full_name) {
      const info = db.prepare(`
        INSERT INTO guests (full_name, email, phone, id_proof_type, id_proof_number, address, city, state, country, company_name, gstin)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(guest.full_name, guest.email || null, guest.phone || null, guest.id_proof_type || null,
        guest.id_proof_number || null, guest.address || null, guest.city || null, guest.state || null,
        guest.country || 'India', guest.company_name || null, guest.gstin || null);
      resolvedGuestId = info.lastInsertRowid;
    }
    if (!resolvedGuestId) throw new Error('guest_id or guest object required');

    const bookingRef = generateBookingRef(db);
    const resInfo = db.prepare(`
      INSERT INTO reservations (property_id, booking_ref, guest_id, source, status,
        arrival_date, departure_date, adults, children, booked_by_user_id, special_requests)
      VALUES (?, ?, ?, ?, 'confirmed', ?, ?, ?, ?, ?, ?)
    `).run(propertyId, bookingRef, resolvedGuestId, source || 'walk_in',
      arrivalDate, departureDate, adults || 1, children || 0, bookedByUserId || null, specialRequests || null);

    const reservationId = resInfo.lastInsertRowid;
    const nights = nightsBetween(arrivalDate, departureDate);

    const insertRR = db.prepare(`
      INSERT INTO reservation_rooms (reservation_id, room_id, room_type_id, rate_per_night, status)
      VALUES (?, ?, ?, ?, 'reserved')
    `);
    rooms.forEach(r => insertRR.run(reservationId, r.room_id || null, r.room_type_id, r.rate_per_night));

    const folioNumber = generateFolioNumber(db);
    const folioInfo = db.prepare(`
      INSERT INTO folios (reservation_id, folio_number, status)
      VALUES (?, ?, 'open')
    `).run(reservationId, folioNumber);
    const folioId = folioInfo.lastInsertRowid;

    const property = db.prepare('SELECT is_gst_registered FROM properties WHERE id = ?').get(propertyId);
    const insertCharge = db.prepare(`
      INSERT INTO folio_charges (folio_id, charge_type, description, amount, tax_rate, tax_amount, posted_by_user_id)
      VALUES (?, 'room', ?, ?, ?, ?, ?)
    `);
    rooms.forEach(r => {
      const total = r.rate_per_night * nights;
      const roomType = db.prepare('SELECT gst_rate FROM room_types WHERE id = ?').get(r.room_type_id);
      const taxRate = property.is_gst_registered ? (roomType ? roomType.gst_rate || 0 : 0) : 0;
      const taxAmount = Math.round((total * taxRate / 100) * 100) / 100;
      insertCharge.run(
        folioId,
        `Room charge (${nights} night${nights > 1 ? 's' : ''} @ ${r.rate_per_night})`,
        total, taxRate, taxAmount, bookedByUserId || null
      );
    });

    if (bookedByUserId) {
      logActivity(db, bookedByUserId, 'reservation_created', 'reservation', reservationId, { bookingRef, source });
    }

    return { reservationId, bookingRef, folioId, folioNumber };
  });

  return tx();
}

module.exports = { createReservation };
