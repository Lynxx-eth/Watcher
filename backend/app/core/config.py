from functools import lru_cache

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


@lru_cache
def get_settings() -> Settings:
    return Settings()
