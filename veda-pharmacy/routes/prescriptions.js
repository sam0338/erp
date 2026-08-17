const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('../db/connection');
const { logActivity } = require('../utils/helpers');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

// Same convention as db/connection.js's DB_DIR: defaults to a folder next
// to server.js for dev, overridden by the packaged Windows launcher to a
// %PROGRAMDATA% folder so photos survive an uninstall/reinstall.
const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads', 'rx');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Deliberately not served as a static file under /public — patient/doctor
// photos should stay behind the same session auth as everything else in
// this API, not sit at a guessable, unauthenticated URL.
const ALLOWED_MIME = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, `rx-${req.params.id}-${Date.now()}${ALLOWED_MIME[file.mimetype] || ''}`)
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME[file.mimetype]) return cb(new Error('Only JPG, PNG or WEBP images are allowed'));
    cb(null, true);
  }
});

function loadPrescription(req, res, next) {
  const prescription = db.prepare('SELECT * FROM prescriptions WHERE id = ?').get(req.params.id);
  if (!prescription) return res.status(404).json({ error: 'Prescription not found' });
  req.prescription = prescription;
  next();
}

// GET /api/prescriptions - register, store-scoped via the sale it's attached to
// (a prescription has no store_id of its own; every prescription today is
// created inline by POST /api/sales, so it's always tied to exactly one sale).
// ?q=patient/doctor/rx ref&from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/', (req, res) => {
  const { q, from, to } = req.query;
  let query = `
    SELECT p.*, s.id AS sale_id, s.invoice_no, s.sale_date, s.total_amount
    FROM prescriptions p
    JOIN sales s ON s.prescription_id = p.id
    WHERE s.store_id = ?
  `;
  const params = [req.session.storeId];
  if (q) {
    query += ' AND (p.patient_name LIKE ? OR p.doctor_name LIKE ? OR p.rx_ref_no LIKE ?)';
    const like = `%${q}%`;
    params.push(like, like, like);
  }
  if (from) { query += ' AND date(p.created_at) >= ?'; params.push(from); }
  if (to) { query += ' AND date(p.created_at) <= ?'; params.push(to); }
  query += ' ORDER BY p.created_at DESC';

  res.json(db.prepare(query).all(...params));
});

// GET /api/prescriptions/:id - full record: patient/doctor details, the
// sale it's attached to, and exactly which Schedule H1/X items it covered
router.get('/:id', loadPrescription, (req, res) => {
  const sale = db.prepare(`
    SELECT s.* FROM sales s WHERE s.prescription_id = ? AND s.store_id = ?
  `).get(req.params.id, req.session.storeId);
  if (!sale) return res.status(404).json({ error: 'Prescription not found' });

  const items = db.prepare(`
    SELECT si.*, i.name AS item_name, i.schedule, i.unit
    FROM sale_items si JOIN items i ON si.item_id = i.id
    WHERE si.sale_id = ? AND i.schedule IN ('H1', 'X')
  `).all(sale.id);

  res.json({ ...req.prescription, sale, items });
});

// POST /api/prescriptions/:id/photo - attach (or replace) the photo of the physical Rx slip
router.post('/:id/photo', requireRole('Cashier', 'Pharmacist'), loadPrescription, (req, res, next) => {
  upload.single('photo')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}, (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No photo file received' });

  // Best-effort cleanup of the previous photo when replacing one — a
  // leftover orphaned file on disk is harmless, so this never blocks the
  // response on failure.
  if (req.prescription.image_path) {
    fs.unlink(path.join(uploadDir, path.basename(req.prescription.image_path)), () => {});
  }

  db.prepare('UPDATE prescriptions SET image_path = ? WHERE id = ?').run(req.file.filename, req.params.id);
  logActivity(db, req.session.userId, 'prescription_photo_uploaded', 'prescription', req.params.id, null);
  res.json({ success: true, image_path: req.file.filename });
});

// GET /api/prescriptions/:id/photo - serve the stored photo (auth-gated, same as the rest of this router)
router.get('/:id/photo', loadPrescription, (req, res) => {
  if (!req.prescription.image_path) return res.status(404).json({ error: 'No photo on file for this prescription' });

  // path.basename strips any directory component — image_path is always a
  // filename we generated ourselves, but this keeps that guarantee even if
  // a future migration or manual DB edit puts something unexpected there.
  const filePath = path.join(uploadDir, path.basename(req.prescription.image_path));
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Photo file is missing on disk' });
  res.sendFile(filePath);
});

module.exports = router;
