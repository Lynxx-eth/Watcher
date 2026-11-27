import io
from datetime import date

from PIL import Image

from tests.conftest import H, admin_login, login

BIO = {"facial": "ON FILE", "fingerprint": "PENDING", "iris": "NOT ON FILE", "dna": "PENDING"}


def payload(**over):
    body = {
        "full_name": "Ada Example",
        "date_of_birth": "1995-06-15",
        "nationality": "Nigerian",
        "location": {"country": "Nigeria", "city": "Kano"},
        "threat_level": "GUARDED",
        "watchlist_status": "NONE",
        "risk_score": 30,
        "biometrics": BIO,
        "case_notes": ["First note", "  "],
        "pin": "482915",
        "pin_confirm": "482915",
        "consent_own_profile": True,
    }
    body.update(over)
    return body


def jpeg_with_gps() -> bytes:
    exif = Image.Exif()
    exif[0x8825] = {1: "N", 2: (12.0, 0.0, 0.0), 3: "E", 4: (8.0, 31.0, 0.0)}
    buf = io.BytesIO()
    Image.new("RGB", (1200, 900), (10, 120, 200)).save(buf, "JPEG", exif=exif.tobytes())
    return buf.getvalue()


def test_enroll_creates_profile_signs_in_and_issues_sequential_ids(client):
    r = client.post("/api/enroll", json=payload(), headers=H)
    assert r.status_code == 201, r.text
    pid = r.json()["projectId"]
    year = date.today().year
    # WTR-<year>-00001 is taken by the fixture in 2026; generator skips taken numbers.
    assert pid.startswith(f"WTR-{year}-") and len(pid) == 14
    me = client.get("/api/profile/me").json()
    assert me["fullName"] == "Ada Example" and me["caseNotes"] == ["First note"]
    assert me["location"]["address"] is None
    r2 = client.post("/api/enroll", json=payload(full_name="Second Example"), headers=H)
    assert r2.json()["projectId"] != pid
    assert int(r2.json()["projectId"][-5:]) == int(pid[-5:]) + 1


def test_enrolled_owner_can_log_in_with_pin(client):
    pid = client.post("/api/enroll", json=payload(), headers=H).json()["projectId"]
    client.post("/api/auth/logout", headers=H)
    assert login(client, pid=pid, pin="482915").status_code == 200


def test_enroll_validation(client):
    bad = [
        payload(consent_own_profile=False),
        payload(pin_confirm="111111"),
        payload(pin="1111", pin_confirm="1111"),
        payload(pin="1234", pin_confirm="1234"),
        payload(date_of_birth=f"{date.today().year - 10}-01-01"),
        payload(location={"country": "Nigeria", "city": " "}),
        payload(risk_score=150),
        payload(threat_level="APOCALYPTIC"),
    ]
    for b in bad:
        assert client.post("/api/enroll", json=b, headers=H).status_code == 422


def test_photo_upload_strips_exif_and_serves_only_to_owner(client):
    client.post("/api/enroll", json=payload(), headers=H)
    r = client.post("/api/profile/me/photo", files={"file": ("me.jpg", jpeg_with_gps(), "image/jpeg")}, headers=H)
    assert r.status_code == 200, r.text
    assert r.json()["photoUrl"].startswith("/api/profile/me/photo")
    img = client.get("/api/profile/me/photo")
    assert img.headers["content-type"] == "image/webp"
    out = Image.open(io.BytesIO(img.content))
    assert out.format == "WEBP" and max(out.size) <= 800
    assert dict(out.getexif()) == {}  # GPS gone
    client.post("/api/auth/logout", headers=H)
    assert client.get("/api/profile/me/photo").status_code == 401


def test_photo_rejects_non_images_and_oversize(client):
    client.post("/api/enroll", json=payload(), headers=H)
    r = client.post("/api/profile/me/photo", files={"file": ("x.jpg", b"<?php system($_GET[1]); ?>", "image/jpeg")}, headers=H)
    assert r.status_code == 422
    big = b"\xff\xd8" + b"0" * (6 * 1024 * 1024)
    r = client.post("/api/profile/me/photo", files={"file": ("big.jpg", big, "image/jpeg")}, headers=H)
    assert r.status_code == 422


def test_admin_can_view_replace_and_remove_photo(client):
    pid = client.post("/api/enroll", json=payload(), headers=H).json()["projectId"]
    admin_login(client)
    r = client.put(f"/api/admin/profiles/{pid}/photo", files={"file": ("p.jpg", jpeg_with_gps(), "image/jpeg")}, headers=H)
    assert r.status_code == 200 and r.json()["hasPhoto"] is True
    assert client.get(f"/api/admin/profiles/{pid}/photo").status_code == 200
    r = client.request("DELETE", f"/api/admin/profiles/{pid}/photo", headers=H)
    assert r.json()["hasPhoto"] is False
