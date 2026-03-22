from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db
from models.user import User
from models.transaction import Transaction
from models.goal import Goal
from models.loan import Loan
from routers.auth import get_current_user
from utils.health_score import calculate_health_score
from tools.risk_analyzer import risk_analyzer
from tools.cashflow_predictor import cashflow_predictor

router = APIRouter(tags=["dashboard"])


@router.get("/summary")
async def get_dashboard_summary(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    income = float(current_user.monthly_income or 0)

    # Fetch all data
    tx_result = await db.execute(
        select(Transaction).where(Transaction.user_id == current_user.id).limit(500)
    )
    transactions = tx_result.scalars().all()

    goal_result = await db.execute(select(Goal).where(Goal.user_id == current_user.id))
    goals = goal_result.scalars().all()

    loan_result = await db.execute(select(Loan).where(Loan.user_id == current_user.id))
    loans = loan_result.scalars().all()

    # Compute monthly expenses
    import pandas as pd
    tx_dicts = [{'date': str(t.date), 'amount': float(t.amount), 'type': t.type,
                 'category': t.category, 'description': t.description,
                 'merchant': t.merchant} for t in transactions]

    if tx_dicts:
        df = pd.DataFrame(tx_dicts)
        df['date'] = pd.to_datetime(df['date'], errors='coerce')
        debits = df[df['type'] == 'debit']
        months_count = max(1, len(debits['date'].dt.to_period('M').unique()) if not debits.empty else 1)
        avg_expenses = float(debits['amount'].sum() / months_count) if not debits.empty else 0
    else:
        avg_expenses = 0

    loans_dicts = [{'loan_type': l.loan_type, 'outstanding': float(l.outstanding or 0),
                    'annual_rate': float(l.annual_rate or 0), 'monthly_emi': float(l.monthly_emi or 0)}
                   for l in loans]
    goals_dicts = [{'name': g.name, 'probability': float(g.probability or 0)} for g in goals]

    total_emi = sum(l['monthly_emi'] for l in loans_dicts)
    total_outstanding = sum(l['outstanding'] for l in loans_dicts)
    surplus = income - avg_expenses - total_emi
    savings = max(0, surplus * 3)

    # Calculate health score
    health = calculate_health_score(income, avg_expenses, loans_dicts, savings, goals_dicts)

    # Risk analysis
    risks = risk_analyzer(income, avg_expenses, loans_dicts, savings)

    # Cashflow prediction
    cashflow = cashflow_predictor(tx_dicts, months_ahead=3)

    # Category spending for last month
    recent_tx = [t for t in tx_dicts if t.get('type') == 'debit']
    category_totals = {}
    for tx in recent_tx:
        cat = tx.get('category', 'Other') or 'Other'
        category_totals[cat] = category_totals.get(cat, 0) + tx.get('amount', 0)

    # Recent transactions (last 10)
    recent = sorted(tx_dicts, key=lambda x: x.get('date', ''), reverse=True)[:10]

    return {
        'kpis': {
            'monthly_income': income,
            'monthly_expenses': round(avg_expenses, 2),
            'monthly_surplus': round(surplus, 2),
            'total_debt': round(total_outstanding, 2),
            'total_emi': round(total_emi, 2),
            'emergency_months': round(savings / avg_expenses if avg_expenses > 0 else 0, 1),
            'savings_estimate': round(savings, 2),
        },
        'health_score': health,
        'risks': risks,
        'cashflow': cashflow,
        'category_spending': {k: round(v, 2) for k, v in sorted(category_totals.items(), key=lambda x: x[1], reverse=True)[:8]},
        'recent_transactions': recent,
        'goals_count': len(goals),
        'loans_count': len(loans),
        'user': {
            'name': current_user.name,
            'email': current_user.email,
            'risk_tolerance': current_user.risk_tolerance,
        },
    }
