from __future__ import annotations

from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.config.database import get_db
from app.errors import AppError
from app.models.user import User
from app.schemas.goal import GoalCreateRequest, GoalCreateResponse, GoalListResponse, GoalPredictionResponse, GoalResponse
from app.services.goal_service import GoalService

router = APIRouter(prefix="/goals", tags=["goals"])


def get_goal_service() -> GoalService:
    return GoalService()


@router.post("", response_model=GoalCreateResponse, status_code=201)
async def create_goal(
    payload: GoalCreateRequest,
    session: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    service: GoalService = Depends(get_goal_service),
) -> GoalCreateResponse:
    goal, simulation = await service.create_goal(session=session, user=user, payload=payload.model_dump())
    return GoalCreateResponse(
        goal=GoalResponse.model_validate(goal),
        monthly_required=goal.monthly_required or 0,
        success_probability=float(goal.success_probability or 0),
        simulation=simulation,
    )


@router.get("", response_model=GoalListResponse)
async def list_goals(
    session: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    service: GoalService = Depends(get_goal_service),
) -> GoalListResponse:
    goals = await service.list_goals(session=session, user=user)
    return GoalListResponse(goals=[GoalResponse.model_validate(goal) for goal in goals])


@router.delete("/{goal_id}", status_code=204)
async def delete_goal(
    goal_id: str,
    session: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    service: GoalService = Depends(get_goal_service),
) -> Response:
    deleted = await service.delete_goal(session=session, user=user, goal_id=goal_id)
    if not deleted:
        raise AppError(status_code=404, title="Not found", detail="Goal not found.")
    return Response(status_code=204)


@router.get("/{goal_id}/prediction", response_model=GoalPredictionResponse)
async def predict_goal(
    goal_id: str,
    session: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    service: GoalService = Depends(get_goal_service),
) -> GoalPredictionResponse:
    prediction = await service.predict_goal(session=session, user=user, goal_id=goal_id)
    if prediction is None:
        raise AppError(status_code=404, title="Not found", detail="Goal not found.")
    return GoalPredictionResponse(
        goal=GoalResponse.model_validate(prediction["goal"]),
        on_track=prediction["on_track"],
        months_remaining=prediction["months_remaining"],
        projected_amount=prediction["projected_amount"],
        success_probability=prediction["success_probability"],
        recommended_adjustments=prediction["recommended_adjustments"],
    )

