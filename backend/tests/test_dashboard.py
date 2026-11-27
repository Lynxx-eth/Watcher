from tests.conftest import login


def test_activity_is_own_only(client):
    login(client, pid="WTR-2026-00001", pin="1111")
    login(client)  # now signed in as demo
    events = client.get("/api/profile/me/activity").json()
    assert events, "expected at least the login event"
    assert {"at", "event", "category", "source", "status"} <= set(events[0])
    # The demo log must not include anything from the other profile's session.
    assert sum(1 for e in events if e["event"] == "Secure session established") == 1


def test_failed_attempts_show_in_own_activity(client):
    login(client, pin="000000")
    login(client)
    events = [e["event"] for e in client.get("/api/profile/me/activity").json()]
    assert "Failed login" in events
    assert events[0] == "Secure session established"  # newest first


def test_stats_shape_and_values(client):
    login(client, pin="000000")
    login(client)
    s = client.get("/api/profile/me/stats").json()
    assert s["sessions30d"] == 1
    assert s["failures30d"] == 1
    assert s["caseNotes"] == 3
    assert s["biometricsOnFile"] == 3  # MATCH FOUND + ON FILE + ON FILE
    assert len(s["byDay"]) == 14
    assert s["byDay"][-1]["sessions"] == 1
    assert 0 <= s["completeness"] <= 100
    assert s["byCategory"]["AUTH"] >= 2


def test_activity_requires_session(client):
    assert client.get("/api/profile/me/activity").status_code == 401
    assert client.get("/api/profile/me/stats").status_code == 401


def test_days_param_validated(client):
    login(client)
    assert client.get("/api/profile/me/activity?days=0").status_code == 422
    assert client.get("/api/profile/me/activity?days=500").status_code == 422
