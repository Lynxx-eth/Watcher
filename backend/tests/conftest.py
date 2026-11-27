import os
import tempfile

# Configure BEFORE the app is imported.
_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
os.environ.update(
    DATABASE_URL=f"sqlite:///{_db.name}",
    COOKIE_SECURE="false",
    DEMO_PIN="482916",
    RATE_LIMIT_ENABLED="false",
    MAX_FAILED_ATTEMPTS="5",
    UPLOAD_DIR=tempfile.mkdtemp(prefix="watcher-uploads-"),
)

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.core.config import get_settings  # noqa: E402
from app.database.session import Base, SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import AdminUser, Profile  # noqa: E402
from app.security.hashing import hash_secret  # noqa: E402
from app.services.seed import seed_demo  # noqa: E402

H = {"X-Watcher-Request": "1"}
ADMIN_PW = "correct-horse-battery-staple"


FAKE_GEO = {
    "kano, nigeria": (12.0022, 8.592),
    "london, united kingdom": (51.5074, -0.1278),
    "paris, france": (48.8566, 2.3522),
}
GEO_CALLS: list[str] = []


@pytest.fixture(autouse=True)
def fake_geocoder(monkeypatch):
    """No network in tests: a tiny lookup table stands in for Nominatim."""
    from app.services import geocode

    def fake(_settings, query):
        GEO_CALLS.append(query)
        hit = FAKE_GEO.get(query.lower())
        return geocode.GeoResult(hit[0], hit[1], query, "") if hit else None

    GEO_CALLS.clear()
    monkeypatch.setattr(geocode, "provider", fake)


@pytest.fixture(autouse=True)
def fresh_db():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        seed_demo(db, get_settings())
        db.add(Profile(project_id="WTR-2026-00001", pin_hash=hash_secret("1111"), full_name="Second Owner"))
        db.add(AdminUser(username="root", password_hash=hash_secret(ADMIN_PW), role="owner"))
        db.add(AdminUser(username="mod", password_hash=hash_secret(ADMIN_PW), role="moderator"))
        db.commit()
    yield


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def login(c: TestClient, pid: str = "demo-0000", pin: str = "482916"):
    return c.post("/api/auth/client", json={"project_id": pid, "pin": pin}, headers=H)


def admin_login(c: TestClient, user: str = "root", pw: str = ADMIN_PW):
    return c.post("/api/admin/login", json={"username": user, "password": pw}, headers=H)
