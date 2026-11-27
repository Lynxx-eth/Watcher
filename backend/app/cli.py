"""
Management commands:

    python -m app.cli seed-demo        # create/refresh the fictional demo profile
    python -m app.cli create-admin     # create an admin account (prompts for password)
    python -m app.cli geocode-pending  # resolve coordinates for profiles not yet geocoded
    python -m app.cli purge-sessions   # delete expired sessions (run on a schedule)
"""

import getpass
import sys

from sqlalchemy import select

from app.core.config import get_settings
from app.database.session import SessionLocal
from app.models import AdminUser
from app.security.hashing import hash_secret
from app.services.seed import seed_demo


def cmd_seed_demo() -> None:
    with SessionLocal() as db:
        p = seed_demo(db, get_settings())
        print(f"Demo profile ready: {p.project_id}")


def cmd_create_admin() -> None:
    username = input("Admin username: ").strip()
    if not username:
        sys.exit("Username required.")
    pw = getpass.getpass("Password (min 12 chars): ")
    if len(pw) < 12:
        sys.exit("Password must be at least 12 characters.")
    if pw != getpass.getpass("Repeat password: "):
        sys.exit("Passwords do not match.")
    with SessionLocal() as db:
        if db.scalar(select(AdminUser).where(AdminUser.username == username)):
            sys.exit("That username already exists.")
        db.add(AdminUser(username=username, password_hash=hash_secret(pw), role="owner"))
        db.commit()
    print(f"Admin '{username}' created.")


def cmd_purge_sessions() -> None:
    """Delete expired client + admin sessions (safe to run on a schedule, e.g. hourly cron)."""
    from app.services.maintenance import purge_expired_sessions

    with SessionLocal() as db:
        clients, admins = purge_expired_sessions(db)
        print(f"Purged {clients} client and {admins} admin session(s).")


def cmd_geocode_pending() -> None:
    """Geocode every profile whose location hasn't been attempted yet (throttled to 1 req/s)."""
    from app.models import Profile, ProfileLocation
    from app.services.geocode import geocode_profile

    with SessionLocal() as db:
        rows = db.scalars(select(Profile).join(ProfileLocation).where(ProfileLocation.geocoded_at.is_(None))).all()
        for p in rows:
            ok = geocode_profile(db, get_settings(), p)
            print(f"{p.project_id}: {'located' if ok else 'unavailable'}")
        print(f"{len(rows)} profile(s) processed.")


COMMANDS = {
    "seed-demo": cmd_seed_demo,
    "create-admin": cmd_create_admin,
    "geocode-pending": cmd_geocode_pending,
    "purge-sessions": cmd_purge_sessions,
}

if __name__ == "__main__":
    if len(sys.argv) != 2 or sys.argv[1] not in COMMANDS:
        sys.exit(f"usage: python -m app.cli [{' | '.join(COMMANDS)}]")
    COMMANDS[sys.argv[1]]()
