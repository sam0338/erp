# Bug Report & Fixes — SAKAAR ERP

> **Renamed to SAKAAR ERP** as of Round 23. Every round below this notice
> (1–22) was written when the product was still called "MSME Saarthi" —
> left as-is rather than rewritten, since it's a historical dev log of
> what was actually done at the time. All in-app branding, file names,
> the license generator, and the installer scripts have been updated to
> SAKAAR ERP; see Round 23 for the full list of what changed.

I read through every backend and frontend file, matched each frontend `API.*`/`fetch()`
call against the actual server routes, and cross-checked all SQL against the table
schemas. Summary: the project had **four different, mutually-inconsistent server
files** (`server.js`, `server-fixed.js`, `server-fixed-FULL.js`, `server-fixed-BACKUP.js`)
plus three different, conflicting database-schema definitions. None of them matched
what the frontend actually needed. I consolidated everything into one working
`server.js` and fixed the frontend bugs that were causing crashes.

## Critical bugs (app was broken/crashing)

1. **`package.json` pointed at a dead entry point.** `npm start` / `node server.js`
   ran the original `server.js`, which required `./backend/routes/auth`,
   `./backend/routes/purchase`, etc. — **those files never existed in the project**.
   The app could not start at all via the documented command. Only `server-fixed.js`
   (never wired up as the actual entry point) worked.

2. **GRN (Goods Receipt) was 100% unimplemented on the backend.** The frontend
   (`grn.js`) and API client (`api.js`) both call `POST/GET /api/purchase/grn`,
   and the database schema already had `grn`/`grn_items` tables — but no server file
   had any route for them. Every attempt to receive a PO failed. This is also why
   the previous "fix" doc claiming *"Issue #2: Cannot move PO to GRN — Fixed"*
   was incomplete: it added a PO **submit** endpoint, but never built GRN itself.

3. **Purchase Order line items were silently discarded.** In `purchase-orders.js`,
   the "Add Item" UI built rows in the DOM, but `POModal.submit()` never read
   them back out — the POST body only ever contained `vendor_id`, dates, and
   notes. Every PO was created with zero items. The backend's insert also never
   touched the `purchase_order_items` table. Fixed both sides: the frontend now
   collects the item rows, and the server persists them and computes real
   `total_amount` / `tax_amount` / `grand_total`.

4. **Viewing a PO's details crashed.** `POModal.viewDetails()` calls
   `po.items.map(...)`, but the backend's `GET /purchase-orders/:id` never
   returned an `items` array (`undefined`), so this threw
   `Cannot read properties of undefined (reading 'map')` on every click.

5. **`API.updatePOStatus` didn't exist.** The "Submit" button on the PO list
   calls `POModal.updateStatus()` → `API.updatePOStatus()`, which was never
   defined in `api.js`. Clicking Submit threw `API.updatePOStatus is not a
   function`. Added the method and a matching
   `PUT /api/purchase/purchase-orders/:id/status` route. Also aligned the status
   strings (`Draft → Submitted → Approved`) between frontend and backend, and
   added the missing "Approve" button — without it, a PO could never reach
   `Approved`, and the "GRN" button (which only shows for `Approved` POs) was
   unreachable in practice.

6. **Vendor edit/delete was broken.** `vendors.js` calls `API.getVendor(id)`,
   `API.updateVendor()`, and `API.deleteVendor()`, none of which had server
   routes (only list + create existed). Editing or deleting a vendor failed
   silently. Added `GET/PUT/DELETE /api/purchase/vendors/:id`.

7. **Invoices module had no backend at all.** `invoices.js` calls
   `createInvoice`, `getInvoices`, `updateInvoiceStatus` — no matching routes
   existed anywhere. Added them, backed by the existing (unused) `vendor_invoices`
   table.

8. **Indent → RFQ → PO workflow was almost entirely missing.**
   `indent-purchaser.js` and `indent-approver.js` call
   `/api/indent/:id`, `/api/indent/:id/quotation`, `/api/indent/:id/quotations`,
   `/api/indent/:id/evaluate-rates`, `/api/indent/:id/generate-po`, and
   `/api/indent/:id/reject` — none existed. Added all of them.

9. **Production Planning was broken by a schema mismatch, not just a missing
   route.** Two different `production_orders` table definitions existed
   (`init-db.js` used `material_id`/`quantity`; `production-schema.js` used
   `product_name NOT NULL`/`quantity`/`unit_of_measure`). The frontend
   (`production-planning.js`) sends `product_name`, but the server's insert used
   `material_id` — so on the schema that actually matched the "richer" table,
   the insert would fail on the `NOT NULL` constraint. Also, `/api/production/work-orders`
   and `/api/production/allocations` had no routes despite the frontend calling
   them and the schema already existing. Standardized on one schema and added
   the missing routes.

10. **Two conflicting table definitions for `materials`, `purchase_orders`,
    `production_orders`, etc.** existed across `init-db.js` and
    `backend/config/database.js`/`production-schema.js`. Whichever ran first
    silently won (`CREATE TABLE IF NOT EXISTS`), so behavior depended on which
    setup script you happened to run. Consolidated into a single schema.

11. **Indent/Production/Notification tables were never created when running
    the app the "recommended" way.** `server-fixed.js` connected straight to
    the SQLite file with no schema setup; the `initialize*Schema()` calls only
    ever ran from the *broken* `server.js`. So the working server had no
    `indents`, `vendor_quotations`, `work_orders`, `stock_adjustment`, etc.
    tables at all. The new `server.js` creates every table itself on startup.

## Smaller bugs

- `api.js` defined `createStockOut`/`getStockOutList` **twice** — harmless
  (the second silently overrides the first) but confusing; removed the
  duplicate.
- `GET /inventory/warehouses` had no matching `POST`, even though nothing
  currently calls it from the UI to create one — added for completeness/parity.
- Stock ledger upserts used two different code paths (get-then-update-or-insert)
  duplicated in four places; factored into one `addToLedger()` helper and added
  a `UNIQUE(material_id, warehouse_id)` constraint so it can't silently create
  duplicate ledger rows for the same material/warehouse.
- `grand_total`/`total_amount` were referenced by the frontend but never
  actually computed by the server on PO creation — always `0`/`NaN`. Now
  computed from the line items.
- Removed `server-fixed.js`, `server-fixed-BACKUP.js`, `server-fixed-FULL.js`,
  `init-db.js`, and `backend/config/*` — all superseded by the single
  `server.js`, which creates the schema and seeds the admin user/default
  warehouse automatically on first run.

## Known remaining gaps (flagged, not fixed — out of scope for a bug pass)

- The Indent-Purchaser RFQ screen (`indent-purchaser.js`) actually pulls its
  "pending indents" list from `/purchase/purchase-orders` filtered by
  `status === 'Approved'`, not from the `indents` table, and hardcodes
  material/quantity/department text ("Steel Sheet", "100 Kg", "Production").
  This is a UI wiring issue that predates this fix — the RFQ/quotation
  endpoints I added will work correctly once that page is pointed at real
  indent data.
- `api.js`'s `request()` helper returns `null` (not an object) on a 401, but
  many callers do `result.error` without a null-check, which will throw on an
  expired/invalid session instead of showing a clean error. This pattern
  repeats across most page files — worth a follow-up pass if you want it
  hardened.


---

## Round 2 fixes (from live testing feedback)

### 1. PO printing didn't exist at all
There was no print capability anywhere in the app. Added a **Print** button
on both the PO list row and the PO details modal (`POModal.printPO`) that
opens a clean, print-formatted document (vendor, dates, item table, tax/
totals) in a new tab and triggers the browser's print dialog automatically.

### 2. Raised indents never reached the approval section
This turned out to be **three compounding bugs**, any one of which alone
would have broken the flow:

- `POST /api/indent/create` only ever returned `indent_id` in its response,
  but the "Raise Indent" form read `result.id` right after creating an
  indent, to immediately submit it. `result.id` was `undefined`, so it called
  `PUT /api/indent/undefined/submit` — which matched zero database rows and
  silently did nothing. The indent stayed stuck in `Draft` forever.
- `GET /api/indent/my-indents` — which the same page calls to show your own
  Draft/Pending/Approved indents — **didn't exist as a route at all**. The
  fetch 404'd, so an employee couldn't even see whether their indent existed,
  independent of the bug above.
- Even after fixing both of those, the page's own tab-filtering logic checked
  for `status === 'Pending Approval'`, but the backend actually sets
  `status = 'Pending'` on submit — so the row would never land in the
  "Pending Approval" tab either.

All three are fixed: the create endpoint now returns both `id` and
`indent_id`, `GET /api/indent/my-indents` is implemented, and the status
string is now consistent everywhere.

**Bonus bug found in the same flow:** the approver's "Approve" button POSTs
`{ approval_comments }`, but the backend's `/approve` route required a
truthy `approved` boolean that was never sent — so clicking **Approve** was
silently falling through to the rejection branch and **rejecting** the
indent instead. Fixed (approve/reject are separate endpoints/buttons already,
so `/approve` no longer needs that flag at all).

### 3. Vendor rates weren't being recorded item-wise per indent
The RFQ/rate-comparison page (`indent-purchaser.js`) was never actually
looking at real indents — `loadApprovedIndents()` queried
`/api/purchase/purchase-orders` and treated *Approved purchase orders* as
stand-ins for indents, padding the table with hardcoded placeholder values
("100", "Steel Sheet", "Production") that had nothing to do with the actual
request. So any vendor quotation you recorded was tied to fake data, not a
real indent — and the total-price calculation used a hardcoded quantity of
`100` regardless of what was actually needed.

Fixed by:
- Adding `GET /api/indent/approved` (approved indents ready for RFQ).
- Pointing the RFQ page at that endpoint and rendering real material name,
  quantity, area of use, and priority per indent.
- Using the indent's real `quantity_required` when computing a quotation's
  total price.
- Showing a live "quotes received" count per indent, sourced from
  `vendor_quotations` (already indent-scoped, so multiple suppliers'
  submitted rates are recorded and compared per item rather than overwriting
  each other — this was already correct in the schema, it just wasn't wired
  to real data before).


---

## Round 3 fix (from live testing feedback)

### Root cause of the 401s and "indents.filter is not a function" crash
Two `fetch()` calls in `indent-employee.js` — loading "My Indents" and the
live "available in store" lookup — were missing the `Authorization` header
entirely (every *other* fetch call in that file, and in the rest of the app,
correctly sends `Bearer <token>`). Since the backend's `verifyToken`
middleware requires that header, both calls always got back
`401 { error: 'No token provided' }` instead of data. The page then called
`.filter()` on that error object as if it were an array, which threw and
crashed the whole page before it could render.

Fixed both calls to send the token, and added a guard so that if a session
ever does expire mid-use, the page shows a clear "please log in again"
message in the table instead of a hard crash. Added the same defensive guard
to the approver and purchaser indent pages, since they hit the same class of
endpoint.


```bash
npm install
node server.js
```

No separate `init-db.js` step needed anymore — schema creation and the default
`admin` / `admin123` login are handled automatically the first time the server
starts.

**Note:** I could not fully runtime-test this in the sandbox I worked in —
`better-sqlite3`'s native build needs to download Node headers from
`nodejs.org`, which wasn't reachable there. Every file passed `node --check`
(syntax-valid), and I traced every route/query against the schema by hand, but
please run it locally and let me know if anything surfaces.


---

## Round 4: User Management (new feature)

Added a proper admin-controlled user/privilege system:

- **New "User Management" screen** (visible only to `admin` accounts, in the
  top nav) to create logins for approvers, purchasers, storekeepers,
  production staff, and employees, edit their role/department, deactivate or
  reactivate an account, and reset a forgotten password.
- **Roles / privileges:** `admin`, `approver`, `purchaser`, `storekeeper`,
  `production`, `employee`. A user's role is what the rest of the app should
  gate access by (e.g. only `approver`/`admin` should approve indents).
- **Security fix found along the way:** the public self-registration form's
  backend endpoint (`POST /api/auth/register`) accepted a `role` field
  straight from the request body. The Register tab in the UI doesn't expose
  a role picker, but nothing stopped a direct API call from sending
  `role: "admin"` and self-promoting. Self-registration is now hardcoded to
  the lowest-privilege role; only an admin can grant anything higher, via the
  new screen.
- Deactivated accounts are now correctly blocked at login with a clear
  message, instead of silently still being able to sign in.

**Not yet done, flagged for you:** the role field currently exists and is
settable, but most pages don't yet *check* it to hide/restrict actions (e.g.
a `storekeeper` login can currently still open Purchase Orders). Enforcing
per-page access by role is a reasonable next step once you confirm which
roles should see which screens.

## Round 5: the 5 workflow chains you listed

Quick status check against what's actually built vs. not, so we don't build
the wrong thing next:

1. **Procure to stock** — `Requisition → RFQ → PO → GRN` all exist and are
   wired end-to-end. **Incoming QC** does not exist — GRN currently marks
   received stock as accepted immediately, with no inspection/hold step.
2. **Stock to production** — material reservation (`production_allocation`)
   and work orders exist. **FG (finished goods) receipt back into stock**
   does not exist yet — production output isn't posted back to the stock
   ledger.
3. **Quality to release** — does not exist at all. No inspection plans,
   result entry, pass/hold/reject states, or rework/CAPA tracking.
4. **Order to dispatch** — does not exist at all. There's no sales/customer
   side of this app yet (no sales orders, allocation-to-order, packing,
   dispatch, or invoice linkage on the sales side — only vendor-side
   invoices exist today).
5. **Record to report** — partial. Data is captured transactionally, but
   there's no ledger-style summary/MIS reporting layer or dashboards beyond
   the basic counts on the main Dashboard page.

Items 3 and 4 are essentially whole new modules (Quality and Sales), not
small additions — building all five properly in one pass would mean shipping
something shallow on all of them. Worth agreeing which to tackle first.

## Round 6: Incoming Quality Control (finishes the procure-to-stock chain)

The chain was: `Requisition → RFQ → PO → GRN → incoming QC → accepted stock`.
Everything up to GRN worked, but GRN was putting received quantity straight
into usable stock — there was no inspection gate at all. Added one:

- **GRN no longer adds straight to usable stock.** Received quantity now
  lands in a new "QC pending" bucket per material/warehouse and is invisible
  to production allocation, stock-out, etc. until inspected.
- **New "Quality → Incoming Inspection" screen** (nav bar) with three views:
  - *Pending Inspection* — every GRN line item awaiting a decision, with a
    running remaining-quantity count (supports inspecting in batches, e.g.
    50 today, 50 tomorrow, without losing the first result).
  - *On Hold (Rework/CAPA)* — quantity inspected and held rather than
    passed/rejected outright, with a "Release" action to finally disposition
    it (pass after rework → joins usable stock, or reject → written off).
  - *Inspection History* — full audit trail of every result recorded, who
    recorded it, and when.
- **Per-material QC opt-out**: added a "Requires Quality Inspection" checkbox
  on the Materials page. Unchecked, that material's receipts skip QC and go
  straight to usable stock (useful for things like consumables where a full
  inspection step isn't warranted) — same behavior as before this feature
  existed.
- Stock ledger (`/api/inventory/ledger`, used by allocation/stock-out/low
  stock checks) is untouched by this change and still only reflects
  QC-passed, usable stock — it simply now excludes anything still pending or
  on hold, which is the correct behavior for "accepted stock" in the chain.

**Scoped deliberately narrow:** this is the QC gate needed to finish chain 1
(procure-to-stock). It is *not* the full Quality module from chain 3
(inspection plans, formal CAPA case tracking with root-cause analysis,
etc.) — the hold/release mechanism here is a minimal, functional version of
that, not the full thing. Flagging so expectations are clear if #3 comes up
next.

## Round 7: GRN print, category-wise stock, and the RFQ→PO bug

### 1. PO not generating from RFQ/rate comparison
Real bug, and it failed completely silently. The "Generate PO" step after
selecting a winning vendor in Rate Evaluation never actually sent
`vendor_id` in its request — only `evaluation_id`. `purchase_orders.vendor_id`
is a required (`NOT NULL`) column, so the insert always failed server-side.
There was also no error handling written for that specific call, so the UI
just... did nothing after "Generating PO..." — no PO, no error message,
nothing. Fixed both sides: the frontend now sends the selected vendor, the
backend falls back to the evaluation's selected vendor if it's ever missing
anyway, and a failure now shows a clear alert instead of disappearing.

### 2. Printable GRN (A4) with the full indent → PO → QC trace
New "Print" button on every GRN row generates an A4-formatted document with
three stamped sections, so one printout is the full audit record of the
cycle:
1. **Indent Approval** — indent number, who raised it, who approved it and
   when (shows "not raised from an indent" if the PO was created directly).
2. **Purchase Order Approval** — PO number, vendor, who created it, who
   approved it and when, PO value.
3. **Quality Inspection** — pass/hold/reject breakdown per line item and
   overall QC status.
Followed by the item table (received / rejected-at-dock / QC pass / hold /
reject / batch) and signature lines for Store Keeper / Quality Inspector /
Authorized Signatory.

**Bug fixed to make this possible:** PO approval was never actually being
timestamped. There are two ways a PO gets approved in this app (`/approve`
and the generic `/status` endpoint the PO list's Approve button actually
uses) — neither recorded *when* it was approved, and the one the UI
actually calls didn't record *who* either. Added `approved_at` and fixed
both endpoints to set it.

**Also fixed:** the GRN list's "View" button was a literal stub —
`onclick="alert('View GRN details coming soon')"`. It's now the Print
button described above.

### 3. Category-wise stock view (+ a broken dashboard fixed along the way)
Added a **"Stock by Category"** tab on the Inventory page: every active
material, grouped by category, showing usable stock, quantity still in QC,
quantity on hold, reorder level, and OK/LOW status — with a category filter
dropdown. This is the "complete stock of the item, category-wise" view.

While building it, found the existing **Stock Ledger tab had been silently
broken**: it read field names (`current_balance`, `reorder_point`,
`reserved_qty`) that the backend never actually returned (it returns
`quantity` and `reorder_level`) — so every row showed blank/`undefined`
values and the LOW/OK badge was always wrong (always evaluated to OK,
since `undefined <= undefined` is `false`). Same bug, same fix, in the Low
Stock Alerts tab. Also found the **"Stock Value" card had no code wired to
it at all** — it displayed "-" forever; now computed from the existing
valuation endpoint. And low-stock detection now correctly totals a
material **across all its warehouses** before comparing to reorder level,
instead of checking each warehouse row in isolation (a material split
50/50 across two warehouses, each under reorder level, used to never be
flagged even if the true total was critically low).

## Round 8: Company branding, approval hierarchy, and vendor payment vouchers

### 1. Company letterhead on PO/GRN prints
New **Admin → Company Settings** page: company name, address, GSTIN, phone,
email, website, and a logo upload (stored as the settings are, no separate
file server needed) — with a live preview as you type. Both the PO print
and the GRN print now render this as a proper letterhead header (logo +
name + address/contact line) instead of a plain "PURCHASE ORDER" heading,
plus a highlighted meta-info row (PO Number / Date / Expected Delivery /
Status) similar to the format requested.

### 2. Approval hierarchy ("Level 1 → Level 2 → ...")
New **Admin → Approval Hierarchy** page, plus an **Approval Level** field on
every user (User Management page):
- **Indents**: admin sets a flat number of sequential levels required (e.g.
  2). An indent can't skip from Level 1 straight to "Approved" — each level
  must sign off in order, and a Level 2 approver can't jump the queue ahead
  of Level 1.
- **Purchase Orders**: admin defines value-based tiers (e.g. up to ₹50,000 →
  1 level; ₹50,000–₹5,00,000 → 2 levels; above → 3 levels). The required
  level is locked in at submit time based on the PO's grand total.
- Enforcement happens **server-side** on every approve action — a user
  whose approval level doesn't match "the next level in line" gets a clear
  rejection message telling them what level is actually needed next.
  Admin accounts can approve at any level as a safety valve, so the chain
  can't get permanently stuck if a specific approver is unavailable.
- Every level's approval (or rejection) is logged to a new audit table and
  shown in full on the GRN traceability print — so a 3-level PO approval
  shows all 3 signatures, not just the last one.

**Bug fixed to make the "Approve" button trustworthy:** the PO list's
Approve button had no error handling wired up at all — if an approval was
ever rejected (wrong level, wrong status, etc.), it would fail completely
silently with no message shown. Fixed.

### 3. Vendor payment vouchers, auto-triggered from GRN
As requested: completing a GRN now **automatically creates a pending vendor
invoice** for that receipt's value (due date computed from the vendor's
payment terms, defaulting to 30 days if terms aren't parseable). From the
Vendor Invoices page, "Process Payment" opens a voucher form (amount, date,
payment mode, reference number, remarks) — each voucher is logged, and the
invoice's paid amount/status (`Pending` → `Partially Paid` → `Paid`)
updates automatically. Multiple partial payments against one invoice are
supported and all show in that invoice's payment history.

**Bug fixed along the way:** the old "Mark Paid" button flipped an
invoice's status to `Paid` without ever actually recording a paid amount —
so the displayed "Paid" total stayed wrong even after marking something
paid. Replaced with the voucher flow, which keeps the numbers honest.

## Round 9: Auto-generated serial numbers (Vendor, Material, PO, Indent)

Vendor Code and Material Code were previously free-text fields the user
typed in by hand on creation — exactly the "manual entry causes confusion"
problem (duplicate codes, inconsistent formats like "V001" vs "VEN-1" vs
"v1", typos). PO Number and Indent Number were already system-generated,
but from `Date.now()` — unique, but not a clean sequential series.

All four now use one shared, gap-free sequential numbering scheme:
- **Vendors**: `VEN-0001`, `VEN-0002`, ...
- **Materials**: `MAT-0001`, `MAT-0002`, ...
- **Purchase Orders**: `PO-0001`, `PO-0002`, ... (same series whether created
  directly or generated from an indent's RFQ)
- **Indents**: `IND-0001`, `IND-0002`, ...

Implementation: a small `sequences` table tracks "next number" per entity,
incremented inside its own transaction so two people creating a vendor at
the same moment can never collide on the same code. Vendor Code and
Material Code fields are now **read-only** in their forms — assigned only
by the server — and Vendor Code can no longer be changed even via an edit,
so it stays a stable, permanent identifier.

Other document numbers (GRN, invoices, payment vouchers, QC inspections,
stock in/out/transfer) were already system-generated (via timestamp) rather
than manually typed, so there's no manual-entry risk there today — happy to
switch those to the same clean sequential style too if you'd like
consistency across the board.

## Round 10: PO edit/delete workflow, fixed approvers, module permissions (from your own edits) + GRN→Accounts and BOM frontend

Reviewed the version you uploaded. Your PO edit/delete + fixed-approver +
module-permission changes are all in place and working (nice work — the
change-request grant mechanism and the per-role default module permissions
are both solid). Two small gaps found and fixed:

- The backend already supports an `accounts` role (with its own default
  module permissions), but the Users page's role dropdown didn't list it —
  so there was no way to actually create an Accounts Dept login from the
  UI. Added it to the role list and the module-permission labels.

**Bigger finding:** the backend for both of your new requests — GRN→Accounts
submission/acknowledgment, and Product Recipes (BOM: which raw materials
make which finished product, with input quantities that auto-scale to the
production order's quantity) — was **already fully built**, schema through
API client, in your uploaded file. There was just no page UI wired up to
actually use any of it. Built the missing frontend:

- **GRN page**: a "Send to Accounts" button appears once a GRN's QC cycle is
  fully complete, plus an Accounts-status badge (Not Sent / Awaiting Ack. /
  Acknowledged) per GRN.
- **New Accounts page** (nav-gated by the `accounts` module): date-filterable
  list of submitted GRNs with a one-click Acknowledge action — this is the
  "daily basis" acknowledgment you asked for.
- **New Bill of Materials page**: create/edit a recipe for a finished
  product — output quantity/unit, plus a list of raw materials each with
  input quantity, unit, and scrap %.
- **Production order creation**: can now select a recipe instead of typing
  the product manually. Doing so shows a live preview of exactly how much
  of each raw material is needed, scaled to the order quantity you enter
  (with scrap % factored in), and the order is saved with its computed
  expected input/output quantities — visible as new columns on the
  Production Orders table.

**Known gap, flagged honestly:** none of this posts finished-goods output
back into the stock ledger yet when a production order completes — the
recipe/BOM math is there, but "production complete → stock increases" isn't
wired up. That's a natural next step if you want the full
requisition-to-finished-goods loop closed.

## Round 11: Purchase Order print redesigned to match your Work Order format

Matched the layout/structure of the sample Work Order PDF you shared:

- **Header**: logo stays left, company name/address/GSTIN now **right-aligned**
  (previously left-aligned next to the logo). GSTIN is shown right under the
  company name, same position as the sample.
- **Vendor / Deliver To boxes**: since this is a Purchase Order (we're the
  buyer), the two boxes show the **Vendor being ordered from** (with their
  GSTIN, address, phone) and **our own delivery address** — the mirror
  image of the sample's Bill To/Ship To, adjusted for the fact that a PO
  and a Work Order face opposite directions.
- **Commercial Terms box**: new bordered section — Our Rates, Inspection,
  P&F, Payment Term, Insurance, Freight, Destination, Transporter — filled
  in on the PO creation/edit form and printed exactly like the sample's
  layout.
- **Item table**: added a **Grade** column (pulled from the material's
  record) between Description and Qty, matching the sample.
- **Special Remarks**: new free-text field on the PO form, filled in at
  creation time (not a fixed template) — prints in its own bordered box
  below the totals, same position as the sample.
- **Signature block**: "This order is technically reviewed and accepted."
  followed by two signature lines — **Prepared By** and **Approved By** —
  each printing the actual name of that person (the PO's creator and its
  final approver) rather than a blank line to sign.

All of the above (category, commercial terms, special remarks) are stored
on the PO itself, so they're editable through the same PO edit flow
(Draft-owner-direct or change-request-approved) as everything else.

## Round 12: System Administration suite

Added a new **Admin → System Settings** page (tabbed) plus upgrades to
User Management, covering all ten items requested. Honest status against
each:

1. **User management** — already existed; unchanged.
2. **Role-based access control** — already existed (6 roles); unchanged.
3. **Permission matrix by module and action** — upgraded. Previously each
   user just had a flat "has access to this module: yes/no" toggle. Now
   it's a full matrix — **View / Create / Edit / Delete / Approve**, per
   module, per user — set on the User Management edit screen. Enforced
   server-side (not just hidden buttons): e.g. someone with `view` but not
   `create` on Purchase gets a real 403 if they try to POST a new PO, not
   just a missing button in the UI. Old single-boolean permission data
   still works (a `true` expands to "all actions allowed", `false` to
   "none") so nothing broke on upgrade.
4. **Company profile and branch setup** — Company Settings (single profile)
   already existed. Added a **Branches** master (code, name, address,
   GSTIN, phone, head-office flag) under System Settings.
5. **Financial year and period locking** — new. A financial year has 12
   auto-generated monthly periods; each can be locked independently. A
   locked period **blocks new/edited POs dated inside it** with a clear
   error. Scoped to POs for now (the highest-value transaction to lock) —
   extending the same `checkPeriodOpen()` check to GRN/stock-in/etc. is a
   small follow-up if you want period locking enforced everywhere.
6. **Number series and document prefixes** — every auto-generated number
   in the system (Vendor, Material, PO, Indent, GRN, Invoice, Payment
   Voucher, Stock In/Out/Transfer, Adjustment, Quotation, Production
   Order, Work Order, Allocation, Recipe) now goes through one
   admin-configurable system — prefix, zero-padding, and next-number are
   all editable from System Settings. Previously GRN/Invoice/Voucher/etc.
   used a raw timestamp (`GRN-1735829...`), which worked but wasn't
   configurable or as clean — all converted to the same clean `PREFIX-0001`
   style as Vendor/Material/PO/Indent.
7. **Approval workflow rules** — already existed (Approval Hierarchy page:
   indent levels + PO value-based tiers); unchanged.
8. **Audit trail and activity logs** — the `audit_logs` table existed in
   the schema but **nothing ever wrote to it** — a dead table. Wired up a
   `logAudit()` helper and a real Audit Log viewer (filterable by module/
   user/date). Currently logging PO creation, PO approval steps, and user
   creation as a working example — not yet exhaustive across every action
   in the app. Say which other events matter most to you and I'll extend
   coverage.
9. **Notification templates** — new. Template library (title/subject/body
   with `{placeholders}`) for events like PO-pending-approval, GRN-sent-
   to-accounts, low-stock, etc. **Important:** this is content management
   only — there's no SMTP/email or SMS sending set up anywhere in this
   app, so nothing is actually dispatched when these events occur yet.
   This is the honest groundwork for that, not the real thing.
10. **Backup and restore controls** — new. One-click backup downloads a
    consistent snapshot of the live database (using `better-sqlite3`'s
    safe hot-backup API, not a raw file copy that could catch a
    mid-write). Restore requires uploading a `.db` file and typing a
    confirmation phrase (checked server-side, not just in the browser);
    it automatically takes a safety copy of the current database before
    overwriting it, then the server process exits so it can be restarted
    cleanly against the restored file (there's no process manager
    configured to auto-restart it, so you'll need to start it back up
    yourself after a restore).

## Round 13: Master Data Management

New **Master Data** nav item (own module permission, so it can be granted
independently of Purchase/Production/etc.) covering everything requested:

- **Item Groups, Grades** — simple code+name masters. The Materials
  (Item Master) form's Category and Grade fields are now **dropdowns
  sourced from these masters** instead of free-text — this is the actual
  point of a master ("standardize what powers downstream modules"), not
  just a list sitting unused next to the real data entry.
- **UOM + conversion factors** — unit master, plus a conversion table
  (e.g. "1 Box = 12 Nos"). The Material form's Unit of Measure dropdown
  now also pulls from this master instead of a hardcoded list.
- **BOM master** — already existed (Production → Bill of Materials, added
  earlier). **Routing master** — new: sequence of operations (each
  optionally tied to a Work Center) to produce something, optionally
  linked to a BOM recipe. This is the process steps, distinct from the
  BOM's materials-in/out.
- **Warehouse, rack, bin, location masters** — warehouses already existed;
  added rack/bin location codes within them.
- **Supplier master** — already existed (Vendors). **Customer master** —
  new, same shape as Vendors, standalone since there's no sales module to
  consume it yet (flagged as a known gap in an earlier round).
- **Tax master, HSN/SAC, GST class** — new: tax name, rate, HSN/SAC code,
  GST classification (Goods/Services/Exempt/Nil-rated).
- **Employee, department, shift, machine, work center masters** — all new.
  Employee master is deliberately separate from Users (portal logins) —
  not every employee needs a login, and not every login is necessarily
  tied to an HR employee record.
- **Reason codes** — rejection/return/scrap/adjustment, each tagged with
  its category.
- **Payment terms, transporters, dispatch modes** — new masters.

**Implementation note:** nine of these (Item Group, Grade, UOM, Department,
Shift, Reason Code, Payment Term, Transporter, Dispatch Mode) share one
generic "code + name (+small extra fields)" table and one reusable UI
widget rather than nine near-identical ones — same functionality, much
less code to maintain.

**Scoped honestly:** Category/Grade/UOM on the Item Master are wired to
their masters now. Payment Term/Transporter on the PO commercial-terms
form, and the reason codes on QC rejection/stock adjustment, are **not**
wired up yet — those still take free text. Say if you want those
connected next; it's the same pattern, just needs doing per screen.

## Round 14: Inventory & Stores — real batch traceability

This was a genuine rework of the stock model, not just new screens. Before
this, stock was tracked only as an aggregate quantity per material +
warehouse — batch numbers were recorded in transaction history (GRN, stock
in) but never actually tracked as *stock*, so there was no way to answer
"which batches do we currently have" or "where did this specific batch end
up." Fixed that properly:

- **New `stock_batches` table**: every receipt (GRN, manual stock-in, a
  positive adjustment, a QC hold released as pass) creates its own batch
  record with quantity remaining, batch/heat/coil/serial numbers, unit
  cost, and where it came from. The existing aggregate `stock_ledger`
  stays as-is underneath (nothing that reads "current stock" broke), but
  now there's a real traceable layer on top of it.
- **Heat, coil, and serial number fields** added to GRN item entry and
  manual Stock In, alongside the batch number that already existed.
- **FIFO consumption**: stock-out, stock-transfer, production material
  allocation, and negative stock adjustments now draw from the *oldest*
  batch first automatically. Falls back to a plain ledger decrement only
  for stock that predates this feature (nothing to trace it back to), so
  nothing gets blocked by the upgrade.
- **Transfers preserve batch identity**: sending a transfer records exactly
  which batches (with their heat/coil/serial numbers) were drawn from;
  receiving it recreates those same batches in the destination warehouse,
  so a coil doesn't lose its identity just by moving location.
- **Material reservation against work orders** — already existed
  (Production Allocation); now draws from traceable batches too. Sales
  orders aren't a thing yet (no sales module — flagged in an earlier
  round), so that half of "reservation against work orders or sales
  orders" only covers the work-order side for now.
- **Min/max stock control**: added Max Stock Level on the Item Master,
  alongside the Reorder Level (min) that already existed.
- **Stock adjustment with approval** — already existed from an earlier
  round; now also creates/consumes batches on approval instead of just
  moving the aggregate number.
- **New reports** on the Inventory page: **Batch/Heat/Coil/Serial**
  register (every batch currently in stock), **Stock Aging** (0-30 /
  31-60 / 61-90 / 90+ day buckets per batch), and **Slow-Moving / Dead
  Stock** (materials with stock on hand but no outward movement in 90 or
  180 days, whichever you pick).
- **Stock ledger and valuation summaries** — already existed from earlier
  rounds; unchanged.

**Known limitation, stated honestly:** the QC-hold-release-as-pass path
creates a new generic batch rather than tracing back to the exact original
batch it came from (the hold bucket itself isn't batch-granular yet — it's
tracked at material+warehouse level). Everything else in the chain is
fully traceable end to end.

## How to run

```bash
npm install
node server.js
```

No separate `init-db.js` step needed — schema creation and the default
`admin` / `admin123` login are handled automatically the first time the
server starts.

## Round 15: Production Planning & Execution module

Connects BOM → Routing → Issue → Production → WIP → Output end to end, on
top of the BOM/routing/work-order/allocation scaffolding that already
existed from earlier rounds. Honest status against each item requested:

1. **BOM with alternate BOM support** — a product can now have more than
   one BOM (e.g. a substitute-material or different-process alternate),
   grouped under the primary on the Bill of Materials screen ("+
   Alternate" button). A BOM's output is now linked to a real `materials`
   record (`output_material_id`) so a receipt can post real stock — new
   **Item Type** field on Materials (Raw Material / Semi-Finished /
   Finished Good / Consumable / By-Product) marks which materials are
   valid BOM outputs.
   **Bug fixed along the way:** the Materials page's Edit button was a
   literal `alert('Edit functionality coming soon')` stub with no backend
   route at all — materials could never be edited after creation. Added
   `GET/PUT /api/purchase/materials/:id` and wired the edit form.
2. **Routing / operation sequence master** — already existed (Master Data →
   Routing); now actually connected: a BOM can carry a default routing,
   and creating a production order auto-generates one work order/job card
   per routing step in sequence, instead of routing sitting unused next
   to production.
3. **Production planning and scheduling board** — new Kanban-style board
   (Planned / In Progress / On Hold / Completed lanes) on the Production
   Planning page, each card showing product, quantity, schedule window,
   machine/shift/operator, and operation completion count; drag-free
   reschedule via a per-card status dropdown (`PUT
   /production/orders/:id/schedule`).
4. **Work order / job card creation** — already existed; now auto-created
   from the routing at order-creation time, tagged with machine/shift/
   operator, and printable as an A4 job card (product, operation, all
   operations on the order, materials issued, sign-off lines).
5. **Raw material issue to production** — the existing "Allocation"
   endpoint *was* already doing real stock deduction (FIFO by batch), just
   not labeled or tracked as an issue; renamed in the UI to "Issue
   Material" and now rolls up into a running `actual_input_quantity` on
   the order for variance reporting.
6. **Return of unused material** — new: a return posts the quantity back
   into usable stock as its own traceable batch (`source: 'Production
   Return'`) and reduces the order's counted consumption accordingly.
7. **WIP tracking by stage/operation** — new `production_wip_log`: each
   movement between stages records qty in/out, scrap/rework/rejection,
   and machine/shift/operator. A per-order summary view reconstructs the
   current WIP balance sitting at each stage.
8. **Production receipt and finished goods receipt** — this was the
   flagged gap from Round 10 ("production complete → stock increases"
   wasn't wired up). Fixed: a receipt now posts the BOM's linked output
   material into real, batch-traceable stock at the chosen warehouse, and
   updates the order's actual output quantity / status. Requires the BOM
   to have an Output Material set — the receipt form tells you clearly if
   it doesn't yet.
9. **Scrap, by-product, rework, and rejection capture** — captured at
   three levels: per work-order (operation-level), per WIP log entry
   (stage-level), and per receipt (order-level, including posting a
   by-product quantity into its own material's stock if one is linked).
10. **Machine, shift, and operator tagging** — added to production orders,
    work orders, and WIP log entries, sourced from the existing
    Machines/Employees masters.
11. **Production variance reporting against BOM** — new: for every
    in-progress or completed order, compares what the BOM says should
    have been consumed (scaled to order quantity) against what was
    actually issued minus returned, per material, plus an output
    yield % (actual output ÷ planned output). Flags material lines more
    than 10% off as a quick visual check.

**Scoped honestly:** WIP-log-driven scrap/rejection and work-order-level
scrap/rejection both roll up into the same order-level totals rather than
being reconciled against each other — if you log the same rejection at
both the work-order and the WIP-log for one operation, it will be counted
twice in the order total. Recording it at one level consistently avoids
this; a stricter single-source-of-truth version is a reasonable follow-up
if double-entry becomes a real problem in practice.

## Round 16: Sales & Dispatch module

This was a true zero-to-one build — Round 5's status check had flagged
"Order to dispatch — does not exist at all", and the Customer master
(added in Round 13) was explicitly left "standalone for now — ready for
when a sales module is built." That module now exists, chaining
Quotation → Sales Order → Dispatch Planning → Delivery Challan → Invoice,
plus returns and a dashboard. New **Sales** role and module permission
added (Users page role dropdown, module permission matrix).

1. **Quotation and sales order management** — quotations (multi-line,
   auto-computed tax/total) with Draft → Sent → Accepted/Rejected status;
   an Accepted quotation converts to a sales order in one click, copying
   its line items across.
2. **Order status tracking** — sales orders move through Draft →
   Confirmed → Ready to Dispatch → Partially Dispatched → Dispatched (or
   Cancelled), driven automatically as dispatch plans/challans are
   created rather than needing manual status bookkeeping at every step.
3. **Dispatch planning** — plan what goes out, from which warehouse, on
   what date/vehicle, against an order's *remaining* (ordered minus
   already-dispatched) balance per line — before any stock actually moves.
4. **Delivery challan / dispatch note** — the real stock-moving document:
   deducts FIFO-by-batch from the chosen warehouse immediately on
   creation, records which batches were drawn from, updates the order's
   dispatched quantity, and is printable as an A4 dispatch note (customer
   details, vehicle, e-way bill, item table, sign-off lines).
5. **Packing list support** — package-wise breakdown (package number,
   material, qty, weight) attached to a challan, separate from the
   challan's material-wise line items; printable.
6. **Invoice reference capture / integration hook** — lightweight invoice
   record (number, taxable value, tax, due date, external reference field
   for a Tally/Busy voucher number) with partial-payment tracking
   (Pending → Partially Paid → Paid). This is deliberately not a GST
   invoice generator — Finance module round will cover the fuller
   Tally/Busy staging-table integration (item #42 on your list).
7. **Sales return base flow** — a return is logged Pending, then
   Accepted/Rejected. Accepting posts "Good" condition lines back into
   real, traceable stock (`source: 'Sales Return'`); "Damaged"/"Rework"
   lines are recorded but deliberately not auto-added to usable stock —
   same inspect-before-you-trust-it gate the Quality module applies to
   incoming GRN stock.
8. **Customer dispatch history and pending order dashboard** — a Sales
   Dashboard tab shows pending orders (not yet fully dispatched) and
   upcoming dispatch plans at a glance, plus a per-customer dispatch
   history view (every challan ever sent to that customer, with items).

**Scoped honestly:**
- Sales order pricing/tax is entered manually per line (unit price, tax
  %) rather than pulled from a price list or the Tax Master's rates —
  wiring that up is a reasonable follow-up.
- Cancelling a delivery challan (`status = 'Cancelled'`) does **not**
  automatically reverse the stock deduction or the order's dispatched
  quantity — cutting a challan is treated as a real, committed stock
  movement. If you need cancel-and-reverse, flag it and I'll add it
  properly (it needs to reconstruct which batches to credit back).
## Round 17: BOM entry redesign + weight-based yield + Order Fulfillment Check (ATP)

Two related requests from the user, both aimed at the same real problem:
"our RM is always tracked in Kg, but the finished item is sold in
Nos/Mtr/CBM/Kg — how do we check RM consumption *and* automatically know
whether an order can ship from stock or needs production/purchase?"

### 1. BOM entry screen redesign
Rebuilt to match the reference screen the user shared (Tally-style "Add
Bill of Material Master"): a proper spreadsheet-grid layout with S.No /
Item Name / Qty / Unit rows in a scrollable table, rather than the
previous div-based row list. Added the fields from the reference screen:

- **Alias** — short code alongside the BOM name.
- **Item to Produce** — this was already the "Output Material" link from
  Round 15, now positioned and labeled to match.
- **Weight/Unit (Kg)** — the actual new capability: the Kg-equivalent of
  ONE output unit. RM is always Kg; the output can be Nos/Mtr/CBM/Kg. A
  BOM producing "500 Nos" of a connector where each piece is 0.08 Kg now
  has a real, computable total output weight (40 Kg) to check against
  Kg of RM consumed — visible live in the BOM screen and carried through
  to the variance report and the new availability check below.
- **Expenses/Unit** and **Default Machine** — captured per the reference
  screen; Default Machine pre-fills onto auto-generated work orders.
- **By-Product Generated grid** — new: a BOM can now declare its
  *expected* by-products (e.g. "producing 100 Kg of strip also yields
  ~5 Kg of slitting scrap"), separate from the actual by-product
  quantity captured transactionally on a real Production Receipt.

### 2. Order Fulfillment Check (Available-to-Promise)
This is the bigger piece — a new read-only report, run per sales order
(or ad-hoc for a material+quantity while quoting), that answers exactly
the question described:

1. **Free finished stock** — total stock on hand for the ordered item,
   minus whatever is already committed (ordered-but-undispatched) to
   every *other* active sales order. What's left is genuinely free /
   "not linked to any order" — matching the requirement precisely.
2. If free stock covers the order → **"Ship Now — Fully Available in
   Stock."**
3. If not, the **shortfall** is exploded through that item's BOM (scaled
   to the shortfall quantity, including scrap %) into raw material
   requirements.
4. For each raw material, the check pulls together everything already
   tracked elsewhere in the app rather than re-deriving it:
   **free/usable stock** (stock ledger), **QC pending** and **QC hold**
   (Quality module's buckets), and **on order** (open PO quantity not
   yet received, from `purchase_order_items.received_quantity`).
5. Final decision per line: Ship Now / Produce (RM Available) / Produce
   (RM Shortage — raise indent/PO), with an overall order-level status
   rollup (Ready to Ship / Production Required / Raw Material Shortage —
   Purchase Required).

Available from a new **"Check Availability"** button on every Sales
Order row — opens a full breakdown: free stock, shortfall, and (if
production is needed) a material-by-material RM table with free/QC
pending/QC hold/on-order quantities and a status per line.

**Scoped honestly:**
- This is a **report, not a reservation system** — running the check
  doesn't lock or allocate anything. Two orders checked back-to-back
  against the same free stock will both show it as available (same
  behavior as before this feature — it answers "what does the picture
  look like right now," not "claim this for me").
- When a product has more than one BOM (alternates from Round 15), the
  check always uses the **primary** BOM for the RM explosion — it
  doesn't yet let you pick which alternate to plan against. Flag it if
  you want that added; it's a small extension of the same function.
- The Kg-equivalent weight (`weight_per_output_unit`) defaults to 1 for
  every BOM that existed before this round, which is only correct if
  that BOM's output unit was already Kg — go back and set the real
  figure on any BOM whose output is Nos/Mtr/CBM for the weight-based
  numbers to be meaningful.




## Round 18: Sales & Dispatch reliability fixes + Finance & Commercial Controls

### Bug fixes (Sales & Dispatch reported "not working")
I couldn't reproduce a specific error, but ran the entire SQL layer (365
queries extracted straight from `server.js`) against a real SQLite engine
with dummy parameters — 0 errors — and cross-checked every HTML element
id against every `getElementById` call — nothing missing. What I did find
and fix:

1. **The real bug**: `loadMasters()` on the Sales & Dispatch page (and the
   same pattern in Production Planning / BOM) used `apiResult || []` to
   guard against a failed API call. That doesn't work — a failed call
   returns a *truthy* `{error: "..."}` object, so `{error} || []` keeps
   the error object, and the very next `.map()` on it throws
   `TypeError: x.map is not a function`, silently killing page
   initialization with **zero visible error** — dropdowns and tables just
   never populate. Fixed everywhere in Sales & Dispatch, Production
   Planning, and BOM to use `Array.isArray(x) ? x : []` instead.
2. Every list-loading function on the Sales & Dispatch page was also
   masking real API errors as an empty state ("No quotations yet" shown
   even when the actual problem was a failed request) — added a shared
   `rowsOrMessage()` helper that shows the real error text instead.
3. `App.loadPage()` had no error handling at all — any uncaught exception
   during a page's `render()`/`init()` left a blank content area with
   nothing in the UI to explain why. Now wrapped in try/catch with a
   visible error panel (page name, error message, pointer to the browser
   console) instead of a silent blank screen.

If the module still misbehaves after this, please share what you're
actually seeing (blank page? a specific button doing nothing? a 500 in
the Network tab?) — with the error surfacing fixed above, the real cause
should now show up on screen or in the console instead of hiding.

### Finance & Commercial Controls module
A new module, deliberately **not a full accounting engine** — it links
into transactions that already exist elsewhere in the app (vendor
invoices, sales invoices, GRNs, BOM costs) rather than replacing them.

1. **Accounts payable / receivable summaries** — total outstanding, a
   0-30/31-60/61-90/90+ day aging breakdown, and a by-vendor / by-customer
   outstanding table, each drilling into invoice-level detail.
2. **Expense and payment reference capture** — a generic expense entry
   (category, optional vendor, department, GST fields) for costs that
   aren't tied to a purchase order (freight, rent, professional fees),
   with its own partial-payment tracking. The customer side of invoice
   payments also now has a proper history table
   (`customer_payment_receipts`), matching the audit trail the vendor
   side (`payment_vouchers`) already had — previously it was just a
   running total with no per-payment record.
3. **GST-ready document fields** — mostly already existed (HSN codes, tax
   master, GSTIN on vendors/customers/company); expenses now carry the
   same HSN/GST-class fields, and a new **GST Summary** view nets output
   tax (from sales invoices) against input tax (from vendor invoices +
   expenses) for a date range — a working figure to check your return
   against, not a filed return itself.
4. **Vendor outstanding and customer outstanding views** — dedicated
   detail tables (invoice, due date, outstanding, aging bucket) beyond
   just the summary numbers.
5. **Basic cost and margin report** — per sales order, estimated cost is
   computed from the item's BOM (raw material priced at each material's
   current weighted-average stock cost, same averaging the inventory
   valuation report already uses, plus the BOM's Expenses/Unit) or, for
   items with no BOM, the item's own average stock cost. Flagged clearly
   in the UI: this is a standard-cost-style **estimate**, not a
   FIFO-traced actual cost — good for a first-pass margin view, not for
   statutory costing.
6. **Integration staging tables for Tally/Busy** — a flat
   `accounting_staging` table that a "Sync New Transactions" button
   populates from every vendor invoice, payment voucher, sales invoice,
   customer receipt, and expense not yet staged (safe to click
   repeatedly — already-staged transactions are never duplicated), plus
   a CSV export of everything still Pending (marks it Exported on
   download so re-exporting doesn't duplicate). This app does not talk to
   Tally/Busy directly — there's no native XML push/API integration here,
   just a clean flat file ready to import on the accounting side.

**Scoped honestly:** the margin report's "estimated cost" uses each
material's *current* average stock cost applied retroactively to past
orders, not the cost that was actually in effect when that order shipped
— fine for a rough today's-margin check, not for historical accuracy.
The Tally/Busy staging export is CSV, not TallyXML or Busy's native
import format; if you need the actual XML schema, flag it and I'll build
a proper exporter against it.

## Round 19: The real Sales & Dispatch bug (found it) + Advance & Expense Claims workflow

### The actual Sales & Dispatch bug
"Click it, nothing happens, console shows an error" was the key detail —
that specific symptom means a whole script file failed to load, not a
runtime crash inside it. Found it: `sales-dispatch.js` declared
`const InvoiceModal = {...}`, but `invoices.js` (the original vendor
invoices page from Round 1) **already declares `const InvoiceModal`**.
Every page script in this app is a plain `<script src="...">` tag, not an
ES module — they all share one global scope. Two `const` declarations
with the same name anywhere in that shared scope makes the browser throw
`Uncaught SyntaxError: Identifier 'InvoiceModal' has already been
declared` the moment it parses the second file, and that entire file
never runs — which meant `SalesDispatchPage` itself was never defined,
so clicking the nav link had nothing to route to. This is exactly why
`node --check`, run file-by-file like I'd been doing, could never catch
it — each file is individually valid; the conflict only exists *across*
files. Renamed the sales-side one to `SalesInvoiceModal` and wrote a
proper cross-file collision scanner (checked every `const`/`let`/`class`/
top-level `function` name across every page script) — confirmed zero
remaining collisions anywhere in the app.

To catch anything like this before it reaches you again, this round's
testing went further than before: actually **executed** `render()` for
both new pages in Node and ran the real output through an HTML parser
(checking every tag opens and closes correctly) rather than just
eyeballing the template strings, on top of running the full SQL layer
(408 queries) against a real SQLite engine.

### Advance & Expense Claims (new, under a new "Expense Claims" nav item)
Employee-submitted travel advances and expense bills — customer visits,
complaint visits, tours, fuel/daily commute — routed through the same
"reporting manager" relationship (`users.approver_id`) Indents already
use, so no new org-chart data entry is needed if it's already set up.

1. **Submission** — an employee picks Advance (a lump-sum request before
   a trip) or Expense Bill (itemized actuals: date/category/description/
   amount per line — fuel, toll, food, lodging, local conveyance), with
   category (Customer Visit / Complaint Visit / Tour / Fuel-Commute /
   Travel / Other), optional linked customer, and optional adjustment
   against a prior Advance.
2. **Manager approval** — goes straight to the employee's reporting
   manager (their `approver_id`), who sees it on their own "Approve
   Claims" tab and approves/rejects with comments. Submitting fails
   clearly (not silently) if an employee has no reporting manager
   configured yet.
3. **Accounts settlement** — approved claims land on a Settlement Queue
   visible only to Accounts/Admin, who mark them Settled with a payment
   mode and reference number. Restricted server-side, not just hidden in
   the UI — the settle and oversight endpoints check the caller's role.
4. **Printable voucher with full approval trail** — every print shows all
   three steps with names, dates, and comments: submitted by (employee,
   date), approved/rejected by (manager, date, comments), settled by
   (Accounts, date, mode, reference) — signature lines for all three for
   physical record keeping.
5. **History, employee-wise and department-wise** — a Reports tab
   (Accounts/Admin only) with per-employee and per-department totals
   (claim count, total, settled, outstanding), plus a full claims list.
   Every employee can also see their own full history under "My Claims"
   regardless of role.

**Scoped honestly:** approval is single-level (the employee's direct
`approver_id`), not a multi-level value-based hierarchy like POs have —
if you need "above ₹10,000 needs two approvals" for expense claims too,
that's a real extension, not a small tweak, and I'd rather build it
properly than bolt it on. Settlement doesn't post anywhere into the
Finance module's payables/GST figures yet (it's tracked as its own
record) — if you want settled claims flowing into the GST summary or
Tally/Busy staging export, say so and I'll wire that connection in.

## Round 20: Sidebar navigation, company branding, and a real permission-enforcement gap closed

### Module visibility — found and closed a real gap
The nav was already correctly hiding modules a user doesn't have
permission for (`data-module-nav` + `Auth.hasModule()`, working as
designed). But nav-hiding alone isn't real security — it just hides the
link; the API itself has to refuse the request too. Round 12 had already
built exactly that (`requireModuleAccess()`, mounted per module route
prefix), but **Sales & Dispatch, Finance, and Expense Claims — all added
in later rounds — were never wired into it.** Meant a valid login could
call any of those three modules' endpoints directly regardless of module
permission, even though the nav correctly hid them. Fixed: added the
same `app.use('/api/sales', verifyToken, requireModuleAccess('sales'))`
style enforcement those three now have, matching every other module.

### Sidebar navigation (replaces the top navbar)
Rebuilt the whole app shell: a fixed left sidebar (collapsible groups for
Purchase/Indent/Inventory/Production/Admin, flat links for single-page
modules) instead of the horizontal dropdown navbar. On mobile/tablet
(<992px) it becomes an off-canvas panel with a toggle button and
backdrop, auto-closing after you pick a page. Same `data-module-nav`
permission-gating carries over unchanged — a hidden module is a hidden
sidebar item, nothing new to keep in sync.

Also fixed a real (if minor) bug hit while rebuilding this: the login
screen and the main app content were secretly sharing one container
(`#content`) in a way that happened to work only because of exact
container ordering — restructuring made `#app` (login) and `#appShell`
(main app) properly distinct, explicitly shown/hidden rather than
implicitly coexisting.

There was no `frontend/css/style.css` file on disk at all before this —
`index.html` had been linking to it since the very first round, silently
404ing the whole time. Everything you've seen has been unstyled
Bootstrap defaults. Created it for real, starting with the sidebar and
the new branding header below.

### Company branding — personalized dashboard
Company Settings (Admin → Company Settings) already had `company_name`
and a logo upload; nothing else in the app read them. Now:
- **Sidebar header** shows the company logo (or a fallback icon if none
  uploaded) and company name instead of the generic "Manufacturing ERP" —
  visible on every page, for every logged-in user.
- **Dashboard** gets a personalized banner up top with the logo, company
  name, and a welcome line, instead of a plain "Dashboard" heading.

Both fall back quietly to the generic name/icon if no logo/name has been
configured yet, so a fresh install still looks fine before anyone's
touched Company Settings.

**Testing note:** given the exact bug found in Round 19 (a cross-file
`const` collision that only manifests when a real browser parses two
script tags together), this round's changes were verified the same
rigorous way: every script file loaded together, in the exact order
`index.html` loads them, into one shared JS context via Node's `vm`
module — confirming no collisions and that navigation still resolves
correctly — plus the HTML-parser structural check on both the rebuilt
`index.html` and the Dashboard's rendered output.

## Round 21: The real "FOREIGN KEY constraint failed" bug (found it) + real GST invoicing

### The FOREIGN KEY bug — root cause confirmed, not guessed
I reproduced this directly: `verifyToken` trusted the JWT's signature but never
checked that the user id inside it still exists in the database. If the
`.db` file is ever reset, replaced with a fresh copy, or restored from an
older backup while a browser still has a login token from before that —
which is exactly what happens across testing multiple app versions — every
create action that stamps `created_by`/`requested_by` with that now-ghost
user id hits SQLite's real, correct constraint check and fails with
exactly the raw message you saw. I confirmed this precisely: seeded a test
database, inserted a Purchase Order, an Indent, and a BOM each with a
`created_by`/`requested_by` pointing at a user id that doesn't exist, and
all three failed with `FOREIGN KEY constraint failed` — the identical
error, on the identical three features you reported.

**Fixed at the source:** `verifyToken` now looks up the user on every
request and rejects the token with a clear "please log in again" message
if that user no longer exists or has been deactivated — before any create
action ever runs. Your existing frontend already logs out and redirects
to the login page automatically on that response, so this self-heals: the
next click just sends you to login instead of failing confusingly deep
inside a save.

### BOM precision (3 decimal places)
Raw material quantity, scrap %, by-product quantity, and BOM output
quantity now accept 3 decimal places (`step="0.001"`) instead of 2 — for
the very small items you mentioned. Nothing in the database was ever
rounding these; SQLite doesn't enforce column precision, so this was
purely an input-field limitation, now fixed at every BOM quantity field.

### Real GST invoicing (multi-order, tax-correct, print-ready)
The old "Sales Invoice" was a lightweight reference-capture stub (a
number, a value, an external reference) — not something you could
actually bill a customer from. Rebuilt properly:

1. **Multi-order consolidation** — pick a customer, and the invoice
   builder shows everything dispatched to them across *every* one of
   their sales orders that hasn't been invoiced yet. Tick whichever lines
   you want, from however many different orders, and generate one
   invoice. A `so_item.invoiced_quantity` counter (new) tracks exactly
   how much of each dispatched line has already been billed, so the same
   delivered goods can never be invoiced twice even when future invoices
   pull from the same order.
2. **Real GST calculation** — CGST+SGST split (half the line's tax rate
   each) when the customer is in the same state as your company, IGST
   (full rate) when they're not, computed automatically per line from
   Company Settings' state vs. the customer's state. Mixed-rate invoices
   (different HSN/tax rates per line) compute correctly since GST is
   calculated per line, not once for the whole invoice.
3. **PO/SO reference on every printed line** — each invoice line's
   description automatically carries its source order number (e.g.
   "Steel Coil — Ref: SO SO-0004"), exactly so a multi-order invoice is
   never ambiguous about what it's billing, per your instruction.
4. **Proper tax invoice print** — company + customer GSTIN, place of
   supply, HSN per line, CGST/SGST or IGST columns (whichever applies),
   taxable value, line total, and a totals block with balance due — not
   the old bare reference card.
5. **Invoice shortcut from the dispatch list** — every Delivery Challan
   row now has either "Generate Invoice" (jumps straight into the
   invoice builder pre-filtered to that customer) or "Print Invoice" (if
   it's already been billed) — so cutting the final dispatch naturally
   leads to the invoice for record-keeping, per your request.

### Accounts Receivable now shows dispatched-but-unbilled value
New **"Dispatched, Awaiting Invoice"** section on the Finance module's
Receivables tab: goods already shipped to a customer, valued at their
order price, that haven't been pulled onto an invoice yet — a real amount
owed, shown separately from (never mixed into) the formally-invoiced
Total Outstanding figure, per customer with which orders are involved.
Order status already correctly reflected "fully dispatched" the moment
a delivery challan covers the full ordered quantity — regardless of
whether it went through a formal Dispatch Plan step first — this was
verified, not changed, since it was already working correctly.

**Scoped honestly:** GST calculation assumes Company Settings' state and
the customer's state are both filled in correctly — if either is blank,
the invoice defaults to intra-state (CGST+SGST). E-way bill and IRN
(e-invoice) generation aren't included — this produces a compliant-format
tax invoice, not a GSTN e-invoice API integration.

## Round 22: Licensing, cloud/local backup, auto-backup schedule, and a Windows installer

### Licensing
A signed license-key system (HMAC-SHA256, self-contained — verifies fully
offline, matching the "no internet dependency" pitch this app is built
around):
- **`generate-license.js`** — a command-line tool for you (the vendor)
  to issue a license key for a client: company name, optional expiry
  date, optional user count. Never ship this file or its embedded
  secret to a client.
- **System Settings → License** — the client pastes the key you gave
  them here to activate. Shows licensed-to, issued date, expiry, and
  days remaining.
- **Enforcement**: an invalid/expired license locks out every non-admin
  role from actual work (server-side, not just hidden in the UI) with a
  clear "contact your administrator" screen — but admins always keep
  access, specifically so there's always a way to activate/renew from
  inside the app rather than a total lockout. Admins also see a small
  reminder banner when a license is expired, invalid, or expiring within
  14 days.

**Scoped honestly:** this is real tamper-resistance (a key can't be
forged or edited without the secret), not bulletproof DRM — a
sufficiently motivated person with access to the compiled app could still
find ways around it, same as most on-prem/boxed software. `max_users` is
recorded but not yet hard-enforced (informational only) — flag it if you
want an actual seat-count cap added.

### Backup: local folder + Google Drive + one-click restore
- **Local folder backup** — new "Save Here" option next to the existing
  browser-download backup: writes the backup file directly to any folder
  path the server can reach, no download dialog — meant for when this is
  running as a background service rather than something someone's
  actively sitting at.
- **Google Drive backup** — connect a Google account (OAuth, using your
  own Google Cloud project credentials — see `packaging/BUILD_INSTRUCTIONS.md`
  for the one-time setup), then "Backup to Google Drive Now" uploads to a
  dedicated "MSME Saarthi Backups" folder in that Drive. A "View Backups
  on Drive" list lets you restore from any of them with the same
  safety-copy-first, type-RESTORE-to-confirm flow the local restore
  already had.
- **Auto-backup schedule** — enable it, pick any time of day, and choose
  Local / Google Drive / Both as the destination. Checked once a minute
  in the background; fires at most once per calendar day, right at the
  time you set — not a fixed slot baked into the code.

**Scoped honestly:** the Google Drive integration code is complete and
follows Google's standard OAuth2 pattern correctly, but I could not run
it against real Google servers from this sandbox (no internet access
here) — please do a real end-to-end test (connect, backup, restore) once
it's deployed, the same way I'd ask you to test anything I can't
personally execute.

### Windows installer (.exe)
`packaging/` contains everything needed to build a one-click
`MSMESaarthiSetup.exe`: an NSIS installer script, a silent background
launcher (starts the server hidden, opens the browser automatically —
this is the "background executor"), a stop script, and a full
step-by-step `BUILD_INSTRUCTIONS.md`.

**I could not compile or test-run the actual `.exe`** — that requires a
Windows machine with internet access (to fetch the Node.js runtime and
compile `better-sqlite3`'s native binding for Windows), which this sandbox
doesn't have. Every script is written correctly against well-established,
standard patterns (NSIS, VBScript, Node), but please build and fully test
it yourself before it goes anywhere near a client, exactly as
`BUILD_INSTRUCTIONS.md` walks through.

One real bug caught and fixed while designing this: the database was
living inside the app's install folder, which the uninstaller would wipe
even if you chose "keep my data." Fixed — the packaged installer now
keeps the database under `%PROGRAMDATA%\MSME Saarthi\data`, outside
Program Files entirely, so it survives an uninstall/reinstall/upgrade.

**On "download data from cloud storage in the background"** — I've
interpreted this as: the background launcher silently starts the server
(no visible window), and separately, the Google Drive restore feature
above lets you pull a client's latest cloud backup down onto a new/
replacement machine. If you meant something more specific — e.g.
auto-restoring from Drive on first launch — tell me and I'll wire that in
directly rather than leaving it as a manual step.

## Round 23: Renamed to SAKAAR ERP

Every user-visible name changed from "MSME Saarthi" / "Manufacturing ERP"
to **SAKAAR ERP**: page title, login screen, sidebar default brand,
dashboard default brand, GRN print footer, health-check/startup log
messages, the license generator's output header, the Windows installer
(app name, output filename `SakaarERPSetup.exe`, shortcuts, Google Drive
backup folder name), and both launcher scripts (renamed to
`Launch-SakaarERP.vbs` / `Stop-SakaarERP.vbs`).

Also renamed, since they're visible in File Explorer / Task Manager and
should match: the database filename (`sakaar-erp.db`), backup file
prefixes, `package.json`'s `name` field, and the `%PROGRAMDATA%` data
folder the installer uses (`SAKAAR ERP`, not `MSME Saarthi`).

**One thing that had to be handled carefully:** `LICENSE_SECRET` — the
key that makes license keys unforgeable — lives in both `server.js` and
`generate-license.js` and **must be byte-identical** in both, or every
previously-issued key stops verifying. Since nothing has shipped to a
client yet, I regenerated it as part of the rename (new value in both
files, confirmed identical) and re-tested the full generate → verify
round-trip end to end. **If you'd already issued license keys under the
old secret before this update, they will no longer activate** — you'd
need to re-issue them with `generate-license.js` from this version.
Nothing else about the license format changed.

Company-specific print documents (job cards, dispatch notes, invoices)
were already pulling the client's own company name from Company Settings
rather than hardcoding a product name, so those needed no changes — a
client's invoice was never going to say "Sakaar ERP" on it regardless of
what the software itself is called, which is correct.

## Round 24: POS / Counter Billing (Trading Edition)

The one piece of real new work needed to sell this to a trader/retailer
rather than just a manufacturer: a fast counter-billing screen. Built to
plug into everything that already existed rather than as a bolt-on —
a POS sale lands in the exact same `sales_invoices` table a consolidated
B2B invoice does (tagged `channel = 'POS'`), so it automatically shows up
in GST Summary, Receivables, and Tally/Busy staging with zero extra
reporting work.

1. **The billing screen** — scan a barcode or search by name, item adds
   to the cart (or increments if already there), quantity/price/discount
   are editable inline, running totals update live. Pressing Enter after
   a scan adds the item straight away if there's exactly one match — no
   mouse needed for a fast scan-scan-scan workflow.
2. **Barcode support** — new `barcode` field on Materials, searchable
   exact-match-first. Also added `default_sale_price` so the counter
   price pre-fills instead of being typed fresh every sale.
3. **Real GST math, with discounts** — line-level discounts reduce that
   line's own taxable value (correct GST treatment); a bill-level
   discount is prorated across every line by its share of the bill, so
   each line's CGST/SGST/IGST stays mathematically consistent with what
   it actually contributed — not just dumped onto one line or subtracted
   after tax (which GST doesn't allow). Verified with targeted math tests
   including the edge case of a discount larger than the bill itself
   (clamped to zero, never negative).
4. **Payment modes** — Cash / UPI / Card mark the sale Paid immediately
   (and log a payment receipt, same audit trail invoice payments already
   have); Credit leaves it Pending and flows straight into the existing
   Receivables/AR view — deliberately blocked for Walk-in customers, since
   there'd be no one on file to actually collect from.
5. **A real "Walk-in Customer"** is created automatically the first time
   it's needed, so a cashier never has to create a customer record just
   to ring up a stranger.
6. **Thermal-receipt-style print** — narrower, simpler than the full A4
   tax invoice (this is often a retailer's *only* invoice, so it still
   carries HSN and the GST breakup, just formatted for an 80mm receipt
   printer instead of A4).
7. **New `cashier` role** — dashboard, inventory (to check stock while
   selling), POS, and expense claims only. No purchase, no finance, no
   admin. This plus turning off Production/Quality/BOM for a role is the
   entire "Trading Edition" — same codebase, same license/backup engine,
   just a different default role setup.

**Two real pre-existing bugs found and fixed while building this:**
- `VALID_ROLES` (the list the user-creation endpoint checks against) was
  never updated when the `sales` role was added back in Round 16 —
  creating a Sales-role user has been silently rejected with a 400 error
  this whole time. Fixed, and `cashier` added alongside it.
- `sales_invoices` had no `warehouse_id` column at all, which the POS
  "today's sales by outlet" summary needs — added.

**Scoped honestly:** there's no formal till/shift open-close/cash-
reconciliation workflow — the "Today's Sales" summary on the billing
screen (bill count, revenue, payment-mode breakdown) covers the common
case without the ceremony of a full shift-close process. If you need
proper till reconciliation (opening float, expected vs counted cash at
close-out), that's a real, separate feature — say so and I'll scope it
properly rather than bolt on something half-built.

## Round 25: The real "browser keeps reloading" bug (my first fix was wrong)

My first attempt at this (guarding against several parallel 401s each
triggering a redirect) was treating the wrong cause — and on reflection,
still left an automatic page navigation living inside a shared helper
function, which is exactly the kind of thing that can loop. Traced it
properly this time instead of patching around a guess:

**The actual bug:** `/api/auth/login` returns HTTP 401 for a wrong
password — that's normal, expected behavior for a login endpoint. But
the shared `API.request()` helper treated *every* 401 from *any* endpoint
as "your session has expired," and force-navigated back to `/` — clearing
storage and reloading the page — instead of showing the actual error.
So a mistyped password didn't show "Invalid credentials": it silently
reloaded the login page, wiping out whatever was typed. Try again,
mistype again (or the same typo without realizing it), reload again —
from the outside, that's indistinguishable from "the login page keeps
reloading and I can't get in."

**Fixed properly:** removed the automatic redirect from `API.request()`
entirely. Every response — 401 included — now just returns what the
server actually said, and the calling page's own (already-existing)
error handling shows it, the same way every other error in this app is
shown. A failed login now correctly shows "Login failed: Invalid
credentials" and lets you try again, with nothing reloading. The one
place that specifically needs to tell "your session is genuinely dead"
apart from other errors (the license check right after login) now does
that by checking the HTTP status directly, opt-in, with no automatic
side effects of its own — so it can never trigger a loop regardless of
how many things happen to fail at once.

Logging out is unaffected — it's still one explicit click, unrelated to
any of this.

## Round 26: POS bill history/reprint, customer mobile capture, and a unified MIS Reports hub

### POS: reprint old bills
New **Bill History** tab right inside POS Billing — search by bill
number, customer name, or the phone number captured at sale, with an
optional date range and outlet filter. Every row has a one-click Print,
reusing the same thermal-receipt layout the original sale printed.

### POS: customer mobile number
New optional "Customer Mobile" field on the billing screen, independent
of picking a registered customer — so a mobile number can be captured on
every sale, including Walk-in ones, without forcing a full customer
record to be created just to ring someone up. If the number typed
matches an existing customer's phone on file, the sale links to that
customer automatically for better repeat-customer history; if not, it's
still saved directly on the invoice as a plain phone number. Shows up in
Bill History and is exportable via MIS Reports.

### MIS Reports — every module's reports, in one place
New **MIS Reports** section: pick a report from a categorized list on the
left (Purchase, Inventory, Production, Quality, Sales, Finance, Expense
Claims, POS — 16 reports total), apply date filters where relevant, view
the table, export to CSV. Built as a catalog-driven hub rather than one
giant page — most reports call the exact same endpoints their home module
already used (Inventory valuation/aging/summary, Production variance,
Finance payables/receivables/margin, Expense Claims summary, POS bill
history) so there's only one source of truth per number, never a second
copy that can drift out of sync. Genuinely new reports were added only
where nothing existed yet: date-ranged Purchase Order Register and
Vendor-wise Purchase Summary, a combined Sales Register spanning both B2B
and POS invoices together, Customer-wise Sales Summary, a Production
Order Register, and an Inspection Summary for Quality.

Every report's column keys were checked field-by-field against what its
actual endpoint returns (not assumed) — the kind of mismatch that
silently renders blank columns instead of throwing an error is easy to
miss otherwise, so each one was traced against the real server-side
response shape before being wired in.

**Scoped honestly:** CSV export only, not native Excel (.xlsx) — the
existing Tally/Busy staging export is the only place in the app that
writes real Excel-adjacent format today. If a client specifically needs
formatted .xlsx exports (styling, multiple sheets, etc.) rather than
plain CSV, that's real, separate work worth scoping properly.

## Round 27: Draft indents can be edited, multi-item indents, indent-wise RFQ, and a real PO bug fixed

### Draft indents can now actually be edited
Root cause: the Edit button on a Draft indent has existed in the UI for a
while, but called a function (`IndentModal.edit`) that was never actually
written — clicking it did nothing, silently. There was no `PUT` route for
editing an indent at all; only status-change endpoints (submit/approve/
reject) existed. Added a real edit flow: loads the indent's full contents
back into the same form used to create one, and saves in place — only
for indents still in Draft, since a Pending/Approved indent may already
have RFQs or approvals riding on its current contents.

### Indents can now hold multiple items
This was a real schema limitation, not a UI gap — `indents` had
`material_id`/`quantity_required` directly on the row, one material per
indent, full stop. Restructured to a header (`indents`) + items
(`indent_items`) shape, same pattern as Purchase Orders and Sales Orders
already use. Raise Indent is now a cart-style form — add as many item
rows as needed, one submission, one approval, one RFQ round.

**If you already have indent data:** a safe migration runs automatically
on first startup — every existing indent's single item is carried into
the new `indent_items` table before the old columns are dropped, so
nothing is lost. I tested this migration directly against seeded data
before shipping it, not just by reading the code.

### RFQ is now maintained indent-wise
A vendor's quotation now covers every item on the indent in one
submission (one quotation number, priced line by line) instead of
needing a separate quotation per material. The Rate Comparison screen
became an item × vendor grid — see each vendor's price for each specific
item side by side, with the lowest price per item highlighted — before
picking one winning vendor for the whole indent. Generating the PO then
pulls every item's price from that vendor's winning quotation
automatically, producing a real multi-line PO in one step.

**Scoped honestly:** awarding different items on the same indent to
different vendors (a split award) isn't supported — one winning vendor
per indent, same as before. If a client genuinely needs split awards,
that's a real extension worth scoping properly, not a small tweak.

### The PO "prefilled details get blanked" bug — found and fixed
Root cause: `poItemsContainer.innerHTML += itemHtml` on the Purchase
Order form. `innerHTML +=` forces the browser to serialize the *entire*
container back to an HTML string — every row already on screen included —
and re-parse the whole thing as brand-new DOM nodes. A `<select>`'s live
selection and an `<input>`'s live typed value only survive that
round-trip if they matched the *original* markup; anything picked or
typed interactively after the row first rendered wasn't reflected in the
attribute, so it silently reset the moment a second item was added.
Fixed with `insertAdjacentHTML('beforeend', ...)`, which only parses the
new fragment and appends it — every existing row's live state is now left
completely untouched. Checked the rest of the codebase for the same
pattern; this was the only occurrence.

## Round 28: Export for Vendors, Materials, and Stock List

Added a one-click "Export" button directly on the three pages people
actually asked for — Vendors, Materials, and Inventory (stock list) —
rather than only through the MIS Reports hub. Built as one shared CSV
export helper (`exportToCSV`, in `api.js`) that any page can call, so
there's a single correct CSV-escaping implementation instead of several
slightly different copies — MIS Reports' own export now uses the exact
same helper.

Also added Vendor List and Material List to MIS Reports under a new
"Masters" category, so they're available both ways: a quick button right
on the page you're already looking at, or alongside every other report
in one place. Stock List was already covered there (MIS Reports'
existing "Stock Summary" report is the same data) — just confirmed it's
findable and didn't need duplicating.












