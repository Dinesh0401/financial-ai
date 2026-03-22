import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from pydantic import BaseModel
from typing import Optional

from database import get_db
from models.user import User
from models.goal import Goal
from models.loan import Loan
from routers.auth import get_current_user

router = APIRouter(tags=["goals"])


class GoalCreate(BaseModel):
    name: str
    target_amount: float
    current_amount: Optional[float] = 0
    deadline_years: Optional[float] = 5
    priority: Optional[str] = "medium"


class LoanCreate(BaseModel):
    loan_type: str
    outstanding: float
    annual_rate: float
    monthly_emi: float


@router.get("")
async def get_goals(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Goal).where(Goal.user_id == current_user.id))
    goals = result.scalars().all()
    return [
        {
            'id': g.id, 'name': g.name,
            'target_amount': float(g.target_amount or 0),
            'current_amount': float(g.current_amount or 0),
            'deadline_years': float(g.deadline_years or 5),
            'priority': g.priority, 'probability': float(g.probability or 0),
            'status': g.status, 'created_at': g.created_at.isoformat(),
        }
        for g in goals
    ]


@router.post("")
async def create_goal(
    req: GoalCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from tools.goal_simulator import goal_simulator
    from models.loan import Loan
    from models.transaction import Transaction

    # Auto-run Monte Carlo
    loan_result = await db.execute(select(Loan).where(Loan.user_id == current_user.id))
    loans = [{'monthly_emi': float(l.monthly_emi or 0)} for l in loan_result.scalars().all()]
    total_emi = sum(l['monthly_emi'] for l in loans)
    income = float(current_user.monthly_income or 30000)
    surplus = max(0, income - total_emi)
    monthly_savings = surplus * 0.20

    sim = goal_simulator(
        target=req.target_amount,
        monthly_savings=monthly_savings,
        years=req.deadline_years or 5,
        current_amount=req.current_amount or 0,
    )

    goal = Goal(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        name=req.name,
        target_amount=req.target_amount,
        current_amount=req.current_amount or 0,
        deadline_years=req.deadline_years,
        priority=req.priority,
        probability=sim['probability'],
        status='active',
    )
    db.add(goal)
    await db.flush()
    return {
        'id': goal.id,
        'probability': sim['probability'],
        'median_outcome': sim['median_outcome'],
        'chart_data': sim['chart_data'][:10],
    }


@router.post("/simulate")
async def simulate_goal(
    req: dict,
    current_user: User = Depends(get_current_user),
):
    from tools.goal_simulator import goal_simulator, what_if_simulation
    target = float(req.get('target_amount', 0))
    monthly_savings = float(req.get('monthly_savings', 5000))
    years = float(req.get('deadline_years', 5))
    delta_savings = float(req.get('delta_savings', 0))
    delta_months = float(req.get('delta_months', 0))
    current = float(req.get('current_amount', 0))

    if delta_savings != 0 or delta_months != 0:
        return what_if_simulation(target, monthly_savings, years, delta_savings, delta_months, current)

    return goal_simulator(target, monthly_savings, years, current)


@router.put("/{goal_id}")
async def update_goal(
    goal_id: str,
    req: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Goal).where(Goal.id == goal_id, Goal.user_id == current_user.id)
    )
    goal = result.scalar_one_or_none()
    if not goal:
        raise HTTPException(404, "Goal not found")
    for key, val in req.items():
        if hasattr(goal, key) and key not in ('id', 'user_id', 'created_at'):
            setattr(goal, key, val)
    db.add(goal)
    return {'id': goal.id}


@router.delete("/{goal_id}")
async def delete_goal(
    goal_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(delete(Goal).where(Goal.id == goal_id, Goal.user_id == current_user.id))
    return {'deleted': goal_id}


# ─── LOANS CRUD ────────────────────────────────────────────────────────────────
@router.get("/loans", tags=["loans"])
async def get_loans(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Loan).where(Loan.user_id == current_user.id))
    return [{'id': l.id, 'loan_type': l.loan_type, 'outstanding': float(l.outstanding or 0),
              'annual_rate': float(l.annual_rate or 0), 'monthly_emi': float(l.monthly_emi or 0)}
            for l in result.scalars().all()]


@router.post("/loans", tags=["loans"])
async def create_loan(req: LoanCreate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    loan = Loan(id=str(uuid.uuid4()), user_id=current_user.id, **req.dict())
    db.add(loan)
    await db.flush()
    return {'id': loan.id}


@router.delete("/loans/{loan_id}", tags=["loans"])
async def delete_loan(loan_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await db.execute(delete(Loan).where(Loan.id == loan_id, Loan.user_id == current_user.id))
    return {'deleted': loan_id}
