from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import Date, DateTime, Enum as SQLEnum, ForeignKey, Index, Integer, Numeric, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import String

from app.config.constants import GoalStatus, GoalType
from app.models.base import Base, JSONType, UUIDType


class Goal(Base):
    __tablename__ = "goals"
    __table_args__ = (
        Index("idx_goals_user", "user_id", "status"),
    )

    goal_id: Mapped[UUID] = mapped_column(
        UUIDType(),
        primary_key=True,
        default=uuid4,
    )
    user_id: Mapped[UUID] = mapped_column(
        UUIDType(),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    goal_type: Mapped[GoalType] = mapped_column(
        SQLEnum(
            GoalType,
            name="goal_type",
            values_callable=lambda enum_cls: [item.value for item in enum_cls],
        ),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    target_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    current_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False, default=Decimal("0"))
    timeline_months: Mapped[int] = mapped_column(Integer, nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False, default=date.today)
    target_date: Mapped[date] = mapped_column(Date, nullable=False)
    monthly_required: Mapped[Decimal | None] = mapped_column(Numeric(15, 2), nullable=True)
    success_probability: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    status: Mapped[GoalStatus] = mapped_column(
        SQLEnum(
            GoalStatus,
            name="goal_status",
            values_callable=lambda enum_cls: [item.value for item in enum_cls],
        ),
        nullable=False,
        default=GoalStatus.ACTIVE,
    )
    simulation_data: Mapped[dict | None] = mapped_column(JSONType, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
