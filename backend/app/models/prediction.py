import uuid
from datetime import datetime

from sqlalchemy import String, Float, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Prediction(Base):
    __tablename__ = "predictions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    prediction_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    target_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    predicted_price: Mapped[float] = mapped_column(Float, nullable=False)
    model: Mapped[str] = mapped_column(String(50), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
