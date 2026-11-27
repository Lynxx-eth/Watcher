from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database.session import Base
from app.models._time import utcnow


class ActivityLog(Base):
    """Audit + activity trail. profile_id is null for admin/system events."""

    __tablename__ = "activity_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    profile_id: Mapped[int | None] = mapped_column(
        ForeignKey("profiles.id", ondelete="CASCADE"), nullable=True, index=True
    )
    actor: Mapped[str] = mapped_column(String(60))  # "client", "admin:<name>", "system"
    event: Mapped[str] = mapped_column(String(160))
    category: Mapped[str] = mapped_column(String(40))
    source: Mapped[str] = mapped_column(String(60), default="WATCHER")
    status: Mapped[str] = mapped_column(String(8), default="OK")  # OK | WARN | FAIL
    ip: Mapped[str | None] = mapped_column(String(45), nullable=True)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
