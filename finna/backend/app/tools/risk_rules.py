from __future__ import annotations

from decimal import Decimal

from app.config.constants import AlertSeverity, AlertType, RiskLevel
from app.tools.financial_metrics import FinancialMetrics


def derive_risk_level(metrics: FinancialMetrics) -> RiskLevel:
    if metrics.total_income <= Decimal("0.00") and metrics.total_expenses <= Decimal("0.00"):
        return RiskLevel.MEDIUM
    if metrics.debt_ratio > 0.40 or metrics.emergency_fund_months < 1:
        return RiskLevel.CRITICAL
    if metrics.debt_ratio > 0.30 or metrics.savings_rate < 0.05:
        return RiskLevel.HIGH
    if metrics.emergency_fund_months < 3 or metrics.expense_ratio > 0.70:
        return RiskLevel.MEDIUM
    if metrics.investment_rate < 0.05 or metrics.discretionary_ratio > 0.30:
        return RiskLevel.LOW
    return RiskLevel.SAFE


def detect_risk_alerts(metrics: FinancialMetrics, goals: list[dict] | None = None) -> list[dict]:
    alerts: list[dict] = []
    if metrics.total_income <= Decimal("0.00") and metrics.total_expenses <= Decimal("0.00"):
        return alerts

    if metrics.spending_velocity > 0.25:
        alerts.append(
            {
                "alert_type": AlertType.OVERSPENDING,
                "severity": AlertSeverity.WARNING,
                "title": "Expenses accelerated sharply",
                "message": f"Monthly expenses increased by {metrics.spending_velocity * 100:.1f}% versus the previous month.",
                "data": {"change_pct": round(metrics.spending_velocity * 100, 2)},
            }
        )
    if metrics.debt_ratio > 0.40:
        alerts.append(
            {
                "alert_type": AlertType.DEBT_RISK,
                "severity": AlertSeverity.CRITICAL,
                "title": "Debt-to-income pressure is critical",
                "message": f"Debt payments consume {metrics.debt_ratio * 100:.1f}% of income.",
                "data": {"debt_ratio": round(metrics.debt_ratio, 4)},
            }
        )
    if metrics.emergency_fund_months < 3:
        alerts.append(
            {
                "alert_type": AlertType.LOW_EMERGENCY_FUND,
                "severity": AlertSeverity.WARNING,
                "title": "Emergency reserve is thin",
                "message": f"Emergency funds cover only {metrics.emergency_fund_months:.1f} months of essentials.",
                "data": {"months": round(metrics.emergency_fund_months, 2)},
            }
        )
    if metrics.subscription_creep > 0.15:
        alerts.append(
            {
                "alert_type": AlertType.SUBSCRIPTION_CREEP,
                "severity": AlertSeverity.INFO,
                "title": "Subscription creep detected",
                "message": f"Subscription costs rose by {metrics.subscription_creep * 100:.1f}% month over month.",
                "data": {"change_pct": round(metrics.subscription_creep * 100, 2)},
            }
        )
    if metrics.investment_rate == 0:
        alerts.append(
            {
                "alert_type": AlertType.TAX_SAVING_OPPORTUNITY,
                "severity": AlertSeverity.INFO,
                "title": "No investments detected",
                "message": "No investment outflows were found. Consider starting a SIP or tax-saving instrument.",
                "data": {"investment_rate": 0},
            }
        )
    for goal in goals or []:
        probability = float(goal.get("success_probability") or 0)
        if probability and probability < 50:
            alerts.append(
                {
                    "alert_type": AlertType.GOAL_AT_RISK,
                    "severity": AlertSeverity.WARNING,
                    "title": f"Goal at risk: {goal.get('title', 'Goal')}",
                    "message": f"Success probability is only {probability:.1f}%. Increase monthly contributions or extend the timeline.",
                    "data": {"success_probability": probability},
                }
            )

    return alerts


def make_recommendations(metrics: FinancialMetrics) -> list[dict]:
    recommendations: list[dict] = []
    if metrics.total_income <= Decimal("0.00") and metrics.total_expenses <= Decimal("0.00"):
        return [
            {
                "id": "rec_data_ingestion",
                "agent": "orchestrator",
                "priority": "high",
                "category": "data",
                "title": "Connect real financial activity",
                "description": "Upload a bank statement, UPI export, or add manual transactions before relying on health and goal scores.",
                "potential_saving": 0,
                "action_items": [
                    "Upload the latest statement from the Transactions page.",
                    "Set monthly income in your profile to improve planning projections.",
                ],
            }
        ]

    if metrics.discretionary_ratio > 0.25:
        potential_saving = float((metrics.discretionary * Decimal("0.15")).quantize(Decimal("0.01")))
        recommendations.append(
            {
                "id": "rec_expense_trim",
                "agent": "expense_agent",
                "priority": "high",
                "category": "spending",
                "title": "Reduce discretionary drag",
                "description": "Dining, shopping, and lifestyle outflows are taking too much room away from goals and reserves.",
                "potential_saving": potential_saving,
                "action_items": [
                    "Set a weekly cap for food delivery and impulse purchases.",
                    "Route the first tranche of savings to your highest-priority goal automatically.",
                ],
            }
        )

    if metrics.debt_ratio > 0.30:
        recommendations.append(
            {
                "id": "rec_debt_rebalance",
                "agent": "debt_agent",
                "priority": "high",
                "category": "debt",
                "title": "Rebalance debt service",
                "description": "Debt service is starting to compress flexibility. Attack the highest-cost EMI first.",
                "potential_saving": 0,
                "action_items": [
                    "Redirect any monthly surplus toward the costliest debt instrument.",
                    "Avoid adding new EMIs until debt ratio drops below 30%.",
                ],
            }
        )

    if metrics.emergency_fund_months < 6:
        recommendations.append(
            {
                "id": "rec_emergency_fund",
                "agent": "risk_agent",
                "priority": "medium",
                "category": "resilience",
                "title": "Strengthen your emergency reserve",
                "description": "Reserve coverage is below the ideal six-month threshold for essential expenses.",
                "potential_saving": 0,
                "action_items": [
                    "Move fixed savings into a liquid reserve before expanding discretionary spend.",
                    "Target one extra month of essential coverage per quarter.",
                ],
            }
        )

    if metrics.investment_rate < 0.10:
        recommendations.append(
            {
                "id": "rec_investment_rate",
                "agent": "investment_agent",
                "priority": "medium",
                "category": "investing",
                "title": "Raise long-term allocation",
                "description": "Investment outflows are below the recommended 10% baseline.",
                "potential_saving": 0,
                "action_items": [
                    "Start or increase a monthly SIP on salary day.",
                    "Use tax-efficient instruments before year-end to improve after-tax returns.",
                ],
            }
        )

    return recommendations
