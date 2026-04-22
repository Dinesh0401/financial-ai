from __future__ import annotations

from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class RegisterRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=1)


class UpdateProfileRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    monthly_income: Decimal | None = Field(default=None, ge=0)
    tax_regime: Literal["old", "new"] | None = None
    onboarding_done: bool | None = None


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: UUID = Field(validation_alias="id")
    name: str
    email: EmailStr
    monthly_income: Decimal | None = None
    currency: str
    tax_regime: str
    onboarding_done: bool


class AuthSessionResponse(BaseModel):
    user_id: UUID
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int | None = None
    user: UserResponse | None = None
