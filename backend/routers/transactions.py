import uuid
from datetime import date as date_type
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from pydantic import BaseModel
from typing import Optional, List
import json

from database import get_db
from models.transaction import Transaction
from models.user import User
from routers.auth import get_current_user
from tools.expense_classifier import expense_classifier
from utils.csv_parser import parse_bank_csv

router = APIRouter(tags=["transactions"])


class TransactionCreate(BaseModel):
    date: str
    amount: float
    description: Optional[str] = ""
    merchant: Optional[str] = ""
    category: Optional[str] = None
    type: Optional[str] = "debit"


class TransactionUpdate(BaseModel):
    category: Optional[str] = None
    merchant: Optional[str] = None


@router.get("")
async def get_transactions(
    limit: int = Query(100, le=500),
    offset: int = Query(0),
    category: Optional[str] = None,
    tx_type: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(Transaction).where(Transaction.user_id == current_user.id)
    if category:
        q = q.where(Transaction.category == category)
    if tx_type:
        q = q.where(Transaction.type == tx_type)
    q = q.order_by(Transaction.date.desc()).offset(offset).limit(limit)
    result = await db.execute(q)
    txs = result.scalars().all()
    return [
        {
            'id': t.id, 'date': str(t.date), 'amount': float(t.amount),
            'description': t.description, 'merchant': t.merchant,
            'category': t.category, 'type': t.type, 'source': t.source,
        }
        for t in txs
    ]


@router.post("/upload")
async def upload_csv(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not file.filename.endswith('.csv'):
        raise HTTPException(400, "Only CSV files are supported")

    file_bytes = await file.read()
    parsed = parse_bank_csv(file_bytes)

    classified = []
    for tx_data in parsed:
        cls = expense_classifier(tx_data.get('description', ''), tx_data.get('amount', 0))
        tx = Transaction(
            id=str(uuid.uuid4()),
            user_id=current_user.id,
            date=_parse_date(tx_data['date']),
            amount=tx_data['amount'],
            description=tx_data.get('description', ''),
            merchant=_extract_merchant(tx_data.get('description', '')),
            category=cls['category'],
            type=tx_data.get('type', 'debit'),
            source=tx_data.get('source', 'csv_upload'),
        )
        db.add(tx)
        classified.append({'description': tx_data.get('description'), 'category': cls['category']})

    await db.flush()
    return {'imported': len(classified), 'categories': classified[:10]}


@router.post("")
async def create_transaction(
    req: TransactionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    category = req.category
    if not category:
        cls = expense_classifier(req.description or '', req.amount)
        category = cls['category']

    tx = Transaction(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        date=_parse_date(req.date),
        amount=req.amount,
        description=req.description,
        merchant=req.merchant or _extract_merchant(req.description or ''),
        category=category,
        type=req.type,
        source='manual',
    )
    db.add(tx)
    await db.flush()
    return {'id': tx.id, 'category': category}


@router.put("/{tx_id}")
async def update_transaction(
    tx_id: str,
    req: TransactionUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Transaction).where(Transaction.id == tx_id, Transaction.user_id == current_user.id)
    )
    tx = result.scalar_one_or_none()
    if not tx:
        raise HTTPException(404, "Transaction not found")
    if req.category:
        tx.category = req.category
    if req.merchant:
        tx.merchant = req.merchant
    db.add(tx)
    return {'id': tx.id, 'category': tx.category}


@router.delete("/{tx_id}")
async def delete_transaction(
    tx_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(delete(Transaction).where(Transaction.id == tx_id, Transaction.user_id == current_user.id))
    return {'deleted': tx_id}


def _parse_date(date_str: str):
    from datetime import datetime
    formats = ["%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%m/%d/%Y", "%d-%b-%Y", "%d %b %Y"]
    for fmt in formats:
        try:
            return datetime.strptime(date_str.strip(), fmt).date()
        except (ValueError, AttributeError):
            continue
    return date_type.today()


def _extract_merchant(description: str) -> str:
    words = description.split()
    return words[0] if words else description
