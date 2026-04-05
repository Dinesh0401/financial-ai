from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.config.database import get_db
from app.models.user import User
from app.schemas.analysis import AnalysisRunRequest, AnalysisRunResponse, HealthScoreResponse, RisksResponse
from app.services.analysis_service import AnalysisService

router = APIRouter(prefix="/analysis", tags=["analysis"])


def get_analysis_service(request: Request) -> AnalysisService:
    return request.app.state.analysis_service


@router.post("/run", response_model=AnalysisRunResponse)
async def run_analysis(
    payload: AnalysisRunRequest,
    session: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    service: AnalysisService = Depends(get_analysis_service),
) -> AnalysisRunResponse:
    analysis = await service.run_analysis(session=session, user=user, force_refresh=payload.force_refresh)
    return AnalysisRunResponse(
        analysis_id=str(analysis.analysis_id),
        financial_score=analysis.financial_score,
        risk_level=analysis.risk_level.value,
        metrics=analysis.metrics,
        recommendations=analysis.recommendations,
        agent_traces=analysis.agent_traces,
    )


@router.get("/health-score", response_model=HealthScoreResponse)
async def get_health_score(
    session: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    service: AnalysisService = Depends(get_analysis_service),
) -> HealthScoreResponse:
    return HealthScoreResponse(**(await service.get_health_score(session=session, user=user)))


@router.get("/risks", response_model=RisksResponse)
async def get_risks(
    session: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    service: AnalysisService = Depends(get_analysis_service),
) -> RisksResponse:
    return RisksResponse(**(await service.get_risks(session=session, user=user)))
