import uuid
from datetime import datetime
from sqlalchemy import String, Numeric, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from database import Base


class Goal(Base):
    __tablename__ = "goals"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String, nullable=False)
    target_amount: Mapped[float | None] = mapped_column(Numeric(12, 2))
    current_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    deadline_years: Mapped[float | None] = mapped_column(Numeric(4, 1))
    priority: Mapped[str] = mapped_column(String, default="medium")
    probability: Mapped[float | None] = mapped_column(Numeric(5, 2))
    status: Mapped[str] = mapped_column(String, default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
