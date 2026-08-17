const express = require('express');
const db = require('../db/connection');
const { getLicenseStatus, activateLicense } = require('../utils/licensing');

const router = express.Router();

// GET /api/license/status - always accessible, even when locked out
router.get('/status', (req, res) => {
  res.json(getLicenseStatus(db));
});

// POST /api/license/activate { license_key } - always accessible
router.post('/activate', (req, res) => {
  const { license_key } = req.body;
  if (!license_key) return res.status(400).json({ error: 'License key is required' });

  const result = activateLicense(db, license_key);
  if (!result.success) return res.status(400).json({ error: result.error });

  res.json({ success: true, licensedTo: result.licensedTo, validUntil: result.validUntil });
});

module.exports = router;
