"""
Phase 0 smoke tests.

These verify that:
1. The goldgoal package imports without errors.
2. The FastAPI app starts and the health/ready endpoints return 200.
3. The errors module exports the right exception classes.
4. The security module can hash and verify a password.

No database writes happen — these are purely structural checks.
"""

from goldgoal.main import create_app
from goldgoal.errors import (
    ValidationError,
    AuthenticationError,
    UnauthorizedError,
    ConflictError,
    NotFoundError,
    PriceUnavailableError,
)
from goldgoal.security import hash_password, verify_password, new_session_token, SESSION_TTL
from datetime import timedelta


# ── App factory ──────────────────────────────────────────────────────────────

def test_app_creates_without_error():
    """create_app() should return a FastAPI instance."""
    app = create_app()
    assert app is not None
    assert app.title == "GoldGoal API"


def test_health_endpoint(client):
    """/health should return 200 with status ok."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_ready_endpoint(client):
    """/ready should return 200 with status ready."""
    response = client.get("/ready")
    assert response.status_code == 200
    assert response.json() == {"status": "ready"}


# ── Error classes ─────────────────────────────────────────────────────────────

def test_validation_error_carries_field():
    err = ValidationError(field="grams", message="must be positive")
    assert err.field == "grams"
    assert "grams" in str(err)


def test_authentication_error_message_is_generic():
    """Both wrong-email and wrong-password must raise the SAME message."""
    err = AuthenticationError()
    assert err.args[0] == AuthenticationError.MESSAGE


def test_unauthorized_error_message():
    err = UnauthorizedError()
    assert err.args[0] == UnauthorizedError.MESSAGE


# ── Security ─────────────────────────────────────────────────────────────────

def test_hash_is_not_plaintext():
    hashed = hash_password("securepass123")
    assert hashed != "securepass123"


def test_verify_correct_password():
    hashed = hash_password("securepass123")
    assert verify_password("securepass123", hashed) is True


def test_verify_wrong_password():
    hashed = hash_password("securepass123")
    assert verify_password("wrongpassword", hashed) is False


def test_two_hashes_of_same_password_differ():
    """bcrypt uses a random salt — same input must produce different hashes."""
    h1 = hash_password("securepass123")
    h2 = hash_password("securepass123")
    assert h1 != h2


def test_session_token_is_string_of_reasonable_length():
    token = new_session_token()
    assert isinstance(token, str)
    assert len(token) >= 40      # 32 bytes base64-encoded ≈ 43 chars


def test_two_session_tokens_differ():
    """Tokens must be unique — never reuse a token."""
    assert new_session_token() != new_session_token()


def test_session_ttl_is_24_hours():
    assert SESSION_TTL == timedelta(hours=24)
