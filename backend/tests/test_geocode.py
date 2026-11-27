from sqlalchemy import select

from app.database.session import SessionLocal
from app.models import Profile
from app.services.geocode import candidate_queries
from tests.conftest import GEO_CALLS, H, admin_login, login
from tests.test_enroll import payload


def unlock(c, pid, pin):
    return c.post("/api/confidential/unlock", json={"project_id": pid, "pin": pin}, headers=H)


def test_candidate_queries_most_specific_first():
    q = candidate_queries("Nigeria", "Kano State", "Kano", "12 Example Rd", "700001")
    assert [p for _, p in q] == ["address", "city", "city", "country"]
    assert q[0][0] == "12 Example Rd, Kano, 700001, Kano State, Nigeria"
    assert q[-1][0] == "Nigeria"


def test_enroll_geocodes_in_background_and_confidential_shows_it(client):
    pid = client.post("/api/enroll", json=payload(), headers=H).json()["projectId"]
    assert GEO_CALLS == ["Kano, Nigeria"]
    assert unlock(client, pid, "482915").status_code == 200
    loc = client.get("/api/confidential/profile").json()["location"]
    assert loc["geoStatus"] == "LOCATED"
    assert loc["geo"] == {"lat": 12.0022, "lon": 8.592, "source": "nominatim:city"}


def test_unresolvable_address_is_reported_honestly(client):
    body = payload(location={"country": "Atlantis", "city": "Nowhere"})
    pid = client.post("/api/enroll", json=body, headers=H).json()["projectId"]
    unlock(client, pid, "482915")
    loc = client.get("/api/confidential/profile").json()["location"]
    assert loc["geo"] is None and loc["geoStatus"] == "UNAVAILABLE"
    with SessionLocal() as db:
        p = db.scalar(select(Profile).where(Profile.project_id == pid))
        assert p.location.lat is None and p.location.geocoded_at is not None


def test_admin_address_change_regeocodes(client):
    admin_login(client)
    client.patch("/api/admin/profiles/demo-0000", json={"location": {"country": "France", "city": "Paris"}}, headers=H)
    r = client.get("/api/admin/profiles/demo-0000").json()["location"]
    assert (r["lat"], r["lon"]) == (48.8566, 2.3522)


def test_admin_manual_regeocode(client):
    admin_login(client)
    r = client.post("/api/admin/profiles/demo-0000/geocode", headers=H)
    assert r.status_code == 200 and r.json()["location"]["lat"] == 51.5074


def test_demo_profile_shows_pending_until_geocoded(client):
    login(client)
    unlock(client, "demo-0000", "482916")
    assert client.get("/api/confidential/profile").json()["location"]["geoStatus"] == "PENDING"
