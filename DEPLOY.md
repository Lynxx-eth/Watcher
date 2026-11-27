# Deploying WATCHER (separate sites)

This hosts the **API + database on Render** and the **three sites on Vercel**
(sign-in, sign-up, admin). Everything is free-tier and can be done from a phone.

You'll end up with 4 URLs:

| Piece | Host | Example URL |
|---|---|---|
| API + database | Render | `https://watcher-api.onrender.com` |
| Sign-in site (main) | Vercel | `https://watcher-client.vercel.app` |
| Sign-up site | Vercel | `https://watcher-enroll.vercel.app` |
| Admin site | Vercel | `https://watcher-admin.vercel.app` |

Config files are already in the repo: `render.yaml` and a `vercel.json` in each
`frontend/<app>` folder. Do the steps **in this order** — it avoids the
"which URL do I put where" trap.

---

## Step 1 — Deploy the 3 sites on Vercel (they build first, wired up later)

Do this three times, once per site. The only thing that differs each time is the
**Root Directory** and the **project name**.

1. Go to **vercel.com** → sign in with GitHub → **Add New… → Project**.
2. Import the **Watcher** repo.
3. **Important:** set **Branch** to `watcher-fullstack` (Settings → Git after import, or during import if shown).
4. Set **Root Directory** to the app's folder:
   - Project 1 → `frontend/client`  → name it **watcher-client**
   - Project 2 → `frontend/enroll`  → name it **watcher-enroll**
   - Project 3 → `frontend/admin`   → name it **watcher-admin**
5. Leave the build settings alone — the `vercel.json` in each folder already sets them.
6. Click **Deploy**. It will build fine even though the API isn't ready yet.
7. After each finishes, **copy its URL** (e.g. `https://watcher-client.vercel.app`).

Write down all three URLs. You'll need them in Step 2, and you'll come back to
Vercel in Step 4.

---

## Step 2 — Deploy the API + database on Render

1. Go to **render.com** → sign in with GitHub.
2. **New + → Blueprint** → pick the **Watcher** repo → branch **watcher-fullstack**.
   Render reads `render.yaml` and proposes a web service **watcher-api** + a
   PostgreSQL database **watcher-db**.
3. Before (or just after) it creates them, open **watcher-api → Environment** and
   fill in the values marked "set later". Use the three Vercel URLs from Step 1
   (no trailing slash):

   | Key | Value |
   |---|---|
   | `CLIENT_ORIGIN` | your watcher-client URL, e.g. `https://watcher-client.vercel.app` |
   | `ADMIN_ORIGIN`  | your watcher-admin URL |
   | `ENROLL_ORIGIN` | your watcher-enroll URL |
   | `GEOCODER_USER_AGENT` | `WATCHER/1.0 (your-email@example.com)` |
   | `DEMO_PIN` | *(optional)* a 4–12 digit number for the demo profile, or leave empty |

   (`DATABASE_URL`, `ENVIRONMENT`, `COOKIE_SECURE`, `COOKIE_SAMESITE` are set
   automatically by `render.yaml`.)
4. **Save** → Render builds and starts the API. When it's live, copy its URL,
   e.g. `https://watcher-api.onrender.com`.
5. Sanity check: open `https://watcher-api.onrender.com/api/health` → you should
   see `{"status":"ok"}`.

> If the service refuses to start with "Unsafe production configuration", it's
> telling you one of the values above is still a placeholder (e.g. an origin that
> isn't `https://`). Fix it and redeploy — that guard is deliberate.

---

## Step 3 — Create your admin login (one time)

On Render, open **watcher-api → Shell** and run:

```bash
python -m app.cli create-admin
```

It asks for a username and a password (use a long one). If you set `DEMO_PIN`
and want the demo profile:

```bash
python -m app.cli seed-demo
```

---

## Step 4 — Point the sites at the API (back to Vercel)

The sites need to know the API URL (and each other). These are **build-time**
values, so after setting them you redeploy each site once.

For each Vercel project: **Settings → Environment Variables**, add the variables
below (Environment: *Production*), then **Deployments → … → Redeploy**.

**watcher-client** (sign-in):
| Key | Value |
|---|---|
| `VITE_API_URL` | `https://watcher-api.onrender.com/api` |
| `VITE_ENROLL_URL` | your watcher-enroll URL |

**watcher-enroll** (sign-up):
| Key | Value |
|---|---|
| `VITE_API_URL` | `https://watcher-api.onrender.com/api` |
| `VITE_MAIN_URL` | your watcher-client URL |

**watcher-admin**:
| Key | Value |
|---|---|
| `VITE_API_URL` | `https://watcher-api.onrender.com/api` |

Redeploy all three. Done.

---

## Step 5 — Try it

1. Open the **sign-up** site → create a profile → you get a 12-digit ID.
2. Open the **sign-in** site → enter that ID + your PIN → the console loads.
3. Open **Confidential Access**, re-enter the ID + PIN → the holographic page.
4. Open the **admin** site → log in with the admin account from Step 3.

---

## Notes & gotchas

- **Free Render services sleep** after ~15 min idle; the first request then takes
  ~30–60 s to wake. Fine for a demo. A paid instance stays awake.
- **The Earth globe textures** aren't committed. Either run `npm run fetch:textures`
  before deploying the client (so they're in the build) or the globe falls back to
  a plain sphere with a notice. To include them on Vercel, add
  `&& npm run fetch:textures` isn't enough (it writes into the client's public
  folder) — simplest is to commit the two images under
  `frontend/client/public/textures/earth/` before deploying.
- **Custom domains:** if you later put all sites + API under one domain
  (e.g. `app.yoursite.com` + `api.yoursite.com`), set `COOKIE_SAMESITE=strict`
  again — same-site domains don't need the cross-site cookie.
- **Database backups / reset:** the free Render Postgres can be wiped from its
  dashboard; re-run migrations by redeploying (migrations run on deploy).
