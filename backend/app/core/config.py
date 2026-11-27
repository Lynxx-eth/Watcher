from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """All configuration comes from environment variables / backend/.env."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    environment: str = "development"
    database_url: str = "postgresql+psycopg://watcher:watcher@localhost:5432/watcher"

    # CORS: only the known frontends may call the API with credentials.
    client_origin: str = "http://localhost:5173"
    admin_origin: str = "http://localhost:5174"
    enroll_origin: str = "http://localhost:5175"

    # Client sessions
    client_cookie_name: str = "watcher_client"
    client_session_hours: int = 8
    cookie_secure: bool = True  # set false only for http://localhost development
    # "strict" works when the sites and API share an origin (dev, or one-app hosting).
    # Set "none" when the frontends are on a different domain than the API (e.g. Vercel
    # sites + Render API); that is the only way the browser will send the cookie
    # cross-site, and it requires cookie_secure=true (HTTPS). CSRF is still covered by
    # the required X-Watcher-Request header, which cross-site callers can't set without
    # a CORS preflight that only our own origins pass.
    cookie_samesite: Literal["strict", "lax", "none"] = "strict"

    # Admin sessions (separate cookie, shorter life)
    admin_cookie_name: str = "watcher_admin"
    admin_session_minutes: int = 120

    # Confidential mode (re-verified with ID + PIN, short-lived)
    confidential_minutes: int = 15

    # Brute-force protection
    max_failed_attempts: int = 5
    lockout_minutes: int = 15
    rate_limit_enabled: bool = True
    login_rate_limit: str = "10/minute"

    # Uploads (stored outside any web root; served only through authorised routes)
    upload_dir: str = "./uploads"
    max_upload_mb: int = 5
    enroll_rate_limit: str = "5/hour"
    min_owner_age: int = 18

    # Geocoding (server-side only; coordinates are never invented)
    geocoder_enabled: bool = True
    geocoder_url: str = "https://nominatim.openstreetmap.org/search"
    geocoder_user_agent: str = "WATCHER/0.10 (set GEOCODER_USER_AGENT with your contact email)"
    geocoder_timeout_s: float = 10.0

    # Demo profile (fictional data) — seeded by `python -m app.cli seed-demo`
    demo_project_id: str = "demo-0000"
    demo_pin: str = ""

    @property
    def cors_origins(self) -> list[str]:
        return [self.client_origin, self.admin_origin, self.enroll_origin]

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    def production_problems(self) -> list[str]:
        """Insecure settings that must not ship. Empty list = safe to run in production."""
        problems: list[str] = []
        if not self.is_production:
            return problems
        if not self.cookie_secure:
            problems.append("COOKIE_SECURE must be true in production (cookies require HTTPS).")
        if self.cookie_samesite == "none" and not self.cookie_secure:
            problems.append("COOKIE_SAMESITE=none requires COOKIE_SECURE=true (browsers reject it otherwise).")
        if "localhost" in self.database_url or "watcher:watcher@" in self.database_url:
            problems.append("DATABASE_URL still points at the development default.")
        if any(o.startswith("http://") for o in self.cors_origins):
            problems.append("Frontend origins must use https:// in production.")
        if self.geocoder_enabled and "set GEOCODER_USER_AGENT" in self.geocoder_user_agent:
            problems.append("Set GEOCODER_USER_AGENT to a real contact (Nominatim usage policy).")
        return problems


@lru_cache
def get_settings() -> Settings:
    return Settings()
