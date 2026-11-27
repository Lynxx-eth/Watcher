"""Password / PIN hashing (argon2id) and session-token helpers."""

import hashlib
import secrets

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

_hasher = PasswordHasher()  # argon2id with library defaults (OWASP-compliant)

# Verified against when a project ID doesn't exist, so a miss costs the
# same time as a wrong PIN and IDs can't be enumerated by timing.
_DUMMY_HASH = _hasher.hash("watcher-dummy-secret")


def hash_secret(secret: str) -> str:
    return _hasher.hash(secret)


def verify_secret(stored_hash: str | None, secret: str) -> bool:
    try:
        return _hasher.verify(stored_hash or _DUMMY_HASH, secret) and stored_hash is not None
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def new_session_token() -> str:
    """Raw token goes in the httpOnly cookie; only its SHA-256 is stored."""
    return secrets.token_urlsafe(32)


def token_digest(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()
