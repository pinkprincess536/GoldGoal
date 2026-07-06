"""
Security utilities: password hashing and session token generation.

Why bcrypt?
- Deliberately slow — makes brute-force attacks expensive.
- Per-password random salt is embedded in the hash automatically.
  Two hashes of the same password will look completely different.
- Industry standard for password storage.

Why secrets.token_urlsafe?
- Cryptographically random (uses os.urandom under the hood).
- URL-safe base64 encoding — safe to put in HTTP headers.
- 32 bytes → 43-character string → 256 bits of entropy.
  Impossible to guess by brute force.
"""

import secrets
import bcrypt as _bcrypt
from datetime import timedelta

# How long a session token stays valid after issuance.
# Stored as a module constant so tests can reference it directly.
SESSION_TTL = timedelta(hours=24)


def hash_password(password: str) -> str:
    """
    Hash a plain-text password using bcrypt.

    Returns a string like:
        $2b$12$<22-char salt><31-char hash>

    The salt is embedded — you don't need to store it separately.
    Never store or log the original password.
    """
    return _bcrypt.hashpw(password.encode(), _bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str) -> bool:
    """
    Check whether a plain-text password matches a stored bcrypt hash.

    Returns True if they match, False otherwise.
    Never raises — comparison failures return False.
    """
    try:
        return _bcrypt.checkpw(password.encode(), password_hash.encode())
    except Exception:
        return False


def new_session_token() -> str:
    """
    Generate a new cryptographically random session token.

    Example output: "W6Tz3p9Q_mRkXoJ2vYnF8cA1LhBdEiNs5uCgPwUeVZ4"
    Each call produces a different value — tokens are never reused.
    """
    return secrets.token_urlsafe(32)
