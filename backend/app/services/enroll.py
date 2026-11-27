from sqlalchemy.orm import Session

from app.models import CaseNote, Profile, ProfileBiometrics, ProfileLocation
from app.schemas.enroll import EnrollIn
from app.security.hashing import hash_secret
from app.services.activity import log_event
from app.services.project_ids import next_project_id


def create_profile(db: Session, body: EnrollIn, ip: str | None) -> Profile:
    """Create a profile from the owner's own submission. Caller commits."""
    p = Profile(
        project_id=next_project_id(db),
        pin_hash=hash_secret(body.pin),
        full_name=body.full_name,
        date_of_birth=body.date_of_birth,
        nationality=body.nationality,
        gender=body.gender,
        title=body.title,
        description=body.description,
        classification=body.classification,
        threat_level=body.threat_level,
        watchlist_status=body.watchlist_status,
        risk_score=body.risk_score,
        priority=body.priority,
        access_status="ACTIVE",
        failed_attempts=0,
        is_demo=False,
    )
    loc = body.location
    p.location = ProfileLocation(
        country=loc.country.strip(),
        region=(loc.region or "").strip() or None,
        city=loc.city.strip(),
        address=(loc.address or "").strip() or None,
        postal_code=(loc.postal_code or "").strip() or None,
        show_address=loc.show_address,
    )
    p.biometrics = ProfileBiometrics(**body.biometrics.model_dump())
    p.notes = [CaseNote(body=n) for n in body.case_notes]
    db.add(p)
    db.flush()
    log_event(db, event="Profile created by owner (self-service)", category="ENROL", actor="client",
              profile_id=p.id, ip=ip)
    return p
