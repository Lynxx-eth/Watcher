from sqlalchemy import Integer
from sqlalchemy.orm import Mapped, mapped_column

from app.database.session import Base


class ProjectIdCounter(Base):
    """One row per year; incremented under a row lock to issue WTR-YYYY-NNNNN IDs."""

    __tablename__ = "project_id_counters"

    year: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)
    last: Mapped[int] = mapped_column(Integer, default=0)
