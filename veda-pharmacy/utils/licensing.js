// VEDA Pharmacy - Licensing
//
// How this works:
// - On first run, an install record locks in the trial start date in the DB.
// - The app is fully usable for TRIAL_DAYS with no license key at all.
// - After that, a valid signed license key is required to keep working.
// - License keys are signed with an Ed25519 PRIVATE key that never ships
//   with this app (see /license-tool, which is vendor-only and must not be
//   distributed to customers). Only the PUBLIC key below ships here, so a
//   customer reading this source code cannot forge a working license key —
//   they can verify a signature but not create one.
const crypto = require('crypto');
const os = require('os');

const PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAAS2ZzI0JUVViczoRVfLhfKMjBJKBtgiz6gBp0VSCGT8=
-----END PUBLIC KEY-----`;

const TRIAL_DAYS = 7;

function getMachineFingerprint() {
  const raw = [
    os.hostname(),
    os.platform(),
    os.arch(),
    (os.cpus()[0] || {}).model || ''
  ].join('|');
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 32);
}

function ensureInstallRecord(db) {
  // Defensive: create the table ourselves if it's somehow missing, rather
  // than trusting that db/migrate.js already ran. This must never crash —
  // it's on the critical path for every single request.
  db.exec(`
    CREATE TABLE IF NOT EXISTS license_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      install_id TEXT NOT NULL,
      installed_at TEXT NOT NULL,
      license_key TEXT,
      licensed_to TEXT,
      valid_until TEXT,
      activated_at TEXT
    )
  `);

  let row = db.prepare('SELECT * FROM license_state WHERE id = 1').get();
  if (!row) {
    const installId = crypto.randomBytes(8).toString('hex');
    db.prepare(`INSERT INTO license_state (id, install_id, installed_at) VALUES (1, ?, datetime('now'))`).run(installId);
    row = db.prepare('SELECT * FROM license_state WHERE id = 1').get();
  }
  return row;
}

// License key format: base64(JSON payload).base64(Ed25519 signature)
// payload: { licensedTo, fingerprint: 'ANY' | <fingerprint>, validUntil: 'YYYY-MM-DD' | null, issuedAt }
function verifyLicenseKey(keyString, fingerprint) {
  try {
    const parts = (keyString || '').trim().split('.');
    if (parts.length !== 2) return { valid: false, error: 'Malformed license key' };
    const [payloadB64, sigB64] = parts;
    const payloadBuf = Buffer.from(payloadB64, 'base64');
    const sig = Buffer.from(sigB64, 'base64');

    const publicKey = crypto.createPublicKey(PUBLIC_KEY_PEM);
    const signatureValid = crypto.verify(null, payloadBuf, publicKey, sig);
    if (!signatureValid) return { valid: false, error: 'Invalid signature — this license key is not authentic' };

    const payload = JSON.parse(payloadBuf.toString('utf8'));

    if (payload.fingerprint && payload.fingerprint !== 'ANY' && payload.fingerprint !== fingerprint) {
      return { valid: false, error: 'This license key is bound to a different installation' };
    }
    if (payload.validUntil) {
      const validUntil = new Date(payload.validUntil + 'T23:59:59');
      if (new Date() > validUntil) return { valid: false, error: 'This license key has expired' };
    }
    return { valid: true, payload };
  } catch (e) {
    return { valid: false, error: 'Could not read this license key' };
  }
}

function getLicenseStatus(db) {
  const row = ensureInstallRecord(db);
  const fingerprint = getMachineFingerprint();
  const installedAt = new Date(row.installed_at.replace(' ', 'T') + 'Z');
  const trialEnds = new Date(installedAt.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
  const now = new Date();
  const trialDaysRemaining = Math.max(0, Math.ceil((trialEnds - now) / (24 * 60 * 60 * 1000)));

  let licensed = false;
  let licenseError = null;
  if (row.license_key) {
    const result = verifyLicenseKey(row.license_key, fingerprint);
    licensed = result.valid;
    if (!result.valid) licenseError = result.error;
  }

  const inTrial = !licensed && now < trialEnds;
  const active = licensed || inTrial;

  return {
    active,
    licensed,
    inTrial,
    trialDaysRemaining,
    installedAt: row.installed_at,
    fingerprint,
    licensedTo: row.licensed_to || null,
    validUntil: row.valid_until || null,
    licenseError
  };
}

function activateLicense(db, keyString) {
  const fingerprint = getMachineFingerprint();
  const result = verifyLicenseKey(keyString, fingerprint);
  if (!result.valid) return { success: false, error: result.error };

  ensureInstallRecord(db);
  db.prepare(`
    UPDATE license_state SET license_key = ?, licensed_to = ?, valid_until = ?, activated_at = datetime('now')
    WHERE id = 1
  `).run(keyString.trim(), result.payload.licensedTo || null, result.payload.validUntil || null);

  return { success: true, licensedTo: result.payload.licensedTo, validUntil: result.payload.validUntil };
}

module.exports = {
  getMachineFingerprint, getLicenseStatus, activateLicense, verifyLicenseKey, ensureInstallRecord, TRIAL_DAYS
};
