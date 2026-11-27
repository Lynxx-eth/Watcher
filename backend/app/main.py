from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded

from app.api import routes_admin, routes_auth, routes_confidential, routes_enroll, routes_profile
from app.core.config import get_settings
from app.core.ratelimit import limiter

settings = get_settings()

app = FastAPI(
    title="WATCHER API",
    version="0.2.0",
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


@app.middleware("http")
async def csrf_and_headers(request: Request, call_next):
    """
    CSRF: cookies are SameSite=Strict, and every state-changing request must
    carry a custom header. Browsers can't add custom headers cross-origin
    without a CORS preflight, which only our two origins pass.
    """
    if request.method in MUTATING and request.url.path.startswith("/api") and request.headers.get(CSRF_HEADER) != "1":
        return JSONResponse({"detail": "MISSING REQUEST HEADER"}, status_code=403)

    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Cache-Control"] = "no-store"
    return response


# Added last so it runs first (handles preflight before the CSRF check).
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    # Multipart uploads set their own Content-Type boundary.
    allow_headers=["Content-Type", "X-Watcher-Request"],
)

app.include_router(routes_auth.router, prefix="/api")
app.include_router(routes_profile.router, prefix="/api")
app.include_router(routes_admin.router, prefix="/api")
app.include_router(routes_enroll.router, prefix="/api")
app.include_router(routes_confidential.router, prefix="/api")


@app.get("/api/health", tags=["system"])
def health() -> dict[str, str]:
    return {"status": "ok"}
