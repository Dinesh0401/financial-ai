from __future__ import annotations

from collections.abc import AsyncGenerator

from sqlalchemy import text, event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config.settings import get_settings

settings = get_settings()

_is_sqlite = settings.database_runtime_url.startswith("sqlite")

engine = create_async_engine(
    settings.database_runtime_url,
    echo=False,
    future=True,
    pool_pre_ping=not _is_sqlite,
)

# Enable WAL mode and foreign keys for SQLite
if _is_sqlite:
    @event.listens_for(engine.sync_engine, "connect")
    def _set_sqlite_pragma(dbapi_conn, connection_record):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def set_current_user(session: AsyncSession, user_id: str) -> None:
    """Set the current user for RLS policies. No-op for SQLite."""
    if not _is_sqlite:
        await session.execute(
            text("select set_config('app.current_user_id', :user_id, true)"),
            {"user_id": user_id},
        )


async def clear_current_user(session: AsyncSession) -> None:
    if not _is_sqlite:
        await session.execute(
            text("select set_config('app.current_user_id', '', true)")
        )


async def create_all_tables() -> None:
    """Create all tables (for SQLite dev mode). Import models first."""
    from app.models import Base  # noqa: F401
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def dispose_engine() -> None:
    await engine.dispose()
