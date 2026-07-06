"""
ORM model for the gold_prices table.

Stores daily gold price data ingested from external sources (e.g. GoldAPI.io).
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import CheckConstraint, Column, DateTime, Date, Index, Numeric, String

from goldgoal.db.session import Base


class GoldPrice(Base):
    __tablename__ = "gold_prices"

    id = Column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
        nullable=False,
    )
    price_date = Column(Date, nullable=False)
    price_per_gram = Column(
        Numeric(18, 2),
        nullable=False,
    )
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        CheckConstraint("price_per_gram >= 0", name="ck_gold_prices_price_per_gram_non_negative"),
        Index("ix_gold_prices_price_date_created_at", price_date.desc(), created_at.desc()),
    )

    def __repr__(self) -> str:
        return (
            f"<GoldPrice id={self.id!r} price_date={self.price_date!r} "
            f"price_per_gram={self.price_per_gram!r}>"
        )
