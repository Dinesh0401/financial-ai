import uuid
from datetime import datetime
from sqlalchemy import String, Numeric, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    name: Mapped[str | None] = mapped_column(String)
    monthly_income: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    risk_tolerance: Mapped[str] = mapped_column(String, default="moderate")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
