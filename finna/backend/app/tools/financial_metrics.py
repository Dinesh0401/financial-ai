from __future__ import annotations

from collections import defaultdict
from dataclasses import asdict, dataclass
from decimal import Decimal
from statistics import mean, pstdev

from app.config.constants import ExpenseCategory, TransactionType
from app.models.transaction import Transaction

ZERO = Decimal("0.00")

FIXED_EXPENSE_CATEGORIES = {
    ExpenseCategory.RENT_HOUSING,
    ExpenseCategory.EMI_LOANS,
    ExpenseCategory.SUBSCRIPTIONS,
    ExpenseCategory.UTILITIES,
    ExpenseCategory.INSURANCE,
}

DISCRETIONARY_CATEGORIES = {
    ExpenseCategory.ENTERTAINMENT,
    ExpenseCategory.SHOPPING,
    ExpenseCategory.FOOD_DINING,
    ExpenseCategory.TRAVEL,
    ExpenseCategory.PERSONAL_CARE,
    ExpenseCategory.GIFTS_DONATIONS,
}

ESSENTIAL_CATEGORIES = FIXED_EXPENSE_CATEGORIES | {
    ExpenseCategory.GROCERIES,
    ExpenseCategory.HEALTHCARE,
    ExpenseCategory.TAXES,
}


@dataclass(slots=True)
class FinancialMetrics:
    total_income: Decimal
    salary_income: Decimal
    other_income: Decimal
    income_stability: float
    total_expenses: Decimal
    fixed_expenses: Decimal
    variable_expenses: Decimal
    discretionary: Decimal
    essential: Decimal
    savings_rate: float
    debt_ratio: float
    expense_ratio: float
    emergency_fund_months: float
    investment_rate: float
    recurring_ratio: float
    discretionary_ratio: float
    spending_velocity: float
    largest_category: str
    subscription_creep: float
    impulse_score: float
    category_breakdown: dict[str, float]
    monthly_trends: dict[str, dict[str, float]]
    top_merchants: list[dict[str, float | int | str]]

    def to_dict(self) -> dict:
        return asdict(self)


def _decimal(value: Decimal | None) -> Decimal:
    return Decimal(value or ZERO)


def _has_income_signal(metrics: FinancialMetrics) -> bool:
    return metrics.total_income > ZERO


def _has_expense_signal(metrics: FinancialMetrics) -> bool:
    return metrics.total_expenses > ZERO


def calculate_health_score(metrics: FinancialMetrics) -> int:
    if not _has_income_signal(metrics) and not _has_expense_signal(metrics):
        return 0

    score = 0

    if _has_income_signal(metrics):
        if metrics.savings_rate >= 0.30:
            score += 25
        elif metrics.savings_rate >= 0.20:
            score += 20
        elif metrics.savings_rate >= 0.10:
            score += 12
        elif metrics.savings_rate >= 0.05:
            score += 6
        else:
            score += max(0, int(metrics.savings_rate * 100))

        if metrics.debt_ratio == 0:
            score += 25
        elif metrics.debt_ratio < 0.20:
            score += 22
        elif metrics.debt_ratio < 0.30:
            score += 17
        elif metrics.debt_ratio < 0.40:
            score += 10
        else:
            score += 3

        if metrics.expense_ratio < 0.50:
            expense_score = 12
        elif metrics.expense_ratio < 0.60:
            expense_score = 10
        elif metrics.expense_ratio < 0.70:
            expense_score = 7
        elif metrics.expense_ratio < 0.80:
            expense_score = 4
        else:
            expense_score = 1

        if metrics.discretionary_ratio < 0.15:
            discretionary_score = 8
        elif metrics.discretionary_ratio < 0.25:
            discretionary_score = 6
        elif metrics.discretionary_ratio < 0.35:
            discretionary_score = 4
        else:
            discretionary_score = 2
        score += expense_score + discretionary_score

        if metrics.investment_rate >= 0.15:
            score += 15
        elif metrics.investment_rate >= 0.10:
            score += 10
        elif metrics.investment_rate >= 0.05:
            score += 5
        else:
            score += max(0, int(metrics.investment_rate * 100))

    if metrics.essential > ZERO:
        if metrics.emergency_fund_months >= 12:
            score += 15
        elif metrics.emergency_fund_months >= 6:
            score += 13
        elif metrics.emergency_fund_months >= 3:
            score += 8
        elif metrics.emergency_fund_months >= 1:
            score += 3

    return min(100, max(0, score))


def build_health_breakdown(metrics: FinancialMetrics) -> dict[str, dict[str, float | int | str]]:
    if not _has_income_signal(metrics) and not _has_expense_signal(metrics):
        return {
            "savings_rate": {"value": 0.0, "score": 0, "max": 25, "status": "insufficient_data"},
            "debt_ratio": {"value": 0.0, "score": 0, "max": 25, "status": "insufficient_data"},
            "spending_behavior": {"value": 0.0, "score": 0, "max": 20, "status": "insufficient_data"},
            "emergency_fund": {"value": 0.0, "score": 0, "max": 15, "status": "insufficient_data"},
            "investment_rate": {"value": 0.0, "score": 0, "max": 15, "status": "insufficient_data"},
        }

    return {
        "savings_rate": {
            "value": round(metrics.savings_rate, 2),
            "score": 25 if _has_income_signal(metrics) and metrics.savings_rate >= 0.30 else 20 if _has_income_signal(metrics) and metrics.savings_rate >= 0.20 else 12 if _has_income_signal(metrics) and metrics.savings_rate >= 0.10 else 6 if _has_income_signal(metrics) and metrics.savings_rate >= 0.05 else max(0, int(metrics.savings_rate * 100)) if _has_income_signal(metrics) else 0,
            "max": 25,
            "status": "good" if _has_income_signal(metrics) and metrics.savings_rate >= 0.20 else "warning" if _has_income_signal(metrics) and metrics.savings_rate >= 0.10 else "needs_work" if _has_income_signal(metrics) else "insufficient_data",
        },
        "debt_ratio": {
            "value": round(metrics.debt_ratio, 2),
            "score": 25 if _has_income_signal(metrics) and metrics.debt_ratio == 0 else 22 if _has_income_signal(metrics) and metrics.debt_ratio < 0.20 else 17 if _has_income_signal(metrics) and metrics.debt_ratio < 0.30 else 10 if _has_income_signal(metrics) and metrics.debt_ratio < 0.40 else 3 if _has_income_signal(metrics) else 0,
            "max": 25,
            "status": "good" if _has_income_signal(metrics) and metrics.debt_ratio < 0.30 else "warning" if _has_income_signal(metrics) and metrics.debt_ratio < 0.40 else "critical" if _has_income_signal(metrics) else "insufficient_data",
        },
        "spending_behavior": {
            "value": round(metrics.expense_ratio, 2),
            "score": 12 if _has_income_signal(metrics) and metrics.expense_ratio < 0.50 else 10 if _has_income_signal(metrics) and metrics.expense_ratio < 0.60 else 7 if _has_income_signal(metrics) and metrics.expense_ratio < 0.70 else 4 if _has_income_signal(metrics) and metrics.expense_ratio < 0.80 else 1 if _has_income_signal(metrics) else 0,
            "max": 20,
            "status": "good" if _has_income_signal(metrics) and metrics.expense_ratio < 0.60 else "warning" if _has_income_signal(metrics) and metrics.expense_ratio < 0.75 else "critical" if _has_income_signal(metrics) else "insufficient_data",
        },
        "emergency_fund": {
            "value": round(metrics.emergency_fund_months, 2),
            "score": 15 if metrics.essential > ZERO and metrics.emergency_fund_months >= 12 else 13 if metrics.essential > ZERO and metrics.emergency_fund_months >= 6 else 8 if metrics.essential > ZERO and metrics.emergency_fund_months >= 3 else 3 if metrics.essential > ZERO and metrics.emergency_fund_months >= 1 else 0,
            "max": 15,
            "status": "good" if metrics.essential > ZERO and metrics.emergency_fund_months >= 6 else "warning" if metrics.essential > ZERO and metrics.emergency_fund_months >= 3 else "critical" if metrics.essential > ZERO else "insufficient_data",
        },
        "investment_rate": {
            "value": round(metrics.investment_rate, 2),
            "score": 15 if _has_income_signal(metrics) and metrics.investment_rate >= 0.15 else 10 if _has_income_signal(metrics) and metrics.investment_rate >= 0.10 else 5 if _has_income_signal(metrics) and metrics.investment_rate >= 0.05 else max(0, int(metrics.investment_rate * 100)) if _has_income_signal(metrics) else 0,
            "max": 15,
            "status": "good" if _has_income_signal(metrics) and metrics.investment_rate >= 0.10 else "warning" if _has_income_signal(metrics) and metrics.investment_rate >= 0.05 else "needs_work" if _has_income_signal(metrics) else "insufficient_data",
        },
    }


def compute_financial_metrics(transactions: list[Transaction]) -> FinancialMetrics:
    credits = [txn for txn in transactions if txn.txn_type == TransactionType.CREDIT]
    debits = [txn for txn in transactions if txn.txn_type == TransactionType.DEBIT]

    monthly_income: dict[str, Decimal] = defaultdict(lambda: ZERO)
    monthly_expenses: dict[str, Decimal] = defaultdict(lambda: ZERO)
    category_breakdown: dict[str, Decimal] = defaultdict(lambda: ZERO)
    merchant_totals: dict[str, dict[str, Decimal | int]] = defaultdict(lambda: {"total": ZERO, "count": 0})
    subscription_by_month: dict[str, Decimal] = defaultdict(lambda: ZERO)

    salary_income = ZERO
    other_income = ZERO
    fixed_expenses = ZERO
    discretionary = ZERO
    essential = ZERO
    debt_payments = ZERO
    investment_outflows = ZERO

    for txn in transactions:
        month_key = txn.date.strftime("%Y-%m")
        amount = _decimal(txn.amount)
        merchant_name = txn.merchant or "Unknown"

        if txn.txn_type == TransactionType.CREDIT:
            monthly_income[month_key] += amount
            if txn.category == ExpenseCategory.SALARY_INCOME:
                salary_income += amount
            else:
                other_income += amount
        else:
            monthly_expenses[month_key] += amount
            category_breakdown[txn.category.value] += amount
            merchant_totals[merchant_name]["total"] = _decimal(merchant_totals[merchant_name]["total"]) + amount
            merchant_totals[merchant_name]["count"] = int(merchant_totals[merchant_name]["count"]) + 1

            if txn.category in FIXED_EXPENSE_CATEGORIES:
                fixed_expenses += amount
            if txn.category in DISCRETIONARY_CATEGORIES:
                discretionary += amount
            if txn.category in ESSENTIAL_CATEGORIES:
                essential += amount
            if txn.category == ExpenseCategory.EMI_LOANS:
                debt_payments += amount
            if txn.category == ExpenseCategory.INVESTMENTS:
                investment_outflows += amount
            if txn.category == ExpenseCategory.SUBSCRIPTIONS:
                subscription_by_month[month_key] += amount

    total_income = sum(monthly_income.values(), ZERO)
    total_expenses = sum(monthly_expenses.values(), ZERO)
    variable_expenses = total_expenses - fixed_expenses

    income_values = [float(value) for value in monthly_income.values()] or [0.0]
    income_mean = mean(income_values) if income_values else 0.0
    income_stability = 0.0 if income_mean == 0 else pstdev(income_values) / income_mean

    expense_values = list(monthly_expenses.values()) or [ZERO]
    average_income = total_income / max(1, len(monthly_income) or 1)
    average_expense = total_expenses / max(1, len(monthly_expenses) or 1)
    average_essential = essential / max(1, len(monthly_expenses) or 1)

    savings_rate = float((average_income - average_expense) / average_income) if average_income > 0 else 0.0
    debt_ratio = float(debt_payments / total_income) if total_income > 0 else 0.0
    expense_ratio = float(total_expenses / total_income) if total_income > 0 else 0.0
    net_savings = max(total_income - total_expenses, ZERO)
    emergency_fund_months = float(net_savings / average_essential) if average_essential > 0 else 0.0
    investment_rate = float(investment_outflows / total_income) if total_income > 0 else 0.0
    recurring_ratio = float(fixed_expenses / total_expenses) if total_expenses > 0 else 0.0
    discretionary_ratio = float(discretionary / total_expenses) if total_expenses > 0 else 0.0

    ordered_months = sorted(monthly_expenses.keys())
    spending_velocity = 0.0
    if len(ordered_months) >= 2 and monthly_expenses[ordered_months[-2]] > 0:
        spending_velocity = float(
            (monthly_expenses[ordered_months[-1]] - monthly_expenses[ordered_months[-2]])
            / monthly_expenses[ordered_months[-2]]
        )

    largest_category = max(category_breakdown.items(), key=lambda item: item[1], default=("uncategorized", ZERO))[0]

    subscription_creep = 0.0
    if len(ordered_months) >= 2:
        previous = subscription_by_month[ordered_months[-2]]
        latest = subscription_by_month[ordered_months[-1]]
        if previous > 0:
            subscription_creep = float((latest - previous) / previous)

    top_merchants = [
        {"name": name, "total": float(values["total"]), "count": int(values["count"])}
        for name, values in sorted(merchant_totals.items(), key=lambda item: item[1]["total"], reverse=True)[:5]
    ]
    monthly_trends = {
        month: {
            "income": float(monthly_income.get(month, ZERO)),
            "expenses": float(monthly_expenses.get(month, ZERO)),
        }
        for month in sorted(set(monthly_income) | set(monthly_expenses))
    }

    return FinancialMetrics(
        total_income=total_income,
        salary_income=salary_income,
        other_income=other_income,
        income_stability=round(income_stability, 4),
        total_expenses=total_expenses,
        fixed_expenses=fixed_expenses,
        variable_expenses=variable_expenses,
        discretionary=discretionary,
        essential=essential,
        savings_rate=round(savings_rate, 4),
        debt_ratio=round(debt_ratio, 4),
        expense_ratio=round(expense_ratio, 4),
        emergency_fund_months=round(emergency_fund_months, 4),
        investment_rate=round(investment_rate, 4),
        recurring_ratio=round(recurring_ratio, 4),
        discretionary_ratio=round(discretionary_ratio, 4),
        spending_velocity=round(spending_velocity, 4),
        largest_category=largest_category,
        subscription_creep=round(subscription_creep, 4),
        impulse_score=0.0,
        category_breakdown={key: float(value) for key, value in category_breakdown.items()},
        monthly_trends=monthly_trends,
        top_merchants=top_merchants,
    )
