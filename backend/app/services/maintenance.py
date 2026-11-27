"""Housekeeping: remove expired sessions so the tables don't grow without bound."""

from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.models import AdminSession, ClientSession
from app.models._time import utcnow


def purge_expired_sessions(db: Session) -> tuple[int, int]:
    """Delete client and admin sessions past their expiry. Returns (clients, admins)."""
    now = utcnow()
    clients = db.execute(delete(ClientSession).where(ClientSession.expires_at <= now)).rowcount or 0
    admins = db.execute(delete(AdminSession).where(AdminSession.expires_at <= now)).rowcount or 0
    db.commit()
    return clients, admins
