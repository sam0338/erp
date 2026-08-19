const express = require('express');
const multer = require('multer');
const ExcelJS = require('exceljs');
const db = require('../db/connection');
const { logActivity, generateStockInNo } = require('../utils/helpers');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

// Direct Stock In: how a store's existing shelf stock gets into this app
// when it first adopts it — there's no distributor invoice for stock that
// was never "received" through the system, so the GRN flow (routes/
// purchases.js, which requires a distributor + invoice_no) doesn't fit.
// See the note on stock_in_entries in db/schema.sql for why this is its
// own table rather than more nullable columns on purchases.

const VALID_SCHEDULES = ['OTC', 'H', 'H1', 'X'];
const TEMPLATE_HEADERS = [
  'Medicine Name*', 'Generic Name', 'Manufacturer', 'HSN Code', 'GST Rate (%)',
  'Schedule (OTC/H/H1/X)', 'Drug Form', 'Pack Size', 'Unit', 'Category',
  'Batch No*', 'Mfg Date (YYYY-MM-DD)', 'Expiry Date* (YYYY-MM-DD)',
  'Quantity*', 'Purchase Rate (Rs)*', 'MRP (Rs)*', 'Supplier Name', 'Reference No', 'Notes'
];

// Small in-memory upload only — the file is parsed and discarded, never
// written to disk. fileSize capped well below anything a legitimate stock
// list needs, mainly to bound how much a single request can make the
// (known ReDoS-prone, see package.json note) xlsx parser chew through.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const okExt = /\.xlsx$/i.test(file.originalname || '');
    if (!okExt) return cb(new Error('Only .xlsx files are accepted'));
    cb(null, true);
  }
});

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// GET /api/stock-in - recent entries for this store, newest first
router.get('/', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 500);
  const rows = db.prepare(`
    SELECT sie.*, i.name AS item_name, i.unit, b.batch_no, b.expiry_date,
      d.name AS distributor_name
    FROM stock_in_entries sie
    JOIN items i ON sie.item_id = i.id
    JOIN batches b ON sie.batch_id = b.id
    LEFT JOIN distributors d ON sie.distributor_id = d.id
    WHERE sie.store_id = ?
    ORDER BY sie.id DESC
    LIMIT ?
  `).all(req.session.storeId, limit);
  res.json(rows);
});

// POST /api/stock-in - manual single-entry direct stock in: creates the
// batch and its stock_in_entries record together, same transactional
// pattern as a GRN line in routes/purchases.js.
router.post('/', requireRole('Pharmacist', 'Accounts'), (req, res) => {
  const { item_id, batch_no, mfg_date, expiry_date, distributor_id, supplier_name, reference_no, notes } = req.body;
  const quantity = parseInt(req.body.quantity, 10);
  const purchaseRate = parseFloat(req.body.purchase_rate);
  const mrp = parseFloat(req.body.mrp);

  if (!item_id) return res.status(400).json({ error: 'item_id is required' });
  if (!batch_no || !String(batch_no).trim()) return res.status(400).json({ error: 'batch_no is required' });
  if (!expiry_date) return res.status(400).json({ error: 'expiry_date is required' });
  if (!Number.isFinite(quantity) || quantity <= 0) return res.status(400).json({ error: 'quantity must be a positive number' });
  if (!Number.isFinite(purchaseRate) || purchaseRate < 0) return res.status(400).json({ error: 'purchase_rate must be a non-negative number' });
  if (!Number.isFinite(mrp) || mrp < 0) return res.status(400).json({ error: 'mrp must be a non-negative number' });

  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(item_id);
  if (!item) return res.status(400).json({ error: 'Item not found' });

  let distributor = null;
  if (distributor_id) {
    distributor = db.prepare('SELECT * FROM distributors WHERE id = ? AND is_active = 1').get(distributor_id);
    if (!distributor) return res.status(400).json({ error: 'Distributor not found or inactive' });
  }

  const storeId = req.session.storeId;
  try {
    const entryId = db.transaction(() => {
      const batchInfo = db.prepare(`
        INSERT INTO batches (item_id, store_id, batch_no, mfg_date, expiry_date, quantity, purchase_rate, mrp, distributor_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(item_id, storeId, String(batch_no).trim(), mfg_date || null, expiry_date, quantity, purchaseRate, mrp, distributor ? distributor.id : null);

      const entryNo = generateStockInNo(db, storeId);
      const info = db.prepare(`
        INSERT INTO stock_in_entries (
          store_id, item_id, batch_id, entry_no, quantity, purchase_rate, mrp,
          distributor_id, supplier_name, reference_no, notes, source, created_by_user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Manual', ?)
      `).run(
        storeId, item_id, batchInfo.lastInsertRowid, entryNo, quantity, purchaseRate, mrp,
        distributor ? distributor.id : null, supplier_name || null, reference_no || null, notes || null,
        req.session.userId
      );
      return info.lastInsertRowid;
    })();

    logActivity(db, req.session.userId, 'stock_in', 'stock_in_entry', entryId, { item: item.name, quantity });
    res.json({ success: true, id: entryId, quantity });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// GET /api/stock-in/template - downloadable .xlsx starter sheet for bulk
// import: header row + one clearly-marked example row + an Instructions
// sheet. Built fresh on every request (cheap, tiny file) so it can never
// drift out of sync with what POST /api/stock-in/bulk actually accepts.
router.get('/template', async (req, res) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'VEDA Pharmacy';

  const sheet = workbook.addWorksheet('Stock In');
  sheet.addRow(TEMPLATE_HEADERS);
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F3D5C' } };
  sheet.getRow(1).eachCell(cell => { cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }; });
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.columns.forEach(col => { col.width = 20; });

  const example = sheet.addRow([
    'Paracetamol 500mg', 'Paracetamol', 'ABC Pharma', '30049099', 12,
    'OTC', 'Tablet', '1x10', 'Strip', 'Analgesic',
    'BTH2024001', '2024-01-01', '2027-01-01',
    100, 2.5, 5, 'Old Stock / Opening Balance', '', 'Example row — delete before uploading'
  ]);
  example.font = { italic: true, color: { argb: 'FF64748B' } };

  const info = workbook.addWorksheet('Instructions');
  info.columns = [{ width: 24 }, { width: 70 }];
  info.addRows([
    ['Column', 'Notes'],
    ['Medicine Name*', 'Required. Matched case-insensitively against your existing Item Master — if no match is found, a new item is created automatically using this row\'s Generic Name/Manufacturer/etc. columns.'],
    ['Generic Name / Manufacturer / HSN Code / Pack Size / Category', 'Optional — only used when a new item is being created for this row.'],
    ['GST Rate (%)', `Optional, only used for a new item. Defaults to your Shop Settings default GST rate.`],
    ['Schedule (OTC/H/H1/X)', `Optional, only used for a new item. One of: ${VALID_SCHEDULES.join(', ')}. Defaults to OTC.`],
    ['Drug Form', 'Optional, e.g. Tablet, Capsule, Syrup.'],
    ['Unit', 'Optional, only used for a new item, e.g. Strip, Box, Bottle. Defaults to Strip.'],
    ['Batch No*', 'Required. Your own batch/lot number for this stock.'],
    ['Mfg Date (YYYY-MM-DD)', 'Optional.'],
    ['Expiry Date* (YYYY-MM-DD)', 'Required.'],
    ['Quantity*', 'Required, whole number greater than 0.'],
    ['Purchase Rate (Rs)*', 'Required, your cost price per unit (0 is fine if unknown).'],
    ['MRP (Rs)*', 'Required, the printed MRP per unit.'],
    ['Supplier Name', 'Optional free text — for record only, doesn\'t need to match a Distributor in the system.'],
    ['Reference No', 'Optional — an old invoice/PO number, for your own record.'],
    ['Notes', 'Optional.'],
    ['', ''],
    ['Important', 'Delete the example row (row 2 on the Stock In sheet) before uploading — it will otherwise be imported as real stock.']
  ]);
  info.getRow(1).font = { bold: true };

  const buffer = await workbook.xlsx.writeBuffer();
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="veda-pharmacy-stock-in-template.xlsx"');
  res.send(Buffer.from(buffer));
});

// POST /api/stock-in/bulk - parses an uploaded .xlsx built on the template
// above. Each row is its own transaction (item-create-if-needed + batch +
// stock_in_entries) so one bad row never aborts the rest of the file —
// the response reports exactly which rows succeeded and why any others
// were skipped, rather than an all-or-nothing failure.
router.post('/bulk', requireRole('Pharmacist', 'Accounts'), (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const storeId = req.session.storeId;
    const store = db.prepare('SELECT default_gst_rate FROM stores WHERE id = ?').get(storeId);
    const defaultGst = (store && store.default_gst_rate) || 12;

    let workbook;
    try {
      workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(req.file.buffer);
    } catch (e) {
      return res.status(400).json({ error: 'Could not read this file — is it a valid .xlsx?' });
    }

    const sheet = workbook.worksheets[0];
    if (!sheet) return res.status(400).json({ error: 'The workbook has no sheets' });

    const results = { imported: 0, itemsCreated: 0, errors: [] };
    const findItem = db.prepare('SELECT * FROM items WHERE LOWER(name) = LOWER(?)');
    const insertItem = db.prepare(`
      INSERT INTO items (name, generic_name, manufacturer, hsn_code, gst_rate, schedule, drug_form, pack_size, unit, category)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertBatch = db.prepare(`
      INSERT INTO batches (item_id, store_id, batch_no, mfg_date, expiry_date, quantity, purchase_rate, mrp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertEntry = db.prepare(`
      INSERT INTO stock_in_entries (store_id, item_id, batch_id, entry_no, quantity, purchase_rate, mrp, supplier_name, reference_no, notes, source, created_by_user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Bulk Excel Import', ?)
    `);

    // row 1 = header, so data starts at row 2 — same layout /template hands out.
    sheet.eachRow({ includeEmpty: false }, (row) => {
      if (row.number === 1) return; // header row itself, eachRow still visits it
      const rowNum = row.number;
      const cell = (i) => {
        const v = row.getCell(i).value;
        if (v === null || v === undefined) return '';
        if (typeof v === 'object' && v.text !== undefined) return String(v.text).trim(); // rich text
        if (v instanceof Date) return v.toISOString().slice(0, 10);
        return String(v).trim();
      };

      const name = cell(1);
      if (!name) return; // blank row — silently skipped, not an error

      try {
        const genericName = cell(2), manufacturer = cell(3), hsn = cell(4);
        const gstRaw = cell(5), scheduleRaw = cell(6).toUpperCase(), form = cell(7);
        const pack = cell(8), unit = cell(9) || 'Strip', category = cell(10);
        const batchNo = cell(11), mfgDate = cell(12) || null, expiryDate = cell(13);
        const qty = parseInt(cell(14), 10);
        const rate = parseFloat(cell(15));
        const mrp = parseFloat(cell(16));
        const supplier = cell(17), referenceNo = cell(18), notes = cell(19);

        if (!batchNo) throw new Error('Batch No is required');
        if (!expiryDate) throw new Error('Expiry Date is required');
        if (!Number.isFinite(qty) || qty <= 0) throw new Error('Quantity must be a positive number');
        if (!Number.isFinite(rate) || rate < 0) throw new Error('Purchase Rate must be a non-negative number');
        if (!Number.isFinite(mrp) || mrp < 0) throw new Error('MRP must be a non-negative number');

        const entryId = db.transaction(() => {
          let item = findItem.get(name);
          if (!item) {
            const schedule = VALID_SCHEDULES.includes(scheduleRaw) ? scheduleRaw : 'OTC';
            const gstRate = gstRaw && Number.isFinite(parseFloat(gstRaw)) ? round2(parseFloat(gstRaw)) : defaultGst;
            const info = insertItem.run(
              name, genericName || null, manufacturer || null, hsn || null,
              gstRate, schedule, form || null, pack || null, unit, category || null
            );
            item = { id: info.lastInsertRowid, name };
            results.itemsCreated++;
          }

          const batchInfo = insertBatch.run(item.id, storeId, batchNo, mfgDate, expiryDate, qty, rate, mrp);
          const entryNo = generateStockInNo(db, storeId);
          const info = insertEntry.run(
            storeId, item.id, batchInfo.lastInsertRowid, entryNo, qty, rate, mrp,
            supplier || null, referenceNo || null, notes || null, req.session.userId
          );
          return info.lastInsertRowid;
        })();

        results.imported++;
        logActivity(db, req.session.userId, 'stock_in_bulk_row', 'stock_in_entry', entryId, { row: rowNum, item: name, quantity: qty });
      } catch (e) {
        results.errors.push({ row: rowNum, medicine: name, message: e.message });
      }
    });

    logActivity(db, req.session.userId, 'stock_in_bulk_import', 'store', storeId, {
      imported: results.imported, itemsCreated: results.itemsCreated, errorCount: results.errors.length
    });
    res.json(results);
  });
});

module.exports = router;
