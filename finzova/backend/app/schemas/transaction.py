from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.config.constants import ExpenseCategory, TransactionType
from app.schemas.common import Pagination


class _DecimalAsFloat(BaseModel):
    """Mixin that serialises Decimal fields as JSON floats."""
    model_config = ConfigDict(json_encoders={Decimal: float})


class TransactionResponse(_DecimalAsFloat):
    model_config = ConfigDict(from_attributes=True, json_encoders={Decimal: float})

    transaction_id: UUID
    user_id: UUID
    amount: Decimal
    merchant: str | None = None
    description: str | None = None
    category: ExpenseCategory
    txn_type: TransactionType
    date: date
    source: str | None = None
    upi_id: str | None = None
    account_number: str | None = None
    is_recurring: bool
    confidence: Decimal | None = None
    created_at: datetime


class UploadFailure(BaseModel):
    row: int
    reason: str


class UploadResponse(BaseModel):
    total_parsed: int
    successful: int
    failed: int
    failures: list[UploadFailure] = Field(default_factory=list)
    categories_assigned: dict[str, int] = Field(default_factory=dict)


class MonthlySummaryItem(_DecimalAsFloat):
    month: str
    income: Decimal
    expenses: Decimal
    savings: Decimal


class TopMerchant(_DecimalAsFloat):
    name: str
    total: Decimal
    count: int


class RecurringExpense(_DecimalAsFloat):
    merchant: str
    amount: Decimal
    frequency: str


class TransactionSummaryResponse(_DecimalAsFloat):
    monthly_summary: list[MonthlySummaryItem]
    category_totals: dict[str, Decimal]
    top_merchants: list[TopMerchant]
    recurring_expenses: list[RecurringExpense]


class ManualTransactionCreate(BaseModel):
    amount: Decimal = Field(gt=0)
    merchant: str | None = Field(default=None, max_length=255)
    category: ExpenseCategory | None = None
    txn_type: TransactionType
    date: date
    description: str | None = None
    source: str = Field(default="manual", max_length=50)
    upi_id: str | None = None
    account_number: str | None = None


class TransactionListResponse(BaseModel):
    transactions: list[TransactionResponse]
    pagination: Pagination

