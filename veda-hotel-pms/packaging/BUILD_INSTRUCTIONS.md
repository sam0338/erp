# Building the VEDA Hotel PMS Windows Installer (.exe)

This produces a single `VedaHotelPMSSetup.exe` you hand to a hotel. They
double-click it, click through a normal Windows installer wizard, and get
a Desktop/Start Menu shortcut that silently starts the app, sets up the
database on first run, and opens it in their browser — no Node.js, no
npm, nothing to type in a terminal. The only thing the person at the
keyboard ever has to do is log in.

## Option A (recommended): let GitHub Actions build it for you

You don't need a Windows machine at all. `.github/workflows/build-windows-installer-veda.yml`
runs the entire process below on a real, temporary Windows runner:

1. Push a tag like `veda-v1.4.0` (`git tag veda-v1.4.0 && git push origin veda-v1.4.0`),
   or open the repo on GitHub → **Actions → Build VEDA Hotel PMS Windows Installer →
   Run workflow** for an on-demand build without tagging.
2. Wait for the run to finish (a few minutes).
3. Download `VedaHotelPMSSetup.exe` from the run's **Artifacts** section
   (or, if triggered by a tag, from the created GitHub Release).
4. Still do the install-and-run test in Step 4 below before handing it
   to a hotel — CI proves it *builds*, not that you've clicked through it.

The manual steps below are what that workflow automates, kept here in
case you want to build locally, customize the installer branding, or
debug a CI failure.

## What you need on your build machine (once, for a manual build)

- A **Windows 10/11 PC** with internet access (only needed for this build
  step — the finished installer works fully offline / on a local network
  with no internet dependency, as designed).
- [Node.js LTS](https://nodejs.org) installed (for running `npm install`
  — this is separate from the *portable* runtime you'll bundle).
- [NSIS](https://nsis.sourceforge.io/Download) installed (free, ~3MB) —
  this compiles the `.nsi` script into the installer `.exe`.

## Step 1 — Get a portable Node.js runtime to bundle

1. Go to <https://nodejs.org/en/download> and download the **Windows
   Binary (.zip)**, 64-bit, matching the LTS version you tested with
   (e.g. `node-v20.x.x-win-x64.zip`).
2. Extract it. You'll get a folder like `node-v20.x.x-win-x64` containing
   `node.exe` and supporting files.
3. Rename that extracted folder to `node` and place it directly inside
   this project's `packaging/` folder, so you have:
   ```
   veda-hotel-pms/packaging/node/node.exe
   veda-hotel-pms/packaging/node/... (other files from the zip)
   ```

## Step 2 — Prepare the app folder (must be done ON Windows)

`better-sqlite3` is a native module — the compiled `.node` binding must
match the OS and Node version it will run on. Building it on Linux (like
a CI sandbox) produces a binding that will **not** work on Windows, so
this step has to happen on your Windows build machine.

1. Copy the whole `veda-hotel-pms/` project — **except** `node_modules`,
   `packaging/`, and the entire `license-tool/` folder (see "How
   licensing works" below for why that folder never leaves your machine)
   — into `packaging/app/`:
   ```
   packaging/app/server.js
   packaging/app/package.json
   packaging/app/db/
   packaging/app/routes/
   packaging/app/middleware/
   packaging/app/utils/
   packaging/app/public/
   ... (everything except license-tool/)
   ```
2. Open a terminal **inside `packaging/app/`** and run:
   ```
   npm install --production
   ```
   This installs all dependencies, including a Windows-native
   `better-sqlite3` binding, directly into `packaging/app/node_modules/`.
3. Do **not** run `npm install` on the Linux/Mac side and copy
   `node_modules` over — it will not work on a client's Windows machine.

At this point `packaging/` should look like:
```
packaging/
  node/                  <- portable Node runtime (Step 1)
  app/
    server.js
    package.json
    node_modules/        <- installed ON Windows (Step 2)
    db/, routes/, middleware/, utils/, public/
    ...                  <- everything except license-tool/
  Launch-VedaHotelPMS.vbs
  Stop-VedaHotelPMS.vbs
  installer.nsi
```

## Step 3 — Compile the installer

In a Windows terminal, from inside `packaging/`:
```
makensis installer.nsi
```
This produces `VedaHotelPMSSetup.exe` in the same folder. That single
file is what you hand to a hotel.

If you want your own company name on it, edit the top of `installer.nsi`
first:
```
!define COMPANYNAME "Your Company Name"
```

## Step 4 — Test it before shipping

On a clean Windows machine (or a VM) with **no Node.js installed**:
1. Run `VedaHotelPMSSetup.exe`.
2. Confirm it installs, creates Desktop/Start Menu shortcuts, and the
   optional "Start with Windows" checkbox works if you tick it.
3. Double-click the Desktop shortcut. The first launch takes a couple of
   extra seconds — it's creating and seeding the database (roles, a demo
   property, 15 demo rooms, the admin account, and starting the 7-day
   trial clock) — then a browser opens to `http://localhost:4500/login.html`,
   no visible console window (that's the silent background "executor"
   behavior).
4. Log in with the seeded admin account (`admin` / `admin123` — **tell
   every hotel to change this immediately**) and confirm the app works
   normally. That login is the *only* manual step — there's no setup
   wizard, no config file to edit, no command to run.
5. Close the browser and re-launch from the shortcut — confirm the
   second launch skips straight to the login page (no re-seeding) and the
   data from step 4 is still there.
6. Test uninstalling — confirm it asks whether to keep the database.

## How licensing works for you (the vendor)

- `license-tool/` (and the `license_private.pem` key inside it) is
  **yours only** — it is deliberately excluded from `packaging/app/` in
  Step 2 and from the GitHub Actions workflow. If that private key ever
  ends up in a customer's copy, on GitHub, or anywhere public, anyone
  could forge their own valid license key — the app only ships the
  matching *public* key (baked into `utils/licensing.js`), which can
  verify a signature but can never create one.
- To issue a license for a new hotel:
  ```
  cd license-tool
  node generate-license.js --to "Hotel Name" --days 365
  ```
  (or `--perpetual` for a non-expiring key, and `--fingerprint <id>` to
  lock it to one machine — see `license-tool/README.md`). This prints a
  signed license key; send it to the hotel and have them paste it into
  **Settings → License** (or `/license.html` once the trial has ended).
- The app works fully for 7 days from first run with no key at all, so a
  freshly installed instance is immediately usable — the license only
  gates continued use past the trial window.

## About the "background executor" behavior

`Launch-VedaHotelPMS.vbs` is the background process: on first run it
seeds the database (equivalent of `npm run initdb`, done automatically
instead of by hand), generates a random session secret and saves it
under `%PROGRAMDATA%\VEDA Hotel PMS\data` (so restarting the server
doesn't log everyone out), starts the Node server completely hidden (no
console window), then opens the browser to it. If you ticked "Start
automatically when Windows starts" during install, this happens silently
every time the machine boots — the app is just always available on the
local network at `http://<that-PC's-IP>:4500` for any other device on
the same network, no one needs to manually start anything.

To stop it (e.g. before an update), use the "Stop VEDA Hotel PMS"
shortcut created in the Start Menu, or just restart the PC.

## Email (SMTP) — optional, not required to use the app

The installer doesn't set up SMTP — there's no `.env` on a fresh
install, so "Email Confirmation" / "Email Invoice" buttons won't send
until someone fills those in. This is intentionally not part of the
one-click flow (it needs real mailbox credentials per hotel); nothing
else in the app depends on it. To enable it later, create a `.env` file
next to `server.js` inside the install folder (`packaging/app` origin,
i.e. `C:\Program Files\VEDA Hotel PMS\app\.env`) based on
`.env.example`, and restart the app. WhatsApp buttons need no
configuration at all — they open a pre-filled `wa.me` link.
