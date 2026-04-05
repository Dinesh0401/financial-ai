from __future__ import annotations

from enum import Enum


class TransactionType(str, Enum):
    CREDIT = "credit"
    DEBIT = "debit"


class ExpenseCategory(str, Enum):
    FOOD_DINING = "food_dining"
    TRANSPORT = "transport"
    SHOPPING = "shopping"
    SUBSCRIPTIONS = "subscriptions"
    UTILITIES = "utilities"
    RENT_HOUSING = "rent_housing"
    HEALTHCARE = "healthcare"
    EDUCATION = "education"
    ENTERTAINMENT = "entertainment"
    INVESTMENTS = "investments"
    INSURANCE = "insurance"
    EMI_LOANS = "emi_loans"
    TRANSFERS = "transfers"
    SALARY_INCOME = "salary_income"
    FREELANCE_INCOME = "freelance_income"
    INTEREST_INCOME = "interest_income"
    CASHBACK_REWARDS = "cashback_rewards"
    GROCERIES = "groceries"
    PERSONAL_CARE = "personal_care"
    TRAVEL = "travel"
    GIFTS_DONATIONS = "gifts_donations"
    TAXES = "taxes"
    MISCELLANEOUS = "miscellaneous"
    UNCATEGORIZED = "uncategorized"


class RiskLevel(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    SAFE = "safe"


class GoalType(str, Enum):
    EMERGENCY_FUND = "emergency_fund"
    VEHICLE = "vehicle"
    HOME = "home"
    EDUCATION = "education"
    RETIREMENT = "retirement"
    VACATION = "vacation"
    WEDDING = "wedding"
    INVESTMENT = "investment"
    DEBT_PAYOFF = "debt_payoff"
    CUSTOM = "custom"


class GoalStatus(str, Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    ABANDONED = "abandoned"
    PAUSED = "paused"


class AlertType(str, Enum):
    OVERSPENDING = "overspending"
    DEBT_RISK = "debt_risk"
    LOW_EMERGENCY_FUND = "low_emergency_fund"
    UNUSUAL_TRANSACTION = "unusual_transaction"
    GOAL_AT_RISK = "goal_at_risk"
    INCOME_DROP = "income_drop"
    SUBSCRIPTION_CREEP = "subscription_creep"
    TAX_SAVING_OPPORTUNITY = "tax_saving_opportunity"


class AlertSeverity(str, Enum):
    CRITICAL = "critical"
    WARNING = "warning"
    INFO = "info"


COLUMN_MAPPINGS: dict[str, list[str]] = {
    "date": ["date", "transaction date", "txn date", "value date", "posting date"],
    "amount": ["amount", "transaction amount", "txn amount", "value"],
    "merchant": ["merchant", "description", "narration", "particulars", "details", "remarks"],
    "txn_type": ["type", "dr/cr", "debit/credit", "transaction type"],
    "debit": ["debit", "withdrawal", "paid out", "dr amount"],
    "credit": ["credit", "deposit", "paid in", "cr amount"],
    "balance": ["balance", "running balance", "closing balance", "available balance", "current balance"],
}


ROW_SKIP_TOKENS = {"total", "balance", "opening", "closing", "summary"}


MERCHANT_CATEGORIES: dict[str, ExpenseCategory] = {
    "swiggy": ExpenseCategory.FOOD_DINING,
    "zomato": ExpenseCategory.FOOD_DINING,
    "dominos": ExpenseCategory.FOOD_DINING,
    "mcdonald": ExpenseCategory.FOOD_DINING,
    "haldiram": ExpenseCategory.FOOD_DINING,
    "barbeque nation": ExpenseCategory.FOOD_DINING,
    "uber": ExpenseCategory.TRANSPORT,
    "ola": ExpenseCategory.TRANSPORT,
    "rapido": ExpenseCategory.TRANSPORT,
    "irctc": ExpenseCategory.TRAVEL,
    "redbus": ExpenseCategory.TRAVEL,
    "indian railways": ExpenseCategory.TRAVEL,
    "metro": ExpenseCategory.TRANSPORT,
    "petrol": ExpenseCategory.TRANSPORT,
    "hp petrol": ExpenseCategory.TRANSPORT,
    "iocl": ExpenseCategory.TRANSPORT,
    "bpcl": ExpenseCategory.TRANSPORT,
    "fastag": ExpenseCategory.TRANSPORT,
    "amazon": ExpenseCategory.SHOPPING,
    "flipkart": ExpenseCategory.SHOPPING,
    "myntra": ExpenseCategory.SHOPPING,
    "ajio": ExpenseCategory.SHOPPING,
    "meesho": ExpenseCategory.SHOPPING,
    "nykaa": ExpenseCategory.SHOPPING,
    "bigbasket": ExpenseCategory.GROCERIES,
    "blinkit": ExpenseCategory.GROCERIES,
    "zepto": ExpenseCategory.GROCERIES,
    "dmart": ExpenseCategory.GROCERIES,
    "reliance fresh": ExpenseCategory.GROCERIES,
    "more supermarket": ExpenseCategory.GROCERIES,
    "netflix": ExpenseCategory.SUBSCRIPTIONS,
    "hotstar": ExpenseCategory.SUBSCRIPTIONS,
    "spotify": ExpenseCategory.SUBSCRIPTIONS,
    "youtube premium": ExpenseCategory.SUBSCRIPTIONS,
    "amazon prime": ExpenseCategory.SUBSCRIPTIONS,
    "jiocinema": ExpenseCategory.SUBSCRIPTIONS,
    "sonyliv": ExpenseCategory.SUBSCRIPTIONS,
    "airtel": ExpenseCategory.UTILITIES,
    "jio": ExpenseCategory.UTILITIES,
    "vi vodafone": ExpenseCategory.UTILITIES,
    "bsnl": ExpenseCategory.UTILITIES,
    "electricity": ExpenseCategory.UTILITIES,
    "bescom": ExpenseCategory.UTILITIES,
    "tangedco": ExpenseCategory.UTILITIES,
    "gas cylinder": ExpenseCategory.UTILITIES,
    "water bill": ExpenseCategory.UTILITIES,
    "broadband": ExpenseCategory.UTILITIES,
    "act fibernet": ExpenseCategory.UTILITIES,
    "apollo": ExpenseCategory.HEALTHCARE,
    "practo": ExpenseCategory.HEALTHCARE,
    "1mg": ExpenseCategory.HEALTHCARE,
    "pharmeasy": ExpenseCategory.HEALTHCARE,
    "medplus": ExpenseCategory.HEALTHCARE,
    "lic": ExpenseCategory.INSURANCE,
    "sbi life": ExpenseCategory.INSURANCE,
    "hdfc life": ExpenseCategory.INSURANCE,
    "max life": ExpenseCategory.INSURANCE,
    "star health": ExpenseCategory.INSURANCE,
    "bajaj allianz": ExpenseCategory.INSURANCE,
    "zerodha": ExpenseCategory.INVESTMENTS,
    "groww": ExpenseCategory.INVESTMENTS,
    "angel one": ExpenseCategory.INVESTMENTS,
    "upstox": ExpenseCategory.INVESTMENTS,
    "coin by zerodha": ExpenseCategory.INVESTMENTS,
    "kuvera": ExpenseCategory.INVESTMENTS,
    "mutual fund": ExpenseCategory.INVESTMENTS,
    "sip": ExpenseCategory.INVESTMENTS,
    "emi": ExpenseCategory.EMI_LOANS,
    "loan": ExpenseCategory.EMI_LOANS,
    "bajaj finserv": ExpenseCategory.EMI_LOANS,
    "hdfc bank emi": ExpenseCategory.EMI_LOANS,
    "rent": ExpenseCategory.RENT_HOUSING,
    "nobroker": ExpenseCategory.RENT_HOUSING,
    "housing society": ExpenseCategory.RENT_HOUSING,
    "maintenance": ExpenseCategory.RENT_HOUSING,
    "udemy": ExpenseCategory.EDUCATION,
    "coursera": ExpenseCategory.EDUCATION,
    "unacademy": ExpenseCategory.EDUCATION,
    "byjus": ExpenseCategory.EDUCATION,
    "school fee": ExpenseCategory.EDUCATION,
    "college fee": ExpenseCategory.EDUCATION,
    "salary": ExpenseCategory.SALARY_INCOME,
    "stipend": ExpenseCategory.SALARY_INCOME,
    "freelance": ExpenseCategory.FREELANCE_INCOME,
    "interest": ExpenseCategory.INTEREST_INCOME,
    "dividend": ExpenseCategory.INTEREST_INCOME,
    "cashback": ExpenseCategory.CASHBACK_REWARDS,
}
