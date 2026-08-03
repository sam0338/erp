const dayjs = require('dayjs');

function generateBookingRef(db) {
  const year = dayjs().format('YYYY');
  const row = db.prepare(
    `SELECT COUNT(*) as c FROM reservations WHERE booking_ref LIKE ?`
  ).get(`RES-${year}-%`);
  const seq = String(row.c + 1).padStart(5, '0');
  return `RES-${year}-${seq}`;
}

function generateFolioNumber(db) {
  const year = dayjs().format('YYYY');
  const row = db.prepare(
    `SELECT COUNT(*) as c FROM folios WHERE folio_number LIKE ?`
  ).get(`FOL-${year}-%`);
  const seq = String(row.c + 1).padStart(5, '0');
  return `FOL-${year}-${seq}`;
}

function nightsBetween(arrival, departure) {
  const a = dayjs(arrival);
  const d = dayjs(departure);
  const n = d.diff(a, 'day');
  return n > 0 ? n : 1;
}

function logActivity(db, userId, action, entityType, entityId, details) {
  db.prepare(`
    INSERT INTO activity_log (user_id, action, entity_type, entity_id, details)
    VALUES (?, ?, ?, ?, ?)
  `).run(userId, action, entityType, entityId, details ? JSON.stringify(details) : null);
}

// Resolves the rate to charge for a room type on a given arrival date,
// checking seasonal rate_plans first (most specific date range wins),
// falling back to the room type's base_rate.
function getEffectiveRate(db, roomTypeId, arrivalDate) {
  const roomType = db.prepare('SELECT * FROM room_types WHERE id = ?').get(roomTypeId);
  if (!roomType) return null;

  const plans = db.prepare(`
    SELECT * FROM rate_plans
    WHERE room_type_id = ? AND is_active = 1
      AND valid_from <= ? AND valid_to >= ?
  `).all(roomTypeId, arrivalDate, arrivalDate);

  if (plans.length === 0) {
    return { rate: roomType.base_rate, source: 'base', plan_name: null };
  }

  // Most specific (shortest date range) wins if multiple seasonal plans overlap
  plans.sort((a, b) => {
    const spanA = new Date(a.valid_to) - new Date(a.valid_from);
    const spanB = new Date(b.valid_to) - new Date(b.valid_from);
    return spanA - spanB;
  });

  return { rate: plans[0].rate, source: 'seasonal', plan_name: plans[0].name };
}

function generateToken() {
  return require('crypto').randomBytes(16).toString('hex');
}

module.exports = { generateBookingRef, generateFolioNumber, nightsBetween, logActivity, getEffectiveRate, generateToken };
