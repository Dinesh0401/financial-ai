from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_auth_service, get_current_user
from app.config.database import get_db
from app.models.user import User
from app.schemas.auth import (
    AuthSessionResponse,
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    UpdateProfileRequest,
    UserResponse,
)
from app.services.auth_service import SupabaseAuthService

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=AuthSessionResponse, status_code=status.HTTP_201_CREATED)
async def register(
    payload: RegisterRequest,
    session: AsyncSession = Depends(get_db),
    auth_service: SupabaseAuthService = Depends(get_auth_service),
) -> AuthSessionResponse:
    auth_session = await auth_service.register(name=payload.name, email=str(payload.email), password=payload.password)
    profile = await auth_service.ensure_profile(
        session,
        identity=auth_session.user,
        fallback_name=payload.name,
    )
    return AuthSessionResponse(
        user_id=auth_session.user.id,
        access_token=auth_session.access_token,
        refresh_token=auth_session.refresh_token,
        token_type=auth_session.token_type,
        expires_in=auth_session.expires_in,
        user=UserResponse.model_validate(profile),
    )


@router.post("/login", response_model=AuthSessionResponse)
async def login(
    payload: LoginRequest,
    session: AsyncSession = Depends(get_db),
    auth_service: SupabaseAuthService = Depends(get_auth_service),
) -> AuthSessionResponse:
    auth_session = await auth_service.login(email=str(payload.email), password=payload.password)
    profile = await auth_service.ensure_profile(session, identity=auth_session.user)
    return AuthSessionResponse(
        user_id=auth_session.user.id,
        access_token=auth_session.access_token,
        refresh_token=auth_session.refresh_token,
        token_type=auth_session.token_type,
        expires_in=auth_session.expires_in,
        user=UserResponse.model_validate(profile),
    )


@router.post("/refresh", response_model=AuthSessionResponse)
async def refresh(
    payload: RefreshRequest,
    session: AsyncSession = Depends(get_db),
    auth_service: SupabaseAuthService = Depends(get_auth_service),
) -> AuthSessionResponse:
    auth_session = await auth_service.refresh(refresh_token=payload.refresh_token)
    profile = await auth_service.ensure_profile(session, identity=auth_session.user)
    return AuthSessionResponse(
        user_id=auth_session.user.id,
        access_token=auth_session.access_token,
        refresh_token=auth_session.refresh_token,
        token_type=auth_session.token_type,
        expires_in=auth_session.expires_in,
        user=UserResponse.model_validate(profile),
    )


@router.get("/me", response_model=UserResponse)
async def me(user: User = Depends(get_current_user)) -> UserResponse:
    """Return the current authenticated user's profile. Used by OAuth callback to sync."""
    return UserResponse.model_validate(user)


@router.patch("/me", response_model=UserResponse)
async def update_me(
    payload: UpdateProfileRequest,
    session: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> UserResponse:
    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(user, field, value)

    await session.flush()
    await session.refresh(user)
    return UserResponse.model_validate(user)
