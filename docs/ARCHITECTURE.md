# WATCHER — Architecture & Implementation Plan

## 1. What WATCHER is

A fictional, cinematic "intelligence console" where a person creates **their own** profile (photo, details, display choices) and then views it as a command-centre dossier, a holographic body scan, a brain visualisation and a globe that flies to their city.

**Core rule: profiles are self-created.** The owner enters every field, including the threat level, watchlist status and risk score they want displayed. The admin app can view, edit (on owner request), suspend, reactivate, revoke and delete profiles. It cannot create one on someone else's behalf. Every page in both apps carries a permanent fiction notice.

## 2. Applications

```
 ┌────────────────────┐        ┌────────────────────┐
 │  CLIENT  :5173     │        │  ADMIN   :5174     │
 │  React + R3F       │        │  React             │
 │  /login /enroll    │        │  /login (password) │
 │  /console/*        │        │  /, /profiles, …   │
 └─────────┬──────────┘        └─────────┬──────────┘
           │  /api (httpOnly cookie)      │  /api/admin (separate cookie)
           └──────────────┬───────────────┘
                 ┌────────▼────────┐
                 │ FastAPI  :8000  │──► Nominatim (server-side geocoding, cached)
                 │ SQLAlchemy 2    │
                 │ Alembic         │──► uploads/ (private, served via auth route)
                 └────────┬────────┘
                 ┌────────▼────────┐
                 │ PostgreSQL 16   │
                 └─────────────────┘
```

Monorepo with npm workspaces:

| Package | Purpose |
|---|---|
| `shared/` | Constants and TypeScript types used by both frontends (mirrored by backend Pydantic schemas) |
| `frontend/ui/` | Design system: tokens, panels, buttons, inputs, console shell, backdrop effects, API helper |
| `frontend/client/` | Client app; 3D scenes live in `src/three/`, independent of dashboard components |
| `frontend/admin/` | Admin app |
| `backend/` | FastAPI service (Phase 2 onward) |

## 3. Data model (Phase 2/11)

- **admin_users**: id, username, password_hash (argon2id), role, created_at
- **profiles**: id, project_id (unique, `WTR-YYYY-NNNNN`), pin_hash, full_name, date_of_birth, nationality, gender, photo_key, title, classification, threat_level, watchlist_status, risk_score, description, status, created_at, updated_at
- **profile_locations**: profile_id (FK, 1:1), country, region, city, address, postal_code, show_address (bool), lat, lon, geo_source, geocoded_at
- **profile_biometrics**: profile_id (FK, 1:1), facial, fingerprint, iris, dna (enums)
- **case_notes**: id, profile_id (FK), body, created_at
- **profile_access**: profile_id (FK), status, created_at, last_access_at, failed_attempts, locked_until
- **activity_logs**: id, profile_id (FK, nullable for admin events), actor, event, category, source, status, at

Project IDs come from a PostgreSQL sequence per year inside a transaction, with a unique constraint as the final guard. They are never generated in the browser.

## 4. 3D assets and sources

| Asset | Source | Licence | Plan |
|---|---|---|---|
| Earth day/night textures | NASA Visible Earth: Blue Marble, Black Marble (city lights) | NASA imagery, generally public domain; credit NASA | 4k JPG → KTX2/WebP; custom shader blends night lights + Fresnel atmosphere |
| Human body | MakeHuman export (CC0 output) refined in Blender | CC0 | A-pose with arms slightly out → decimate to ~40–60k tris → GLB + Draco. Head and body regions split into named meshes so they can be clicked |
| Brain | BodyParts3D (DBCLS) or a CC-BY Sketchfab model | CC BY-SA / CC BY, attribution required | Decimate to ~80k tris, GLB + Draco; hemispheres/lobes as named meshes for region highlighting |
| Neural network effect | Procedural (points sampled on the brain surface + animated line segments) | — | Built in code, no asset |

The materials are holographic: a custom Fresnel + scanline ShaderMaterial, an additive wireframe overlay, and Bloom from `@react-three/postprocessing`. Each model is loaded with `useGLTF` inside `<Suspense>`, and each scene is code-split with `React.lazy`.

If a model's licence or geometry turns out to be unsuitable at that phase, I'll say so and swap in an alternative. I won't fake it with an image.

**Globe choice:** both globes use React Three Fiber (a sphere with NASA textures) rather than MapLibre. This keeps them in the same holographic visual language as the body scene and avoids loading a second map engine. MapLibre stays an option if street-level zoom is ever needed.

## 5. Dependencies (installed per phase)

| Phase | Packages |
|---|---|
| 1 | react 19, react-dom 19, react-router 7, motion 12, vite 7, @vitejs/plugin-react 5, typescript 5.9 |
| 3 | recharts 3 |
| 4, 8–10 | three, @react-three/fiber 9 (React 19 compatible), @react-three/drei 10, @react-three/postprocessing 3 |
| Backend | fastapi, uvicorn, sqlalchemy 2, alembic, psycopg 3, pydantic-settings, argon2-cffi, pyjwt/itsdangerous, slowapi, pillow, httpx, python-multipart |

Compatibility notes:
- R3F v9 is required for React 19 (v8 targets React 18).
- Node 20.19+ or 22.12+ is required by Vite 7.
- Python 3.11+ is required.

## 6. Security risks and how they're handled

| Risk | Handling |
|---|---|
| Someone shown a profile they didn't make | Self-service creation only. The admin has no create endpoint. A permanent fiction notice is shown on every page |
| Guessable project IDs | The ID is an identifier, not a secret. Access needs ID + PIN (argon2id hash). Lockout after repeated failures |
| Brute force | slowapi rate limits on `/auth/*` and `/admin/login`, plus per-profile lockout |
| IDOR / cross-profile leakage | Every client route resolves the profile from the session, never from a URL parameter. Tests assert profile A can't read profile B |
| Session theft | httpOnly, Secure, SameSite=Strict cookies, separate cookies for admin and client, short admin TTL, CSRF token on mutating requests |
| Admin compromise | argon2id password, optional TOTP, login audit, no default credentials (first admin created via CLI) |
| Malicious uploads | MIME sniff plus Pillow decode and re-encode to WebP. **EXIF/GPS is stripped.** 5 MB cap, random filenames, stored outside the web root, served only through an authorised route |
| Location exposure | Owner chooses city-only or full address. Geocoding runs server-side and is cached. If geocoding fails, an honest "location unavailable" is shown and no coordinates are invented |
| Secrets in frontend | All secrets live in backend `.env`. The frontends only know `VITE_API_URL` |
| Data retention | Owner can delete their profile, which also deletes the photo and logs |

## 7. Phases

| # | Phase | Status |
|---|---|---|
| 1 | Foundation, design system, routing, visual identity | ✅ this delivery |
| 2 | Client login + FastAPI auth (ID + PIN, sessions, demo profile seeded with fictional data) | next |
| 3 | Dashboard panels with real profile data, charts, activity log | |
| 4 | Interactive 3D globe (dashboard) | |
| 5 | Admin app: login, profile list/search, edit, suspend/revoke/delete | |
| 6 | Self-service enrolment: form, photo upload + preview, ID generation | |
| 7 | Confidential access gate | |
| 8 | Full-body holographic scanner | |
| 9 | 3D brain visualisation | |
| 10 | Confidential globe + geocoded location | |
| 11 | Backend hardening, migrations, audit logs | |
| 12 | Security tests, responsive QA, deployment | |
