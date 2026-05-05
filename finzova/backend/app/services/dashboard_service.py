from __future__ import annotations

from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.goal import Goal
from app.models.risk_alert import RiskAlert
from app.models.transaction import Transaction
from app.models.user import User
from app.services.analysis_service import AnalysisService
from app.tools.financial_metrics import compute_financial_metrics


class DashboardService:
    def __init__(self, analysis_service: AnalysisService) -> None:
        self.analysis_service = analysis_service

    async def get_dashboard(self, *, session: AsyncSession, user: User) -> dict:
        analysis = await self.analysis_service.run_analysis(session=session, user=user)
        transactions = (
            await session.execute(select(Transaction).where(Transaction.user_id == user.id))
        ).scalars().all()
        metrics = compute_financial_metrics(transactions)
        goals = (
            await session.execute(select(Goal).where(Goal.user_id == user.id).limit(5))
        ).scalars().all()
        alerts = (
            await session.execute(
                select(RiskAlert).where(RiskAlert.user_id == user.id).order_by(RiskAlert.created_at.desc()).limit(5)
            )
        ).scalars().all()

        monthly_trends = [
            {"month": month, "income": values["income"], "expenses": values["expenses"]}
            for month, values in metrics.monthly_trends.items()
        ]
        if not monthly_trends and user.monthly_income is not None:
            monthly_trends = [
                {
                    "month": date.today().strftime("%Y-%m"),
                    "income": float(user.monthly_income),
                    "expenses": 0.0,
                }
            ]

        latest_month = monthly_trends[-1] if monthly_trends else {"income": 0.0, "expenses": 0.0}
        income_value = latest_month["income"]
        if income_value == 0 and user.monthly_income is not None:
            income_value = float(user.monthly_income)
        expense_value = latest_month["expenses"]
        savings_value = income_value - expense_value

        quick_insights: list[str] = []
        if transactions:
            # Only surface meaningful insights — skip nonsense like negative savings
            # rates (debit-only statements) and "uncategorized" largest category.
            if 0 <= metrics.savings_rate <= 1.5:
                rate_pct = metrics.savings_rate * 100
                if rate_pct >= 20:
                    quick_insights.append(
                        f"You're saving {rate_pct:.0f}% of what you earn — healthy."
                    )
                elif rate_pct >= 10:
                    quick_insights.append(
                        f"You're saving {rate_pct:.0f}% of what you earn. Push past 20% if you can."
                    )
                else:
                    quick_insights.append(
                        f"You're saving {rate_pct:.0f}% of what you earn — too low, aim for 20%."
                    )

            largest = (metrics.largest_category or "").strip().lower()
            if largest and largest not in {"uncategorized", "other", ""}:
                quick_insights.append(
                    f"Your biggest spend is on {largest.replace('_', ' ')}."
                )

            if metrics.emergency_fund_months >= 0.5:
                quick_insights.append(
                    f"Your emergency buffer covers {metrics.emergency_fund_months:.1f} months of expenses."
                )

        if not quick_insights:
            quick_insights = [
                "Your setup numbers are loaded — scroll down for personal advice.",
                "Upload a bank or UPI statement to unlock automatic spending insights.",
            ]

        return {
            "health_score": {
                "score": analysis.financial_score,
                "trend": "improving" if analysis.financial_score >= 65 else "watch",
            },
            "monthly_overview": {
                "income": income_value,
                "expenses": expense_value,
                "savings": savings_value,
            },
            "spending_breakdown": metrics.category_breakdown,
            "cashflow_chart": monthly_trends,
            "active_goals": [
                {
                    "title": goal.title,
                    "progress_pct": float((goal.current_amount / goal.target_amount) * 100) if goal.target_amount else 0.0,
                    "on_track": float(goal.success_probability or 0) >= 70,
                }
                for goal in goals
            ],
            "recent_alerts": [
                {
                    "alert_id": str(alert.alert_id),
                    "title": alert.title,
                    "severity": alert.severity.value,
                    "message": alert.message,
                }
                for alert in alerts
            ],
            "quick_insights": quick_insights,
        }
