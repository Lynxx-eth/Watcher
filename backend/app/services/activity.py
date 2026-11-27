from sqlalchemy.orm import Session

from app.models import ActivityLog


def log_event(
    db: Session,
    *,
    event: str,
    category: str,
    actor: str = "system",
    profile_id: int | None = None,
    status: str = "OK",
    source: str = "WATCHER",
    ip: str | None = None,
) -> None:
    """Append to the audit trail. Caller commits."""
    db.add(
        ActivityLog(
            profile_id=profile_id,
            actor=actor,
            event=event,
            category=category,
            status=status,
            source=source,
            ip=ip,
        )
    )
