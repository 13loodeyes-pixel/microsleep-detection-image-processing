# MicroSleep

Browser camera eye closure monitoring with a Cloudflare Workers website, D1 storage,
and responsive driver analytics. Developed by **13loodeye-pixel**.

## Hosted dashboard

The website, API, and database run on Cloudflare. No Python server, WSL camera,
or terminal process is needed to use the deployed website.

1. Open your deployed Worker URL and sign in.
2. Register a driver using the browser camera. Allow camera access when prompted.
3. Select **Start monitoring**, select that driver, and start the session.
4. **Stop session** before navigating away. Search the driver's name on the
   overview to open their analytics.

The dashboard is a **single private workspace**, not a public multi-user service.
The password is the Worker's `DASHBOARD_PASSWORD` secret when configured; otherwise
it is the existing `API_TOKEN` value. Passwords and tokens are not embedded in
JavaScript or stored in browser storage. Authentication uses an eight-hour signed,
Secure, HttpOnly, SameSite cookie, same-origin POST checks, and login throttling.
Set `DASHBOARD_PASSWORD` separately if you want to keep the legacy Python API
credential separate from the website password:

```bash
cd "microsleep  image processing/DASHBOARD/microsleep-api"
npx wrangler secret put DASHBOARD_PASSWORD
```

Rotating the password invalidates existing signed cookies. Signing out clears
this browser's cookie. Anyone who knows the workspace password can view all its
registered drivers and recordings; individual accounts are not implemented.

## Deploy or update

Use Node.js 22.13 or newer. From the Worker directory:

```bash
npm install
npm test
npx wrangler d1 execute microsleep --remote --file=./schema.sql
npx wrangler deploy
```

`wrangler.jsonc` binds the existing `microsleep` D1 database as `DB` and the
`../DASHBOARD` static directory as `ASSETS`. The Worker runs before assets to
protect the site. The schema adds tables without deleting existing records.
Existing Python registrations and recordings are preserved. **Capture one new
browser registration using the same driver name** to enable that driver's browser
monitoring: dlib descriptors and browser model descriptors are stored separately
and are not assumed interchangeable. New browser events use stable UUIDs so save
retries do not duplicate recordings. Analytics combine legacy and browser events.

## Detection and privacy

Hosted detection uses the pinned face-api.js 0.22.2 library and official weights
from source revision `8609b25a15f417398a4d2b95dc91985cd1e0c0c3`, packaged locally in
`vendor/` and `models/`. Its MIT license is included in `vendor/face-api.LICENSE`.
Frames are processed in the browser; photos and video are not uploaded. A numeric
face descriptor is stored in D1 for matching, together with event records.
Chart.js is loaded from a pinned CDN; tables remain usable if the chart CDN fails.

Detection requires exactly one face matching the selected profile. It uses an
experimental fixed eye aspect ratio threshold of 0.22 and records closures lasting
at least one second. Short blinks, mismatches, lost faces, and sampling gaps over
two seconds are excluded. Event timestamps use Asia/Kuala_Lumpur. Lighting, glasses,
pose, hardware, and browser performance affect results. This is not a clinically
validated or guaranteed driving safety system; test while safely seated.

Unsaved events remain in memory. On a save error, keep the page open, stop, and
use **Retry saving**. Closing the page can lose unsaved events. Save IDs prevent
retry duplicates; they do not make browser event measurements tamper-proof.

## Optional local Python workflow

`bash start-dashboard.sh` still starts the original localhost:8000 Eel dashboard.
Its pages use Python face-recognition rather than the hosted browser detector.
Set `MICROSLEEP_API_URL` and `MICROSLEEP_API_TOKEN` (the launcher prompts for the
latter). It requires the existing `.venv`, Eel, NumPy, Pillow, face-recognition,
and a compatible setuptools version providing `pkg_resources`.

The standalone `FPY_PROJECT/FYP.py` remains a separate legacy detector requiring
OpenCV, MediaPipe's legacy solutions API, speech dependencies, and a directly
accessible webcam. It is not used by the hosted website.

## Optional event locations

On the hosted monitoring page, enable **Attach location to events** before
starting. The browser requests location permission and watches only while
monitoring is active. Denial or unavailable location does not block recording.
A position no older than 30 seconds is attached at the start of an eye closure.
Coordinates, accuracy in meters, and fix timestamp are stored with the completed
event; routes and continuous location history are not uploaded. Stopping, hiding,
or leaving the session stops location watching. Everyone with workspace access
can see event locations in **Duration & peak time → View event values**. Clicking
a location opens OpenStreetMap in a new tab and shares those coordinates with it.
Existing events show “Not recorded”. Browser/device location accuracy varies.

## Workspace admin console

Open **Admin console** from the overview or visit `/Admin.html` after signing
in. The console uses the existing shared-workspace password; distinct admin
and driver roles are not implemented. It shows overall counts, browser-profile
readiness, the latest 50 events, and the 100 most recently updated sessions.
The console refreshes every 10 seconds; session heartbeats publish about every
5 seconds. Sessions become offline after 20 seconds without an update.

During monitoring, **Share live location with workspace admin** is a separate,
off-by-default checkbox. It requests browser location permission and shares
only the latest recent fix with the admin console, independently of event
location tagging. Driver session status is reported regardless of that setting,
with a visible disclosure on the monitoring page. No camera video is sent.
Stopping clears live coordinates. Abandoned sessions may retain their last
fix in storage until 30-day cleanup, but offline/stale fixes never appear as
current map markers. No route history is stored. Background tab monitoring
stops, and browser/network restrictions can interrupt updates.

The map loads only after **Show live map** is selected. It uses Leaflet 1.9.4
and OpenStreetMap tiles with attribution; the external map service receives
tile requests for the viewed area. Location tables remain usable if map
resources are unavailable. Everyone with workspace access can see shared data.

Admin sign-in requires the email configured in `wrangler.jsonc` (`ADMIN_EMAIL`) and the private `DASHBOARD_PASSWORD` Worker secret. Until that secret is set, the existing API_TOKEN remains the password fallback. To set a separate dashboard password, run `npx wrangler secret put DASHBOARD_PASSWORD` from the microsleep-api directory and enter the password at the hidden prompt. Never commit passwords. Changing the email or password invalidates existing browser sessions. This is one administrator identity, not individual driver accounts; there is no public registration or email recovery yet. The configured email is a login identifier, not a verified mailbox.
