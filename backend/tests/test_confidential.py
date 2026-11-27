from datetime import timedelta

from sqlalchemy import select

from app.database.session import SessionLocal
from app.models import ClientSession
from app.models._time import utcnow
from tests.conftest import H, login


def unlock(c, pid="demo-0000", pin="482916"):
    return c.post("/api/confidential/unlock", json={"project_id": pid, "pin": pin}, headers=H)


def test_requires_client_session(client):
    assert unlock(client).status_code == 401
    assert client.get("/api/confidential/profile").status_code == 401


def test_profile_blocked_until_unlocked(client):
    login(client)
    assert client.get("/api/confidential/status").json()["unlocked"] is False
    assert client.get("/api/confidential/profile").status_code == 403


def test_correct_id_and_pin_opens_that_profile_regardless_of_session(client):
    login(client)  # signed in as demo
    # Entering another profile's correct ID + PIN rebinds to it and opens its page.
    r = unlock(client, pid="WTR-2026-00001", pin="1111")
    assert r.status_code == 200 and r.json()["unlocked"] is True
    prof = client.get("/api/confidential/profile").json()
    assert prof["projectId"] == "WTR-2026-00001"


def test_wrong_pin_for_a_valid_id_is_refused(client):
    login(client)
    r = unlock(client, pid="WTR-2026-00001", pin="9999")  # valid ID, wrong PIN
    assert r.status_code == 401 and r.json()["detail"] == "VERIFICATION FAILED"


def test_wrong_pin_fails_right_pin_unlocks(client):
    login(client)
    assert unlock(client, pin="000000").status_code == 401
    r = unlock(client)
    assert r.status_code == 200 and r.json()["unlocked"] is True and r.json()["expiresAt"]
    prof = client.get("/api/confidential/profile").json()
    assert prof["projectId"] == "demo-0000"
    assert prof["location"]["city"] == "London"
    assert prof["location"]["geoStatus"] == "PENDING"  # not geocoded yet; nothing invented


def test_expiry_and_lock(client):
    login(client)
    unlock(client)
    with SessionLocal() as db:
        s = db.scalar(select(ClientSession))
        s.confidential_until = utcnow() - timedelta(seconds=1)
        db.commit()
    assert client.get("/api/confidential/profile").status_code == 403
    unlock(client)
    assert client.post("/api/confidential/lock", headers=H).json()["unlocked"] is False
    assert client.get("/api/confidential/profile").status_code == 403


def test_failures_feed_lockout(client):
    login(client)
    for _ in range(5):
        unlock(client, pin="000000")
    assert unlock(client).status_code == 401  # locked even with the right PIN
