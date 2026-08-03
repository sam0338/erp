# VEDA Hotel PMS

A LAN-deployable Hotel Property Management System — Node.js + Express + SQLite,
built in the same pattern as your other VEDA products (MarkEdge CRM, HRMS, School MS).

This is an **MVP core**: Front Office, Reservations, Room/Housekeeping status, and
Folio Billing. It's structured so the remaining IDS Next-style modules (POS,
Procurement, Membership, Payroll, Report Builder) can be added as new route files
without touching what's already here.

## Troubleshooting

**"No such table: users" or similar, even though the server started fine**
This means `npm run initdb` was never actually run in this folder (or was run somewhere else). Run it now:
```bash
npm run initdb
```
Then restart with `npm start`. As of this version, the server refuses to start at all if the database is missing — you'll get a clear `No database found — run "npm run initdb" first` message instead of a confusing crash later.

**Multiple folders like `veda-hotel-pms (1)`**
If your browser downloaded this zip more than once, Windows/macOS often names the second copy `veda-hotel-pms (1).zip`, which then extracts to a `veda-hotel-pms (1)` folder — a completely separate, empty install from your first one. Pick **one** folder, delete the others, and always run `npm install`, `npm run initdb`, and `npm start` from inside that same folder.

**Trial/license errors on startup**
These self-heal automatically as of this version — if you see anything unexpected, just restart with `npm start`.

## Licensing (7-day trial, then license required)

The app now enforces a licensing model:

- **First run starts a 7-day trial clock**, locked into the database the moment you run `npm run initdb` (or first start the server, whichever happens first). The app works fully during this window with no key needed.
- **After 7 days, the entire app is blocked** — every page and API redirects to `/license.html` — until a valid license key is activated. This isn't just a UI flag: `middleware/license.js` runs before every single request.
- License keys are **cryptographically signed** (Ed25519) rather than just a password check. The app only ships the *public* key (in `utils/licensing.js`), which can verify a signature but can't create one — so nobody can read the source code and forge a working key.
- Keys can optionally be **bound to a specific machine** (via a fingerprint derived from hostname/platform/CPU) or issued as `ANY` to work anywhere — useful for your own properties where you don't need per-machine restriction, and available for future customers if you ever license this out the way you might with MarkEdge.

### ⚠️ The `license-tool/` folder is vendor-only — never ship it

`license-tool/license_private.pem` is the private key that signs valid license keys. If it ever ends up in a customer's copy of the app (or on GitHub, or anywhere public), the whole scheme is worthless — anyone could generate their own valid keys. **When you hand this app to a customer or another property, delete the `license-tool/` folder from that copy first.** Keep it only on your own machine. Full details in `license-tool/README.md`.

### Generating a license key (for yourself or a customer)

```bash
cd license-tool
node generate-license.js --to "Sakaar Stainless LLP" --perpetual
```

A perpetual key with no machine binding (`--to "Name" --perpetual`, no `--fingerprint`) already comes generated and ready in this delivery — check the chat for it, or generate a fresh one anytime with the command above. For a time-limited or machine-locked key:

```bash
node generate-license.js --to "Hotel XYZ" --fingerprint <their-installation-id> --days 365
```

The customer's Installation ID appears on their `/license.html` page or in Settings → License once they've installed the app.

### Where to activate

- **Proactively, before the trial ends**: Settings → License (Admin only) — shows days remaining and lets you paste a key any time
- **After the trial ends**: the app auto-redirects everywhere to `/license.html`, which has the same activation form
- A slim banner appears at the top of the app during the trial showing days remaining, with a quick link to the License tab

## What's included (MVP + v1.1 + v1.2 + v1.3 + v1.4 Premium Bundles)

- **Front Office** — room grid with live status, one-click status updates, housekeeping log
- **Reservations** — booking creation, guest capture, room assignment (manual or auto-assign on check-in), check-in, check-out, cancel, **mark no-show**
- **Property Settings** (Admin/Manager) — property details, GST registration, room types & rates, room inventory
- **Seasonal / Dynamic Pricing** — date-ranged rate overrides per room type, auto-suggested on the booking form
- **Direct Online Booking Engine** — public booking page (`/book.html`), no login required
- **iCal Channel Sync (lite)** — export/import calendar feeds to block dates across Booking.com/Airbnb without a paid channel manager
- **Folio / Billing** — GST-aware charges, ad-hoc charges, payments, balance-due enforcement
- **Bill To / reimbursement billing** — redirect an invoice to a company payer with automatic CGST+SGST vs IGST
- **GST / non-GST printing**, **checkout invoice prompt**, **WhatsApp & Email** confirmations/invoices
- **Guests** — searchable directory with room + payment history

### v1.4 — Revenue Intelligence, Guest Experience, Finance, Analytics

- **Revenue Intelligence** *(Settings → Revenue Intelligence)* — rule-based pricing suggestions (not ML): flags room types where occupancy in the next 14 days crosses your high/low thresholds and suggests a rate change, plus a configurable weekend multiplier. One click applies a suggestion as a single-day seasonal rate. Also includes manual competitor rate logging and an **upsell add-ons catalog** (Airport Pickup, Breakfast, Early Check-in, etc.) that can be attached at booking time or added to any open folio in one click
- **Guest CRM & Loyalty** — VIP/Corporate/Repeat tagging, free-text preferences (high floor, non-smoking, etc.), birthday & anniversary tracking with a dashboard widget that surfaces upcoming occasions and a one-click WhatsApp wish, and automatic loyalty points (1 point per ₹100 paid) credited on checkout
- **Guest Self-Service Portal** (`/guest.html`) — guests verify themselves with booking ref + phone (no account needed), then can request housekeeping/food/laundry, ask to extend their stay, and download their invoice. Requests land in the staff-side **Guest Requests** view for action
- **Daily Cash Closing** (`Cash Closing` nav, Accounts/Manager/Admin) — sums payments by mode for the day, front desk enters actual cash counted, system flags any discrepancy, and keeps a running history
- **Tally Export** — same Cash Closing page; pick a date range and download a Tally-compatible XML voucher file to import into Tally for reconciliation
- **Executive Analytics Dashboard** (`Analytics` nav) — occupancy trend chart, ADR, RevPAR, revenue by room type chart, booking source breakdown, cancellation % and no-show %, all over a custom date range. Admins with more than one property also see a side-by-side property comparison table
- **Multi-Property Switcher** — Admins overseeing more than one property get a dropdown in the sidebar to switch which property's data they're viewing/editing
- **Tighter Role-Based Access** — the sidebar now hides views a role shouldn't touch (e.g. Housekeeping doesn't see Billing/Reservations, Accounts doesn't see room/property Settings), enforced server-side too via `requireRole`, not just hidden in the UI

## Setup

```bash
cd veda-hotel-pms
npm install
npm run initdb     # creates db/veda_hotel.db, seeds roles, demo property, 15 rooms, admin user
cp .env.example .env   # optional but needed for email — edit SMTP_* values
npm start           # http://localhost:4500
```

Default login: **admin / admin123** — change this immediately.

**If you already had this app installed:** just run `npm start` — every new column and table across all versions (GST/bill-to, iCal, revenue intelligence, guest CRM, service requests, cash closing) is added automatically on startup via `db/migrate.js`, no data lost, no need to re-run `npm run initdb`.

### Getting the new v1.4 features running

1. **Revenue Intelligence**: Settings → Revenue Intelligence — the default thresholds (bump rates above 80% occupancy, discount below 30%) are a starting point; tune them to match how your property actually books up
2. **Add-ons**: same tab, add your actual upsell items with real prices before they'll show up on the booking form or folio
3. **Guest Portal**: share `https://yourdomain/guest.html` (or the per-booking link copied via the "Guest Portal Link" button on any reservation) with guests — works over your hotel WiFi with zero app install
4. **Cash Closing**: close each day once, at the end of the day, from the Cash Closing nav — closing the same date twice overwrites the record rather than duplicating it
5. **Analytics**: works immediately with whatever booking data you already have; more history = more useful trend lines

### Role permission matrix

| View | Admin | Manager | FrontOffice | Housekeeping | Accounts |
|---|---|---|---|---|---|
| Dashboard | ✓ | ✓ | ✓ | ✓ | ✓ |
| Rooms | ✓ | ✓ | ✓ | ✓ | — |
| Reservations | ✓ | ✓ | ✓ | — | ✓ |
| Guests | ✓ | ✓ | ✓ | — | ✓ |
| Guest Requests | ✓ | ✓ | ✓ | ✓ | — |
| Cash Closing | ✓ | ✓ | — | — | ✓ |
| Analytics | ✓ | ✓ | — | — | ✓ |
| Settings | ✓ | ✓ | — | — | — |

This is enforced both by hiding nav items in the UI **and** by `requireRole` checks on the API routes themselves, so it's not just cosmetic — a FrontOffice user calling the Settings API directly still gets a 403.

### Enabling email sending

Edit `.env` (copied from `.env.example`) with your SMTP details:

```
SMTP_HOST=smtp.yourprovider.com
SMTP_PORT=587
SMTP_USER=you@yourhotel.com
SMTP_PASS=your-password-or-app-password
SMTP_FROM="Sakaar Stainless Hotel <reservations@yourhotel.com>"
```

### WhatsApp — how it actually works here

The **WhatsApp** buttons open a pre-filled message in WhatsApp Web/Desktop/Mobile via a `wa.me` link — zero configuration, zero per-message cost. Fully automated sending needs the Meta Cloud API.

### Billing to a company (reimbursement billing)

Open a reservation's **Billing / Folio** → **Change** next to "Bill To" → uncheck "Bill to guest" → enter the company's details. CGST+SGST vs IGST is decided automatically by comparing states.

### Channel sync (iCal)

Settings → Online Booking & Channels — export links to paste into OTA calendar-import fields, and an "Add Calendar" + "Sync Now" flow to pull their bookings in as blocks here. One-way, manual-trigger, blocking-only — see the earlier section in this file for the full honest rundown of what it does and doesn't do.

## Project structure

```
veda-hotel-pms/
├── server.js
├── .env.example
├── db/
│   ├── schema.sql
│   ├── init.js
│   ├── migrate.js           # every schema change across every version lives here, runs on every start
│   └── connection.js
├── middleware/
│   └── auth.js
├── routes/
│   ├── auth.js
│   ├── rooms.js               # rooms, room types, availability
│   ├── guests.js                # guest CRUD, search, history, upcoming occasions
│   ├── reservations.js          # booking, check-in/out, cancel, no-show
│   ├── billing.js                # folio, charges, payments, invoice data, bill-to
│   ├── property.js                # property settings, multi-property list/switch
│   ├── ratePlans.js                # seasonal pricing CRUD + effective-rate lookup
│   ├── revenue.js                   # pricing suggestions, competitor rates, add-ons catalog
│   ├── serviceRequests.js            # staff-side guest request management
│   ├── finance.js                     # cash closing, Tally export
│   ├── analytics.js                    # occupancy/ADR/RevPAR/source/cancellation metrics
│   ├── public.js                        # UNAUTHENTICATED — booking engine, iCal export, guest portal
│   ├── externalCalendars.js              # iCal import subscriptions + sync
│   ├── messaging.js                       # WhatsApp link generation + email sending
│   └── dashboard.js                        # summary stats
├── utils/
│   ├── helpers.js                # booking ref/folio generators, activity log, rate resolver
│   ├── reservationEngine.js       # shared booking-creation logic used everywhere a booking is made
│   ├── mailer.js                   # SMTP transporter
│   └── messageTemplates.js          # WhatsApp/email text templates
└── public/
    ├── login.html
    ├── dashboard.html          # SPA shell (staff, authenticated)
    ├── book.html                # public booking page (guests, no login)
    ├── guest.html                 # public self-service portal (guests, booking ref + phone)
    ├── css/style.css
    └── js/{api.js, app.js}
```

## What's deliberately NOT built yet

1. **Real OTA API integration** — needs a formal partner relationship with each OTA first
2. **AI-powered natural language assistant** — the "ask a question in plain English" idea needs an LLM API call (Anthropic API key + small per-query cost); happy to wire this in once you decide you want it
3. **GST E-Invoice / IRN generation** — requires registering with a government-approved Invoice Registration Portal (GSP), a compliance step outside of code
4. **POS / F&B module**, **Procurement**, **Licensing layer**, **Automated WhatsApp (Meta Cloud API)**, **Scheduled auto-sync for iCal**, **Change-password UI**, **Banquet/event booking**
5. **PDF invoices** — currently print-to-PDF via the browser dialog

## Notes on design choices

- **better-sqlite3**, session-based auth, no build step — consistent with your other LAN tools throughout
- **Pricing suggestions are rule-based, not machine learning** — transparent thresholds you control in Settings, not a black box. If you want true demand forecasting later (using historical booking patterns to predict future occupancy), that's a meaningfully bigger project I'd scope separately
- **Guest portal auth is intentionally lightweight** (booking ref + phone match, no passwords) — appropriate for a low-stakes self-service tool, not meant to gate anything sensitive
- **Loyalty points are earn-only for now** — redemption isn't wired up to a discount flow yet; flag it if you want that next
- **Cash closing is per-property, per-day, idempotent** — closing the same date again overwrites rather than duplicating
- **Tally export uses the standard Voucher XML import format** — the ledger names (`Cash`, `UPI Collections`, `Card Collections`, `Bank Account`) are placeholders; you'll likely want to adjust `routes/finance.js`'s `modeToLedger` mapping to match your actual Tally ledger names before relying on it
- **Analytics queries run live against SQLite on every request** — fine at this data volume; if the database grows into the tens of thousands of reservations, these could be moved to a nightly-computed summary table for speed
- **Login page redesign** — matches the VEDA split-panel brand design (dark teal hero with wordmark/tagline/feature icons, cream form panel with circular V badge), all done in CSS/inline SVG — no image assets to manage or ship
