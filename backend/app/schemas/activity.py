from datetime import datetime

from app.schemas.common import CamelModel


class ActivityOut(CamelModel):
    at: datetime
    event: str
    category: str
    source: str
    status: str


class DayCount(CamelModel):
    day: str  # yyyy-mm-dd (UTC)
    sessions: int
    failures: int


class StatsOut(CamelModel):
    """Figures derived from the owner's own records — nothing invented."""

    linked_records: int
    case_notes: int
    biometrics_on_file: int
    sessions_30d: int
    failures_30d: int
    completeness: int  # % of profile fields the owner has filled in
    by_day: list[DayCount]  # last 14 days
    by_category: dict[str, int]
