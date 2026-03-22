from typing import TypedDict, Annotated, List
import operator
from config import settings

from tools.expense_classifier import classify_batch
from tools.cashflow_predictor import cashflow_predictor
from tools.goal_simulator import goal_simulator
from tools.loan_optimizer import loan_optimizer
from tools.risk_analyzer import risk_analyzer
from utils.health_score import calculate_health_score
from utils.indian_finance import recommended_sip_allocation


class FinancialState(TypedDict):
    user_id: str
    query: str
    user_data: dict          # income, expenses, loans, goals, savings, risk_tolerance
    tool_outputs: dict       # results from all tools
    agent_outputs: dict      # results from each agent
    plan: dict               # orchestrator execution plan
    conflicts: list          # detected conflicts between agents
    final_recommendation: dict
    health_score: float
    messages: Annotated[list, operator.add]


def orchestrator_node(state: FinancialState) -> FinancialState:
    """Decides which agents to activate based on financial state"""
    data = state.get('user_data', {})
    income = float(data.get('monthly_income', 0) or 0)
    loans = data.get('loans', [])
    goals = data.get('goals', [])
    query = state.get('query', '').lower()

    total_emi = sum(float(l.get('monthly_emi', 0) or 0) for l in loans)
    dti = total_emi / income if income > 0 else 0

    agents_to_activate = ['expense_agent', 'risk_agent']  # Always on

    if dti > 0.20 or loans:
        agents_to_activate.append('debt_agent')
    if goals:
        agents_to_activate.append('goal_agent')
    if income > 20000:
        agents_to_activate.append('investment_agent')

    # Query-based activation
    if any(w in query for w in ['invest', 'sip', 'mutual fund', 'nps', 'ppf', 'stock']):
        if 'investment_agent' not in agents_to_activate:
            agents_to_activate.append('investment_agent')
    if any(w in query for w in ['loan', 'emi', 'debt', 'credit card', 'repay']):
        if 'debt_agent' not in agents_to_activate:
            agents_to_activate.append('debt_agent')
    if any(w in query for w in ['goal', 'house', 'car', 'retire', 'education', 'travel']):
        if 'goal_agent' not in agents_to_activate:
            agents_to_activate.append('goal_agent')

    plan = {
        'agents_to_activate': agents_to_activate,
        'reason': f'DTI={dti:.1%}, loans={len(loans)}, goals={len(goals)}, query_analyzed=True',
    }

    # Run all financial tools
    transactions = data.get('transactions', [])
    savings = float(data.get('savings', 0) or 0)
    expenses = float(data.get('monthly_expenses', 0) or 0)
    risk_tolerance = data.get('risk_tolerance', 'moderate')

    cashflow = cashflow_predictor(transactions)
    loan_strategy = loan_optimizer(loans)
    risks = risk_analyzer(income, expenses, loans, savings)
    health = calculate_health_score(income, expenses, loans, savings, goals)
    sip_alloc = recommended_sip_allocation(income, expenses, loans, risk_tolerance)

    tool_outputs = {
        'cashflow': cashflow,
        'loan_strategy': loan_strategy,
        'risks': risks,
        'health': health,
        'sip_allocation': sip_alloc,
    }

    return {
        **state,
        'plan': plan,
        'tool_outputs': tool_outputs,
        'health_score': health['total'],
        'messages': [{'role': 'orchestrator', 'content': f"Plan: {plan}"}],
    }


def expense_agent_node(state: FinancialState) -> FinancialState:
    """Analyzes spending patterns and compares against 50/30/20 rule"""
    data = state.get('user_data', {})
    income = float(data.get('monthly_income', 0) or 0)
    cashflow = state['tool_outputs'].get('cashflow', {})

    avg_spend = cashflow.get('avg_monthly_spend', 0)
    category_breakdown = cashflow.get('category_breakdown', {})
    trend = cashflow.get('monthly_trend', 0)

    # 50/30/20 analysis
    needs_limit = income * 0.50
    wants_limit = income * 0.30
    savings_target = income * 0.20

    needs_cats = ['Housing', 'Utilities', 'Groceries', 'Fuel', 'EMI', 'Health', 'Transport']
    wants_cats = ['Food Delivery', 'Dining', 'Shopping', 'Entertainment', 'Subscription', 'Travel']

    needs_total = sum(category_breakdown.get(c, 0) for c in needs_cats)
    wants_total = sum(category_breakdown.get(c, 0) for c in wants_cats)

    recommendations = []
    if trend > 500:
        recommendations.append(f'Spending is increasing by ₹{trend:,.0f}/month — intervention needed')
    if wants_total > wants_limit:
        recommendations.append(f'Discretionary (wants) spending ₹{wants_total:,.0f} exceeds ₹{wants_limit:,.0f} (30% limit)')

    top_categories = sorted(category_breakdown.items(), key=lambda x: x[1], reverse=True)[:3]

    output = {
        'avg_monthly_spend': avg_spend,
        'spending_trend': trend,
        'trend_risk': cashflow.get('risk', 'LOW'),
        'category_breakdown': category_breakdown,
        'top_3_categories': top_categories,
        'rule_503020': {
            'needs': {'actual': needs_total, 'limit': needs_limit, 'ok': needs_total <= needs_limit},
            'wants': {'actual': wants_total, 'limit': wants_limit, 'ok': wants_total <= wants_limit},
        },
        'recommendations': recommendations,
    }

    return {
        **state,
        'agent_outputs': {**state.get('agent_outputs', {}), 'expense_agent': output},
        'messages': [{'role': 'expense_agent', 'content': f"Analyzed {len(category_breakdown)} categories"}],
    }


def debt_agent_node(state: FinancialState) -> FinancialState:
    """Analyzes loan portfolio and recommends Avalanche strategy"""
    data = state.get('user_data', {})
    strategy = state['tool_outputs'].get('loan_strategy', {})
    income = float(data.get('monthly_income', 0) or 0)
    loans = data.get('loans', [])

    total_outstanding = sum(float(l.get('outstanding', 0) or 0) for l in loans)
    total_emi = sum(float(l.get('monthly_emi', 0) or 0) for l in loans)
    dti = total_emi / income if income > 0 else 0

    recommendations = []
    if dti > 0.40:
        recommendations.append('URGENT: Contact bank to restructure loans — DTI above safe limit')
    if total_outstanding > income * 36:  # More than 3 years income in debt
        recommendations.append('Outstanding debt exceeds 3x annual income — aggressive paydown required')

    surplus = float(data.get('monthly_income', 0) or 0) - float(data.get('monthly_expenses', 0) or 0)
    extra_monthly = max(0, surplus * 0.30)  # Suggest 30% of surplus to accelerate debt

    output = {
        'total_outstanding': total_outstanding,
        'total_emi': total_emi,
        'dti_percent': round(dti * 100, 1),
        'avalanche_strategy': strategy.get('strategy', []),
        'total_interest_payable': strategy.get('total_interest', 0),
        'suggested_extra_payment': round(extra_monthly, 0),
        'recommendations': recommendations,
    }

    return {
        **state,
        'agent_outputs': {**state.get('agent_outputs', {}), 'debt_agent': output},
        'messages': [{'role': 'debt_agent', 'content': f"Analyzed {len(loans)} loans, DTI={dti:.1%}"}],
    }


def goal_agent_node(state: FinancialState) -> FinancialState:
    """Runs Monte Carlo on all goals and flags at-risk ones"""
    data = state.get('user_data', {})
    goals = data.get('goals', [])
    income = float(data.get('monthly_income', 0) or 0)
    expenses = float(data.get('monthly_expenses', 0) or 0)
    loans = data.get('loans', [])
    total_emi = sum(float(l.get('monthly_emi', 0) or 0) for l in loans)
    surplus = income - expenses - total_emi
    monthly_available = max(0, surplus / max(len(goals), 1))

    goal_results = []
    at_risk = []

    for goal in goals:
        target = float(goal.get('target_amount', 0) or 0)
        current = float(goal.get('current_amount', 0) or 0)
        years = float(goal.get('deadline_years', 5) or 5)
        monthly_savings = monthly_available

        sim = goal_simulator(
            target=target,
            monthly_savings=monthly_savings,
            years=years,
            current_amount=current,
        )
        prob = sim['probability']
        goal_results.append({
            'name': goal.get('name'),
            'target': target,
            'current': current,
            'probability': prob,
            'median_outcome': sim['median_outcome'],
            'shortfall': sim['shortfall_risk'],
            'status': 'ON_TRACK' if prob >= 60 else 'AT_RISK' if prob >= 30 else 'CRITICAL',
        })
        if prob < 60:
            at_risk.append(goal.get('name'))

    recommendations = []
    if at_risk:
        recommendations.append(f'Goals at risk: {", ".join(at_risk)} — increase monthly savings')
    if surplus < 5000:
        recommendations.append('Low surplus — consider extending goal timelines by 12-24 months')

    output = {
        'goals': goal_results,
        'at_risk_count': len(at_risk),
        'on_track_count': len(goals) - len(at_risk),
        'recommendations': recommendations,
        'monthly_available_per_goal': round(monthly_available, 0),
    }

    return {
        **state,
        'agent_outputs': {**state.get('agent_outputs', {}), 'goal_agent': output},
        'messages': [{'role': 'goal_agent', 'content': f"{len(at_risk)}/{len(goals)} goals at risk"}],
    }


def risk_agent_node(state: FinancialState) -> FinancialState:
    """Produces comprehensive risk flags and severity scores"""
    data = state.get('user_data', {})
    risks = state['tool_outputs'].get('risks', {})

    output = {
        **risks,
        'has_critical': risks.get('severity') == 'CRITICAL',
        'priority_action': risks.get('flags', [{}])[0].get('action') if risks.get('flags') else 'Maintain current trajectory',
    }

    return {
        **state,
        'agent_outputs': {**state.get('agent_outputs', {}), 'risk_agent': output},
        'messages': [{'role': 'risk_agent', 'content': f"Severity={risks.get('severity')}, {risks.get('flag_count', 0)} flags"}],
    }


def investment_agent_node(state: FinancialState) -> FinancialState:
    """Suggests SIP allocation, NPS, PPF based on risk profile"""
    data = state.get('user_data', {})
    sip = state['tool_outputs'].get('sip_allocation', {})
    income = float(data.get('monthly_income', 0) or 0)
    risk_tolerance = data.get('risk_tolerance', 'moderate')

    # Calculate 10-year projection for total portfolio
    from utils.indian_finance import calculate_sip, calculate_ppf, calculate_nps
    total_investable = float(sip.get('total_investable', 0) or 0)
    equity_portion = total_investable * 0.60
    sip_10yr = calculate_sip(equity_portion, 12.0, 10)
    ppf_annual = min(total_investable * 12 * 0.10, 150000)
    ppf_result = calculate_ppf(ppf_annual, 15)
    nps_monthly = total_investable * 0.10
    nps_result = calculate_nps(nps_monthly, 30)

    recommendations = []
    if total_investable < 1000:
        recommendations.append('Build emergency fund first before any investment')
    else:
        recommendations.append(f'Automate SIP of ₹{equity_portion:,.0f}/month to large-cap fund on salary day')
        recommendations.append(f'Start PPF for tax benefit under 80C — ₹{ppf_annual:,.0f}/year')

    output = {
        'total_investable': total_investable,
        'allocation': sip.get('allocation', {}),
        'risk_profile': risk_tolerance,
        'projections': {
            'sip_10yr': sip_10yr,
            'ppf_15yr': ppf_result,
            'nps_30yr': nps_result,
        },
        'recommendations': recommendations,
    }

    return {
        **state,
        'agent_outputs': {**state.get('agent_outputs', {}), 'investment_agent': output},
        'messages': [{'role': 'investment_agent', 'content': f"Investable=₹{total_investable:,.0f}"}],
    }


def coordinator_node(state: FinancialState) -> FinancialState:
    """Synthesizes all agent outputs, resolves conflicts, produces final recommendation"""
    agent_outputs = state.get('agent_outputs', {})
    health = state['tool_outputs'].get('health', {})
    plan = state.get('plan', {})

    # Detect conflicts between agents
    conflicts = []
    debt_output = agent_outputs.get('debt_agent', {})
    invest_output = agent_outputs.get('investment_agent', {})

    if debt_output and invest_output:
        dti = debt_output.get('dti_percent', 0)
        investable = invest_output.get('total_investable', 0)
        if dti > 40 and investable > 5000:
            conflicts.append({
                'agents': ['debt_agent', 'investment_agent'],
                'conflict': 'Debt agent suggests aggressive repayment; Investment agent suggests SIP',
                'resolution': 'DEBT_FIRST: Clear high-interest debt before investing beyond emergency fund',
            })

    # Priority actions
    priority_actions = []
    all_recs = []
    for agent, output in agent_outputs.items():
        recs = output.get('recommendations', [])
        all_recs.extend([(agent, r) for r in recs])

    # Sort: CRITICAL risk flags first
    risk_output = agent_outputs.get('risk_agent', {})
    flags = risk_output.get('flags', [])
    for flag in flags:
        if flag.get('severity') in ('CRITICAL', 'HIGH'):
            priority_actions.append({
                'priority': len(priority_actions) + 1,
                'source': 'risk_agent',
                'action': flag.get('action'),
                'why': flag.get('msg'),
            })

    for agent, rec in all_recs[:3]:
        priority_actions.append({
            'priority': len(priority_actions) + 1,
            'source': agent,
            'action': rec,
        })

    # Month 1 allocation
    income = float(state.get('user_data', {}).get('monthly_income', 0) or 0)
    expenses = float(state.get('user_data', {}).get('monthly_expenses', 0) or 0)
    loans = state.get('user_data', {}).get('loans', [])
    total_emi = sum(float(l.get('monthly_emi', 0) or 0) for l in loans)
    surplus = income - expenses - total_emi
    investable = float(invest_output.get('total_investable', 0) or 0) if invest_output else 0

    month1_allocation = {
        'Fixed Expenses': round(expenses, 0),
        'EMI Payments': round(total_emi, 0),
        'Emergency Fund Build': round(min(surplus * 0.20, 5000), 0) if surplus > 0 else 0,
        'SIP / Investment': round(investable, 0),
        'Additional Debt Repayment': round(surplus * 0.10, 0) if surplus > 0 else 0,
        'Buffer': round(max(0, surplus - investable - min(surplus * 0.20, 5000)), 0),
    }

    conflict_text = '; '.join(c.get('resolution', '') for c in conflicts) if conflicts else 'No conflicts detected'

    final_recommendation = {
        'health_score': health,
        'agents_activated': list(agent_outputs.keys()),
        'conflicts': conflicts,
        'conflict_resolution': conflict_text,
        'priority_actions': priority_actions[:5],
        'month1_allocation': month1_allocation,
        'agent_outputs': agent_outputs,
    }

    return {
        **state,
        'final_recommendation': final_recommendation,
        'conflicts': conflicts,
        'messages': [{'role': 'coordinator', 'content': f"Resolved {len(conflicts)} conflicts, {len(priority_actions)} actions"}],
    }


def build_agent_graph():
    """Build and compile the LangGraph StateGraph"""
    try:
        from langgraph.graph import StateGraph, END

        graph = StateGraph(FinancialState)
        graph.add_node('orchestrator', orchestrator_node)
        graph.add_node('expense_agent', expense_agent_node)
        graph.add_node('debt_agent', debt_agent_node)
        graph.add_node('goal_agent', goal_agent_node)
        graph.add_node('risk_agent', risk_agent_node)
        graph.add_node('investment_agent', investment_agent_node)
        graph.add_node('coordinator', coordinator_node)

        graph.set_entry_point('orchestrator')

        def route_to_agents(state: FinancialState):
            plan = state.get('plan', {})
            return plan.get('agents_to_activate', ['expense_agent', 'risk_agent'])[0]

        graph.add_conditional_edges('orchestrator', route_to_agents, {
            'expense_agent': 'expense_agent',
            'debt_agent': 'debt_agent',
            'goal_agent': 'goal_agent',
            'risk_agent': 'risk_agent',
            'investment_agent': 'investment_agent',
        })

        for agent in ['expense_agent', 'debt_agent', 'goal_agent', 'risk_agent', 'investment_agent']:
            graph.add_edge(agent, 'coordinator')
        graph.add_edge('coordinator', END)

        return graph.compile()
    except Exception:
        return None


async def run_full_pipeline(user_id: str, query: str, user_data: dict) -> dict:
    """Run the complete agent pipeline and return final recommendation"""
    initial_state: FinancialState = {
        'user_id': user_id,
        'query': query,
        'user_data': user_data,
        'tool_outputs': {},
        'agent_outputs': {},
        'plan': {},
        'conflicts': [],
        'final_recommendation': {},
        'health_score': 0.0,
        'messages': [],
    }

    # Run orchestrator
    state = orchestrator_node(initial_state)
    agents_to_run = state['plan'].get('agents_to_activate', ['expense_agent', 'risk_agent'])

    # Run activated agents
    agent_fns = {
        'expense_agent': expense_agent_node,
        'debt_agent': debt_agent_node,
        'goal_agent': goal_agent_node,
        'risk_agent': risk_agent_node,
        'investment_agent': investment_agent_node,
    }
    for agent in agents_to_run:
        if agent in agent_fns:
            state = agent_fns[agent](state)

    # Run coordinator
    state = coordinator_node(state)
    return state['final_recommendation']
