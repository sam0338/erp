# License Tool — VENDOR ONLY

**Never distribute this folder to a customer.** If `license_private.pem`
ever ends up in a customer's hands (or on GitHub, or anywhere public),
anyone could generate valid license keys for any installation, and the
whole licensing system becomes worthless. Keep this folder only on your
own machine — don't include it in any zip, repo, or installer you hand out.
`license_private.pem` is gitignored for this reason; it was generated
locally on first setup and is not committed.

The rest of the app (`utils/licensing.js`) only ships the **public** key,
which can verify a signature but can't create one. That's the whole reason
this scheme resists tampering: reading the app's source code doesn't give
anyone the ability to forge a key.

## Generating a key

```bash
cd license-tool
node generate-license.js --to "Sharma Medicos" --perpetual
```

Common patterns:

```bash
# A 1-year key for a customer, tied to their specific machine
node generate-license.js --to "Apex Pharmacy" --fingerprint a1b2c3d4e5f6... --days 365

# A perpetual key that works on any machine (fine for your own stores)
node generate-license.js --to "Own Store" --perpetual

# A 30-day extended trial/demo for a prospect
node generate-license.js --to "Prospect Pharmacy Demo" --days 30
```

The customer's **Installation ID** (needed for `--fingerprint`) is shown on
their app's License page (`/license.html`) or Settings → License tab once
they've installed it.

## How verification works on the customer's side

1. First run of `npm run initdb` locks in the install date — that's the trial clock, stored in the database.
2. For 7 days, the app works with no license key at all.
3. After that, `middleware/license.js` blocks every request except the license activation page/API until a valid key is entered.
4. A key is valid if: (a) its Ed25519 signature checks out against the embedded public key, (b) its bound fingerprint matches the machine's (or is "ANY"), and (c) it hasn't passed its expiry date (or has none, for perpetual licenses).

## If you ever need to rotate the keypair

If `license_private.pem` is ever compromised, you'd need to generate a new
Ed25519 keypair, update the `PUBLIC_KEY_PEM` constant in
`utils/licensing.js` in the main app, and re-issue new keys to every
customer — their old keys would stop verifying against the new public key.
Treat the private key with the same care as a banking password.
