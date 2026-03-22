import json
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional

from database import get_db
from models.user import User
from models.transaction import Transaction
from models.goal import Goal
from models.loan import Loan
from routers.auth import get_current_user
from agents.orchestrator import run_full_pipeline
from memory.financial_memory import save_plan

router = APIRouter(tags=["agents"])


class AgentRunRequest(BaseModel):
    query: str


async def _fetch_user_data(user_id: str, db: AsyncSession) -> dict:
    """Fetch all user financial data for agent context"""
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()

    tx_result = await db.execute(
        select(Transaction).where(Transaction.user_id == user_id).limit(500)
    )
    transactions = [
        {'date': str(t.date), 'amount': float(t.amount), 'description': t.description,
         'category': t.category, 'type': t.type}
        for t in tx_result.scalars().all()
    ]

    goal_result = await db.execute(select(Goal).where(Goal.user_id == user_id))
    goals = [
        {'name': g.name, 'target_amount': float(g.target_amount or 0),
         'current_amount': float(g.current_amount or 0),
         'deadline_years': float(g.deadline_years or 5), 'probability': float(g.probability or 0)}
        for g in goal_result.scalars().all()
    ]

    loan_result = await db.execute(select(Loan).where(Loan.user_id == user_id))
    loans = [
        {'loan_type': l.loan_type, 'outstanding': float(l.outstanding or 0),
         'annual_rate': float(l.annual_rate or 0), 'monthly_emi': float(l.monthly_emi or 0)}
        for l in loan_result.scalars().all()
    ]

    # Estimate monthly expenses from last 30 days of transactions
    import pandas as pd
    if transactions:
        df = pd.DataFrame(transactions)
        df['date'] = pd.to_datetime(df['date'], errors='coerce')
        debits = df[df['type'] == 'debit']
        monthly_expenses = float(debits['amount'].sum() / max(len(debits['date'].dt.month.unique()), 1)) if not debits.empty else 0
    else:
        monthly_expenses = 0

    return {
        'monthly_income': float(user.monthly_income or 0) if user else 0,
        'monthly_expenses': monthly_expenses,
        'risk_tolerance': user.risk_tolerance if user else 'moderate',
        'transactions': transactions,
        'goals': goals,
        'loans': loans,
        'savings': max(0, float(user.monthly_income or 0) - monthly_expenses),
    }


@router.post("/run")
async def run_agents_stream(
    req: AgentRunRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_data = await _fetch_user_data(current_user.id, db)

    async def event_generator():
        try:
            yield f"data: {json.dumps({'phase': 'start', 'msg': 'Fetching your financial data...'})}\n\n"

            yield f"data: {json.dumps({'phase': 'tools', 'msg': 'Running financial tools (cashflow, risk, loan analysis)...'})}\n\n"

            yield f"data: {json.dumps({'phase': 'orchestrate', 'msg': 'Orchestrator analyzing financial state and planning agent activation...'})}\n\n"

            # Run each agent step with SSE updates
            from agents.orchestrator import orchestrator_node, expense_agent_node, debt_agent_node
            from agents.orchestrator import goal_agent_node, risk_agent_node, investment_agent_node, coordinator_node
            from agents.orchestrator import FinancialState
            import operator

            state: FinancialState = {
                'user_id': current_user.id,
                'query': req.query,
                'user_data': user_data,
                'tool_outputs': {},
                'agent_outputs': {},
                'plan': {},
                'conflicts': [],
                'final_recommendation': {},
                'health_score': 0.0,
                'messages': [],
            }

            state = orchestrator_node(state)
            agents_to_run = state['plan'].get('agents_to_activate', ['expense_agent', 'risk_agent'])

            yield f"data: {json.dumps({'phase': 'plan', 'agents': agents_to_run, 'reason': state['plan'].get('reason', '')})}\n\n"

            agent_fns = {
                'expense_agent': expense_agent_node,
                'debt_agent': debt_agent_node,
                'goal_agent': goal_agent_node,
                'risk_agent': risk_agent_node,
                'investment_agent': investment_agent_node,
            }

            for agent in agents_to_run:
                if agent in agent_fns:
                    yield f"data: {json.dumps({'phase': 'agent_start', 'agent': agent})}\n\n"
                    state = agent_fns[agent](state)
                    output = state['agent_outputs'].get(agent, {})
                    yield f"data: {json.dumps({'phase': 'agent_done', 'agent': agent, 'data': output})}\n\n"

            yield f"data: {json.dumps({'phase': 'coordinating', 'msg': 'Coordinator resolving conflicts and generating final plan...'})}\n\n"
            state = coordinator_node(state)

            final = state['final_recommendation']
            # Save to persistent memory
            await save_plan(db, current_user.id, state['health_score'], final)

            yield f"data: {json.dumps({'phase': 'final', 'data': final})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'phase': 'error', 'msg': str(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@router.get("/history")
async def get_agent_history(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from memory.financial_memory import get_plan_history
    return await get_plan_history(db, current_user.id)
