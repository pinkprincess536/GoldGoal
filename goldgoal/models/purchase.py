"""
ORM model for the Purchase table.

Purchases are immutable after creation — there is no updated_at column.
Each record belongs to exactly one User and tracks a gold investment
across three asset types: PHYSICAL_GOLD, GOLD_ETF, or SOVEREIGN_GOLD_BOND.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    Date,
    DateTime,
    Index,
    Numeric,
    String,
    ForeignKey,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

from goldgoal.db.session import Base


def _uuid_col(**kwargs):
    """Return a UUID column that works for both SQLite and PostgreSQL."""
    return Column(
        PG_UUID(as_uuid=True),
        **kwargs,
    )


class Purchase(Base):
    """
    Represents a single gold investment purchase made by a User.

    Asset-type-specific fields
    --------------------------
    PHYSICAL_GOLD   : grams, price_per_gram
    GOLD_ETF        : units, price_per_unit, grams_per_unit
    SOVEREIGN_GOLD_BOND : units, price_per_unit

    Fields not applicable to a given asset type are stored as NULL.
    Purchases are append-only; no field may be modified after creation.
    """

    __tablename__ = "purchases"

    # ------------------------------------------------------------------ #
    #  Primary key                                                         #
    # ------------------------------------------------------------------ #
    id = _uuid_col(primary_key=True, default=uuid.uuid4, nullable=False)

    # ------------------------------------------------------------------ #
    #  Ownership                                                           #
    # ------------------------------------------------------------------ #
    user_id = _uuid_col(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # ------------------------------------------------------------------ #
    #  Asset type                                                          #
    # ------------------------------------------------------------------ #
    asset_type = Column(String(30), nullable=False)

    # ------------------------------------------------------------------ #
    #  PHYSICAL_GOLD fields                                                #
    # ------------------------------------------------------------------ #
    grams = Column(Numeric(18, 4), nullable=True)
    price_per_gram = Column(Numeric(18, 2), nullable=True)

    # ------------------------------------------------------------------ #
    #  GOLD_ETF / SOVEREIGN_GOLD_BOND fields                              #
    # ------------------------------------------------------------------ #
    units = Column(Numeric(18, 4), nullable=True)
    price_per_unit = Column(Numeric(18, 2), nullable=True)

    # ------------------------------------------------------------------ #
    #  GOLD_ETF-only field                                                 #
    # ------------------------------------------------------------------ #
    grams_per_unit = Column(Numeric(18, 6), nullable=True)

    # ------------------------------------------------------------------ #
    #  Common fields                                                       #
    # ------------------------------------------------------------------ #
    purchase_date = Column(Date, nullable=False)
    source_notes = Column(String(500), nullable=True)

    created_at = Column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    # ------------------------------------------------------------------ #
    #  Indexes                                                             #
    # ------------------------------------------------------------------ #
    __table_args__ = (
        # Supports list-purchases sorted by purchase_date DESC, created_at DESC
        # for a given user, matching Requirement 4.1.
        Index(
            "ix_purchases_user_date_created",
            "user_id",
            "purchase_date",
            "created_at",
            postgresql_ops={
                "purchase_date": "DESC",
                "created_at": "DESC",
            },
        ),
    )

    def __repr__(self) -> str:
        return (
            f"<Purchase id={self.id} user_id={self.user_id} "
            f"asset_type={self.asset_type} purchase_date={self.purchase_date}>"
        )
