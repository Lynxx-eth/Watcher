from datetime import timedelta

from sqlalchemy.orm import Session

from app.core.config import Settings
from app.models import ClientSession
from app.models._time import as_utc, utcnow
from app.schemas.confidential import ConfidentialLocation, ConfidentialProfile
from app.schemas.profile import BiometricsOut, GeoOut
from app.services.activity import log_event
from app.services.client_auth import AccessDenied, authenticate


class VerificationFailed(Exception):
    pass


def is_unlocked(sess: ClientSession) -> bool:
    until = as_utc(sess.confidential_until)
    return bool(until and until > utcnow())


def unlock(db: Session, settings: Settings, sess: ClientSession, project_id: str, pin: str, ip: str | None) -> None:
    """
    Open the confidential page for whatever ID + PIN is entered, as long as they
    are correct for that profile — regardless of which profile the current
    session was bound to. In the self-service model a correct ID + PIN is the
    owner's own credential, so this is the owner authenticating, not a bypass.

    The same per-profile lockout and rate limit as sign-in still apply, so this
    is not a way around brute-force protection. On success the session is
    re-bound to that profile and confidential mode opens for a short window.
    """
    try:
        # Reuses the sign-in path: validates ID + PIN against that profile,
        # enforces lockout/suspension, and records the attempt.
        profile = authenticate(db, settings, project_id, pin, ip)
    except AccessDenied:
        raise VerificationFailed from None

    # Re-bind this session to the authenticated profile and open the window.
    sess.profile_id = profile.id
    sess.confidential_until = utcnow() + timedelta(minutes=settings.confidential_minutes)
    log_event(db, event="Confidential access granted", category="CONFIDENTIAL", actor="client",
              profile_id=profile.id, ip=ip)
    db.commit()
    db.refresh(sess)


def lock(db: Session, sess: ClientSession) -> None:
    sess.confidential_until = None
    db.commit()


def confidential_profile(sess: ClientSession) -> ConfidentialProfile:
    p = sess.profile
    loc = p.location
    location = None
    if loc is not None:
        has_geo = loc.lat is not None and loc.lon is not None
        location = ConfidentialLocation(
            country=loc.country,
            region=loc.region,
            city=loc.city,
            address=loc.address,
            postal_code=loc.postal_code,
            geo=GeoOut(lat=loc.lat, lon=loc.lon, source=loc.geo_source or "unknown") if has_geo else None,
            # Geocoding arrives in Phase 10; until then nothing is guessed.
            geo_status="LOCATED" if has_geo else ("UNAVAILABLE" if loc.geocoded_at else "PENDING"),
        )
    bio = p.biometrics
    return ConfidentialProfile(
        project_id=p.project_id,
        full_name=p.full_name,
        date_of_birth=p.date_of_birth.isoformat() if p.date_of_birth else None,
        nationality=p.nationality,
        gender=p.gender,
        photo_url=f"/api/profile/me/photo?v={p.photo_key[:8]}" if p.photo_key else None,
        title=p.title,
        classification=p.classification,
        threat_level=p.threat_level,
        watchlist_status=p.watchlist_status,
        risk_score=p.risk_score,
        description=p.description,
        case_notes=[n.body for n in p.notes],
        biometrics=BiometricsOut(facial=bio.facial, fingerprint=bio.fingerprint, iris=bio.iris, dna=bio.dna) if bio else None,
        location=location,
        expires_at=as_utc(sess.confidential_until),
    )
