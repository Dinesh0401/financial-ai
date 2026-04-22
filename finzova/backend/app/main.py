from __future__ import annotations

import logging
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.agents.orchestrator import OrchestratorAgent
from app.api.v1.router import api_router
from app.config.database import create_all_tables, dispose_engine
from app.config.settings import get_settings
from app.middleware.error_handler import register_exception_handlers
from app.middleware.rate_limiter import RateLimitMiddleware
from app.middleware.request_logger import RequestLoggerMiddleware
from app.services.analysis_service import AnalysisService
from app.services.auth_service import SupabaseAuthService
from app.services.copilot_service import CopilotService
from app.services.dashboard_service import DashboardService
from app.services.gemini_service import GeminiService

settings = get_settings()


def configure_logging() -> None:
    logging.basicConfig(
        level=getattr(logging, settings.log_level.upper(), logging.INFO),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging()
    await create_all_tables()
    client = httpx.AsyncClient(timeout=settings.request_timeout_seconds)
    gemini = GeminiService(settings=settings, client=client)
    orchestrator = OrchestratorAgent(settings=settings, gemini=gemini)
    analysis_service = AnalysisService(orchestrator=orchestrator)
    app.state.http_client = client
    app.state.gemini = gemini
    app.state.auth_service = SupabaseAuthService(settings=settings, client=client)
    app.state.orchestrator = orchestrator
    app.state.analysis_service = analysis_service
    app.state.dashboard_service = DashboardService(analysis_service=analysis_service)
    app.state.copilot_service = CopilotService(orchestrator=orchestrator, gemini=gemini)
    try:
        yield
    finally:
        await client.aclose()
        await dispose_engine()


app = FastAPI(
    title="Finzova Backend Foundation",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RequestLoggerMiddleware)
app.add_middleware(RateLimitMiddleware, rate_limit_per_minute=settings.rate_limit_per_minute)

register_exception_handlers(app)
app.include_router(api_router, prefix="/v1")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
