from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.config.database import get_db
from app.models.user import User
from app.schemas.chat import ChatRequest
from app.services.copilot_service import CopilotService

router = APIRouter(prefix="/chat", tags=["chat"])


def get_copilot_service(request: Request) -> CopilotService:
    return request.app.state.copilot_service


@router.post("")
async def chat(
    payload: ChatRequest,
    session: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    service: CopilotService = Depends(get_copilot_service),
) -> StreamingResponse:
    generator = service.stream_chat(
        session=session,
        user=user,
        message=payload.message,
        session_id=str(payload.session_id) if payload.session_id else None,
    )
    return StreamingResponse(generator, media_type="text/event-stream")
