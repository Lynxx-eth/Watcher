# WATCHER

> Current build: **Phase 10** + structure update. Earlier phase notes below still apply.

A fictional intelligence-console experience for **self-created** profiles. It is made up of a main client app, a **separate enrolment site**, a separate admin app and a FastAPI backend. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full plan.

## Structure update (separate enrolment site, random IDs, direct confidential sign-in)

- **Enrolment is now its own website** (`frontend/enroll`, port **5175**). People create their profile there; on success they get their ID and a link to sign in on the main site. The main client app (port 5173) now **starts at the ID + PIN sign-in** — it no longer hosts the sign-up form (it links out to the enrolment site).
- **Project IDs are random 12-digit numbers** (e.g. `734901825016`), generated server-side and checked unique. No year, no running count — nothing another user can guess. The **PIN remains the secret** that protects access; the ID is only an identifier.
- **Confidential access opens for any correct ID + PIN**, regardless of which profile the current session was on: entering a valid ID + PIN re-binds the session to that profile and opens its confidential page. Because every profile is self-created and its PIN is its owner's own secret, this is just the owner signing in. The 5-try lockout, rate limiting, suspension/revocation checks and the fiction banner all still apply, so it is not a way around brute-force protection.

### Deployment config (environment variables)

Frontends are static builds; set these at build time:

| App | Variable | Meaning | Dev default |
|---|---|---|---|
| all | `VITE_API_URL` | Backend API base | `/api` (proxied) |
| client | `VITE_ENROLL_URL` | URL of the enrolment site | `http://localhost:5175` |
| enroll | `VITE_MAIN_URL` | URL of the main sign-in site | `http://localhost:5173` |

Backend `.env`: set `CLIENT_ORIGIN`, `ADMIN_ORIGIN` (and add the enrolment origin — see below) plus the Phase 2–10 settings. For the enrolment site to call the API with its cookie, add its origin to CORS; in `backend/app/core/config.py` the allowed origins come from `cors_origins` — set `CLIENT_ORIGIN`/`ADMIN_ORIGIN` and, when deploying the enrol site on its own domain, include it too.

Run all three frontends in dev:
```bash
npm run dev:client   # http://localhost:5173  (sign in)
npm run dev:enroll   # http://localhost:5175  (create a profile)
npm run dev:admin    # http://localhost:5174  (admin)
```

## Phase 1 — what's in this build

- npm-workspaces monorepo: `shared/`, `frontend/ui`, `frontend/client`, `frontend/admin`, `backend/`
- **Design system** (`frontend/ui`):
  - colour tokens from the brief, sharp corner-bracket panels, monospace + display type
  - status dots, chips, meters, tech buttons and inputs
  - grid, scanline and scan-beam backdrop, particle field
  - permanent fiction banner
  - shared console shell (header, live UTC clock, nav tabs, status bar)
- **Client app** (port 5173):
  - `/login`: boot sequence, project ID + PIN form, ACCESS GRANTED / DENIED states. It calls the backend, so until Phase 2 it correctly reports *AUTH SERVICE UNREACHABLE*
  - `/enroll`: self-service profile creation (form arrives in Phase 6)
  - `/console`: dashboard grid matching the reference composition (dossier, link analysis, related records, globe, biometrics, activity log, case notes, status bar)
  - every nav tab routes to a working page, including Confidential Access
  - spring panel entrances, page transitions, reduced-motion support
- **Admin app** (port 5174): password sign-in screen, admin console shell, overview, profiles, access, reports and settings routes.

Panels show a labelled **"Scheduled · Phase N"** block where content isn't built yet. Nothing is faked.

## Phase 10 — what's new

**Server-side geocoding** (`backend/app/services/geocode.py`) with OpenStreetMap **Nominatim**:

- **Lookup order:** most specific first. Full address → city/region/country → city/country → country. The level that matched is stored (`nominatim:address|city|country`) and shown in the UI.
- **Follows Nominatim's usage policy:** requests are serialised and throttled to 1 per second, sent with an identifying `GEOCODER_USER_AGENT` (set your contact email), and results are cached in-process.
- **When it runs:** in the background after enrolment, again whenever an admin changes the address, from the admin **Re-geocode** button, or via `python -m app.cli geocode-pending` for existing profiles.
- **No invented coordinates.** If nothing matches, the attempt is recorded and the UI says **"Location unavailable"**.
- **Privacy note:** the location fields are sent to OSM's geocoder. The enrolment form says so and suggests leaving the street blank for city-level only. Set `GEOCODER_ENABLED=false` to turn it off.

**Confidential address globe** (`src/three/globe/FocusGlobeScene.tsx`):
- **Sequence:** globe loads → **rotates so the stored coordinates face you** (rotation maths checked numerically for several cities, north kept up) → camera focuses in → red marker → scanning pulse → location label → coordinates tag and "address locked" log entry.
- **Controls** unlock once it settles.
- **While geocoding is still running** after enrolment, the page re-checks every 5 s and focuses as soon as coordinates arrive.
- **Without coordinates**, the globe idles and the panel explains why.

Tests: 6 new, using a fake geocoder (no network in tests).

## Phase 9 — what's new

**3D brain visualisation** (`src/three/brain/`), opened by clicking the hologram's head:

- **The model:** a recognisable brain built from geometry: two hemispheres separated by the midline fissure, cortex folded into gyri/sulci with ridged noise, a temporal-lobe bulge, a ridged cerebellum and a brainstem. Every vertex is tagged with its lobe (frontal, parietal, temporal, occipital, cerebellum, brainstem). The shape was checked by porting the vertex maths to Python and plotting it from the side and front.
- **Holographic cortex shader:** Fresnel rim, scan lines and a front-to-back sweep, plus a wireframe overlay and bloom.
- **Neural network:** 260 neurons sampled just under the cortex, linked to their nearest neighbours. **Electrical impulses** travel along each connection at staggered timings, and the neuron points **pulse**.
- **Regions:** hover a lobe to tint it, click (or use the lobe list) to highlight it amber and show its function card. Slow rotation (stops while a lobe is highlighted), orbit and zoom.
- **Transition:** the body view zooms and fades out while the brain scales in. The body stays mounted and paused, so **Back to full body** returns instantly without replaying the materialise sequence.
- **Neural Activity panel:** a live multi-channel waveform labelled *Simulated*; the selected lobe's channel is highlighted.
- **Responsive:** on narrow screens the info card moves below the controls (container query).
- The brain and every reading are visual simulations, not medical measurements.

## Phase 8 — what's new

**Full-body holographic scanner** (centre of the confidential environment, `src/three/body/`):

- **The figure:** a real 3D human (≈1.8 units tall, standing, arms slightly out) built from smooth geometry in six selectable regions: head, torso, both arms, both legs. Inside it is a glowing **skeleton** (skull, 20-segment spine, rib cage, pelvis, clavicles, limb bones) visible through the skin.
- **Holographic shader** (custom GLSL): Fresnel rim glow, moving horizontal scan lines, a bright travelling **scan band**, slight flicker, a **wireframe overlay**, and a materialise-from-the-feet-up reveal with a glowing edge. Bloom post-processing on top.
- **Scan platform:**
  - concentric rings and segmented arcs rotating at different speeds, plus 96 tick marks
  - vertical light columns
  - a sweeping horizontal scan ring
  - 500 floating particles (GPU-animated)
  - dashed elliptical orbits like the reference
  - corner scanning brackets
  - coordinate indicators by each region
- **Interaction:** slow rotation (pauses while dragging or when a region is selected), drag to orbit, scroll to zoom (clamped). Hovering a region highlights it amber; clicking opens a region card. Clicking the head is wired for the brain view (Phase 9).
- **Cinematic load (~8 s):** dark screen → initialisation text → platform powers up → body materialises bottom-up → illuminates → side panels slide in → **SCAN INITIALIZED**. Each step is written to the processing log.
- **Reduced motion:** jumps straight to the final state with no movement.
- **Optional real model:** drop `public/models/human.glb` and the scanner uses it automatically (see `public/models/README.md`). Otherwise the procedural figure is used.

## Phase 7 — what's new

**Confidential Access gate** (console tab → `/console/confidential`):

- **Re-check:** you re-enter your project ID and PIN. The server unlocks only if the ID is **the signed-in profile's own** and the PIN matches. Another profile's valid ID + PIN is refused (there's a test for it).
- **One generic "VERIFICATION FAILED"** for every failure. Failures count toward the same 5-strike lockout as sign-in. The unlock route is rate-limited.
- **Short window:** unlocking opens confidential mode on the server-side session for **15 minutes** (`CONFIDENTIAL_MINUTES`). `/api/confidential/profile` returns 403 outside that window.
- **After a successful check:** an "ACCESS VERIFIED" sequence plays, then the full-screen **WATCHER CONFIDENTIAL** environment opens (`/confidential`). It has:
  - a live countdown with auto-lock and a Lock button
  - the subject profile, the supplied address (shown only here), coordinates status, biometric records, diagnostics and a processing log
  - labelled slots for the scanner (Phase 8), brain (Phase 9) and address globe (Phase 10)
- **No guessed coordinates:** the location shows "Not yet resolved" until geocoding exists. The panel notes that it shows the entered address, not live tracking.
- **Tests:** 6 new.

## Phase 6 — what's new

**Self-service enrolment** at http://localhost:5173/enroll (linked from the login screen):

- **Five-step wizard:**
  - **Identity:** name, date of birth (18+ enforced on the server), nationality, optional gender, title, optional photo with live preview
  - **Location:** city and country required; street address optional and **hidden from the console unless the owner ticks "show"**
  - **Display:** classification, threat level, watchlist status, risk slider, priority, biometric statuses
  - **Notes**
  - **Security:** 4–12 digit PIN (trivial ones like 1234 and 0000 are rejected), plus a consent checkbox confirming the profile is about the person creating it
- **On submit:**
  - the server issues the next **WTR-YYYY-NNNNN** ID from a locked per-year counter, with a unique index as the final guard (never from browser randomness)
  - the owner is signed in, and a success screen shows the ID with a copy button and a reminder to save ID + PIN
- **Rate limit:** 5 enrolments per hour per IP

**Photo pipeline** (`backend/app/services/photos.py`, per the OWASP File Upload cheat sheet):
- 5 MB limit, enforced while reading
- the file type is decided by decoding the image; JPEG, PNG and WebP only
- decompression-bomb guard
- re-encoded to WebP at most 800 px, which **strips EXIF/GPS** and any appended payloads (tested with a GPS-tagged JPEG and a PNG with a script tail)
- random filenames, stored outside the web root, served only through authorised routes

**Admin photo controls:** view, replace and remove a profile's photo from its detail page.

**Other changes:** migration `0003_project_id_counters`, and 6 new tests.

## Phase 5 — what's new

**Admin app** (http://localhost:5174), backed by `/api/admin/*`:

- **Sign-in:** username + password (argon2id), with its own session cookie scoped to `/api/admin` that expires after 2 h. Lockout after 5 failures, rate-limited. A client session can't reach admin routes.
- **Overview:** live counts (profiles, active, suspended, revoked, locked, sign-ins and failures in 24 h), recent profiles, latest audit events.
- **All Profiles:** search by project ID or name (debounced), filter by access state, pagination.
- **Profile detail:**
  - every field the owner entered, plus access info
  - edit form in sections (general, location, display and classification, biometric statuses, description and notes); only changed fields are sent, and the owner's console picks them up within 30 s
  - changing the address clears old coordinates (they're re-geocoded later, never guessed)
  - actions: **suspend** (ends sessions immediately), **reactivate**, **unlock**, **reset PIN** (new 6-digit PIN shown once), **revoke** (permanent; type the ID to confirm), **delete** (owner role only; type the ID to confirm)
- **Profile Access:** the suspended-profiles view. **Reports:** the full audit log with actor and IP. **Settings:** change your password (min 12 chars).
- **No "create profile" in admin**, by design: the API has no create route (there's a test for it).
- Migration `0002_admin_sessions` and 13 admin API tests.

Create your admin account once:
```bash
cd backend && alembic upgrade head && python -m app.cli create-admin
```

## Phase 4 — what's new

**Interactive 3D Earth** in the dashboard's Global Intelligence View (`frontend/client/src/three/globe/`):

- **Earth:** a real sphere with the NASA-derived day map tinted to WATCHER blue (dark oceans, lighter land) and the night-lights map as glowing land features
- **Atmosphere:** a Fresnel shader glow, plus a lat/long graticule, starfield and bloom post-processing
- **Motion:** slow continuous rotation that pauses while you drag or inspect. Drag to orbit, scroll to zoom (clamped)
- **Every 5 seconds** the next **simulated** relay node is targeted: red marker, double scanning pulse, label, and an animated dashed arc from the previous node. The HUD shows the node ID, name and coordinates under a "SIMULATED FEED" tag
- **Click any node** to inspect it (the cycle pauses until you close the card). Click empty space to deselect
- **Loading:** three.js / R3F load only when the globe is on screen (code-split)
- **Fallbacks:** without WebGL, a clear notice; without textures, a plain sphere plus a notice telling you to fetch them
- **Reduced motion:** no rotation, pulses or cycling, and rendering on demand

### Earth textures (one-time)
```bash
npm run fetch:textures
```
This downloads two images (NASA-derived, via the three.js examples) into `frontend/client/public/textures/earth/`.

## Phase 3 — what's new

- **Live dashboard** from the signed-in owner's own record:
  - **Dossier:** photo (or an honest "no photo" silhouette), identity fields, threat gauge, watchlist status, risk meter
  - **Link Analysis:** figures derived from the owner's real records and activity (nothing invented)
  - **Related Records:** each entry opens the matching section
  - **Biometrics:** display statuses with a scan overlay
  - **Activity Log** and **Case Notes**
  - **Status bar:** watchlist alert, priority, classification, last sync time
- **Live updates:** the console re-syncs every 30 s and whenever the tab regains focus, so admin changes appear without a reload. A suspended or expired session signs the user out automatically.
- **Sections:** Intelligence, Watchlists (threat matrix), Operations (full activity log), Analytics (Recharts area and bar charts, loaded only when that tab is opened), Reports (printable dossier, saveable as PDF)
- **Backend:** `GET /api/profile/me/activity` and `GET /api/profile/me/stats`, plus 5 new tests

## Phase 2 — what's new

- **FastAPI backend** (`backend/`):
  - SQLAlchemy 2 models, Alembic migration `0001_initial`, PostgreSQL via Docker
  - client login: **project ID + PIN** (argon2id), server-side sessions in an httpOnly, SameSite=Strict cookie
  - one generic `ACCESS DENIED` for every failure (unknown ID, wrong PIN, locked, suspended); a missing ID takes the same time to check as a wrong PIN
  - lockout after 5 failed attempts (15 min), plus an IP rate limit on login
  - CSRF header check on every state-changing request, security headers, CORS limited to the two frontends
  - `GET /api/profile/me` returns only the signed-in owner's profile; there is no route that takes another profile's ID
  - activity / audit log for every login, failure, lockout and logout
  - CLI: `seed-demo` (fictional demo profile `demo-0000`) and `create-admin`
  - pytest suite covering login, isolation, lockout, suspension, CSRF and logout
- **Client:** login is wired to the backend, with an ACCESS GRANTED init sequence. The session survives a page reload, there's a sign-out button, and the layout-preview bypass has been removed.

## Run it

Requirements: Node 20.19+ (or 22.12+), Python 3.11+, Docker (for PostgreSQL).

**1. Database**
```bash
cd WATCHER
docker compose up -d db
```

**2. Backend** (in `WATCHER/backend`)
```bash
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
cp .env.example .env               # then set DEMO_PIN to 4–12 digits
alembic upgrade head
python -m app.cli seed-demo
pytest                             # should be all green
uvicorn app.main:app --reload --port 8000
```

**3. Frontends** (in `WATCHER`)
```bash
npm install
npm run dev:client   # http://localhost:5173  → log in with demo-0000 + your DEMO_PIN
npm run dev:admin    # http://localhost:5174  (admin login is wired in Phase 5)
```

Vite proxies `/api` to the backend on :8000, so cookies stay same-origin. API docs (dev only) are at http://localhost:8000/api/docs.

Type-check and build:

```bash
npm run typecheck
npm run build
```

## Project layout

```
WATCHER/
  shared/           constants + types (both apps)
  frontend/
    ui/             design system + console shell (shared)
    client/         client app (3D scenes go in src/three/)
    admin/          admin app
  backend/          FastAPI service (Phase 2+)
  docs/             architecture, security, asset plan
```
