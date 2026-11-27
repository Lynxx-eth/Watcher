"""Client authentication: project ID + PIN → server-side session."""

from datetime import timedelta

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.models import ClientSession, Profile
from app.models._time import as_utc, utcnow
from app.security.hashing import new_session_token, token_digest, verify_secret
from app.services.activity import log_event


class AccessDenied(Exception):
    """Raised for every login failure. The API maps it to one generic message."""


def authenticate(db: Session, settings: Settings, project_id: str, pin: str, ip: str | None) -> Profile:
    profile = db.scalar(select(Profile).where(Profile.project_id == project_id))

    # Always run a hash verification so missing IDs take as long as wrong PINs.
    pin_ok = verify_secret(profile.pin_hash if profile else None, pin)

    if profile is None:
        raise AccessDenied

    now = utcnow()
    locked_until = as_utc(profile.locked_until)
    if locked_until and locked_until > now:
        log_event(db, event="Login blocked (locked)", category="AUTH", actor="client",
                  profile_id=profile.id, status="WARN", ip=ip)
        db.commit()
        raise AccessDenied

    if not pin_ok:
        profile.failed_attempts += 1
        if profile.failed_attempts >= settings.max_failed_attempts:
            profile.locked_until = now + timedelta(minutes=settings.lockout_minutes)
            profile.failed_attempts = 0
            event = "Account locked after repeated failures"
        else:
            event = "Failed login"
        log_event(db, event=event, category="AUTH", actor="client", profile_id=profile.id, status="FAIL", ip=ip)
        db.commit()
        raise AccessDenied

    if profile.access_status != "ACTIVE":
        log_event(db, event=f"Login refused ({profile.access_status.lower()})", category="AUTH",
                  actor="client", profile_id=profile.id, status="WARN", ip=ip)
        db.commit()
        raise AccessDenied

    profile.failed_attempts = 0
    profile.locked_until = None
    profile.last_access_at = now
    return profile


def start_session(db: Session, settings: Settings, profile: Profile, ip: str | None) -> str:
    token = new_session_token()
    db.add(
        ClientSession(
            token_hash=token_digest(token),
            profile_id=profile.id,
            expires_at=utcnow() + timedelta(hours=settings.client_session_hours),
        )
    )
    log_event(db, event="Secure session established", category="AUTH", actor="client",
              profile_id=profile.id, ip=ip)
    db.commit()
    return token


def resolve_session(db: Session, token: str | None) -> ClientSession | None:
    """Return a live session whose profile is still ACTIVE, else None."""
    if not token:
        return None
    sess = db.scalar(select(ClientSession).where(ClientSession.token_hash == token_digest(token)))
    if sess is None:
        return None
    if as_utc(sess.expires_at) <= utcnow():
        db.delete(sess)
        db.commit()
        return None
    if sess.profile.access_status != "ACTIVE":
        return None
    return sess


def end_session(db: Session, token: str | None) -> None:
    if token:
        db.execute(delete(ClientSession).where(ClientSession.token_hash == token_digest(token)))
        db.commit()


def end_all_sessions(db: Session, profile_id: int) -> None:
    """Used when an admin suspends/revokes a profile (Phase 5)."""
    db.execute(delete(ClientSession).where(ClientSession.profile_id == profile_id))
    db.commit()
