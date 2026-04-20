from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.config.database import get_db
from app.errors import AppError
from app.models.user import User
from app.schemas.onboarding import (
    OnboardingSnapshotMergePayload,
    OnboardingSnapshotPayload,
    OnboardingSnapshotResponse,
)

router = APIRouter(prefix="/onboarding", tags=["onboarding"])

SCHEMA_VERSION = 1


def _normalize_snapshot(raw: dict) -> dict:
    return {
        "income": float(raw.get("income", 0) or 0),
        "expenses": {
            str(k): float(v or 0)
            for k, v in (raw.get("expenses") or {}).items()
            if isinstance(v, (int, float))
        },
        "loans": [
            {
                "type": str(loan.get("type", "")),
                "name": str(loan.get("name") or "") or None,
                "balance": float(loan.get("balance") or 0),
                "emi": float(loan.get("emi") or 0),
                "interest": float(loan.get("interest") or 0),
            }
            for loan in (raw.get("loans") or [])
        ],
        "goals": [
            {
                "type": str(goal.get("type", "")),
                "name": str(goal.get("name") or "") or None,
                "targetAmount": float(goal.get("targetAmount") or 0),
                "years": float(goal.get("years") or 1),
                "priority": goal.get("priority"),
            }
            for goal in (raw.get("goals") or [])
        ],
        "version": int(raw.get("version") or SCHEMA_VERSION),
    }


@router.get("/snapshot", response_model=OnboardingSnapshotResponse)
async def get_snapshot(
    user: User = Depends(get_current_user),
) -> OnboardingSnapshotResponse:
    snap = user.onboarding_snapshot or None
    if not isinstance(snap, dict):
        return OnboardingSnapshotResponse(snapshot=None, saved_at=None, version=SCHEMA_VERSION)
    saved_at = snap.get("savedAt") if isinstance(snap, dict) else None
    return OnboardingSnapshotResponse(
        snapshot=snap,
        saved_at=saved_at,
        version=int(snap.get("version") or SCHEMA_VERSION),
    )


@router.post("/snapshot", response_model=OnboardingSnapshotResponse)
async def save_snapshot(
    payload: OnboardingSnapshotPayload,
    session: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> OnboardingSnapshotResponse:
    if payload.income <= 0:
        raise AppError(
            status_code=422,
            title="Invalid snapshot",
            detail="Monthly income must be greater than zero.",
        )
    now_iso = datetime.now(timezone.utc).isoformat()
    snap: dict = {
        "income": payload.income,
        "expenses": dict(payload.expenses or {}),
        "loans": [loan.model_dump() for loan in payload.loans],
        "goals": [goal.model_dump() for goal in payload.goals],
        "version": SCHEMA_VERSION,
        "savedAt": now_iso,
    }
    user.onboarding_snapshot = snap
    user.monthly_income = Decimal(str(payload.income))
    user.onboarding_done = True
    await session.flush()
    return OnboardingSnapshotResponse(snapshot=snap, saved_at=now_iso, version=SCHEMA_VERSION)


@router.patch("/snapshot", response_model=OnboardingSnapshotResponse)
async def merge_snapshot(
    payload: OnboardingSnapshotMergePayload,
    session: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> OnboardingSnapshotResponse:
    existing_raw = user.onboarding_snapshot
    existing = _normalize_snapshot(existing_raw) if isinstance(existing_raw, dict) else {
        "income": 0.0,
        "expenses": {},
        "loans": [],
        "goals": [],
        "version": SCHEMA_VERSION,
    }
    if payload.income is not None:
        existing["income"] = payload.income
        user.monthly_income = Decimal(str(payload.income))
    if payload.expenses is not None:
        merged_expenses = dict(existing.get("expenses", {}))
        merged_expenses.update(payload.expenses)
        existing["expenses"] = merged_expenses
    if payload.loans is not None:
        existing["loans"] = [loan.model_dump() for loan in payload.loans]
    if payload.goals is not None:
        existing["goals"] = [goal.model_dump() for goal in payload.goals]

    if existing["income"] <= 0:
        raise AppError(
            status_code=422,
            title="Invalid snapshot",
            detail="Monthly income must be greater than zero.",
        )

    now_iso = datetime.now(timezone.utc).isoformat()
    existing["version"] = SCHEMA_VERSION
    existing["savedAt"] = now_iso
    user.onboarding_snapshot = existing
    user.onboarding_done = True
    await session.flush()
    return OnboardingSnapshotResponse(snapshot=existing, saved_at=now_iso, version=SCHEMA_VERSION)
