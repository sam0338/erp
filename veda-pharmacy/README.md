# VEDA Pharmacy

A LAN-deployable Pharmacy POS & Inventory system for small pharmacies in
India — Node.js + Express + better-sqlite3 + plain HTML/JS frontend, no
build step, offline-first. Built in the same pattern as VEDA Hotel PMS and
the other VEDA products (MarkEdge CRM, HRMS, School MS).

**Status: full operational loop + reporting + accounting + returns +
multi-store, end to end.** Item Master, Distributors (with a full
ledger/statement view), Purchases/GRN, Batches & Stock, POS/Sales
(including partial-line returns), Prescriptions, Doctors, Reports, and
Stores are all live — a GRN creates batches, POS sells against them FEFO
(oldest expiry first, splitting across lots automatically), a sale with a
Schedule H1/X item is blocked until a prescription is captured, a return
restores stock without ever mutating the original invoice, the GST
summary / expiry risk / low-stock / sales-register reports all read off
that same data — net of returns — with CSV export, a doctor's accrued
referral commission can be settled in one lump-sum payout with a full
paid/unpaid audit trail, and an Admin can create additional branches and
switch the active store for their session from the sidebar. What's left
is a multi-installment distributor payment history — see "What's next"
below.

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
  Payout (`POST /api/doctors/:id/pay-commission`) settles ALL of a
  doctor's currently-unpaid commission in one lump sum — the amount is
  computed server-side from unpaid `Completed` sales at the moment of
  payout and is never accepted from the client, so it can't drift from
  what's actually owed. `sales.commission_paid_at` marks which sales a
  payout covered; once set, a later return on that sale no longer claws
  the commission back (see the return note below) — the money's already
  changed hands, and reconciling a refund against an already-paid
  commission is a manual call for the operator, not something this app
  automates.
- **Every sale now tags a patient and a doctor — not just Schedule H1/X
  ones — because commission can only be calculated off a doctor that's
  actually on the sale.** `POST /api/sales` rejects any sale missing
  either: a patient name (`customer_name`), and a `doctor_id` that's
  either a registered, active doctor or the literal string `'walkin'`.
  `'walkin'` has to be chosen explicitly by the cashier — it's a real
  value the client sends, never a silently-defaulted absence — and
  resolves to no doctor and zero commission, same outcome as an untagged
  sale always had. This does raise the stakes on the compliance flag
  above: doctor-commission exposure is no longer confined to
  prescription-driven sales, it's now possible on every single sale in
  the pharmacy (still opt-in per sale via the doctor picker, never
  automatic) — flagged again here for the same reason as above, and the
  operator's call to make either way. The sale-wide doctor tag is
  intentionally a separate concept from the Schedule H1/X prescription's
  own "prescribing doctor" field: legally a pharmacy must be able to
  dispense on any qualified doctor's Rx, not only ones registered in its
  own commission list, so picking Walk-in / No Doctor for the commission
  tag never blocks an H1/X sale — the prescription panel's free-text
  doctor name independently satisfies that legal requirement and simply
  earns no commission when the two diverge. In the common case they're
  the same person, so the Rx panel's doctor field auto-fills from the
  sale-wide pick and the cashier only has to touch it when the actual
  prescriber is someone else.
- **Patient loyalty/incentive discount is a plain per-sale percentage**,
  not a persistent customer/points record — `sales.patient_incentive_pct`
  and `.patient_incentive_amount` are just another discount lane, kept
  separate from `discount_amount` so reporting can tell "why" a sale was
  discounted. A real repeat-customer loyalty system (a `customers` table,
  point balances, tiers) is a natural future addition but wasn't asked for.
- **The distributor ledger is built from `purchases` directly, not a
  separate payments-transaction table.** Each purchase already carries
  `amount_paid`/`payment_status`, and `PUT /api/purchases/:id/payment` was
  already the one place payments get recorded — adding a second,
  disconnected payments table risked two sources of truth for "what's
  owed." Instead, one column (`purchases.paid_at`, set whenever
  `amount_paid` moves above zero) was enough to let the ledger show the
  purchase (debit) and its payment (credit) as separate dated lines
  instead of collapsing them into one row. The trade-off: this models
  "amount currently paid so far" per invoice, not a full history of
  discrete partial-payment events if an invoice is paid in three
  installments over three different dates — only the latest cumulative
  figure and its most recent update date are kept. Good enough for a
  statement/reconciliation view; a true multi-installment history would
  need that separate table after all.
- **Sale returns never mutate the original sale.** A return is its own
  `sale_returns`/`sale_return_items` header+lines, restoring stock to the
  exact batch each unit was sold from; `sales.total_amount` etc. stay the
  historical record of what was actually invoiced. Because of that, `PUT
  /api/sales/:id/cancel` (full-sale void, restores every line's *original*
  quantity) is blocked once any return exists against a sale — cancelling
  on top of a partial return would double-restore the portion the return
  already put back. Once every line is fully returned via the return
  flow, `sales.status` flips to `'Returned'` on its own.
  Doctor commission is clawed back proportionally on a return, and this
  needed a real fix during development: the first version reduced the
  *current* `doctor_commission_amount` by a percentage of each return's
  refund, which compounds wrong — two returns covering 40% then the
  remaining 60% of a sale left 2.4% of the original commission still
  accrued instead of zero. It's recomputed from scratch each time instead:
  `net_sale_value = total_amount - SUM(all refunds so far)`, commission =
  `net_sale_value × doctor_commission_pct` (the fixed, checkout-time rate,
  never itself mutated) — verified this now zeroes out exactly across
  multiple partial returns. That clawback is itself skipped once a sale's
  commission has already been paid out (see the Doctor commission note
  above) — the return still restores stock and refunds the patient
  normally, it just leaves the (already-settled) commission figure alone.
- **The store switcher is Admin-only, and reuses a session-level override
  rather than editing the user's home store.** Every other role
  (Pharmacist/Cashier/Accounts) stays pinned to `users.store_id`, the store
  they were created under — `req.session.storeId`/`storeName` only ever
  gets set for an Admin via `POST /api/stores/switch`, and every route that
  scopes a query by store reads that session value (falling back to
  `users.store_id` when it's unset), so a non-Admin's effective store never
  moves no matter what's in the sidebar. This mirrors the property switcher
  in VEDA Hotel PMS. The switch endpoint is gated with `requireRole()`
  called with **no roles listed** — every role-check in
  `middleware/auth.js` lets Admin through first regardless of the allowed
  list, so an empty list rejects every role except Admin, which is exactly
  the "Admin-only" gate this needed without a separate check. `items`,
  `distributors`, and `doctors` stay shared catalogs across the switch
  (as documented above) — only `batches`, `purchases`, `sales`, and their
  child tables actually change when you switch. Deleting a store
  (soft-delete, `is_active = 0`) is blocked if it's the last active store,
  or if any active user still has it as their home store — otherwise a
  switch or a login could silently land someone in a closed branch.

## Database schema

See `db/schema.sql` for the full, commented definition. Summary:

| Table | Purpose |
|---|---|
| `stores` | Branches/outlets (multi-store from day 1) — CRUD + an Admin-only session store-switcher are live from the sidebar |
| `roles`, `users` | Admin / Pharmacist / Cashier / Accounts |
| `items` | Shared item master — name, generic name, HSN, GST%, Schedule (OTC/H/H1/X), pack size, unit, reorder level |
| `distributors` | Supplier ledger — CRUD live, includes state (used for CGST/SGST vs IGST), plus a full statement view (opening balance, every purchase/payment as a dated debit/credit, running balance) |
| `purchases`, `purchase_items` | GRN header + lines — CRUD live; saving a GRN creates one `batches` row per line in the same transaction |
| `batches` | Store-scoped stock lots — batch no., mfg/expiry dates, quantity, purchase rate, MRP — viewable/searchable live, with expiry status (expired/near/ok) computed per row |
| `sales`, `sale_items` | POS invoices — live; each line records the exact FEFO-selected `batch_id` it was sold from, split across lots automatically if one lot doesn't cover the quantity. Also carries the patient loyalty discount and (see Architecture Decisions) doctor commission fields, both snapshotted at checkout |
| `sale_returns`, `sale_return_items` | Partial-line returns against a Completed sale — live; restores stock to the originating batch and proportionally claws back any doctor commission, without ever mutating the original sale |
| `prescriptions` | Patient/doctor/Rx reference + optional photo, for Schedule H1/X sales — live end to end: text created inline by `POST /api/sales`, photo attached/replaced afterwards from the register, both searchable/viewable there |
| `stock_adjustments` | Expiry write-off / damage / loss / correction, always reducing a batch's quantity — CRUD live from the Batches & Stock screen |
| `doctors`, `doctor_commission_payments` | Referral commission registry — name, phone, registration no., default commission % — CRUD live, with a per-doctor commission history view and a "Pay Out" action that settles all unpaid commission in one lump sum |
| `activity_log` | Audit trail |
| `license_state` | Single-row trial/license record |

**Reports** (`routes/reports.js`) cover GST summary (output tax from
Completed **and** Returned sales vs input tax from purchases, in a date
range, with a simplified net-payable estimate explicitly labeled as a
reference figure, not a GSTR substitute), an expiry-risk report (batches
expiring within N days including already-expired ones, valued at both
cost and MRP), low stock (active items at or below `reorder_level`, with
quantity needed to reach it), and a sales register (date-ranged sales with
payment-mode totals, Completed/Returned/Cancelled broken out). Each report
exports to CSV client-side.

**Returns net out of both the GST summary and sales register**, keyed to
when the return was *processed*, not the original sale's date — the same
treatment a real GST credit note gets (it reduces liability in the period
it's issued, not retroactively amends the original period). A sale that
was later returned still counts in that period's gross figures (it was a
real, dated invoice); the return — wherever its date falls — is what nets
it back out. A sale fully returned within the same reporting window
correctly nets to zero on both reports; only a genuinely `Cancelled` sale
(a void, not a completed-then-reversed one) is excluded from gross
entirely. Verified all of this arithmetically against known test data,
including the same-period-full-return edge case.

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

1. **Multi-installment payment history** — as noted above, the distributor
   ledger currently tracks one cumulative `amount_paid` per purchase, not
   a log of each individual part-payment. Would need a dedicated
   `distributor_payments` table if that granularity is ever needed.
2. **Partial commission payouts** — `POST /api/doctors/:id/pay-commission`
   only supports settling *all* of a doctor's currently-unpaid commission
   in one go, matching the common "settle up for the month" flow. Paying
   an arbitrary partial amount and choosing which sales it covers isn't
   supported — would need an allocation policy decided first (which sales
   get marked paid when the amount doesn't divide evenly across them).

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
│   ├── auth.js, license.js, items.js, distributors.js, purchases.js, batches.js, sales.js, prescriptions.js, doctors.js, reports.js, stores.js
├── utils/
│   ├── helpers.js           # logActivity, generateGrnNo, generateInvoiceNo, generateReturnNo
│   └── licensing.js         # Ed25519 verify/activate, trial clock
├── public/                  # static frontend — one HTML page per module + shared shell.js/api.js/style.css
├── license-tool/            # VENDOR-ONLY key generator — never ship this folder
├── packaging/                # Silent launcher (.vbs) + NSIS installer build — see BUILD_INSTRUCTIONS.md
└── uploads/rx/               # prescription photos (gitignored, .gitkeep only)
```

## Troubleshooting

**"No such table: ..." even though the server started fine**
`npm run initdb` was never run in this folder. Run it, then `npm start`
again. The server refuses to start at all if the database is missing.

**Trial/license errors on startup**
These self-heal — if you see anything unexpected, just restart with
`npm start`.
