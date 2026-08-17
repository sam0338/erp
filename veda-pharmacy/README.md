# VEDA Pharmacy

A LAN-deployable Pharmacy POS & Inventory system for small pharmacies in
India — Node.js + Express + better-sqlite3 + plain HTML/JS frontend, no
build step, offline-first. Built in the same pattern as VEDA Hotel PMS and
the other VEDA products (MarkEdge CRM, HRMS, School MS).

**Status: full operational loop + reporting + accounting + returns +
multi-store, end to end, on a rebuilt UI.** Item Master, Distributors
(with a full ledger/statement view), Purchases/GRN, Batches & Stock,
POS/Sales (including partial-line returns), Prescriptions, Doctors,
Reports, and Stores are all live — a GRN creates batches, POS sells
against them FEFO (oldest expiry first, splitting across lots
automatically), a sale with a Schedule H1/X item is blocked until a
prescription is captured, a return restores stock without ever mutating
the original invoice, the GST summary / expiry risk / low-stock /
sales-register reports all read off that same data — net of returns —
with CSV export, a doctor's accrued referral commission can be settled in
one lump-sum payout with a full paid/unpaid audit trail, an Admin can
create additional branches and switch the active store for their session
from the sidebar, and the Dashboard is a real live snapshot — today's
sales, this month's revenue, low-stock and expiring-soon counts with
quick-action buttons to jump straight into a new sale or GRN, plus a
persistent alert banner and a once-per-login popup surfacing what's
expiring soon. Every sale requires a patient name and a doctor tag
(a registered doctor, or an explicit Walk-in / No Doctor) — see the
Architecture Decisions below for why. The whole UI was reskinned onto a
navy/teal design system (ported from a reference app the operator
preferred, MediStore Pro) while every screen kept talking to this same
backend the whole time — see "MediStore Pro-style reskin" below for what
that did and didn't change. What's left is a multi-installment
distributor payment history — see "What's next" below.

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
- **The Dashboard is built entirely on existing report/list endpoints —
  no new aggregation backend.** `public/js/dashboard.js` fetches
  `/api/reports/low-stock`, `/api/reports/expiry?days=90`,
  `/api/reports/sales-register` (defaults to this month), and
  `/api/sales?from=<today>&to=<today>` in parallel via
  `Promise.allSettled` (one slow/failed source degrades that one card to
  "Could not load" instead of blanking the whole page) rather than
  standing up a dedicated summary route that would just re-derive numbers
  those routes already compute correctly (returns-aware revenue,
  reorder-level math, expiry-status classification). The expiry
  notification is two deliberately different mechanisms, not one: a
  **persistent banner** on the dashboard body that shows on every visit
  for as long as there's something to flag (the "notification" — you
  can't miss it just by not being there the moment it first appeared),
  and a **once-per-login popup** modal listing the actual near-expiry
  batches, gated by a `sessionStorage.vedaJustLoggedIn` flag that
  `login.html` sets right before redirecting and `dashboard.js` reads
  once and clears — so it fires exactly on a fresh login, not on every
  later sidebar click back to Dashboard (which would just be noise for
  someone working the counter all day). The two "+ New Sale" / "+ New
  Purchase" quick-action buttons are plain links to `/sales.html` (whose
  New Sale tab is already the default view) and `/purchases.html?new=1`
  — the latter's `?new=1` is read once by `purchases.js` on load to
  auto-open the existing New GRN modal instead of landing on a plain
  list, `history.replaceState`-d away immediately after so a page
  refresh doesn't reopen it. `reports.html` similarly grew a `?tab=`
  query param so the dashboard's "Review →" / "View full report" links
  can deep-link straight into the Expiry or Low Stock tab instead of
  always landing on GST Summary.
- **MediStore Pro-style reskin: the visual layer was replaced, the
  backend was not.** The operator supplied a reference app, MediStore
  Pro, whose UI/reports they preferred, and asked for its look plus
  VEDA's feature set. MediStore Pro's own server turned out to be plain
  JSON files rewritten whole on every write (no locking, no
  transactions), with zero authentication anywhere and CORS wide open —
  fine for a single-PC demo, unsafe for a real multi-counter pharmacy
  handling money and Schedule H1/X drugs. So only its CSS/markup design
  language was adopted; every screen still talks to this app's own
  Express+SQLite backend, session auth, and business logic — none of
  which changed. Concretely: `public/css/style.css` is MediPro's
  component CSS (navy sidebar, teal accent, cards, stat-cards, tables,
  badges, modals, tabs, alerts, toast, A5 bill print styles) plus a
  compatibility layer of old-class-name and old-CSS-variable aliases
  (`.modal-overlay`, `.form-field`, `.badge-ok`/`-warn`/`-danger`,
  `.tab-bar`/`.tab-btn`, `--brand-900`, `--ink`, `--paper`, `--accent`,
  `--danger`, ...) mapped onto the equivalent new rule, which is what let
  every page's already-working JS-generated markup keep rendering
  correctly the moment the stylesheet was swapped, before any page's own
  markup was touched. Every page's outer shell (sidebar/topbar) was then
  rebuilt against MediPro's real markup (`#sidebar`/`#main`/`.topbar`/
  `.page-content`, real `<a href>` navigation — not MediPro's own
  onclick-driven SPA divs, since this stays a genuine multi-page app,
  each screen its own file, exactly as before), and each page's content
  was then given a real pass onto MediPro's actual list-page components
  (search-icon filter cards, card-header table cards, rich icon+heading
  empty-states) rather than just riding the alias layer indefinitely.
  The one deliberate design upgrade taken from MediPro rather than just
  its skin: the printed POS receipt now uses MediPro's actual `.a5-bill`
  layout (dark header band, patient/doctor/invoice meta strip, itemized
  table with an Rx badge on Schedule H1/X lines, boxed totals) instead of
  VEDA's old plain two-column table — genuinely nicer, not just
  reskinned. Three real bugs were caught and fixed purely by doing this
  systematically rather than page-by-page in isolation: MediPro's
  stylesheet carried `@media print { body { display: none } }`, harmless
  for MediPro (which never printed from its main window at all) but fatal
  for VEDA's print-one-component pattern (used by both the distributor
  ledger and the POS receipt) — `display:none` removes the target from
  the render tree regardless of any `visibility:visible` override further
  down, so this would have silently produced a blank page on every print
  until caught; the Sales Register's summary stat cards were still built
  on the pre-rename `.label`/`.value`/`.hint` classes with no alias ever
  added for them (every other renamed thing got one), so they'd been
  unstyled since the very first pass; and `login.html`'s brand wordmark
  hardcoded `font-family: 'Manrope'`, a font this app stopped loading
  when the `<link>` tags switched to Inter+JetBrains Mono, so it had been
  silently falling back to a default sans-serif. A full grep-based audit
  (every `var(--x)` reference checked against what's actually defined,
  every `.tab-btn`/`.badge-*`/`class="app-shell"` pattern checked for
  stragglers) was run as the final step specifically to catch this class
  of issue — a partial reskin is worse than no reskin, since it looks
  like an oversight rather than a deliberate choice.
- **MediStore Pro feature parity: six of its screens/behaviors that VEDA
  didn't have were built for real against VEDA's own backend, not just
  visually referenced.** After the reskin above, the operator asked for
  MediPro's actual feature set to be copied, not just its look, in five
  named areas. What was built, and how each maps onto VEDA's existing
  data model:
  - **Purchase Orders** (`purchase_orders`, `purchase_order_items`,
    `routes/purchase-orders.js`, `public/purchase-orders.html`) — a
    genuinely separate concept from a GRN: a PO is a *request* out to a
    distributor (Draft → Sent → Cancelled), a GRN (`routes/purchases.js`)
    is the actual receipt. `purchases.purchase_order_id` is a nullable
    link — receiving stays fully supported with no PO at all, exactly as
    before, or against an open PO's still-pending quantity, partially or
    in full, across as many GRNs as it takes. **"GRN status" (Pending /
    Partial GRN / Fully Received) is deliberately never stored** — it's
    computed on every read by comparing each line's `quantity_received`
    to `quantity_ordered` (`computeGrnStatus()`), the same
    recompute-from-source-rows principle used to fix the doctor-commission
    clawback bug elsewhere in this codebase, so there's no second place
    for that fact to go stale.
  - **Shop Settings** (`public/settings.html`, eight new columns on
    `stores`) — self-service shop profile/license/billing-preference
    fields (tagline, owner name, FSSAI no., bill prefix, default GST%,
    receipt footer), Admin-only, editing the operator's own current store
    through the **existing** `PUT /api/stores/:id` endpoint rather than a
    parallel settings-specific route — it's the same "update a store
    record" operation Admin's Stores CRUD already does, just against
    `req.session.storeId` instead of an arbitrary id. Two fields are
    genuinely functional, not cosmetic: `bill_prefix` drives
    `generateInvoiceNo()` (was hardcoded `INV-`), and `default_gst_rate`
    pre-fills the Item Master's Add Item GST% field (was hardcoded 12).
    **Deliberately excluded**: MediPro's Export All Data / Import Data /
    Clear All Data (JSON) buttons — built for its browser-localStorage
    backend, they don't map onto a relational database, and a "Clear All
    Data" button in front of a live pharmacy's real SQL data would be an
    unacceptable footgun rather than a convenience.
  - **Categories** (`categories` table, `routes/categories.js`,
    `public/categories.html`) — a managed, shared (not store-scoped) list
    with icon/description and a live medicine-count per category, feeding
    the Item Master's Category field as a datalist suggestion.
    `items.category` deliberately stays plain `TEXT` with no FK — adding
    one would mean migrating every existing item's free-text category
    value against the new table's exact spelling, a real risk for no
    functional gain; renaming/removing a category here never rewrites
    items that already used the old text.
  - **Item Movement Log** (`routes/movements.js`, `public/movements.html`)
    — a unified, read-only, chronological ledger per item: GRN receipts
    (in), sales (out), sale returns (in), manual stock adjustments (out).
    Pure aggregation over `purchase_items`/`sale_items`/
    `sale_return_items`/`stock_adjustments` at request time — nothing is
    stored separately, so it can never drift from the records it reads.
  - **Global Retrieve Bill / New Bill** (`injectTopbarActions()` in
    `public/js/shell.js`) — MediPro's topbar search-any-invoice and
    jump-to-a-fresh-sale shortcuts, injected into every page's topbar
    rather than duplicated into all 14 page templates. Retrieve Bill reuses
    the existing `GET /api/sales` filters (invoice/customer/phone/date
    range/payment status); its result rows either open the POS page's own
    History-tab detail view directly (if already on `sales.html`) or
    navigate there with `?openSale=<id>`, which `sales.js` picks up on
    load. New Bill resets the cart in place if already on the POS page,
    otherwise navigates there.
  - **Stock adjustment types extended** to match MediPro's list — 'Return
    to Supplier' and 'Sample' joined the original Expired/Damaged/Lost/
    Correction, rather than building MediPro's separate "Stock Out" page
    as a duplicate of VEDA's existing adjustment feature (same concept,
    different name). This required two changes in lockstep, both now
    verified: SQLite `CHECK` constraints **are** enforced on every insert
    against a table's already-stored schema (verified empirically, not
    assumed) and can't be widened with a plain `ALTER TABLE`, so
    `db/migrate.js` rebuilds `stock_adjustments` (new table with the wider
    `CHECK`, copy rows across, drop, rename) for any pre-existing
    install — and the route-level allow-list in `routes/batches.js` had
    its own separate hardcoded four-value array that also needed updating
    (caught by an end-to-end smoke test against a running server, not by
    inspection — a `POST /api/batches/adjustments` with `'Sample'` came
    back rejected even after the schema/migration fix alone).

## Database schema

See `db/schema.sql` for the full, commented definition. Summary:

| Table | Purpose |
|---|---|
| `stores` | Branches/outlets (multi-store from day 1) — CRUD + an Admin-only session store-switcher are live from the sidebar |
| `roles`, `users` | Admin / Pharmacist / Cashier / Accounts |
| `items` | Shared item master — name, generic name, HSN, GST%, Schedule (OTC/H/H1/X), pack size, unit, reorder level |
| `distributors` | Supplier ledger — CRUD live, includes state (used for CGST/SGST vs IGST), plus a full statement view (opening balance, every purchase/payment as a dated debit/credit, running balance) |
| `purchase_orders`, `purchase_order_items` | Requests out to a distributor (Draft/Sent/Cancelled) — CRUD live; "GRN status" is always derived (see Architecture Decisions), never stored |
| `purchases`, `purchase_items` | GRN header + lines — CRUD live; saving a GRN creates one `batches` row per line in the same transaction, and bumps the matching PO line's `quantity_received` if `purchase_order_id` is set |
| `batches` | Store-scoped stock lots — batch no., mfg/expiry dates, quantity, purchase rate, MRP — viewable/searchable live, with expiry status (expired/near/ok) computed per row |
| `categories` | Shared managed picklist (name/icon/description) for the Item Master's Category field — CRUD live |
| `sales`, `sale_items` | POS invoices — live; each line records the exact FEFO-selected `batch_id` it was sold from, split across lots automatically if one lot doesn't cover the quantity. Also carries the patient loyalty discount and (see Architecture Decisions) doctor commission fields, both snapshotted at checkout |
| `sale_returns`, `sale_return_items` | Partial-line returns against a Completed sale — live; restores stock to the originating batch and proportionally claws back any doctor commission, without ever mutating the original sale |
| `prescriptions` | Patient/doctor/Rx reference + optional photo, for Schedule H1/X sales — live end to end: text created inline by `POST /api/sales`, photo attached/replaced afterwards from the register, both searchable/viewable there |
| `stock_adjustments` | Expired / Damaged / Lost / Correction / Return to Supplier / Sample, always reducing a batch's quantity — CRUD live from the Batches & Stock screen |
| `doctors`, `doctor_commission_payments` | Referral commission registry — name, phone, registration no., default commission % — CRUD live, with a per-doctor commission history view and a "Pay Out" action that settles all unpaid commission in one lump sum |
| `activity_log` | Audit trail |
| `license_state` | Single-row trial/license record |

The Item Movement Log (`routes/movements.js`) and the eight Shop Settings
columns added to `stores` (`tagline`, `owner_name`, `phone_alt`, `email`,
`fssai_no`, `bill_prefix`, `default_gst_rate`, `invoice_footer`) aren't
their own tables — see the MediStore Pro feature parity entry above.

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
3. **Installer icon still shows the old green pharmacy-cross badge** —
   `packaging/app-icon.ico` was generated to match VEDA's original
   green/gold palette and wasn't regenerated for the navy/teal reskin.
   Cosmetic only (doesn't affect anything at runtime), but worth doing
   before the next installer build for visual consistency with the app
   itself.

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
│   ├── auth.js, license.js, items.js, distributors.js, purchases.js, purchase-orders.js,
│   │   batches.js, sales.js, prescriptions.js, doctors.js, reports.js, stores.js,
│   │   categories.js, movements.js
├── utils/
│   ├── helpers.js           # logActivity, generateGrnNo, generateInvoiceNo, generateReturnNo, generatePoNo
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
