from tests.conftest import ADMIN_PW, H, admin_login, login


def test_admin_routes_require_admin_session(client):
    assert client.get("/api/admin/profiles").status_code == 401
    # A client session is not an admin session.
    login(client)
    assert client.get("/api/admin/profiles").status_code == 401


def test_admin_login_bad_and_good(client):
    assert admin_login(client, pw="wrong").status_code == 401
    r = admin_login(client)
    assert r.status_code == 200 and r.json() == {"username": "root", "role": "owner"}
    assert "path=/api/admin" in r.headers["set-cookie"].lower()
    assert client.get("/api/admin/me").json()["username"] == "root"


def test_no_create_endpoint(client):
    admin_login(client)
    r = client.post("/api/admin/profiles", json={"full_name": "Someone"}, headers=H)
    assert r.status_code == 405


def test_search_by_id_and_name(client):
    admin_login(client)
    assert client.get("/api/admin/profiles?q=demo").json()["total"] == 1
    assert client.get("/api/admin/profiles?q=second").json()["items"][0]["projectId"] == "WTR-2026-00001"
    assert client.get("/api/admin/profiles?q=wtr-2026").json()["total"] == 1
    assert client.get("/api/admin/profiles").json()["total"] == 2


def test_edit_updates_client_view(client):
    admin_login(client)
    r = client.patch("/api/admin/profiles/demo-0000", json={"threat_level": "HIGH", "case_notes": ["Updated"]}, headers=H)
    assert r.status_code == 200 and r.json()["threatLevel"] == "HIGH"
    login(client)
    me = client.get("/api/profile/me").json()
    assert me["threatLevel"] == "HIGH" and me["caseNotes"] == ["Updated"]


def test_edit_validation(client):
    admin_login(client)
    assert client.patch("/api/admin/profiles/demo-0000", json={"risk_score": 101}, headers=H).status_code == 422
    assert client.patch("/api/admin/profiles/demo-0000", json={"threat_level": "MAX"}, headers=H).status_code == 422


def test_location_change_clears_coordinates(client):
    from sqlalchemy import select

    from app.database.session import SessionLocal
    from app.models import Profile

    with SessionLocal() as db:
        p = db.scalar(select(Profile).where(Profile.project_id == "demo-0000"))
        p.location.lat, p.location.lon, p.location.geo_source = 51.5, -0.12, "nominatim"
        db.commit()
    admin_login(client)
    r = client.patch(
        "/api/admin/profiles/demo-0000",
        json={"location": {"country": "France", "city": "Paris"}},
        headers=H,
    )
    assert r.json()["location"]["lat"] is None


def test_suspend_kills_client_session_and_reactivate(client):
    login(client)
    admin_login(client)
    assert client.post("/api/admin/profiles/demo-0000/suspend", headers=H).json()["accessStatus"] == "SUSPENDED"
    assert client.get("/api/profile/me").status_code == 401
    assert client.post("/api/admin/profiles/demo-0000/suspend", headers=H).status_code == 409
    assert client.post("/api/admin/profiles/demo-0000/reactivate", headers=H).json()["accessStatus"] == "ACTIVE"
    assert login(client).status_code == 200


def test_revoke_is_permanent(client):
    admin_login(client)
    client.post("/api/admin/profiles/demo-0000/revoke", headers=H)
    assert client.post("/api/admin/profiles/demo-0000/reactivate", headers=H).status_code == 409
    assert login(client).status_code == 401


def test_reset_pin(client):
    admin_login(client)
    r = client.post("/api/admin/profiles/demo-0000/reset-pin", headers=H)
    pin = r.json()["newPin"]
    assert len(pin) == 6 and pin.isdigit()
    assert login(client).status_code == 401  # old PIN dead
    assert login(client, pin=pin).status_code == 200


def test_delete_requires_confirmation_and_owner(client):
    admin_login(client, user="mod")
    r = client.request("DELETE", "/api/admin/profiles/demo-0000", json={"confirm": "demo-0000"}, headers=H)
    assert r.status_code == 403
    admin_login(client)
    r = client.request("DELETE", "/api/admin/profiles/demo-0000", json={"confirm": "nope"}, headers=H)
    assert r.status_code == 400
    r = client.request("DELETE", "/api/admin/profiles/demo-0000", json={"confirm": "demo-0000"}, headers=H)
    assert r.status_code == 204
    assert client.get("/api/admin/profiles/demo-0000").status_code == 404


def test_overview_and_audit(client):
    login(client, pin="000000")
    admin_login(client)
    o = client.get("/api/admin/overview").json()
    assert o["profiles"] == 2 and o["active"] == 2 and o["failed24h"] == 1
    events = [a["event"] for a in client.get("/api/admin/audit").json()]
    assert "Admin signed in" in events and "Failed login" in events


def test_password_change(client):
    admin_login(client)
    bad = client.post("/api/admin/me/password", json={"current_password": "x", "new_password": "a" * 12}, headers=H)
    assert bad.status_code == 400
    short = client.post("/api/admin/me/password", json={"current_password": ADMIN_PW, "new_password": "short"}, headers=H)
    assert short.status_code == 422
    ok = client.post("/api/admin/me/password", json={"current_password": ADMIN_PW, "new_password": "n" * 14}, headers=H)
    assert ok.status_code == 204
    assert admin_login(client, pw="n" * 14).status_code == 200
