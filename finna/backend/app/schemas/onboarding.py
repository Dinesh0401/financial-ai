from __future__ import annotations

from typing import Annotated, Any

from pydantic import BaseModel, ConfigDict, Field, StrictStr


NonNegativeFloat = Annotated[float, Field(ge=0, le=10_000_000_000, strict=False)]
RateFloat = Annotated[float, Field(ge=0, le=100, strict=False)]
YearsFloat = Annotated[float, Field(ge=0, le=60, strict=False)]
ShortStr = Annotated[str, Field(max_length=80)]
PriorityStr = Annotated[str, Field(pattern="^(high|medium|low)$")]


class OnboardingLoanPayload(BaseModel):
    model_config = ConfigDict(extra="ignore", str_strip_whitespace=True)

    type: ShortStr
    name: ShortStr | None = None
    balance: NonNegativeFloat = 0
    emi: NonNegativeFloat = 0
    interest: RateFloat = 0


class OnboardingGoalPayload(BaseModel):
    model_config = ConfigDict(extra="ignore", str_strip_whitespace=True)

    type: ShortStr
    name: ShortStr | None = None
    targetAmount: NonNegativeFloat = 0
    years: YearsFloat = 1
    priority: PriorityStr | None = None


class OnboardingSnapshotPayload(BaseModel):
    model_config = ConfigDict(extra="ignore")

    income: NonNegativeFloat = 0
    expenses: dict[StrictStr, NonNegativeFloat] = Field(default_factory=dict)
    loans: list[OnboardingLoanPayload] = Field(default_factory=list, max_length=20)
    goals: list[OnboardingGoalPayload] = Field(default_factory=list, max_length=20)
    version: int = 1


class OnboardingSnapshotMergePayload(BaseModel):
    """Partial update — only fields provided are overwritten."""

    model_config = ConfigDict(extra="ignore")

    income: NonNegativeFloat | None = None
    expenses: dict[StrictStr, NonNegativeFloat] | None = None
    loans: list[OnboardingLoanPayload] | None = None
    goals: list[OnboardingGoalPayload] | None = None


class OnboardingSnapshotResponse(BaseModel):
    snapshot: dict[str, Any] | None = None
    saved_at: str | None = None
    version: int = 1
