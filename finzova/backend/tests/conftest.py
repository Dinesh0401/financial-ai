from __future__ import annotations

import os
from collections.abc import AsyncIterator
from pathlib import Path
from uuid import UUID, uuid4

import psycopg
import pytest
import pytest_asyncio
from alembic import command
from alembic.config import Config
from asgi_lifespan import LifespanManager
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("LOG_LEVEL", "INFO")
os.environ.setdefault("CORS_ORIGINS", "http://localhost:3000")
os.environ.setdefault("RATE_LIMIT_PER_MINUTE", "100")
os.environ.setdefault("REQUEST_TIMEOUT_SECONDS", "15")
os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-anon-key")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")
os.environ.setdefault("TEST_DATABASE_RUNTIME_URL", "postgresql+asyncpg://postgres:postgres@localhost:54329/finzova_test")
os.environ.setdefault("TEST_DATABASE_MIGRATION_URL", "postgresql+psycopg://postgres:postgres@localhost:54329/finzova_test")
os.environ["DATABASE_RUNTIME_URL"] = os.environ["TEST_DATABASE_RUNTIME_URL"]
os.environ["DATABASE_MIGRATION_URL"] = os.environ["TEST_DATABASE_MIGRATION_URL"]

from app.api.deps import get_auth_service  # noqa: E402
from app.config.database import set_current_user  # noqa: E402
from app.config.settings import get_settings  # noqa: E402
from app.errors import AppError  # noqa: E402
from app.main import app  # noqa: E402
from app.middleware.rate_limiter import RateLimitMiddleware  # noqa: E402
from app.models.user import User  # noqa: E402
from app.services.auth_service import AuthenticatedUser, AuthSession  # noqa: E402

get_settings.cache_clear()


def _sync_render(url_value) -> str:
    return make_url(str(url_value)).render_as_string(hide_password=False)


def _ensure_test_database() -> None:
    target_url = make_url(os.environ["DATABASE_MIGRATION_URL"])
    admin_url = target_url.set(database="postgres")

    with psycopg.connect(_sync_render(str(admin_url)), autocommit=True) as connection:
        exists = connection.execute(
            "SELECT 1 FROM pg_database WHERE datname = %s",
            (target_url.database,),
        ).fetchone()
        if not exists:
            connection.execute(f'CREATE DATABASE "{target_url.database}"')

    with psycopg.connect(_sync_render(str(target_url)), autocommit=True) as connection:
        connection.execute("CREATE SCHEMA IF NOT EXISTS auth")
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS auth.users (
                id UUID PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                raw_user_meta_data JSONB DEFAULT '{}'::jsonb,
                created_at TIMESTAMPTZ DEFAULT now(),
                updated_at TIMESTAMPTZ DEFAULT now()
            )
            """
        )


def _run_migrations() -> None:
    backend_dir = Path(__file__).resolve().parent.parent
    config = Config(str(backend_dir / "alembic.ini"))
    config.set_main_option("script_location", str(backend_dir / "alembic"))
    command.upgrade(config, "head")


def _find_rate_limiter():
    current = app.middleware_stack
    while hasattr(current, "app"):
        if isinstance(current, RateLimitMiddleware):
            return current
        current = current.app
    return None


class FakeAuthService:
    def __init__(self, session_factory: async_sessionmaker[AsyncSession]) -> None:
        self.session_factory = session_factory
        self.users_by_email: dict[str, dict] = {}
        self.users_by_access: dict[str, dict] = {}
        self.users_by_refresh: dict[str, dict] = {}

    async def _ensure_auth_user(self, *, user_id: UUID, email: str, name: str) -> None:
        async with self.session_factory() as session:
            await session.execute(
                text(
                    """
                    INSERT INTO auth.users (id, email, raw_user_meta_data)
                    VALUES (:id, :email, CAST(:metadata AS jsonb))
                    ON CONFLICT (id) DO UPDATE SET
                        email = EXCLUDED.email,
                        raw_user_meta_data = EXCLUDED.raw_user_meta_data
                    """
                ),
                {"id": str(user_id), "email": email, "metadata": f'{{"name":"{name}"}}'},
            )
            await session.commit()

    def _issue_session(self, record: dict) -> AuthSession:
        access_token = f"access-{uuid4()}"
        refresh_token = f"refresh-{uuid4()}"
        self.users_by_access[access_token] = record
        self.users_by_refresh[refresh_token] = record
        return AuthSession(
            access_token=access_token,
            refresh_token=refresh_token,
            user=AuthenticatedUser(id=record["id"], email=record["email"], name=record["name"]),
            expires_in=3600,
        )

    async def register(self, *, name: str, email: str, password: str) -> AuthSession:
        if email in self.users_by_email:
            raise AppError(status_code=409, title="Conflict", detail="User already registered")
        record = {"id": uuid4(), "name": name, "email": email, "password": password}
        self.users_by_email[email] = record
        await self._ensure_auth_user(user_id=record["id"], email=email, name=name)
        return self._issue_session(record)

    async def login(self, *, email: str, password: str) -> AuthSession:
        record = self.users_by_email.get(email)
        if not record or record["password"] != password:
            raise AppError(status_code=401, title="Unauthorized", detail="Invalid login credentials")
        return self._issue_session(record)

    async def refresh(self, *, refresh_token: str) -> AuthSession:
        record = self.users_by_refresh.pop(refresh_token, None)
        if not record:
            raise AppError(status_code=401, title="Unauthorized", detail="Invalid refresh token")
        return self._issue_session(record)

    async def get_user(self, access_token: str) -> AuthenticatedUser:
        record = self.users_by_access.get(access_token)
        if not record:
            raise AppError(status_code=401, title="Unauthorized", detail="Invalid access token")
        return AuthenticatedUser(id=record["id"], email=record["email"], name=record["name"])

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
            profile = User(id=identity.id, name=desired_name, email=str(identity.email))
            session.add(profile)
        else:
            profile.name = desired_name
            profile.email = str(identity.email)
        await session.flush()
        return profile


test_engine = create_async_engine(os.environ["DATABASE_RUNTIME_URL"], future=True, pool_pre_ping=True)
TestSessionLocal = async_sessionmaker(test_engine, expire_on_commit=False, class_=AsyncSession)


@pytest_asyncio.fixture(scope="session")
async def database_ready() -> AsyncIterator[None]:
    try:
        _ensure_test_database()
        _run_migrations()
    except Exception as exc:  # pragma: no cover - environment dependent
        pytest.skip(f"PostgreSQL test database unavailable: {exc}")
    yield
    await test_engine.dispose()


@pytest_asyncio.fixture
async def reset_database(database_ready) -> AsyncIterator[None]:
    async with TestSessionLocal() as session:
        await session.execute(
            text(
                """
                TRUNCATE TABLE
                    public.chat_messages,
                    public.risk_alerts,
                    public.analysis_results,
                    public.goals,
                    public.transactions,
                    public.users
                RESTART IDENTITY CASCADE
                """
            )
        )
        await session.execute(text("TRUNCATE TABLE auth.users RESTART IDENTITY CASCADE"))
        await session.commit()

    rate_limiter = _find_rate_limiter()
    if rate_limiter is not None:
        rate_limiter.buckets.clear()

    yield


@pytest_asyncio.fixture
async def fake_auth_service(database_ready, reset_database) -> AsyncIterator[FakeAuthService]:
    yield FakeAuthService(TestSessionLocal)


@pytest_asyncio.fixture
async def client(database_ready, fake_auth_service: FakeAuthService) -> AsyncIterator[AsyncClient]:
    app.dependency_overrides[get_auth_service] = lambda: fake_auth_service
    async with LifespanManager(app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as async_client:
            yield async_client
    app.dependency_overrides.clear()
