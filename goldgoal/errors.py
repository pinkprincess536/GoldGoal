"""
Domain exception hierarchy for GoldGoal.

Every service raises one of these typed exceptions.
The FastAPI app factory (main.py) maps each exception type to the
correct HTTP status code and JSON envelope — services never deal with
HTTP status codes directly.

Exception hierarchy:
    GoldGoalError
    ├── ValidationError       → 400  (invalid field value)
    ├── AuthenticationError   → 401  (wrong credentials)
    ├── UnauthorizedError     → 401  (missing/expired/revoked session)
    ├── ConflictError         → 409  (duplicate resource, e.g. email)
    ├── NotFoundError         → 404  (record missing or owned by another user)
    └── PriceUnavailableError → 200  (soft error: no gold price in DB yet)
"""


class GoldGoalError(Exception):
    """Base class for all GoldGoal domain errors."""


class ValidationError(GoldGoalError):
    """
    A submitted field value violates a business rule.

    field: the name of the offending field (e.g. "grams", "purchase_date")
    message: human-readable reason
    """
    def __init__(self, field: str, message: str):
        self.field = field
        self.message = message
        super().__init__(f"Validation error on '{field}': {message}")


class AuthenticationError(GoldGoalError):
    """
    Login failed — wrong email or wrong password.

    The message is intentionally generic so callers cannot tell
    whether the email exists (prevents user enumeration).
    """
    MESSAGE = "Invalid email or password"

    def __init__(self):
        super().__init__(self.MESSAGE)


class UnauthorizedError(GoldGoalError):
    """
    Request carries no valid session token (missing, expired, or revoked).
    """
    MESSAGE = "Authentication required"

    def __init__(self):
        super().__init__(self.MESSAGE)


class ConflictError(GoldGoalError):
    """
    Resource already exists (e.g. email address already registered).
    """
    def __init__(self, message: str = "Resource already exists"):
        self.message = message
        super().__init__(message)


class NotFoundError(GoldGoalError):
    """
    Record does not exist, or belongs to a different user.

    Ownership violations are deliberately indistinguishable from
    "not found" to prevent cross-user enumeration attacks.
    """
    def __init__(self, message: str = "Resource not found"):
        self.message = message
        super().__init__(message)


class PriceUnavailableError(GoldGoalError):
    """
    No gold price record exists in the database yet.

    This is a soft error — the app is functional, just missing price data.
    Portfolio values and goal calculations will return null for price-dependent
    fields and include a price_available=False indicator.
    """
    MESSAGE = "Gold price data is not yet available"

    def __init__(self):
        super().__init__(self.MESSAGE)
