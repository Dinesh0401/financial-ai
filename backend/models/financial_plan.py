import uuid
from datetime import datetime
from sqlalchemy import String, Numeric, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID, JSONB
from database import Base


class FinancialPlan(Base):
    __tablename__ = "financial_plans"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"))
    health_score: Mapped[float | None] = mapped_column(Numeric(5, 2))
    plan_json: Mapped[dict | None] = mapped_column(JSONB)
    conflict_resolved: Mapped[str | None] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
