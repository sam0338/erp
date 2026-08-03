#!/usr/bin/env node
// ============================================================
// VEDA Hotel PMS — License Key Generator
// VENDOR-ONLY. Do not copy this file, this folder, or
// license_private.pem into any customer installation or zip
// you hand out. Keep this folder only on your own machine.
// ============================================================
//
// Usage:
//   node generate-license.js --to "Customer Name" --days 365
//   node generate-license.js --to "Sakaar Stainless" --perpetual
//   node generate-license.js --to "Customer Name" --fingerprint <id-from-their-license-page> --days 365
//
// If you omit --fingerprint, the key defaults to "ANY" — meaning it will
// activate on whatever machine it's pasted into. That's fine for your own
// properties (Sakaar, BFTL) where you control the install yourself. For a
// key you're selling to someone else, ask them for the "Installation ID"
// shown on their License page/tab first, and pass it as --fingerprint so
// the key only works on their machine.

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
function getArg(name, fallback) {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 ? args[idx + 1] : fallback;
}

const licensedTo = getArg('to');
const fingerprint = getArg('fingerprint', 'ANY');
const days = getArg('days');
const perpetual = args.includes('--perpetual');

if (!licensedTo) {
  console.error('\nUsage: node generate-license.js --to "Customer Name" [--fingerprint <id>] [--days 365 | --perpetual]\n');
  process.exit(1);
}
if (!perpetual && !days) {
  console.error('\nSpecify either --days <n> or --perpetual\n');
  process.exit(1);
}

const privateKeyPath = path.join(__dirname, 'license_private.pem');
if (!fs.existsSync(privateKeyPath)) {
  console.error('\nlicense_private.pem not found in this folder. Without it, no keys can be generated.\n');
  process.exit(1);
}
const privateKey = crypto.createPrivateKey(fs.readFileSync(privateKeyPath, 'utf8'));

let validUntil = null;
if (!perpetual) {
  const d = new Date();
  d.setDate(d.getDate() + parseInt(days, 10));
  validUntil = d.toISOString().slice(0, 10);
}

const payload = {
  licensedTo,
  fingerprint,
  validUntil,
  issuedAt: new Date().toISOString()
};

const payloadBuf = Buffer.from(JSON.stringify(payload), 'utf8');
const signature = crypto.sign(null, payloadBuf, privateKey);
const licenseKey = `${payloadBuf.toString('base64')}.${signature.toString('base64')}`;

console.log('\nLicensed to:      ', payload.licensedTo);
console.log('Bound to machine: ', payload.fingerprint === 'ANY' ? '(any machine)' : payload.fingerprint);
console.log('Valid until:      ', payload.validUntil || '(perpetual — never expires)');
console.log('\n=== LICENSE KEY — give this to the customer ===\n');
console.log(licenseKey);
console.log('\n================================================\n');
