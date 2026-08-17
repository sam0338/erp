# VEDA Pharmacy

A LAN-deployable Pharmacy POS & Inventory system for small pharmacies in
India — Node.js + Express + better-sqlite3 + plain HTML/JS frontend, no
build step, offline-first. Built in the same pattern as VEDA Hotel PMS and
the other VEDA products (MarkEdge CRM, HRMS, School MS).

**Status: early build.** The database schema covers the whole domain
(items, batches, distributors, purchases/GRN, sales, prescriptions).
**Item Master, Distributors, Purchases/GRN, and Batches & Stock are live**
— receiving a GRN creates `batches` rows automatically, and the Batches &
Stock screen shows every lot with expiry alerts and lets you write off
expired/damaged/lost stock. The POS sale flow (with FEFO batch selection)
and prescription capture are schema-ready but don't have routes/screens
yet — see "What's next" below.

## Quick start

```bash
npm install
npm run initdb   # creates db/veda_pharmacy.db, seeds roles/store/admin user
npm start        # http://localhost:4600 — login: admin / admin123
```

Copy `.env.example` to `.env` if you want to change the port or session
secret; `.env` is only read on server start, so restart after editing.

## Architecture decisions

These were made explicitly up front rather than assumed, since they shape
the schema in ways that are painful to change later:

- **Multi-branch from day one.** A `stores` table exists and every
  operational table (`users`, `batches`, `purchases`, `sales`, ...) is
  scoped by `store_id`, even though the UI currently only drives one store.
  The item master (`items`) itself is a shared catalog *not* scoped to a
  store — batches/stock are what's per-store, matching how a real multi-
  outlet pharmacy chain works (one catalog, separate shelves).
- **Prescriptions capture text + photo.** Schedule H1/X sales require a
  `prescriptions` row (patient name, doctor name, Rx reference/date) and
  can optionally carry a photo of the physical Rx slip (`image_path`,
  uploaded via `multer`) for compliance. One prescription covers every
  H1/X line on a single sale.
- **Licensing is baked in from the start**, copied from VEDA Hotel PMS's
  scheme: a 7-day trial clock starts on `npm run initdb`, then
  `middleware/license.js` blocks every request until an Ed25519-signed
  license key is activated. See "Licensing" below.

## Database schema

See `db/schema.sql` for the full, commented definition. Summary:

| Table | Purpose |
|---|---|
| `stores` | Branches/outlets (multi-store from day 1) |
| `roles`, `users` | Admin / Pharmacist / Cashier / Accounts |
| `items` | Shared item master — name, generic name, HSN, GST%, Schedule (OTC/H/H1/X), pack size, unit, reorder level |
| `distributors` | Supplier ledger — CRUD live, includes state (used for CGST/SGST vs IGST) |
| `purchases`, `purchase_items` | GRN header + lines — CRUD live; saving a GRN creates one `batches` row per line in the same transaction |
| `batches` | Store-scoped stock lots — batch no., mfg/expiry dates, quantity, purchase rate, MRP — viewable/searchable live, with expiry status (expired/near/ok) computed per row |
| `sales`, `sale_items` | POS invoices; each line records the exact FEFO-selected `batch_id` it was sold from |
| `prescriptions` | Patient/doctor/Rx reference + optional photo, for Schedule H1/X sales |
| `stock_adjustments` | Expiry write-off / damage / loss / correction, always reducing a batch's quantity — CRUD live from the Batches & Stock screen |
| `activity_log` | Audit trail |
| `license_state` | Single-row trial/license record |

**FEFO (first-expiry-first-out)** batch selection is application logic, not
a DB feature: query `batches` for an `(item_id, store_id)` with
`quantity > 0` ordered by `expiry_date ASC`, and allocate across as many
lots as needed to cover the sold quantity. The `idx_batches_fefo` index
exists to make that query cheap, and `GET /api/batches` already returns
batches in this order — the POS route just needs to walk that list and
allocate. This isn't implemented yet — it's the core of the POS sale route
when that gets built.

## What's next (not built yet)

Roughly in the order it makes sense to build:

1. **POS / Sales** — the FEFO allocator, GST-split invoice totals
   (CGST/SGST/IGST), and the H1/X gate that requires a `prescriptions`
   row before the sale can complete.
2. **Prescriptions** — the `multer` upload endpoint for the Rx photo
   (`uploads/rx/`, gitignored) plus a lightweight register/search view.
3. **Reports** — GST summary, expiry-due-soon, low-stock, sales register.
4. **Distributor ledger** — payment history/statement view; `PUT
   /api/purchases/:id/payment` already records payments, this just
   surfaces them per distributor.

## Licensing (7-day trial, then license required)

Same scheme as VEDA Hotel PMS:

- First run (`npm run initdb`) locks in a 7-day trial clock in the database.
  The app works fully during this window with no key.
- After 7 days, every page/API is blocked until a valid license key is
  activated at `/license.html`. `middleware/license.js` runs before every
  request — this isn't just a UI flag.
- Keys are Ed25519-signed. Only the **public** key ships in
  `utils/licensing.js`; the private key lives at
  `license-tool/license_private.pem`, generated locally and **gitignored**
  — never commit it or hand it to a customer. Full details in
  `license-tool/README.md`.
- Keys can be bound to one machine (fingerprint from hostname/platform/CPU)
  or issued as `ANY`.

Generate a key:
```bash
cd license-tool
node generate-license.js --to "Customer Name" --perpetual
```

## Project layout

```
veda-pharmacy/
├── server.js              # entrypoint — licensing gate, sessions, routes, static files
├── db/
│   ├── schema.sql          # full schema
│   ├── connection.js       # opens the DB (fails clearly if initdb hasn't run)
│   ├── init.js             # npm run initdb — applies schema, seeds roles/store/admin
│   └── migrate.js          # safe additive migrations, runs on every start
├── middleware/
│   ├── auth.js              # session gate (requireAuth, requireRole)
│   └── license.js           # trial/license gate
├── routes/
│   ├── auth.js, license.js, items.js, distributors.js, purchases.js, batches.js
├── utils/
│   ├── helpers.js           # logActivity, generateGrnNo
│   └── licensing.js         # Ed25519 verify/activate, trial clock
├── public/                  # static frontend — one HTML page per module + shared shell.js/api.js/style.css
├── license-tool/            # VENDOR-ONLY key generator — never ship this folder
├── packaging/                # Windows silent launcher (.vbs) — mirrors veda-hotel-pms
└── uploads/rx/               # prescription photos (gitignored, .gitkeep only)
```

## Troubleshooting

**"No such table: ..." even though the server started fine**
`npm run initdb` was never run in this folder. Run it, then `npm start`
again. The server refuses to start at all if the database is missing.

**Trial/license errors on startup**
These self-heal — if you see anything unexpected, just restart with
`npm start`.
