from __future__ import annotations

from decimal import Decimal

from rapidfuzz import fuzz, process

from app.config.constants import ExpenseCategory, MERCHANT_CATEGORIES
from app.config.security import normalize_merchant


def classify_transaction(merchant: str | None, description: str | None = None) -> tuple[ExpenseCategory, Decimal]:
    haystack = " ".join(filter(None, [merchant, description]))
    normalized = normalize_merchant(haystack)

    for key, category in MERCHANT_CATEGORIES.items():
        if key in normalized:
            return category, Decimal("0.99")

    best = process.extractOne(
        normalized,
        list(MERCHANT_CATEGORIES.keys()),
        scorer=fuzz.partial_ratio,
    )
    if best and best[1] >= 85:
        return MERCHANT_CATEGORIES[best[0]], Decimal(str(round(best[1] / 100, 2)))

    tokens = set(normalized.split())
    for key, category in MERCHANT_CATEGORIES.items():
        if set(key.split()) & tokens:
            return category, Decimal("0.75")

    return ExpenseCategory.UNCATEGORIZED, Decimal("0.30")
