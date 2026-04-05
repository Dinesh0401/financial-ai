from __future__ import annotations

from uuid import UUID

import httpx
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.database import set_current_user
from app.config.settings import Settings
from app.errors import AppError
from app.models.user import User


class AuthenticatedUser(BaseModel):
    id: UUID
    email: EmailStr
    name: str | None = None


class AuthSession(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int | None = None
    user: AuthenticatedUser


class SupabaseAuthService:
    def __init__(self, *, settings: Settings, client: httpx.AsyncClient) -> None:
        self.settings = settings
        self.client = client

    def _headers(self, *, bearer_token: str | None = None) -> dict[str, str]:
        headers = {
            "apikey": self.settings.supabase_anon_key,
            "Content-Type": "application/json",
        }
        if bearer_token:
            headers["Authorization"] = f"Bearer {bearer_token}"
        return headers

    def _translate_error(self, response: httpx.Response) -> AppError:
        try:
            payload = response.json()
        except ValueError:
            payload = {}

        detail = (
            payload.get("msg")
            or payload.get("error_description")
            or payload.get("error")
            or response.text
            or "Authentication request failed"
        )
        lowered = detail.lower()

        if response.status_code in {400, 409, 422} and "already" in lowered:
            return AppError(status_code=409, title="Conflict", detail=detail)
        if response.status_code in {400, 401, 403, 422}:
            return AppError(status_code=401, title="Unauthorized", detail=detail)
        return AppError(status_code=502, title="Upstream authentication failed", detail=detail)

    def _extract_session(self, payload: dict) -> AuthSession:
        session_payload = payload.get("session") or payload
        user_payload = payload.get("user") or session_payload.get("user")
        if not session_payload or not user_payload:
            raise AppError(
                status_code=502,
                title="Invalid authentication response",
                detail="Supabase did not return a session payload.",
            )
        return AuthSession(
            access_token=session_payload["access_token"],
            refresh_token=session_payload["refresh_token"],
            token_type=session_payload.get("token_type", "bearer"),
            expires_in=session_payload.get("expires_in"),
            user=AuthenticatedUser(
                id=user_payload["id"],
                email=user_payload["email"],
                name=(user_payload.get("user_metadata") or {}).get("name")
                or (user_payload.get("raw_user_meta_data") or {}).get("name"),
            ),
        )

    async def register(self, *, name: str, email: str, password: str) -> AuthSession:
        try:
            response = await self.client.post(
                f"{self.settings.auth_base_url}/signup",
                headers=self._headers(),
                json={"email": email, "password": password, "data": {"name": name}},
            )
        except httpx.HTTPError as exc:
            raise AppError(status_code=503, title="Authentication unavailable", detail=str(exc)) from exc

        if not response.is_success:
            raise self._translate_error(response)

        payload = response.json()

        # When email confirmation is enabled, Supabase returns the user but
        # no session. Auto-login immediately after signup so the user gets tokens.
        session_payload = payload.get("session") or payload
        if not session_payload.get("access_token"):
            return await self.login(email=email, password=password)

        return self._extract_session(payload)

    async def login(self, *, email: str, password: str) -> AuthSession:
        try:
            response = await self.client.post(
                f"{self.settings.auth_base_url}/token?grant_type=password",
                headers=self._headers(),
                json={"email": email, "password": password},
            )
        except httpx.HTTPError as exc:
            raise AppError(status_code=503, title="Authentication unavailable", detail=str(exc)) from exc

        if not response.is_success:
            raise self._translate_error(response)
        return self._extract_session(response.json())

    async def refresh(self, *, refresh_token: str) -> AuthSession:
        try:
            response = await self.client.post(
                f"{self.settings.auth_base_url}/token?grant_type=refresh_token",
                headers=self._headers(),
                json={"refresh_token": refresh_token},
            )
        except httpx.HTTPError as exc:
            raise AppError(status_code=503, title="Authentication unavailable", detail=str(exc)) from exc

        if not response.is_success:
            raise self._translate_error(response)
        return self._extract_session(response.json())

    async def get_user(self, access_token: str) -> AuthenticatedUser:
        try:
            response = await self.client.get(
                f"{self.settings.auth_base_url}/user",
                headers=self._headers(bearer_token=access_token),
            )
        except httpx.HTTPError as exc:
            raise AppError(status_code=503, title="Authentication unavailable", detail=str(exc)) from exc

        if not response.is_success:
            raise self._translate_error(response)

        payload = response.json()
        return AuthenticatedUser(
            id=payload["id"],
            email=payload["email"],
            name=(payload.get("user_metadata") or {}).get("name")
            or (payload.get("raw_user_meta_data") or {}).get("name"),
        )

    async def ensure_profile(
        self,
        session: AsyncSession,
        *,
        identity: AuthenticatedUser,
        fallback_name: str | None = None,
    ) -> User:
        await set_current_user(session, str(identity.id))
        profile = await session.get(User, identity.id)
        desired_name = identity.name or fallback_name or identity.email.split("@", 1)[0]

        if profile is None:
            profile = User(
                id=identity.id,
                name=desired_name,
                email=str(identity.email),
            )
            session.add(profile)
        else:
            profile.email = str(identity.email)
            if desired_name and profile.name != desired_name:
                profile.name = desired_name

        await session.flush()
        return profile
