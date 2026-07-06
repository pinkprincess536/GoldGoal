"""
User ORM model.

Represents a registered GoldGoal user. Email is stored lowercase
via the @validates decorator to enforce case-insensitive uniqueness
at the application layer (complementing the unique index on the column).
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Index, String
from sqlalchemy.orm import validates

from goldgoal.db.session import Base


def _utcnow() -> datetime:
    """Return the current UTC datetime (timezone-aware)."""
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id = Column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
        nullable=False,
    )
    email = Column(
        String(320),
        unique=True,
        nullable=False,
        index=True,
    )
    password_hash = Column(String(255), nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=_utcnow,
    )

    # Enforce lowercase on every assign/update so the unique index
    # behaves as a case-insensitive constraint (lowercase convention).
    @validates("email")
    def _lowercase_email(self, key: str, value: str) -> str:
        if value is None:
            return value
        return value.lower()

    def __repr__(self) -> str:  # pragma: no cover
        return f"<User id={self.id!r} email={self.email!r}>"


# Explicit unique index on email — redundant with unique=True above but
# makes the case-insensitive-by-convention guarantee self-documenting and
# gives DDL control if a future migration needs to swap this for a
# functional (LOWER(email)) index on PostgreSQL.
_email_unique_idx = Index("ix_users_email_lower", User.email, unique=True)
