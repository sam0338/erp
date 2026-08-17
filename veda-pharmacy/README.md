# VEDA Pharmacy

A LAN-deployable Pharmacy POS & Inventory system for small pharmacies in
India — Node.js + Express + better-sqlite3 + plain HTML/JS frontend, no
build step, offline-first. Built in the same pattern as VEDA Hotel PMS and
the other VEDA products (MarkEdge CRM, HRMS, School MS).

**Status: full operational loop + reporting.** Item Master, Distributors,
Purchases/GRN, Batches & Stock, POS/Sales, Prescriptions, Doctors, and
Reports are all live — a GRN creates batches, POS sells against them FEFO
(oldest expiry first, splitting across lots automatically), a sale with a
Schedule H1/X item is blocked until a prescription is captured, and the
GST summary / expiry risk / low-stock / sales-register reports all read
off that same data with CSV export. What's left is a distributor ledger
view, partial-line sale returns, and a multi-store switcher UI — see
"What's next" below.

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
  H1/X line on a single sale. `POST /api/sales` creates the text-only
  record inline at checkout; the photo is a separate step afterwards from
  the Prescriptions register (`POST /api/prescriptions/:id/photo`), since
  a cashier mid-sale shouldn't be blocked on finding the physical slip to
  scan. Photos are **not** served as static files under `/public` —
  `GET /api/prescriptions/:id/photo` streams them from disk behind the
  same session auth as the rest of the API, so patient/doctor photos never
  sit at a guessable, unauthenticated URL.
- **MRP is GST-inclusive at the POS counter — deliberately different math
  from purchases.** Indian pharma MRP already includes tax, so a sale line
  back-calculates taxable value and GST out of `qty × rate` (`tax = gross ×
  gstRate / (100 + gstRate)`) instead of adding GST on top like a
  distributor's purchase rate does (`routes/purchases.js`). Getting this
  backwards would overcharge customers and misstate every GST return, so
  it's called out explicitly in `routes/sales.js` (`computeInclusiveChunk`)
  rather than left to be inferred from the purchase-side code next to it.
  Retail sales are also assumed intra-state (CGST+SGST, no IGST) — a
  walk-in counter sale doesn't carry a customer state the way a distributor
  purchase does.
- **Licensing is baked in from the start**, copied from VEDA Hotel PMS's
  scheme: a 7-day trial clock starts on `npm run initdb`, then
  `middleware/license.js` blocks every request until an Ed25519-signed
  license key is activated. See "Licensing" below.
- **Doctor commission is opt-in per doctor, not automatic — and this needs
  a compliance flag, not just an architecture note.** In India, the
  National Medical Commission / Medical Council of India's ethics
  regulations (Reg. 6.4) bar a registered doctor from receiving any
  commission for referring patients to a specific pharmacy — this is
  commonly called "cut practice" and is professional misconduct that can
  cost a doctor their license. A per-sale commission tied to the
  prescribing doctor is the textbook shape of that arrangement. **This was
  flagged to the operator explicitly before being built, and they asked
  for it anyway** — it's their business decision to make, not this
  codebase's to block, but it's also not this codebase's place to pretend
  the question never came up. What's actually built reflects that flag:
  commission only accrues when the prescribing doctor is a row in the
  `doctors` table with a rate set (`sales.doctor_id` is only populated
  when `prescription.doctor_id` was explicitly selected from that
  registry in the POS Rx panel) — free-typing any other doctor's name
  accrues nothing. The commission also never reduces what the patient
  pays (`total_amount` is computed before `doctor_commission_amount`) and
  is deliberately excluded from the printable customer receipt, only
  shown in the internal sale detail view. If you operate outside India,
  or under a different arrangement (e.g. a doctor who is a formal salaried
  consultant, not paid per-referral), your own applicable professional-
  conduct and anti-kickback rules still govern what you configure here —
  this app just tracks the number, it doesn't make the arrangement lawful.
- **Patient loyalty/incentive discount is a plain per-sale percentage**,
  not a persistent customer/points record — `sales.patient_incentive_pct`
  and `.patient_incentive_amount` are just another discount lane, kept
  separate from `discount_amount` so reporting can tell "why" a sale was
  discounted. A real repeat-customer loyalty system (a `customers` table,
  point balances, tiers) is a natural future addition but wasn't asked for.

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
| `sales`, `sale_items` | POS invoices — live; each line records the exact FEFO-selected `batch_id` it was sold from, split across lots automatically if one lot doesn't cover the quantity. Also carries the patient loyalty discount and (see Architecture Decisions) doctor commission fields, both snapshotted at checkout |
| `prescriptions` | Patient/doctor/Rx reference + optional photo, for Schedule H1/X sales — live end to end: text created inline by `POST /api/sales`, photo attached/replaced afterwards from the register, both searchable/viewable there |
| `stock_adjustments` | Expiry write-off / damage / loss / correction, always reducing a batch's quantity — CRUD live from the Batches & Stock screen |
| `doctors` | Referral commission registry — name, phone, registration no., default commission % — CRUD live, with a per-doctor commission history view |
| `activity_log` | Audit trail |
| `license_state` | Single-row trial/license record |

**Reports** (`routes/reports.js`, no new tables — all four read off the
tables above) cover GST summary (output tax from Completed sales vs input
tax from purchases, in a date range, with a simplified net-payable
estimate explicitly labeled as a reference figure, not a GSTR substitute),
an expiry-risk report (batches expiring within N days including
already-expired ones, valued at both cost and MRP), low stock (active
items at or below `reorder_level`, with quantity needed to reach it), and
a sales register (date-ranged sales with payment-mode totals, Completed
vs Cancelled broken out — cancelled sales are excluded from every total).
Each report exports to CSV client-side.

**FEFO (first-expiry-first-out)** batch selection is application logic, not
a DB feature: `allocateFefo()` in `routes/sales.js` queries `batches` for
an `(item_id, store_id)` with `quantity > 0 AND expiry_date >= date('now')`
ordered by `expiry_date ASC`, and walks that list taking as much as it can
from the soonest-expiring lot before spilling into the next one — so a
single cart line can (and regularly will) become multiple `sale_items`
rows against different batches. The `idx_batches_fefo` index exists to
make that query cheap. Runs inside the same transaction as the stock
deduction, so there's no race with a concurrent sale.

## What's next (not built yet)

1. **Distributor ledger** — payment history/statement view; `PUT
   /api/purchases/:id/payment` already records payments, this just
   surfaces them per distributor.
2. **Sale returns** — `sales.status` already has a `Returned` value in its
   CHECK constraint and `PUT /api/sales/:id/cancel` shows the restore-stock
   pattern to follow, but a partial-line return isn't implemented — only
   a full-sale cancel.
3. **Multi-store UI** — the schema has supported multiple stores since day
   one and every query is already `store_id`-scoped, but there's no
   store-switcher in the UI yet; every user is just pinned to the store
   they were seeded/created under.
4. **Commission payout tracking** — `doctors` shows commission *accrued*
   (per doctor, per sale, excluding cancelled sales), but there's no
   "mark as paid" flow yet the way `purchases`/distributors have one.
   Would follow the same `amount_paid`/`payment_status` pattern as
   `routes/purchases.js`'s `PUT /:id/payment` if it's needed.

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
│   ├── auth.js, license.js, items.js, distributors.js, purchases.js, batches.js, sales.js, prescriptions.js, doctors.js, reports.js
├── utils/
│   ├── helpers.js           # logActivity, generateGrnNo, generateInvoiceNo
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
