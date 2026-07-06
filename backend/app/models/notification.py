import uuid
from datetime import datetime

from sqlalchemy import String, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class NotificationHistory(Base):
    __tablename__ = "notification_history"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    notification_type: Mapped[str] = mapped_column(String(50), nullable=False)  # email, sms
    subject: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(50), nullable=False)  # sent, failed
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
