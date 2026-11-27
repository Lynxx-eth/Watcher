from datetime import timedelta

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.models import AdminSession, AdminUser
from app.models._time import as_utc, utcnow
from app.security.hashing import new_session_token, token_digest, verify_secret
from app.services.activity import log_event


class AdminDenied(Exception):
    pass


def authenticate_admin(db: Session, settings: Settings, username: str, password: str, ip: str | None) -> AdminUser:
    admin = db.scalar(select(AdminUser).where(AdminUser.username == username))
    ok = verify_secret(admin.password_hash if admin else None, password)
    now = utcnow()

    if admin is None:
        log_event(db, event="Admin login failed (unknown user)", category="ADMIN", actor="admin:?", status="FAIL", ip=ip)
        db.commit()
        raise AdminDenied

    locked = as_utc(admin.locked_until)
    if locked and locked > now:
        log_event(db, event="Admin login blocked (locked)", category="ADMIN", actor=f"admin:{admin.username}",
                  status="WARN", ip=ip)
        db.commit()
        raise AdminDenied

    if not ok:
        admin.failed_attempts += 1
        if admin.failed_attempts >= settings.max_failed_attempts:
            admin.locked_until = now + timedelta(minutes=settings.lockout_minutes)
            admin.failed_attempts = 0
        log_event(db, event="Admin login failed", category="ADMIN", actor=f"admin:{admin.username}", status="FAIL", ip=ip)
        db.commit()
        raise AdminDenied

    admin.failed_attempts = 0
    admin.locked_until = None
    admin.last_login_at = now
    return admin


def start_admin_session(db: Session, settings: Settings, admin: AdminUser, ip: str | None) -> str:
    token = new_session_token()
    db.add(
        AdminSession(
            token_hash=token_digest(token),
            admin_id=admin.id,
            expires_at=utcnow() + timedelta(minutes=settings.admin_session_minutes),
        )
    )
    log_event(db, event="Admin signed in", category="ADMIN", actor=f"admin:{admin.username}", ip=ip)
    db.commit()
    return token


def resolve_admin(db: Session, token: str | None) -> AdminSession | None:
    if not token:
        return None
    sess = db.scalar(select(AdminSession).where(AdminSession.token_hash == token_digest(token)))
    if sess is None:
        return None
    if as_utc(sess.expires_at) <= utcnow():
        db.delete(sess)
        db.commit()
        return None
    return sess


def end_admin_session(db: Session, token: str | None) -> None:
    if token:
        db.execute(delete(AdminSession).where(AdminSession.token_hash == token_digest(token)))
        db.commit()
