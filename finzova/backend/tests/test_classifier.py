from decimal import Decimal

from app.config.constants import ExpenseCategory
from app.services.classifier import classify_transaction


def test_classifier_exact_match() -> None:
    category, confidence = classify_transaction("Swiggy Instamart")
    assert category == ExpenseCategory.FOOD_DINING
    assert confidence == Decimal("0.99")


def test_classifier_fuzzy_match() -> None:
    category, confidence = classify_transaction("Amazn Marketplace")
    assert category == ExpenseCategory.SHOPPING
    assert confidence >= Decimal("0.85")


def test_classifier_unknown_falls_back() -> None:
    category, confidence = classify_transaction("Completely Unknown Merchant")
    assert category == ExpenseCategory.UNCATEGORIZED
    assert confidence == Decimal("0.30")

