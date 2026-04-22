from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.config.database import get_db
from app.config.constants import ExpenseCategory, TransactionType
from app.errors import AppError
from app.models.user import User
from app.schemas.transaction import (
    ManualTransactionCreate,
    TransactionListResponse,
    TransactionResponse,
    TransactionSummaryResponse,
    UploadResponse,
)
from app.services.transaction_service import TransactionService

router = APIRouter(prefix="/transactions", tags=["transactions"])


def get_transaction_service() -> TransactionService:
    return TransactionService()


@router.post("/upload", response_model=UploadResponse)
async def upload_transactions(
    file: UploadFile = File(...),
    source: str = Form(...),
    pdf_password: str | None = Form(default=None),
    session: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    service: TransactionService = Depends(get_transaction_service),
) -> UploadResponse:
    filename = file.filename or ""
    if not filename:
        raise AppError(status_code=400, title="Bad request", detail="Uploaded file must have a filename.")
    if filename.rsplit(".", 1)[-1].lower() not in {"csv", "xlsx", "pdf"}:
        raise AppError(status_code=415, title="Unsupported media type", detail="Supported file types: csv, xlsx, pdf.")

    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise AppError(status_code=413, title="Payload too large", detail="Maximum upload size is 10MB.")

    return await service.ingest_transactions(
        session=session,
        user=user,
        filename=filename,
        file_bytes=content,
        source=source,
        pdf_password=pdf_password,
    )


@router.get("", response_model=TransactionListResponse)
async def list_transactions(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=200),
    category: ExpenseCategory | None = Query(default=None),
    from_date: date | None = Query(default=None, alias="from"),
    to_date: date | None = Query(default=None, alias="to"),
    txn_type: TransactionType | None = Query(default=None, alias="type"),
    session: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    service: TransactionService = Depends(get_transaction_service),
) -> TransactionListResponse:
    return await service.list_transactions(
        session=session,
        user=user,
        page=page,
        limit=limit,
        category=category,
        from_date=from_date,
        to_date=to_date,
        txn_type=txn_type,
    )


@router.get("/summary", response_model=TransactionSummaryResponse)
async def get_transaction_summary(
    period: str = Query(default="monthly"),
    months: int = Query(default=6, ge=1, le=24),
    session: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    service: TransactionService = Depends(get_transaction_service),
) -> TransactionSummaryResponse:
    return await service.get_summary(session=session, user=user, period=period, months=months)


@router.post("/manual", response_model=TransactionResponse, status_code=201)
async def create_manual_transaction(
    payload: ManualTransactionCreate,
    session: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    service: TransactionService = Depends(get_transaction_service),
) -> TransactionResponse:
    transaction = await service.create_manual_transaction(
        session=session,
        user=user,
        payload=payload.model_dump(),
    )
    return TransactionResponse.model_validate(transaction)
