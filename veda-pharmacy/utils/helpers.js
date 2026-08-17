const dayjs = require('dayjs');

function logActivity(db, userId, action, entityType, entityId, details) {
  db.prepare(`
    INSERT INTO activity_log (user_id, action, entity_type, entity_id, details)
    VALUES (?, ?, ?, ?, ?)
  `).run(userId, action, entityType, entityId, details ? JSON.stringify(details) : null);
}

// GRN-YYYY-00001, sequential within the calendar year, counting existing
// rows rather than a separate counter table — fine at pharmacy-scale
// volumes and self-heals if a row is ever deleted.
function generateGrnNo(db) {
  const year = dayjs().format('YYYY');
  const row = db.prepare(
    `SELECT COUNT(*) as c FROM purchases WHERE grn_no LIKE ?`
  ).get(`GRN-${year}-%`);
  const seq = String(row.c + 1).padStart(5, '0');
  return `GRN-${year}-${seq}`;
}

module.exports = { logActivity, generateGrnNo };
