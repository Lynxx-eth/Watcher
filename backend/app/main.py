import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from sqlalchemy import text

from app.api import routes_admin, routes_auth, routes_confidential, routes_enroll, routes_profile
from app.core.config import get_settings
from app.core.ratelimit import limiter
from app.database.session import engine

settings = get_settings()


def _bootstrap_admin() -> None:
    """
    Create the first admin from ADMIN_USER / ADMIN_PASSWORD env vars, but only
    when no admin exists yet. Lets hosts without shell access (Render free)
    create an admin without a CLI. Idempotent and never overwrites.
    """
    user = settings.admin_user.strip()
    pw = settings.admin_password
    if not user or not pw:
        return
    if len(pw) < 8:
        print("WATCHER: ADMIN_PASSWORD too short (min 8) — skipping admin bootstrap.")
        return
    try:
        from sqlalchemy import func, select

        from app.database.session import SessionLocal
        from app.models import AdminUser
        from app.security.hashing import hash_secret

        with SessionLocal() as db:
            if db.scalar(select(func.count()).select_from(AdminUser)):
                return  # an admin already exists; leave everything alone
            db.add(AdminUser(username=user, password_hash=hash_secret(pw), role="owner"))
            db.commit()
            print(f"WATCHER: bootstrapped admin '{user}'.")
    except Exception as exc:  # never let bootstrap take down the API
        print(f"WATCHER: admin bootstrap skipped ({exc!r}).")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Refuse to boot with insecure settings in production, rather than ship them.
    problems = settings.production_problems()
    if problems:
        raise RuntimeError("Unsafe production configuration:\n  - " + "\n  - ".join(problems))
    _bootstrap_admin()
    yield


app = FastAPI(
    title="WATCHER API",
    version="0.11.0",
    lifespan=lifespan,
    # Interactive docs only outside production.
    docs_url=None if settings.is_production else "/api/docs",
    redoc_url=None,
    openapi_url=None if settings.is_production else "/api/openapi.json",
)

app.state.limiter = limiter


@app.exception_handler(RateLimitExceeded)
def _rate_limited(_request: Request, _exc: RateLimitExceeded) -> JSONResponse:
    return JSONResponse({"detail": "TOO MANY ATTEMPTS — TRY AGAIN SHORTLY"}, status_code=429)


MUTATING = {"POST", "PUT", "PATCH", "DELETE"}
CSRF_HEADER = "x-watcher-request"

# API responses carry no HTML/scripts, so lock the document down hard.
CSP = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"


@app.middleware("http")
async def security_middleware(request: Request, call_next):
    """
    CSRF: cookies are SameSite=Strict, and every state-changing request must
    carry a custom header. Browsers can't set a custom header cross-origin
    without a CORS preflight, which only our known origins pass.
    """
    if request.method in MUTATING and request.url.path.startswith("/api") and request.headers.get(CSRF_HEADER) != "1":
        return JSONResponse({"detail": "MISSING REQUEST HEADER"}, status_code=403)

    request_id = request.headers.get("x-request-id") or uuid.uuid4().hex
    response = await call_next(request)

    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Cache-Control"] = "no-store"
    # Swagger UI (dev only) loads its assets from a CDN, so skip the lockdown there.
    if request.url.path not in ("/api/docs", "/api/openapi.json"):
        response.headers["Content-Security-Policy"] = CSP
    response.headers["Permissions-Policy"] = "geolocation=(), camera=(), microphone=(), interest-cohort=()"
    # Photos are embedded by the frontends via <img>; everything else is JSON.
    response.headers.setdefault("Cross-Origin-Resource-Policy", "cross-origin")
    response.headers["X-Request-ID"] = request_id
    if settings.cookie_secure:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


# Added last so it runs first (handles preflight before the CSRF check).
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    # Multipart uploads set their own Content-Type boundary.
    allow_headers=["Content-Type", "X-Watcher-Request", "X-Request-ID"],
    expose_headers=["X-Request-ID"],
)

app.include_router(routes_auth.router, prefix="/api")
app.include_router(routes_profile.router, prefix="/api")
app.include_router(routes_admin.router, prefix="/api")
app.include_router(routes_enroll.router, prefix="/api")
app.include_router(routes_confidential.router, prefix="/api")


@app.get("/api/health", tags=["system"])
def health() -> dict[str, str]:
    """Liveness: the process is up."""
    return {"status": "ok"}


@app.get("/api/ready", tags=["system"])
def ready() -> JSONResponse:
    """Readiness: the database is reachable."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return JSONResponse({"status": "ready"})
    except Exception:
        return JSONResponse({"status": "unavailable"}, status_code=503)
