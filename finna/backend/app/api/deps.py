from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Header, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.database import get_db
from app.errors import AppError
from app.models.user import User
from app.services.auth_service import SupabaseAuthService


def get_auth_service(request: Request) -> SupabaseAuthService:
    return request.app.state.auth_service


def _extract_bearer_token(authorization: str | None) -> str:
    if not authorization:
        raise AppError(status_code=401, title="Unauthorized", detail="Missing Authorization header.")
    prefix, _, token = authorization.partition(" ")
    if prefix.lower() != "bearer" or not token:
        raise AppError(status_code=401, title="Unauthorized", detail="Authorization header must use Bearer token.")
    return token


async def get_current_user(
    authorization: Annotated[str | None, Header(alias="Authorization")] = None,
    session: AsyncSession = Depends(get_db),
    auth_service: SupabaseAuthService = Depends(get_auth_service),
) -> User:
    token = _extract_bearer_token(authorization)
    identity = await auth_service.get_user(token)
    return await auth_service.ensure_profile(session, identity=identity)

