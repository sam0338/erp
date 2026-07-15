# Building the SAKAAR ERP Windows Installer (.exe)

This produces a single `SakaarERPSetup.exe` you hand to a client. They
double-click it, click through a normal Windows installer wizard, and get
a Desktop/Start Menu shortcut that silently starts the app and opens it
in their browser.

## Option A (recommended): let GitHub Actions build it for you

You don't need a Windows machine at all. `.github/workflows/build-windows-installer.yml`
runs the entire process below on a real, temporary Windows runner:

1. Push a tag like `v1.0.0` (`git tag v1.0.0 && git push origin v1.0.0`),
   or open the repo on GitHub → **Actions → Build Windows Installer →
   Run workflow** for an on-demand build without tagging.
2. Wait for the run to finish (a few minutes).
3. Download `SakaarERPSetup.exe` from the run's **Artifacts** section
   (or, if triggered by a tag, from the created GitHub Release).
4. Still do the install-and-run test in Step 4 below before handing it
   to a client — CI proves it *builds*, not that you've clicked through it.

The manual steps below are what that workflow automates, kept here in
case you want to build locally, customize the installer branding, or
debug a CI failure.

**Important:** I built and verified every line of the application code,
the SQL, and the packaging *scripts* in this delivery. The manual path
needs a Windows machine with internet access (to download the Node.js
runtime and `npm install` the native `better-sqlite3` module for
Windows) — the CI path above handles that for you instead.

## What you need on your build machine (once)

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
   packaging/node/node.exe
   packaging/node/... (other files from the zip)
   ```

## Step 2 — Prepare the app folder (must be done ON Windows)

`better-sqlite3` is a native module — the compiled `.node` binding must
match the OS and Node version it will run on. Building it on Linux (like
this sandbox) produces a binding that will **not** work on Windows, so
this step has to happen on your Windows build machine.

1. Copy the whole project (everything except `node_modules`,
   `packaging/node`, and `generate-license.js` — see "How licensing
   works" below for why that one file stays off the client's machine)
   into `packaging/app/`:
   ```
   packaging/app/server.js
   packaging/app/package.json
   packaging/app/frontend/
   ... (all other project files except generate-license.js)
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
    frontend/
    ...                  <- everything except generate-license.js
  Launch-SakaarERP.vbs
  Stop-SakaarERP.vbs
  installer.nsi
```

## Step 3 — Compile the installer

In a Windows terminal, from inside `packaging/`:
```
makensis installer.nsi
```
This produces `SakaarERPSetup.exe` in the same folder. That single file
is what you hand to a client.

If you want your own company name on it, edit the top of `installer.nsi`
first:
```
!define COMPANYNAME "Your Company Name"
```

## Step 4 — Test it before shipping

On a clean Windows machine (or a VM) with **no Node.js installed**:
1. Run `SakaarERPSetup.exe`.
2. Confirm it installs, creates Desktop/Start Menu shortcuts, and the
   optional "Start with Windows" checkbox works if you tick it.
3. Double-click the Desktop shortcut — a browser should open to
   `http://localhost:3000` within a couple of seconds, no visible console
   window (that's the silent background "executor" behavior).
4. Log in with the seeded admin account (`admin` / `admin123` — **tell
   every client to change this immediately** under Admin → User
   Management) and confirm the app works normally.
5. Test uninstalling — confirm it asks whether to keep the database.

## How licensing works for you (the vendor)

- `generate-license.js` is **yours** — never ship it or the
  `LICENSE_SECRET` constant to a client. Keep both on your own machine.
- To issue a license for a new client:
  ```
  node generate-license.js "Client Company Name" 2027-12-31
  ```
  This prints a license key. Send that key to the client; they paste it
  into **System Settings → License → Activate** inside the app.
- Leave off the date for a perpetual (non-expiring) license.
- Renewing is the same command with a new expiry date and a fresh key —
  there's no way to "extend" a key in place, since the expiry is baked
  into its signature.

**Honest limitation:** `LICENSE_SECRET` also has to live inside
`server.js` itself, because the app verifies keys locally (no
phone-home). `server.js` ships to every client as plain, unminified
JavaScript, so a technically capable client *could* read the secret out
of their own copy and sign their own keys — this scheme stops casual
copying/resale, not a determined technical client. Locking that down for
real means switching to asymmetric signing (generator holds a private
key, `server.js` only ships the public key), which is a real change to
`generate-license.js` and the verify function in `server.js`, not a
config tweak — worth doing before this is relied on as a hard revenue
gate.

## How the Google Drive backup option works for a client

This app can't set up Google API access on a client's behalf — each
client (or you, on their behalf) needs their own free Google Cloud
project:
1. Go to <https://console.cloud.google.com>, create a project.
2. Enable the **Google Drive API**.
3. Under "OAuth consent screen," set it up (External, add the client's
   Google account as a test user if it's still in testing mode).
4. Under "Credentials," create an **OAuth Client ID** of type
   **Web application**. Add this **Authorized redirect URI** exactly
   (shown in the app too, under System Settings → Backup → Google Drive):
   ```
   http://localhost:3000/api/settings/gdrive/callback
   ```
5. Copy the generated **Client ID** and **Client Secret** into the app
   under System Settings → Backup & Restore → Google Drive, click Save,
   then "Connect Google Drive" and sign in.

This is a one-time, ~10 minute setup per client if they want Google Drive
backups. Local-folder backup and scheduled local auto-backup need none of
this and work immediately.

## About the "background executor" behavior

`Launch-SakaarERP.vbs` is the background process: it starts the Node
server completely hidden (no console window) and then opens the browser
to it. If you ticked "Start automatically when Windows starts" during
install, this happens silently every time the machine boots — the app is
just always available on the local network at `http://<that-PC's-IP>:3000`
for any other device on the same network, no one needs to manually start
anything.

To stop it (e.g. before an update), use the "Stop SAKAAR ERP" shortcut
created in the Start Menu, or just restart the PC.
