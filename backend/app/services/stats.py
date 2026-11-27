from collections import Counter
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import ActivityLog, Profile
from app.models._time import as_utc, utcnow
from app.schemas.activity import ActivityOut, DayCount, StatsOut


def recent_activity(db: Session, profile_id: int, days: int = 30, limit: int = 50) -> list[ActivityOut]:
    since = utcnow() - timedelta(days=days)
    rows = db.scalars(
        select(ActivityLog)
        .where(ActivityLog.profile_id == profile_id, ActivityLog.at >= since)
        .order_by(ActivityLog.at.desc(), ActivityLog.id.desc())
        .limit(limit)
    ).all()
    return [ActivityOut(at=r.at, event=r.event, category=r.category, source=r.source, status=r.status) for r in rows]


def _completeness(p: Profile) -> int:
    loc = p.location
    fields = [
        p.full_name,
        p.date_of_birth,
        p.nationality,
        p.photo_key,
        p.title,
        p.description,
        loc and loc.city,
        loc and loc.country,
        p.biometrics,
        p.notes,
    ]
    return round(100 * sum(1 for f in fields if f) / len(fields))


def profile_stats(db: Session, p: Profile) -> StatsOut:
    now = utcnow()
    logs = db.scalars(
        select(ActivityLog).where(ActivityLog.profile_id == p.id, ActivityLog.at >= now - timedelta(days=30))
    ).all()

    sessions = [r for r in logs if r.event == "Secure session established"]
    failures = [r for r in logs if r.category == "AUTH" and r.status == "FAIL"]

    today = now.date()
    days = [today - timedelta(days=i) for i in range(13, -1, -1)]
    s_by_day = Counter(as_utc(r.at).date() for r in sessions)
    f_by_day = Counter(as_utc(r.at).date() for r in failures)

    bio = p.biometrics
    bio_on_file = (
        sum(1 for v in (bio.facial, bio.fingerprint, bio.iris, bio.dna) if v in ("ON FILE", "MATCH FOUND"))
        if bio
        else 0
    )

    return StatsOut(
        linked_records=sum(1 for x in (p.location, p.biometrics) if x) + len(p.notes) + 1,
        case_notes=len(p.notes),
        biometrics_on_file=bio_on_file,
        sessions_30d=len(sessions),
        failures_30d=len(failures),
        completeness=_completeness(p),
        by_day=[DayCount(day=d.isoformat(), sessions=s_by_day[d], failures=f_by_day[d]) for d in days],
        by_category=dict(Counter(r.category for r in logs)),
    )
