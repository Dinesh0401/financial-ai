from __future__ import annotations

from datetime import date
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.goal import Goal
from app.models.transaction import Transaction
from app.models.user import User
from app.tools.financial_metrics import compute_financial_metrics
from app.tools.goal_simulator import simulate_goal


def _add_months(start_date: date, months: int) -> date:
    month = start_date.month - 1 + months
    year = start_date.year + month // 12
    month = month % 12 + 1
    day = min(start_date.day, [31, 29 if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0) else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1])
    return date(year, month, day)


class GoalService:
    async def create_goal(self, *, session: AsyncSession, user: User, payload: dict) -> tuple[Goal, dict]:
        transactions = (
            await session.execute(select(Transaction).where(Transaction.user_id == user.id))
        ).scalars().all()
        metrics = compute_financial_metrics(transactions)
        monthly_saving = max(Decimal("0.00"), (metrics.total_income - metrics.total_expenses) / max(1, len(metrics.monthly_trends) or 1))
        simulation = simulate_goal(
            target_amount=payload["target_amount"],
            current_amount=payload.get("current_amount", Decimal("0.00")),
            timeline_months=payload["timeline_months"],
            monthly_saving=monthly_saving,
        )

        goal = Goal(
            user_id=user.id,
            goal_type=payload["goal_type"],
            title=payload["title"],
            target_amount=payload["target_amount"],
            current_amount=payload.get("current_amount", Decimal("0.00")),
            timeline_months=payload["timeline_months"],
            target_date=_add_months(date.today(), payload["timeline_months"]),
            monthly_required=simulation.monthly_required,
            success_probability=Decimal(str(round(simulation.success_probability, 2))),
            simulation_data=simulation.to_dict(),
        )
        session.add(goal)
        await session.flush()
        await session.refresh(goal)
        return goal, simulation.to_dict()

    async def list_goals(self, *, session: AsyncSession, user: User) -> list[Goal]:
        return (
            await session.execute(select(Goal).where(Goal.user_id == user.id).order_by(Goal.created_at.desc()))
        ).scalars().all()

    async def predict_goal(self, *, session: AsyncSession, user: User, goal_id: str) -> dict | None:
        goal = await session.scalar(select(Goal).where(Goal.goal_id == goal_id, Goal.user_id == user.id))
        if goal is None:
            return None

        transactions = (
            await session.execute(select(Transaction).where(Transaction.user_id == user.id))
        ).scalars().all()
        metrics = compute_financial_metrics(transactions)
        monthly_saving = max(Decimal("0.00"), (metrics.total_income - metrics.total_expenses) / max(1, len(metrics.monthly_trends) or 1))
        simulation = simulate_goal(
            target_amount=Decimal(goal.target_amount),
            current_amount=Decimal(goal.current_amount),
            timeline_months=goal.timeline_months,
            monthly_saving=monthly_saving,
        )

        return {
            "goal": goal,
            "on_track": simulation.success_probability >= 75,
            "months_remaining": goal.timeline_months,
            "projected_amount": simulation.percentile_50,
            "success_probability": simulation.success_probability,
            "recommended_adjustments": [
                f"Increase monthly saving by Rs {max(0, int(simulation.monthly_required - monthly_saving)):,} to improve confidence."
                if monthly_saving < simulation.monthly_required
                else "Maintain current contribution pace to stay on track."
            ],
        }

