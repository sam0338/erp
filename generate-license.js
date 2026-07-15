#!/usr/bin/env node
/**
 * SAKAAR ERP — License Key Generator
 * =====================================
 * Run this YOURSELF (the vendor) to issue a license key for a client.
 * Never ship this file to a client, and never hand out LICENSE_SECRET —
 * both need to stay on your side only. If you change LICENSE_SECRET here,
 * you must change the identical constant in server.js to match, or every
 * key you generate will fail to verify.
 *
 * Usage:
 *   node generate-license.js "Client Company Name" [valid_until] [max_users]
 *
 * Examples:
 *   node generate-license.js "Ratnamani Steel Pvt Ltd"
 *     -> perpetual license, unlimited users
 *
 *   node generate-license.js "Ratnamani Steel Pvt Ltd" 2027-12-31
 *     -> expires 31-Dec-2027, unlimited users
 *
 *   node generate-license.js "Ratnamani Steel Pvt Ltd" 2027-12-31 25
 *     -> expires 31-Dec-2027, capped at a suggested 25 users
 *      (max_users is informational today — enforcing a hard seat limit
 *      is a small, separate follow-up if you want it)
 */
const crypto = require('crypto');

// MUST match LICENSE_SECRET in server.js exactly.
const LICENSE_SECRET = process.env.LICENSE_SECRET || 'SakaarERP-7d4b2f9e1c6a8035bf42d9e7c1a5b830f6e4c0a9';

function signLicensePayload(payload) {
  const json = JSON.stringify(payload);
  const encoded = Buffer.from(json).toString('base64url');
  const signature = crypto.createHmac('sha256', LICENSE_SECRET).update(encoded).digest('hex');
  return `${encoded}.${signature}`;
}

const [, , licensedTo, validUntil, maxUsers] = process.argv;

if (!licensedTo) {
  console.error('Usage: node generate-license.js "Client Company Name" [valid_until YYYY-MM-DD] [max_users]');
  process.exit(1);
}

if (validUntil && !/^\d{4}-\d{2}-\d{2}$/.test(validUntil)) {
  console.error('valid_until must be in YYYY-MM-DD format, e.g. 2027-12-31');
  process.exit(1);
}

const payload = {
  licensed_to: licensedTo,
  issued_date: new Date().toISOString().split('T')[0],
  valid_until: validUntil || null,
  max_users: maxUsers ? parseInt(maxUsers, 10) : null
};

const key = signLicensePayload(payload);

console.log('\n=== SAKAAR ERP License Key ===\n');
console.log('Licensed to :', payload.licensed_to);
console.log('Issued      :', payload.issued_date);
console.log('Valid until :', payload.valid_until || 'Perpetual (no expiry)');
console.log('Max users   :', payload.max_users || 'Unlimited');
console.log('\nLicense Key (give this to the client — they paste it into');
console.log('System Settings → License → Activate):\n');
console.log(key);
console.log('\n=================================\n');
