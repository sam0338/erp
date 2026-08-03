const db = require('../db/connection');
const { getLicenseStatus } = require('../utils/licensing');

// Runs before everything else. Always lets the license API and the license
// page (plus its static assets) through, no matter what — that's the only
// way out of a lockout. Everything else is blocked once the trial has
// ended and no valid license is active.
function requireLicense(req, res, next) {
  if (req.path.startsWith('/api/license')) return next();
  if (req.path === '/license.html') return next();
  if (/\.(css|js|png|jpg|jpeg|svg|ico|woff2?)$/.test(req.path)) return next();

  let status;
  try {
    status = getLicenseStatus(db);
  } catch (err) {
    // A licensing bug should never brick the app for the customer — log it
    // and let the request through rather than hard-failing.
    console.error('License check failed, allowing request through:', err.message);
    return next();
  }

  if (status.active) return next();

  if (req.path.startsWith('/api/')) {
    return res.status(403).json({
      error: 'Your 7-day trial has ended. Please activate a license to continue using VEDA Hotel PMS.',
      license_expired: true
    });
  }
  return res.redirect('/license.html');
}

module.exports = { requireLicense };
