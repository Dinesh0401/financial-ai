from __future__ import annotations

from datetime import date
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.config.constants import GoalType


class _DecimalAsFloat(BaseModel):
    model_config = ConfigDict(json_encoders={Decimal: float})


class GoalCreateRequest(BaseModel):
    goal_type: GoalType
    title: str = Field(min_length=1, max_length=255)
    target_amount: Decimal = Field(gt=0)
    timeline_months: int = Field(gt=0, le=600)
    current_amount: Decimal = Field(default=Decimal("0.00"), ge=0)


class GoalResponse(_DecimalAsFloat):
    model_config = ConfigDict(from_attributes=True, json_encoders={Decimal: float})

    goal_id: UUID
    title: str
    goal_type: GoalType
    target_amount: Decimal
    current_amount: Decimal
    timeline_months: int
    target_date: date
    monthly_required: Decimal | None = None
    success_probability: Decimal | None = None
    status: str


class GoalCreateResponse(_DecimalAsFloat):
    goal: GoalResponse
    monthly_required: Decimal
    success_probability: float
    simulation: dict


class GoalListResponse(BaseModel):
    goals: list[GoalResponse]


class GoalPredictionResponse(_DecimalAsFloat):
    goal: GoalResponse
    on_track: bool
    months_remaining: int
    projected_amount: Decimal
    success_probability: float
    recommended_adjustments: list[str]
