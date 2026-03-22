from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from models.financial_plan import FinancialPlan
import uuid


async def save_plan(db: AsyncSession, user_id: str, health_score: float, plan_json: dict, conflict_resolved: str = None) -> FinancialPlan:
    """Save a new financial plan to persistent memory"""
    plan = FinancialPlan(
        id=str(uuid.uuid4()),
        user_id=user_id,
        health_score=health_score,
        plan_json=plan_json,
        conflict_resolved=conflict_resolved,
    )
    db.add(plan)
    await db.flush()
    return plan


async def get_latest_plan(db: AsyncSession, user_id: str) -> Optional[FinancialPlan]:
    """Retrieve the most recent plan for a user"""
    result = await db.execute(
        select(FinancialPlan)
        .where(FinancialPlan.user_id == user_id)
        .order_by(desc(FinancialPlan.created_at))
        .limit(1)
    )
    return result.scalar_one_or_none()


async def get_plan_history(db: AsyncSession, user_id: str, limit: int = 5) -> list:
    """Get historical plans for trend analysis"""
    result = await db.execute(
        select(FinancialPlan)
        .where(FinancialPlan.user_id == user_id)
        .order_by(desc(FinancialPlan.created_at))
        .limit(limit)
    )
    plans = result.scalars().all()
    return [
        {
            'id': p.id,
            'health_score': float(p.health_score or 0),
            'plan_json': p.plan_json,
            'conflict_resolved': p.conflict_resolved,
            'created_at': p.created_at.isoformat(),
        }
        for p in plans
    ]


async def get_health_score_trend(db: AsyncSession, user_id: str) -> list:
    """Get health score history for trend visualization"""
    plans = await get_plan_history(db, user_id, limit=10)
    return [{'date': p['created_at'][:10], 'score': p['health_score']} for p in reversed(plans)]
