from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, Enum as SQLEnum, ForeignKey, Index, Integer, func
from sqlalchemy.orm import Mapped, mapped_column

from app.config.constants import RiskLevel
from app.models.base import Base, JSONType, UUIDType


class AnalysisResult(Base):
    __tablename__ = "analysis_results"
    __table_args__ = (
        Index("idx_analysis_user", "user_id", "created_at"),
    )

    analysis_id: Mapped[UUID] = mapped_column(
        UUIDType(),
        primary_key=True,
        default=uuid4,
    )
    user_id: Mapped[UUID] = mapped_column(
        UUIDType(),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    financial_score: Mapped[int] = mapped_column(Integer, nullable=False)
    risk_level: Mapped[RiskLevel] = mapped_column(
        SQLEnum(
            RiskLevel,
            name="risk_level",
            values_callable=lambda enum_cls: [item.value for item in enum_cls],
        ),
        nullable=False,
    )
    metrics: Mapped[dict] = mapped_column(JSONType, nullable=False, default=dict)
    recommendations: Mapped[list] = mapped_column(JSONType, nullable=False, default=list)
    agent_traces: Mapped[dict | None] = mapped_column(JSONType, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
