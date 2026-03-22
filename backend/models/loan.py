import uuid
from datetime import datetime
from sqlalchemy import String, Numeric, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from database import Base


class Loan(Base):
    __tablename__ = "loans"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"))
    loan_type: Mapped[str | None] = mapped_column(String)
    outstanding: Mapped[float | None] = mapped_column(Numeric(12, 2))
    annual_rate: Mapped[float | None] = mapped_column(Numeric(5, 2))
    monthly_emi: Mapped[float | None] = mapped_column(Numeric(10, 2))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
