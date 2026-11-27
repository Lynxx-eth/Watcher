from sqlalchemy import select

from app.database.session import SessionLocal
from app.models import Profile
from tests.conftest import H, login


def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok"}


def test_wrong_pin_and_unknown_id_look_identical(client):
    a = login(client, pin="000000")
    b = login(client, pid="WTR-2099-99999")
    assert a.status_code == b.status_code == 401
    assert a.json() == b.json() == {"detail": "ACCESS DENIED"}


def test_missing_csrf_header_rejected(client):
    r = client.post("/api/auth/client", json={"project_id": "demo-0000", "pin": "482916"})
    assert r.status_code == 403


def test_pin_must_be_digits(client):
    r = client.post("/api/auth/client", json={"project_id": "demo-0000", "pin": "abcd"}, headers=H)
    assert r.status_code == 422


def test_login_sets_httponly_cookie_and_session_works(client):
    r = login(client)
    assert r.status_code == 200
    assert r.json() == {"projectId": "demo-0000", "displayName": "Agent Demo Kestrel"}
    cookie = r.headers["set-cookie"].lower()
    assert "httponly" in cookie and "samesite=strict" in cookie and "path=/api" in cookie
    assert client.get("/api/auth/me").json()["projectId"] == "demo-0000"


def test_profile_me_returns_own_profile_only(client):
    login(client, pid="wtr-2026-00001", pin="1111")  # lowercase input is normalised
    p = client.get("/api/profile/me").json()
    assert p["projectId"] == "WTR-2026-00001"
    assert p["fullName"] == "Second Owner"
    # No route exists to fetch another profile by ID.
    assert client.get("/api/profile/demo-0000").status_code in (404, 405)


def test_demo_profile_shape(client):
    login(client)
    p = client.get("/api/profile/me").json()
    assert p["isDemo"] is True
    assert p["location"]["city"] == "London"
    assert p["location"]["address"] is None  # city-level only
    assert p["location"]["geo"] is None  # never invented; filled by geocoding later
    assert p["biometrics"]["dna"] == "PENDING"
    assert len(p["caseNotes"]) == 3


def test_requires_session(client):
    assert client.get("/api/profile/me").status_code == 401
    assert client.get("/api/auth/me").status_code == 401


def test_lockout_after_repeated_failures(client):
    for _ in range(5):
        assert login(client, pin="000000").status_code == 401
    # Correct PIN is refused while locked.
    assert login(client).status_code == 401


def test_suspension_blocks_login_and_kills_live_session(client):
    login(client)
    with SessionLocal() as db:
        p = db.scalar(select(Profile).where(Profile.project_id == "demo-0000"))
        p.access_status = "SUSPENDED"
        db.commit()
    assert client.get("/api/profile/me").status_code == 401
    assert login(client).status_code == 401


def test_logout_ends_session(client):
    login(client)
    assert client.post("/api/auth/logout", headers=H).status_code == 204
    assert client.get("/api/auth/me").status_code == 401
