from fastapi import APIRouter

from app.api.v1.analysis import router as analysis_router
from app.api.v1.auth import router as auth_router
from app.api.v1.chat import router as chat_router
from app.api.v1.dashboard import router as dashboard_router
from app.api.v1.goals import router as goals_router
from app.api.v1.onboarding import router as onboarding_router
from app.api.v1.transactions import router as transactions_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(transactions_router)
api_router.include_router(analysis_router)
api_router.include_router(goals_router)
api_router.include_router(dashboard_router)
api_router.include_router(chat_router)
api_router.include_router(onboarding_router)
