from __future__ import annotations

import hashlib
import re
from datetime import date
from decimal import Decimal
from uuid import UUID


def normalize_merchant(value: str | None) -> str:
    if not value:
        return "unknown"
    normalized = value.lower().strip()
    normalized = re.sub(r"[^a-z0-9\s]", " ", normalized)
    normalized = re.sub(r"\s+", " ", normalized).strip()
    return normalized or "unknown"


def dedupe_hash(*, user_id: UUID | str, txn_date: date, merchant: str | None, amount: Decimal) -> str:
    payload = f"{user_id}|{txn_date.isoformat()}|{normalize_merchant(merchant)}|{amount.normalize()}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def mask_account_number(value: str | None) -> str | None:
    if not value:
        return None
    digits = "".join(char for char in value if char.isdigit())
    if not digits:
        return None
    return digits[-4:]

