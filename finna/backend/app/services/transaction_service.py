from __future__ import annotations

from collections import Counter, defaultdict
from datetime import date, timedelta
from decimal import Decimal
from math import ceil
from typing import Sequence

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.constants import ExpenseCategory, TransactionType
from app.config.security import dedupe_hash
from app.errors import AppError
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.common import Pagination
from app.schemas.transaction import (
    MonthlySummaryItem,
    RecurringExpense,
    TopMerchant,
    TransactionListResponse,
    TransactionResponse,
    TransactionSummaryResponse,
    UploadFailure,
    UploadResponse,
)
from app.services.classifier import classify_transaction
from app.services.statement_parser import StatementParseError, parse_transactions_file


def _frequency_from_intervals(intervals: list[int]) -> str | None:
    if not intervals:
        return None
    average = sum(intervals) / len(intervals)
    if 25 <= average <= 35:
        return "monthly"
    if 5 <= average <= 9:
        return "weekly"
    if 80 <= average <= 100:
        return "quarterly"
    if 350 <= average <= 380:
        return "annual"
    return None


class TransactionService:
    async def ingest_transactions(
        self,
        *,
        session: AsyncSession,
        user: User,
        filename: str,
        file_bytes: bytes,
        source: str,
        pdf_password: str | None = None,
    ) -> UploadResponse:
        try:
            parsed_rows, failures = parse_transactions_file(
                filename=filename,
                file_bytes=file_bytes,
                source=source,
                pdf_password=pdf_password,
            )
        except StatementParseError as exc:
            raise AppError(
                status_code=422,
                title="Unsupported statement",
                detail=str(exc),
            ) from exc
        if not parsed_rows:
            detail = "No supported transactions were detected in the uploaded statement."
            if failures:
                detail = f"{detail} First parser error: {failures[0].reason}"
            raise AppError(
                status_code=422,
                title="Unsupported statement",
                detail=detail,
            )
        prepared = []

        for row in parsed_rows:
            category, confidence = classify_transaction(row.merchant, row.description)
            prepared.append(
                (
                    row,
                    dedupe_hash(user_id=user.id, txn_date=row.txn_date, merchant=row.merchant, amount=row.amount),
                    row.category or category,
                    confidence,
                )
            )

        hashes = [item[1] for item in prepared]
        existing_hashes = set()
        if hashes:
            existing_hashes = set(
                (
                    await session.execute(
                        select(Transaction.dedupe_hash).where(
                            Transaction.user_id == user.id,
                            Transaction.dedupe_hash.in_(hashes),
                        )
                    )
                ).scalars()
            )

        categories_assigned: Counter[str] = Counter()
        successful = 0

        for row, row_hash, category, confidence in prepared:
            if row_hash in existing_hashes:
                continue

            session.add(
                Transaction(
                    user_id=user.id,
                    amount=row.amount,
                    merchant=row.merchant,
                    description=row.description,
                    category=category,
                    txn_type=row.txn_type,
                    date=row.txn_date,
                    source=row.source,
                    upi_id=row.upi_id,
                    account_number=row.account_number,
                    confidence=confidence,
                    raw_data=row.raw_data,
                    dedupe_hash=row_hash,
                )
            )
            categories_assigned[category.value] += 1
            successful += 1

        await session.flush()

        return UploadResponse(
            total_parsed=len(parsed_rows),
            successful=successful,
            failed=len(failures),
            failures=[UploadFailure(row=item.row, reason=item.reason) for item in failures],
            categories_assigned=dict(categories_assigned),
        )

    async def create_manual_transaction(
        self,
        *,
        session: AsyncSession,
        user: User,
        payload: dict,
    ) -> Transaction:
        merchant = payload.get("merchant")
        description = payload.get("description")
        category = payload.get("category")
        if not category:
            category, confidence = classify_transaction(merchant, description)
        else:
            confidence = Decimal("1.00")

        row_hash = dedupe_hash(
            user_id=user.id,
            txn_date=payload["date"],
            merchant=merchant,
            amount=payload["amount"],
        )
        existing = await session.scalar(
            select(Transaction.transaction_id).where(Transaction.dedupe_hash == row_hash)
        )
        if existing:
            raise AppError(status_code=409, title="Conflict", detail="A matching transaction already exists.")

        transaction = Transaction(
            user_id=user.id,
            amount=payload["amount"],
            merchant=merchant,
            description=description,
            category=category,
            txn_type=payload["txn_type"],
            date=payload["date"],
            source=payload.get("source"),
            upi_id=payload.get("upi_id"),
            account_number=payload.get("account_number"),
            confidence=confidence,
            dedupe_hash=row_hash,
            raw_data={"manual": True},
        )
        session.add(transaction)
        await session.flush()
        await session.refresh(transaction)
        return transaction

    async def list_transactions(
        self,
        *,
        session: AsyncSession,
        user: User,
        page: int,
        limit: int,
        category: ExpenseCategory | None,
        from_date: date | None,
        to_date: date | None,
        txn_type: TransactionType | None,
    ) -> TransactionListResponse:
        filters = [Transaction.user_id == user.id]
        if category:
            filters.append(Transaction.category == category)
        if from_date:
            filters.append(Transaction.date >= from_date)
        if to_date:
            filters.append(Transaction.date <= to_date)
        if txn_type:
            filters.append(Transaction.txn_type == txn_type)

        total = int(
            (
                await session.execute(select(func.count()).select_from(Transaction).where(*filters))
            ).scalar_one()
        )

        records = (
            await session.execute(
                select(Transaction)
                .where(*filters)
                .order_by(Transaction.date.desc(), Transaction.created_at.desc())
                .offset((page - 1) * limit)
                .limit(limit)
            )
        ).scalars().all()

        return TransactionListResponse(
            transactions=[TransactionResponse.model_validate(item) for item in records],
            pagination=Pagination(total=total, page=page, limit=limit, pages=max(1, ceil(total / limit) if total else 1)),
        )

    async def get_summary(
        self,
        *,
        session: AsyncSession,
        user: User,
        period: str,
        months: int,
    ) -> TransactionSummaryResponse:
        if period != "monthly":
            raise AppError(status_code=422, title="Unsupported period", detail="Only monthly summaries are supported.")

        start_date = date.today().replace(day=1) - timedelta(days=31 * max(months - 1, 0))

        transactions = (
            await session.execute(
                select(Transaction)
                .where(Transaction.user_id == user.id, Transaction.date >= start_date)
                .order_by(Transaction.date.asc())
            )
        ).scalars().all()

        # Group by month in Python (cross-database compatible)
        monthly: dict[str, dict[str, Decimal]] = {}
        category_totals: dict[str, Decimal] = defaultdict(lambda: Decimal("0.00"))
        merchant_totals: dict[str, dict] = defaultdict(lambda: {"total": Decimal("0.00"), "count": 0})

        for txn in transactions:
            month_key = txn.date.strftime("%Y-%m")
            if month_key not in monthly:
                monthly[month_key] = {"income": Decimal("0.00"), "expenses": Decimal("0.00")}
            if txn.txn_type == TransactionType.CREDIT:
                monthly[month_key]["income"] += Decimal(str(txn.amount))
            else:
                monthly[month_key]["expenses"] += Decimal(str(txn.amount))
                category_totals[txn.category.value] += Decimal(str(txn.amount))
                if txn.merchant:
                    merchant_totals[txn.merchant]["total"] += Decimal(str(txn.amount))
                    merchant_totals[txn.merchant]["count"] += 1

        sorted_months = sorted(monthly.keys())
        top_merchants_sorted = sorted(merchant_totals.items(), key=lambda x: x[1]["total"], reverse=True)[:10]

        recurring_debits = [t for t in transactions if t.txn_type == TransactionType.DEBIT and t.merchant]

        return TransactionSummaryResponse(
            monthly_summary=[
                MonthlySummaryItem(
                    month=m,
                    income=monthly[m]["income"],
                    expenses=monthly[m]["expenses"],
                    savings=monthly[m]["income"] - monthly[m]["expenses"],
                )
                for m in sorted_months
            ],
            category_totals=dict(category_totals),
            top_merchants=[
                TopMerchant(name=name, total=data["total"], count=data["count"])
                for name, data in top_merchants_sorted
            ],
            recurring_expenses=self._detect_recurring_expenses(recurring_debits),
        )

    def _detect_recurring_expenses(self, transactions: Sequence[Transaction]) -> list[RecurringExpense]:
        grouped: dict[str, list[Transaction]] = defaultdict(list)
        for transaction in transactions:
            if transaction.merchant:
                grouped[transaction.merchant.lower()].append(transaction)

        recurring: list[RecurringExpense] = []
        for merchant, items in grouped.items():
            if len(items) < 3:
                continue

            amounts = [Decimal(item.amount) for item in items]
            average_amount = sum(amounts) / len(amounts)
            within_range = [
                amount for amount in amounts if abs(amount - average_amount) <= (average_amount * Decimal("0.10"))
            ]
            if len(within_range) < 3:
                continue

            intervals = [(current.date - previous.date).days for previous, current in zip(items, items[1:])]
            frequency = _frequency_from_intervals(intervals)
            if frequency:
                recurring.append(
                    RecurringExpense(
                        merchant=items[0].merchant or merchant,
                        amount=average_amount.quantize(Decimal("0.01")),
                        frequency=frequency,
                    )
                )

        return recurring[:10]
