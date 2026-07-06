"""
Goal ORM model.

Represents a user's gold accumulation goal. Each goal captures:
- target_grams:            how many grams the user wants to accumulate
- target_date:             the date by which they want to reach the target
- current_holdings_grams:  grams already held (snapshot; portfolio service
                            uses purchase history as the live figure)
- monthly_budget_inr:      how much (INR) the user can invest per month

Constraints are enforced at the DB level via CHECK constraints so that
they hold even if rows are modified outside the ORM.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    CheckConstraint,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
)

from goldgoal.db.session import Base


def _utcnow() -> datetime:
    """Return the current UTC datetime (timezone-aware)."""
    return datetime.now(timezone.utc)


class Goal(Base):
    __tablename__ = "goals"

    id = Column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
        nullable=False,
    )
    user_id = Column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # How many grams the user wants to accumulate — must be strictly positive.
    target_grams = Column(
        Numeric(18, 4),
        nullable=False,
    )
    # Deadline for reaching the target.
    target_date = Column(
        Date,
        nullable=False,
    )
    # Grams already held at the time the goal was created/last updated.
    current_holdings_grams = Column(
        Numeric(18, 4),
        nullable=False,
    )
    # Monthly savings budget in INR — zero is allowed (read-only tracker).
    monthly_budget_inr = Column(
        Numeric(18, 2),
        nullable=False,
    )
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=_utcnow,
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=_utcnow,
        onupdate=_utcnow,
    )

    # DB-level CHECK constraints — enforce invariants independent of the ORM.
    __table_args__ = (
        CheckConstraint("target_grams > 0", name="ck_goals_target_grams_positive"),
        CheckConstraint(
            "current_holdings_grams >= 0",
            name="ck_goals_current_holdings_grams_non_negative",
        ),
        CheckConstraint(
            "monthly_budget_inr >= 0",
            name="ck_goals_monthly_budget_inr_non_negative",
        ),
        # Explicit index on user_id for fast per-user goal queries.
        Index("ix_goals_user_id", "user_id"),
    )

    def __repr__(self) -> str:  # pragma: no cover
        return (
            f"<Goal id={self.id!r} user_id={self.user_id!r} "
            f"target_grams={self.target_grams!r} target_date={self.target_date!r}>"
        )
