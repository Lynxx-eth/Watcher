import secrets

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Profile

# Random numeric IDs: a fixed-length string of digits, hard to guess so one
# owner can't stumble onto another's ID. The ID is an identifier, not a secret —
# the PIN is the secret — but randomising it removes any guessable structure
# (no year, no running count). Uniqueness is guaranteed by a DB check plus the
# UNIQUE index on profiles.project_id as the final guard.
ID_DIGITS = 12


def _random_id() -> str:
    # 12 digits → 10**12 space; first digit forced non-zero so length is stable.
    first = secrets.choice("123456789")
    rest = "".join(secrets.choice("0123456789") for _ in range(ID_DIGITS - 1))
    return first + rest


def next_project_id(db: Session) -> str:
    """Return a fresh, unique random numeric project ID."""
    for _ in range(50):
        pid = _random_id()
        if db.scalar(select(Profile.id).where(Profile.project_id == pid)) is None:
            return pid
    # Astronomically unlikely with a 10**12 space; fail loudly rather than loop.
    raise RuntimeError("could not allocate a unique project ID")
