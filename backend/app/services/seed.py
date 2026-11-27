"""Seed the fictional demo profile used for `demo-0000`."""

from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.models import CaseNote, Profile, ProfileBiometrics, ProfileLocation
from app.security.hashing import hash_secret
from app.services.activity import log_event

DEMO_NOTES = [
    "Demonstration profile — every value here is fictional.",
    "Use this profile to preview the console before creating your own.",
    "Case notes on real profiles are written by their owners.",
]


def seed_demo(db: Session, settings: Settings) -> Profile:
    if not settings.demo_pin or not settings.demo_pin.isdigit() or len(settings.demo_pin) < 4:
        raise ValueError("Set DEMO_PIN in backend/.env (4–12 digits) before seeding.")

    existing = db.scalar(select(Profile).where(Profile.project_id == settings.demo_project_id))
    if existing:
        existing.pin_hash = hash_secret(settings.demo_pin)  # allow PIN rotation via .env
        db.commit()
        return existing

    p = Profile(
        project_id=settings.demo_project_id,
        pin_hash=hash_secret(settings.demo_pin),
        full_name="Agent Demo Kestrel",
        date_of_birth=date(1990, 1, 1),
        nationality="Fictional",
        title="Demonstration Subject",
        classification="DEMO // UNCLASSIFIED",
        threat_level="ELEVATED",
        watchlist_status="ACTIVE",
        risk_score=72,
        priority="HIGH",
        description="Fictional demonstration profile for previewing the WATCHER interface.",
        is_demo=True,
    )
    # City-level only, no street address. Coordinates are filled by geocoding in Phase 10.
    p.location = ProfileLocation(country="United Kingdom", city="London", show_address=False)
    p.biometrics = ProfileBiometrics(facial="MATCH FOUND", fingerprint="ON FILE", iris="ON FILE", dna="PENDING")
    p.notes = [CaseNote(body=b) for b in DEMO_NOTES]
    db.add(p)
    db.flush()
    log_event(db, event="Demo profile seeded", category="SYSTEM", profile_id=p.id)
    db.commit()
    return p
