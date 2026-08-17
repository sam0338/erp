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

// INV-YYYY-00001, sequential per store within the calendar year (the
// UNIQUE constraint on sales is (store_id, invoice_no), so numbering only
// needs to be unique within a store, not globally).
function generateInvoiceNo(db, storeId) {
  const year = dayjs().format('YYYY');
  const row = db.prepare(
    `SELECT COUNT(*) as c FROM sales WHERE store_id = ? AND invoice_no LIKE ?`
  ).get(storeId, `INV-${year}-%`);
  const seq = String(row.c + 1).padStart(5, '0');
  return `INV-${year}-${seq}`;
}

// RET-YYYY-00001, sequential per store within the calendar year — an
// internal reference only, not a GST credit note number (see the note on
// sale_returns in db/schema.sql).
function generateReturnNo(db, storeId) {
  const year = dayjs().format('YYYY');
  const row = db.prepare(
    `SELECT COUNT(*) as c FROM sale_returns WHERE store_id = ? AND return_no LIKE ?`
  ).get(storeId, `RET-${year}-%`);
  const seq = String(row.c + 1).padStart(5, '0');
  return `RET-${year}-${seq}`;
}

module.exports = { logActivity, generateGrnNo, generateInvoiceNo, generateReturnNo };
