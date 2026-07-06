"""
ORM model for the session_tokens table.

Each row represents an issued authentication token for a user.
Tokens can be revoked before expiry by setting revoked_at.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from goldgoal.db.session import Base


class SessionToken(Base):
    """Persisted bearer token linked to a user account."""

    __tablename__ = "session_tokens"

    # Primary key: the raw token string (hex, JWT, etc.)
    token: Mapped[str] = mapped_column(String(64), primary_key=True)

    # Owner of this token — FK to the users table
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,          # fast look-up of all tokens for a given user
    )

    # Timestamps (all stored as UTC)
    issued_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )
    revoked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        default=None,
    )

    # Explicit named index on user_id (supplements the inline index=True above)
    __table_args__ = (
        Index("ix_session_tokens_user_id", "user_id"),
    )

    def __repr__(self) -> str:
        return (
            f"<SessionToken token={self.token!r} user_id={self.user_id} "
            f"expires_at={self.expires_at} revoked={'yes' if self.revoked_at else 'no'}>"
        )
