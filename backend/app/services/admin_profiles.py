"""Admin operations on existing profiles. There is intentionally no create."""

import secrets

from sqlalchemy import delete, func, or_, select
from sqlalchemy.orm import Session

from app.models import ActivityLog, CaseNote, Profile, ProfileBiometrics, ProfileLocation
from app.models._time import as_utc, utcnow
from app.schemas.admin import (
    AuditRow,
    LocationAdmin,
    OverviewOut,
    ProfileAdminOut,
    ProfileRow,
    ProfileUpdateIn,
)
from app.schemas.profile import BiometricsOut
from app.security.hashing import hash_secret
from app.services.client_auth import end_all_sessions


class NotAllowed(Exception):
    pass


def _locked(p: Profile) -> bool:
    lu = as_utc(p.locked_until)
    return bool(lu and lu > utcnow())


def to_row(p: Profile) -> ProfileRow:
    return ProfileRow(
        project_id=p.project_id,
        full_name=p.full_name,
        access_status=p.access_status,
        threat_level=p.threat_level,
        watchlist_status=p.watchlist_status,
        is_demo=p.is_demo,
        locked=_locked(p),
        last_access_at=p.last_access_at,
        created_at=p.created_at,
    )


def to_admin_out(p: Profile) -> ProfileAdminOut:
    loc, bio = p.location, p.biometrics
    return ProfileAdminOut(
        project_id=p.project_id,
        full_name=p.full_name,
        date_of_birth=p.date_of_birth,
        nationality=p.nationality,
        gender=p.gender,
        has_photo=bool(p.photo_key),
        title=p.title,
        classification=p.classification,
        threat_level=p.threat_level,
        watchlist_status=p.watchlist_status,
        risk_score=p.risk_score,
        priority=p.priority,
        description=p.description,
        case_notes=[n.body for n in p.notes],
        biometrics=BiometricsOut(facial=bio.facial, fingerprint=bio.fingerprint, iris=bio.iris, dna=bio.dna) if bio else None,
        location=LocationAdmin(
            country=loc.country, region=loc.region, city=loc.city, address=loc.address,
            postal_code=loc.postal_code, show_address=loc.show_address, lat=loc.lat, lon=loc.lon,
        ) if loc else None,
        access_status=p.access_status,
        failed_attempts=p.failed_attempts,
        locked_until=p.locked_until,
        last_access_at=p.last_access_at,
        is_demo=p.is_demo,
        created_at=p.created_at,
        updated_at=p.updated_at,
    )


def search(db: Session, q: str, status: str | None, page: int, page_size: int) -> tuple[list[Profile], int]:
    stmt = select(Profile)
    if q:
        like = f"%{q.strip().lower()}%"
        stmt = stmt.where(or_(func.lower(Profile.project_id).like(like), func.lower(Profile.full_name).like(like)))
    if status:
        stmt = stmt.where(Profile.access_status == status)
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.scalars(stmt.order_by(Profile.created_at.desc()).offset((page - 1) * page_size).limit(page_size)).all()
    return list(rows), total


def get_by_pid(db: Session, project_id: str) -> Profile | None:
    return db.scalar(select(Profile).where(Profile.project_id == project_id))


def apply_update(p: Profile, body: ProfileUpdateIn) -> list[str]:
    """Also returns "location:moved" in the list when the address changed (needs re-geocoding)."""
    """Apply only the fields that were sent. Returns the names of changed fields."""
    data = body.model_dump(exclude_unset=True)
    changed: list[str] = []

    for field in ("full_name", "date_of_birth", "nationality", "gender", "title", "classification",
                  "threat_level", "watchlist_status", "risk_score", "priority", "description"):
        if field in data and getattr(p, field) != data[field]:
            setattr(p, field, data[field])
            changed.append(field)

    if "case_notes" in data and data["case_notes"] is not None:
        p.notes = [CaseNote(body=b) for b in data["case_notes"]]
        changed.append("case_notes")

    if data.get("location") is not None:
        loc_in = data["location"]
        loc = p.location or ProfileLocation()
        moved = (loc.country, loc.region, loc.city, loc.address, loc.postal_code) != (
            loc_in["country"], loc_in.get("region"), loc_in["city"], loc_in.get("address"), loc_in.get("postal_code"),
        )
        for k, v in loc_in.items():
            setattr(loc, k, v)
        if moved:
            # Coordinates belong to the old address; clear them so they're re-geocoded, never guessed.
            loc.lat = loc.lon = None
            loc.geo_source = None
            loc.geocoded_at = None
            changed.append("location:moved")
        p.location = loc
        changed.append("location")

    if data.get("biometrics") is not None:
        bio = p.biometrics or ProfileBiometrics()
        for k, v in data["biometrics"].items():
            setattr(bio, k, v)
        p.biometrics = bio
        changed.append("biometrics")

    return changed


def set_access(db: Session, p: Profile, action: str) -> None:
    current = p.access_status
    if action == "suspend":
        if current != "ACTIVE":
            raise NotAllowed("Only ACTIVE profiles can be suspended")
        p.access_status = "SUSPENDED"
    elif action == "reactivate":
        if current != "SUSPENDED":
            raise NotAllowed("Only SUSPENDED profiles can be reactivated (revocation is permanent)")
        p.access_status = "ACTIVE"
        p.failed_attempts = 0
        p.locked_until = None
    elif action == "revoke":
        if current == "REVOKED":
            raise NotAllowed("Profile is already revoked")
        p.access_status = "REVOKED"
    elif action == "unlock":
        p.failed_attempts = 0
        p.locked_until = None
    else:
        raise NotAllowed("Unknown action")
    if action in ("suspend", "revoke"):
        end_all_sessions(db, p.id)


def delete_profile(db: Session, p: Profile) -> None:
    """Remove the profile and everything tied to it (sessions, activity, notes, location, biometrics)."""
    end_all_sessions(db, p.id)
    db.execute(delete(ActivityLog).where(ActivityLog.profile_id == p.id))
    db.delete(p)


def reset_pin(p: Profile) -> str:
    pin = f"{secrets.randbelow(10**6):06d}"
    p.pin_hash = hash_secret(pin)
    p.failed_attempts = 0
    p.locked_until = None
    return pin


def overview(db: Session) -> OverviewOut:
    from datetime import timedelta

    now = utcnow()
    counts = dict(db.execute(select(Profile.access_status, func.count()).group_by(Profile.access_status)).all())
    locked = db.scalar(select(func.count()).where(Profile.locked_until.is_not(None), Profile.locked_until > now)) or 0
    since = now - timedelta(hours=24)
    sign_ins = db.scalar(
        select(func.count()).where(ActivityLog.event == "Secure session established", ActivityLog.at >= since)
    ) or 0
    failed = db.scalar(
        select(func.count()).where(ActivityLog.category == "AUTH", ActivityLog.status == "FAIL", ActivityLog.at >= since)
    ) or 0
    return OverviewOut(
        profiles=sum(counts.values()),
        active=counts.get("ACTIVE", 0),
        suspended=counts.get("SUSPENDED", 0),
        revoked=counts.get("REVOKED", 0),
        locked=locked,
        sign_ins_24h=sign_ins,
        failed_24h=failed,
    )


def audit(db: Session, limit: int = 100) -> list[AuditRow]:
    rows = db.execute(
        select(ActivityLog, Profile.project_id)
        .join(Profile, Profile.id == ActivityLog.profile_id, isouter=True)
        .order_by(ActivityLog.at.desc(), ActivityLog.id.desc())
        .limit(limit)
    ).all()
    return [
        AuditRow(at=a.at, actor=a.actor, event=a.event, category=a.category, status=a.status, project_id=pid, ip=a.ip)
        for a, pid in rows
    ]
