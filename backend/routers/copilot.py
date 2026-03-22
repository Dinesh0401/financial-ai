from fastapi import APIRouter, Depends
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

router = APIRouter(tags=["copilot"])


class ChatRequest(BaseModel):
    message: str
    conversation_history: Optional[list] = []


async def _build_financial_context(user: User, db: AsyncSession) -> dict:
    """Build rich financial context dict from DB"""
    income = float(user.monthly_income or 0)

    tx_result = await db.execute(
        select(Transaction).where(Transaction.user_id == user.id).limit(200)
    )
    transactions = tx_result.scalars().all()
    total_debits = sum(float(t.amount) for t in transactions if t.type == 'debit')
    total_credits = sum(float(t.amount) for t in transactions if t.type == 'credit')
    months_count = max(1, len(set(str(t.date)[:7] for t in transactions)))
    avg_expenses = total_debits / months_count

    goal_result = await db.execute(select(Goal).where(Goal.user_id == user.id))
    goals = goal_result.scalars().all()

    loan_result = await db.execute(select(Loan).where(Loan.user_id == user.id))
    loans = loan_result.scalars().all()
    total_emi = sum(float(l.monthly_emi or 0) for l in loans)
    total_outstanding = sum(float(l.outstanding or 0) for l in loans)

    surplus = income - avg_expenses - total_emi
    savings = max(0, surplus * 3)
    dti = total_emi / income if income > 0 else 0
    savings_rate = (surplus / income * 100) if income > 0 else 0

    return {
        'income': income,
        'avg_expenses': avg_expenses,
        'total_emi': total_emi,
        'surplus': surplus,
        'savings': savings,
        'total_outstanding': total_outstanding,
        'dti': dti,
        'savings_rate': savings_rate,
        'risk_tolerance': user.risk_tolerance or 'moderate',
        'name': user.name or 'there',
        'goals': goals,
        'loans': loans,
        'transactions': transactions,
        'tx_count': len(transactions),
    }


def _generate_response(message: str, ctx: dict) -> str:
    """Rule-based financial AI response engine — no API key required."""
    msg = message.lower().strip()
    income = ctx['income']
    expenses = ctx['avg_expenses']
    surplus = ctx['surplus']
    emi = ctx['total_emi']
    savings_rate = ctx['savings_rate']
    dti = ctx['dti']
    outstanding = ctx['total_outstanding']
    risk = ctx['risk_tolerance']
    name = ctx['name'].split()[0] if ctx['name'] else 'there'
    goals = ctx['goals']
    loans = ctx['loans']

    def fmt(n): return f"₹{n:,.0f}"

    # ── Greeting / generic ────────────────────────────────────────────────────
    if any(w in msg for w in ['hello', 'hi ', 'hey', 'namaste', 'good morning', 'good evening']):
        grade = "excellent" if savings_rate > 30 else "good" if savings_rate > 15 else "needs attention"
        return (
            f"**Namaste, {name}! 👋 I'm your FinMind AI Copilot.**\n\n"
            f"Your current financial snapshot:\n"
            f"- **Income:** {fmt(income)}/month\n"
            f"- **Expenses:** {fmt(expenses)}/month\n"
            f"- **Monthly Surplus:** {fmt(surplus)}\n"
            f"- **Savings Rate:** {savings_rate:.1f}% ({grade})\n"
            f"- **Active Goals:** {len(goals)} | **Active Loans:** {len(loans)}\n\n"
            f"Ask me about SIP recommendations, debt payoff strategies, retirement planning, or anything about your finances!"
        )

    # ── SIP / Investment advice ───────────────────────────────────────────────
    if any(w in msg for w in ['sip', 'mutual fund', 'invest', 'elss', 'nps', 'ppf', 'stock', 'equity']):
        invest_capacity = max(0, surplus * 0.7)
        elss = min(invest_capacity * 0.3, 12500)          # 80C limit ₹1.5L/yr
        nps  = min(invest_capacity * 0.1, 4167)            # 80CCD(1B) ₹50K/yr
        ppf  = min(invest_capacity * 0.15, 12500)          # PPF max ₹1.5L/yr
        equity_sip = invest_capacity * (0.7 if risk == 'aggressive' else 0.5 if risk == 'moderate' else 0.3)
        debt_sip   = invest_capacity - equity_sip - elss - nps - ppf

        return (
            f"**📈 SIP & Investment Plan for {name}**\n\n"
            f"Your investable surplus: **{fmt(invest_capacity)}/month**\n\n"
            f"**Recommended Allocation:**\n"
            f"- 🔴 Equity SIP (Large/Mid Cap): **{fmt(max(0,equity_sip))}/month**\n"
            f"- 🟢 ELSS (Tax-saving, 80C): **{fmt(max(0,elss))}/month** → saves ₹{elss*0.3:.0f}/mo in tax\n"
            f"- 🔵 NPS Tier-1 (80CCD): **{fmt(max(0,nps))}/month** → extra ₹50K deduction\n"
            f"- 🟡 PPF (safe, 7.1% tax-free): **{fmt(max(0,ppf))}/month**\n"
            f"- ⚪ Debt Funds / Liquid: **{fmt(max(0,debt_sip))}/month**\n\n"
            f"**10-year projection** at 12% CAGR on equity SIP:\n"
            f"Corpus ≈ **{fmt(equity_sip * 12 * 1.12**10 * 0.6)}** 💰\n\n"
            f"_Tip: Always keep 3–6 months emergency fund before investing. You have ~{fmt(ctx['savings'])} built up._"
        )

    # ── Debt / EMI advice ────────────────────────────────────────────────────
    if any(w in msg for w in ['loan', 'emi', 'debt', 'repay', 'credit card', 'prepay', 'overcomi']):
        if not loans:
            return (
                f"**✅ Great news, {name}! You have no active loans.**\n\n"
                f"This means {fmt(income)} flows entirely towards your savings and expenses.\n"
                f"Consider channeling {fmt(surplus * 0.5)}/month into SIP/mutual funds to grow wealth!"
            )
        loan_lines = "\n".join(
            f"- **{l.loan_type}**: {fmt(float(l.outstanding or 0))} outstanding @ {l.annual_rate}% → EMI {fmt(float(l.monthly_emi or 0))}"
            for l in loans
        )
        # Sort by rate for avalanche method
        sorted_loans = sorted(loans, key=lambda l: float(l.annual_rate or 0), reverse=True)
        top_loan = sorted_loans[0]
        extra_payment = max(0, surplus * 0.3)

        return (
            f"**💳 Debt Repayment Strategy for {name}**\n\n"
            f"**Your Loans:**\n{loan_lines}\n\n"
            f"**Total EMI:** {fmt(emi)}/month ({dti*100:.1f}% of income)\n"
            f"**Total Outstanding:** {fmt(outstanding)}\n\n"
            f"**📌 Avalanche Strategy (saves most interest):**\n"
            f"Pay minimum on all loans. Put **extra {fmt(extra_payment)}/month** towards:\n"
            f"**{top_loan.loan_type}** (highest rate at {top_loan.annual_rate}%)\n\n"
            f"This will clear it **{extra_payment/max(float(top_loan.monthly_emi or 1),1):.1f}x faster** and save significant interest.\n\n"
            f"_Your DTI is {'⚠️ HIGH' if dti > 0.4 else '✅ Healthy'} at {dti*100:.1f}% (ideal: <40%)_"
        )

    # ── Budget / Savings ──────────────────────────────────────────────────────
    if any(w in msg for w in ['budget', 'sav', 'spend', 'expense', 'cut', 'saving rate', 'money']):
        ideal_savings = income * 0.2
        gap = ideal_savings - surplus
        return (
            f"**💰 Budget Analysis for {name}**\n\n"
            f"| Category | Amount | % of Income |\n"
            f"|---|---|---|\n"
            f"| Monthly Income | {fmt(income)} | 100% |\n"
            f"| Expenses | {fmt(expenses)} | {expenses/income*100:.0f}% |\n"
            f"| EMI | {fmt(emi)} | {emi/income*100:.0f}% |\n"
            f"| **Surplus** | **{fmt(surplus)}** | **{savings_rate:.0f}%** |\n\n"
            f"**50-30-20 Rule Check:**\n"
            f"- Needs (50%): {fmt(income*0.5)} → you spend {fmt(expenses+emi)}\n"
            f"- Wants (30%): {fmt(income*0.3)}\n"
            f"- Savings (20%): {fmt(income*0.2)} → you save {fmt(max(0,surplus))}\n\n"
            + (f"✅ **You're saving above the 20% benchmark!** Consider investing surplus in SIPs."
               if savings_rate >= 20 else
               f"⚠️ **You need to save ₹{gap:,.0f} more** to hit the 20% benchmark.\nTry: reduce dining out, subscriptions, or impulse purchases.")
        )

    # ── Goals ────────────────────────────────────────────────────────────────
    if any(w in msg for w in ['goal', 'house', 'car', 'retire', 'retirement', 'education', 'travel', 'dream']):
        if not goals:
            return (
                f"**🎯 You haven't set any financial goals yet, {name}!**\n\n"
                f"Go to the **Goals** page to add goals like:\n"
                f"- 🏠 Home Purchase\n- 🎓 Education Fund\n- 🚗 Car\n- 🌴 Retirement\n\n"
                f"With your surplus of {fmt(surplus)}/month, you could reach:\n"
                f"- ₹5L goal in **{5_00_000/max(surplus,1):.0f} months**\n"
                f"- ₹10L goal in **{10_00_000/max(surplus,1):.0f} months**\n\n"
                f"_Setting goals helps you stay motivated and track your progress!_"
            )
        goal_lines = "\n".join(
            f"- **{g.name}**: Need {fmt(float(g.target_amount or 0))}, have {fmt(float(g.current_amount or 0))} — {float(g.probability or 0):.0f}% probability"
            for g in goals[:4]
        )
        return (
            f"**🎯 Goal Progress for {name}**\n\n"
            f"{goal_lines}\n\n"
            f"With your surplus of **{fmt(surplus)}/month**, here's your readiness:\n"
            + ("\n".join(
                f"- **{g.name}**: Monthly SIP needed = {fmt(float(g.target_amount or 0)/max(float(g.deadline_years or 1)*12,1))} → {'✅ Achievable' if surplus >= float(g.target_amount or 0)/max(float(g.deadline_years or 1)*12,1) else '⚠️ Needs more savings'}"
                for g in goals[:3]
            )) +
            f"\n\n_Run the AI Agents pipeline for a full Monte Carlo simulation!_"
        )

    # ── Health Score ─────────────────────────────────────────────────────────
    if any(w in msg for w in ['health', 'score', 'grade', 'status', 'rating', 'overall']):
        from utils.health_score import calculate_health_score
        loans_d = [{'monthly_emi': float(l.monthly_emi or 0)} for l in loans]
        goals_d = [{'probability': float(g.probability or 0)} for g in goals]
        health = calculate_health_score(income, expenses, loans_d, ctx['savings'], goals_d)
        return (
            f"**📊 Financial Health Report for {name}**\n\n"
            f"**Overall Score: {health['total']}/100 — {health['grade']} ({health['label']})**\n\n"
            f"**Breakdown:**\n"
            + "\n".join(f"- {k.replace('_',' ').title()}: {v['score']}/{v['max']}" for k, v in health.get('breakdown', {}).items()) +
            f"\n\n**Key Advice:**\n"
            f"- Savings Rate: {'✅ Good' if savings_rate >= 20 else '⚠️ Boost savings to 20%+'}\n"
            f"- Debt Burden: {'✅ Healthy' if dti < 0.4 else '⚠️ Reduce loans — DTI is high'}\n"
            f"- Emergency Fund: {'✅ Good' if ctx['savings'] >= income*3 else f'⚠️ Build to {fmt(income*6)} (6 months)'}\n"
        )

    # ── Tax saving ───────────────────────────────────────────────────────────
    if any(w in msg for w in ['tax', '80c', '80d', 'hra', 'deduction', 'tds', 'itr']):
        annual_income = income * 12
        possible_80c = min(150000, surplus * 12 * 0.3)
        tax_saved = possible_80c * 0.3
        return (
            f"**🧾 Tax Planning for {name} (FY 2024-25)**\n\n"
            f"**Annual Income:** {fmt(annual_income)}\n\n"
            f"**Key Deductions Available:**\n"
            f"- **80C** (ELSS/PPF/LIC/EPF): Up to ₹1,50,000 → saves ~{fmt(min(45000, tax_saved))} in tax\n"
            f"- **80CCD(1B)** NPS: Additional ₹50,000 → saves ~₹15,000\n"
            f"- **80D** Health Insurance: ₹25,000–₹50,000\n"
            f"- **HRA Exemption**: If on rent (submit rent receipts)\n"
            f"- **Home Loan Interest (24b)**: Up to ₹2,00,000\n\n"
            f"**Recommended Action:**\n"
            f"Invest **{fmt(possible_80c/12)}/month in ELSS** to max 80C — saves **{fmt(tax_saved/12)}/month** in taxes!\n\n"
            f"_Tip: Always file ITR before July 31 to avoid late fees._"
        )

    # ── Emergency fund ───────────────────────────────────────────────────────
    if any(w in msg for w in ['emergency', 'fund', 'liquid', 'rainy day', 'backup']):
        ideal = income * 6
        current = ctx['savings']
        gap = max(0, ideal - current)
        months_to_build = gap / max(surplus * 0.3, 1)
        return (
            f"**🛡️ Emergency Fund Status for {name}**\n\n"
            f"- **Target** (6 months expenses): {fmt(ideal)}\n"
            f"- **Current estimate**: {fmt(current)}\n"
            f"- **Gap**: {fmt(gap)}\n\n"
            + (f"✅ **Your emergency fund looks good!** Keep it in a liquid fund or high-yield savings account."
               if gap == 0 else
               f"⚠️ **Build your emergency fund first before investing!**\n"
               f"Save {fmt(surplus*0.3)}/month → fully funded in **{months_to_build:.0f} months**.\n"
               f"Use: Liquid Mutual Funds (better returns than savings account)")
        )

    # ── Default / Fallback ───────────────────────────────────────────────────
    return (
        f"**Hi {name}! 🤖 Here's your financial summary:**\n\n"
        f"- **Income:** {fmt(income)}/month | **Expenses:** {fmt(expenses)}/month\n"
        f"- **Monthly Surplus:** {fmt(surplus)} ({savings_rate:.0f}% savings rate)\n"
        f"- **Total Debt:** {fmt(outstanding)} | **EMI Burden:** {dti*100:.0f}% of income\n\n"
        f"I can help you with:\n"
        f"- 📈 **SIP & investment planning** — ask 'where should I invest?'\n"
        f"- 💳 **Debt strategy** — ask 'how to pay off my loans faster?'\n"
        f"- 🎯 **Goal planning** — ask 'how to save for a house?'\n"
        f"- 🧾 **Tax saving** — ask 'how to save tax under 80C?'\n"
        f"- 💰 **Budget review** — ask 'analyze my spending'\n"
        f"- 📊 **Health score** — ask 'what is my financial health?'"
    )


@router.post("/chat")
async def chat(
    req: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ctx = await _build_financial_context(current_user, db)
    response = _generate_response(req.message, ctx)
    confidence = 'High' if ctx['tx_count'] > 5 else 'Medium' if current_user.monthly_income else 'Low'
    return {'response': response, 'confidence': confidence}
