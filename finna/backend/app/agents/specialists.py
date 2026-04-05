from __future__ import annotations

import json
from time import perf_counter

from app.agents.base_agent import AgentContext, AgentResult, BaseAgent
from app.services.gemini_service import GeminiService
from app.tools.investment_planner import build_investment_blueprint


def _metrics_summary(ctx: AgentContext) -> str:
    """Build a compact text summary of the user's financial metrics for prompts."""
    m = ctx.metrics or {}
    profile = ctx.profile or {}
    lines = [
        f"Total income: Rs {m.get('total_income', 0):,.0f}",
        f"Total expenses: Rs {m.get('total_expenses', 0):,.0f}",
        f"Savings rate: {m.get('savings_rate', 0) * 100:.1f}%",
        f"Debt ratio: {m.get('debt_ratio', 0) * 100:.1f}%",
        f"Expense ratio: {m.get('expense_ratio', 0) * 100:.1f}%",
        f"Emergency fund: {m.get('emergency_fund_months', 0):.1f} months",
        f"Investment rate: {m.get('investment_rate', 0) * 100:.1f}%",
        f"Discretionary ratio: {m.get('discretionary_ratio', 0) * 100:.1f}%",
        f"Largest spending category: {m.get('largest_category', 'unknown')}",
        f"Recurring expense ratio: {m.get('recurring_ratio', 0) * 100:.1f}%",
    ]
    if profile.get("monthly_income"):
        lines.append(f"Profile monthly income: Rs {float(profile['monthly_income']):,.0f}")
    if profile.get("tax_regime"):
        lines.append(f"Tax regime: {profile['tax_regime']}")
    category_breakdown = m.get("category_breakdown", {})
    if category_breakdown:
        top_cats = sorted(category_breakdown.items(), key=lambda x: x[1], reverse=True)[:6]
        lines.append("Top categories: " + ", ".join(f"{k}: Rs {v:,.0f}" for k, v in top_cats))
    top_merchants = m.get("top_merchants", [])
    if top_merchants:
        lines.append("Top merchants: " + ", ".join(f"{t['name']} Rs {t['total']:,.0f}" for t in top_merchants[:5]))
    return "\n".join(lines)


def _goals_summary(ctx: AgentContext) -> str:
    if not ctx.goals:
        return "No active financial goals."
    return "\n".join(
        f"- {g.get('title', 'Goal')}: target Rs {g.get('target_amount', 0):,.0f}, "
        f"probability {g.get('success_probability', 0):.0f}%"
        for g in ctx.goals
    )


SYSTEM_INSTRUCTION = (
    "You are a specialist agent in an India-first agentic AI financial copilot system. "
    "You analyze real transaction data and financial metrics. Be specific with numbers. "
    "Use Rs (Indian Rupees). Give actionable advice. Be concise (3-5 sentences max per finding). "
    "Return your analysis as a JSON object with keys: "
    '"findings" (list of {title, detail}), "recommendations" (list of {title, description, potential_saving}), '
    '"risk_alerts" (list of {title, message, severity}). severity must be "info", "warning", or "critical".'
)


async def _gemini_analyze(gemini: GeminiService, agent_prompt: str, context: AgentContext) -> dict:
    """Call Gemini with the agent's specific prompt and parse structured response."""
    full_prompt = (
        f"{agent_prompt}\n\n"
        f"USER FINANCIAL DATA:\n{_metrics_summary(context)}\n\n"
        f"GOALS:\n{_goals_summary(context)}"
    )
    raw = await gemini.generate(
        system_instruction=SYSTEM_INSTRUCTION,
        prompt=full_prompt,
        temperature=0.4,
        max_tokens=1500,
    )
    if not raw:
        return {}
    # Try to parse JSON from Gemini's response
    try:
        # Handle markdown code blocks
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[-1].rsplit("```", 1)[0]
        return json.loads(cleaned)
    except json.JSONDecodeError:
        # If not valid JSON, create a simple finding from the text
        return {"findings": [{"title": "AI Analysis", "detail": raw[:500]}]}


class ExpenseAgent(BaseAgent):
    name = "expense_agent"
    description = "Analyzes spending composition, discretionary pressure, and merchant patterns."
    tools = ["financial_metrics", "risk_rules"]

    def __init__(self, gemini: GeminiService | None = None) -> None:
        self.gemini = gemini

    def can_handle(self, intent: str) -> float:
        return 0.9 if any(k in intent.lower() for k in ["spend", "expense", "merchant", "budget", "food", "shopping"]) else 0.3

    async def analyze(self, context: AgentContext) -> AgentResult:
        started_at = perf_counter()
        metrics = context.metrics or {}
        findings = []
        recommendations = []
        risk_alerts = []

        # Rule-based findings (always present)
        largest = metrics.get("largest_category", "uncategorized")
        disc_ratio = float(metrics.get("discretionary_ratio", 0))
        expense_ratio = float(metrics.get("expense_ratio", 0))
        total_income = float(metrics.get("total_income", 0))
        total_expenses = float(metrics.get("total_expenses", 0))

        findings.append({"title": "Largest spending category", "detail": f"The biggest debit category is {largest.replace('_', ' ')}."})
        if disc_ratio > 0.25:
            findings.append({"title": "Discretionary pressure", "detail": f"Discretionary outflows account for {disc_ratio * 100:.1f}% of total expenses. Consider capping non-essential spending."})
        if expense_ratio > 0.7:
            findings.append({"title": "High expense ratio", "detail": f"Expenses consume {expense_ratio * 100:.1f}% of income (Rs {total_expenses:,.0f} of Rs {total_income:,.0f}). Target keeping this below 70%."})

        category_breakdown = metrics.get("category_breakdown", {})
        if category_breakdown:
            top_cats = sorted(category_breakdown.items(), key=lambda x: x[1], reverse=True)[:3]
            detail = ", ".join(f"{k.replace('_', ' ')} Rs {v:,.0f}" for k, v in top_cats)
            findings.append({"title": "Top expense categories", "detail": f"Your top spending areas: {detail}."})

        top_merchants = metrics.get("top_merchants", [])
        if top_merchants:
            detail = ", ".join(f"{m['name']} (Rs {m['total']:,.0f})" for m in top_merchants[:3])
            findings.append({"title": "Merchant concentration", "detail": f"Highest spend merchants: {detail}."})

        if disc_ratio > 0.25:
            savings_potential = total_expenses * disc_ratio * 0.15
            recommendations.append({"title": "Reduce discretionary spending", "description": f"Cutting 15% of discretionary outflows could save Rs {savings_potential:,.0f} monthly. Set weekly caps for food delivery and impulse purchases.", "potential_saving": savings_potential})

        # Gemini-powered deep analysis
        if self.gemini and self.gemini.available:
            ai = await _gemini_analyze(
                self.gemini,
                "Analyze this person's SPENDING PATTERNS. Focus on: which categories are overspent, "
                "merchant-level insights (e.g. food delivery vs groceries), subscription creep, "
                "and specific actionable cuts. Be quantitative.",
                context,
            )
            findings.extend(ai.get("findings", []))
            recommendations.extend(ai.get("recommendations", []))
            risk_alerts.extend(ai.get("risk_alerts", []))

        return await self._result(
            started_at=started_at,
            findings=findings,
            recommendations=recommendations,
            risk_alerts=risk_alerts,
            confidence=0.90 if self.gemini and self.gemini.available else 0.65,
            reasoning="Analyzed expense mix, discretionary ratio, and merchant patterns using real financial data.",
        )


class DebtAgent(BaseAgent):
    name = "debt_agent"
    description = "Analyzes debt service burden, EMI pressure, and payoff strategies."
    tools = ["financial_metrics"]

    def __init__(self, gemini: GeminiService | None = None) -> None:
        self.gemini = gemini

    def can_handle(self, intent: str) -> float:
        return 0.92 if any(k in intent.lower() for k in ["debt", "emi", "loan", "credit"]) else 0.25

    async def analyze(self, context: AgentContext) -> AgentResult:
        started_at = perf_counter()
        m = context.metrics or {}
        debt_ratio = float(m.get("debt_ratio", 0))
        total_income = float(m.get("total_income", 0))
        findings = [{"title": "Debt-to-income ratio", "detail": f"Debt payments consume {debt_ratio * 100:.1f}% of income."}]
        recommendations = []
        risk_alerts = []

        if debt_ratio > 0.40:
            findings.append({"title": "Critical debt load", "detail": f"Debt-to-income above 40% is dangerous territory. Monthly debt burden is approximately Rs {total_income * debt_ratio:,.0f}."})
            recommendations.append({"title": "Aggressive debt reduction", "description": "Prioritize highest-interest debt first (avalanche method). Avoid new EMIs until ratio drops below 30%.", "potential_saving": 0})
        elif debt_ratio > 0.30:
            findings.append({"title": "Elevated debt pressure", "detail": f"At {debt_ratio * 100:.1f}%, debt service is compressing your financial flexibility. Target under 30%."})
            recommendations.append({"title": "Rebalance debt service", "description": "Focus surplus towards the costliest EMI. Consider part-prepayment to reduce interest burden.", "potential_saving": 0})
        elif debt_ratio == 0:
            findings.append({"title": "Debt-free status", "detail": "No debt obligations detected. This frees up capacity for investments and goals."})

        if self.gemini and self.gemini.available:
            ai = await _gemini_analyze(
                self.gemini,
                "Analyze this person's DEBT SITUATION. Focus on: debt-to-income safety, "
                "EMI burden, strategies for faster payoff (avalanche vs snowball), "
                "and whether they should prioritize debt reduction or investment. Be specific.",
                context,
            )
            findings.extend(ai.get("findings", []))
            recommendations.extend(ai.get("recommendations", []))
            risk_alerts.extend(ai.get("risk_alerts", []))

        return await self._result(
            started_at=started_at,
            findings=findings,
            recommendations=recommendations,
            risk_alerts=risk_alerts,
            confidence=0.88 if self.gemini and self.gemini.available else 0.60,
            reasoning="Assessed EMI and loan outflows relative to income capacity.",
        )


class GoalAgent(BaseAgent):
    name = "goal_agent"
    description = "Evaluates savings goals, feasibility trajectories, and Monte Carlo projections."
    tools = ["goal_simulator", "financial_metrics"]

    def __init__(self, gemini: GeminiService | None = None) -> None:
        self.gemini = gemini

    def can_handle(self, intent: str) -> float:
        return 0.95 if any(k in intent.lower() for k in ["goal", "afford", "car", "fund", "retirement", "save for"]) else 0.4

    async def analyze(self, context: AgentContext) -> AgentResult:
        started_at = perf_counter()
        m = context.metrics or {}
        goal_count = len(context.goals)
        savings_rate = float(m.get("savings_rate", 0))
        total_income = float(m.get("total_income", 0))
        total_expenses = float(m.get("total_expenses", 0))
        monthly_surplus = (total_income - total_expenses) / max(1, len(m.get("monthly_trends", {}) or {"_": 1}))

        findings = [{"title": "Goal inventory", "detail": f"{goal_count} active goals are being tracked."}]
        recommendations = []
        risk_alerts = []

        if goal_count == 0:
            findings.append({"title": "No goals set", "detail": "Setting financial goals helps direct savings purposefully. Consider starting with an emergency fund (6 months of expenses)."})
            recommendations.append({"title": "Create your first goal", "description": f"With a {savings_rate * 100:.1f}% savings rate and approximately Rs {monthly_surplus:,.0f} monthly surplus, you have capacity to start saving towards a goal.", "potential_saving": 0})
        else:
            at_risk = [g for g in context.goals if float(g.get("success_probability", 0)) < 50]
            on_track = [g for g in context.goals if float(g.get("success_probability", 0)) >= 70]
            if at_risk:
                detail = ", ".join(g.get("title", "Goal") for g in at_risk)
                findings.append({"title": "Goals at risk", "detail": f"These goals have below 50% success probability and need attention: {detail}."})
                recommendations.append({"title": "Increase goal contributions", "description": "Either increase monthly savings towards at-risk goals or extend the timeline. Consider automating SIP contributions.", "potential_saving": 0})
            if on_track:
                detail = ", ".join(g.get("title", "Goal") for g in on_track)
                findings.append({"title": "Goals on track", "detail": f"These goals are progressing well (70%+ probability): {detail}."})

        if self.gemini and self.gemini.available:
            ai = await _gemini_analyze(
                self.gemini,
                "Analyze this person's FINANCIAL GOALS. Focus on: which goals are achievable given current savings, "
                "which need more monthly allocation, timeline feasibility, "
                "and suggest priority ordering. Consider Indian inflation (6-7%) and typical FD/SIP returns (7-12%).",
                context,
            )
            findings.extend(ai.get("findings", []))
            recommendations.extend(ai.get("recommendations", []))
            risk_alerts.extend(ai.get("risk_alerts", []))

        return await self._result(
            started_at=started_at,
            findings=findings,
            recommendations=recommendations,
            risk_alerts=risk_alerts,
            confidence=0.87 if self.gemini and self.gemini.available else 0.55,
            reasoning="Evaluated active goals against current savings capacity.",
        )


class RiskAgent(BaseAgent):
    name = "risk_agent"
    description = "Summarizes systemic financial risk posture and resilience."
    tools = ["risk_rules", "financial_metrics"]

    def __init__(self, gemini: GeminiService | None = None) -> None:
        self.gemini = gemini

    def can_handle(self, intent: str) -> float:
        return 0.9 if any(k in intent.lower() for k in ["risk", "danger", "alert", "warning", "emergency"]) else 0.4

    async def analyze(self, context: AgentContext) -> AgentResult:
        started_at = perf_counter()
        m = context.metrics or {}
        savings_rate = float(m.get("savings_rate", 0))
        emergency_fund = float(m.get("emergency_fund_months", 0))
        spending_velocity = float(m.get("spending_velocity", 0))
        total_expenses = float(m.get("total_expenses", 0))

        findings = [{"title": "Resilience posture", "detail": f"Savings rate is {savings_rate * 100:.1f}% and emergency coverage is {emergency_fund:.1f} months."}]
        recommendations = []
        risk_alerts = []

        if emergency_fund < 3:
            findings.append({"title": "Emergency fund gap", "detail": f"Your reserve covers only {emergency_fund:.1f} months. The recommended minimum is 6 months of essential expenses (approx Rs {total_expenses * 6:,.0f})."})
            recommendations.append({"title": "Build emergency reserve", "description": f"Prioritize building a liquid reserve to cover at least 6 months of expenses. Target adding Rs {total_expenses:,.0f} to your emergency fund per month.", "potential_saving": 0})
        elif emergency_fund < 6:
            findings.append({"title": "Emergency fund moderate", "detail": f"Reserve covers {emergency_fund:.1f} months. Getting to 6 months would provide strong safety."})

        if savings_rate < 0.10:
            findings.append({"title": "Low savings rate", "detail": f"At {savings_rate * 100:.1f}%, savings rate is below the recommended 20% minimum. This leaves little buffer for emergencies."})
        elif savings_rate >= 0.30:
            findings.append({"title": "Strong savings rate", "detail": f"A {savings_rate * 100:.1f}% savings rate is excellent. You have good capacity for investments and goals."})

        if spending_velocity > 0.25:
            findings.append({"title": "Spending acceleration", "detail": f"Month-over-month expenses increased {spending_velocity * 100:.1f}%. Investigate whether this is a one-time spike or a trend."})

        if self.gemini and self.gemini.available:
            ai = await _gemini_analyze(
                self.gemini,
                "Analyze this person's FINANCIAL RISK POSTURE. Focus on: emergency fund adequacy (6 months ideal), "
                "income concentration risk, over-reliance on single income, spending volatility, "
                "and insurance gaps. Flag anything that could cause financial distress in 3-6 months.",
                context,
            )
            findings.extend(ai.get("findings", []))
            recommendations.extend(ai.get("recommendations", []))
            risk_alerts.extend(ai.get("risk_alerts", []))

        return await self._result(
            started_at=started_at,
            findings=findings,
            recommendations=recommendations,
            risk_alerts=risk_alerts,
            confidence=0.90 if self.gemini and self.gemini.available else 0.60,
            reasoning="Cross-checked savings capacity and reserve coverage for financial risk assessment.",
        )


class InvestmentAgent(BaseAgent):
    name = "investment_agent"
    description = "Reviews long-term allocation, SIP strategy, and investment contribution rate."
    tools = ["financial_metrics"]

    def __init__(self, gemini: GeminiService | None = None) -> None:
        self.gemini = gemini

    def can_handle(self, intent: str) -> float:
        return 0.9 if any(k in intent.lower() for k in ["invest", "sip", "portfolio", "mutual fund", "stock", "etf", "ipo", "mtf", "passive income", "dividend"]) else 0.3

    async def analyze(self, context: AgentContext) -> AgentResult:
        started_at = perf_counter()
        m = context.metrics or {}
        profile = context.profile or {}
        intent = (context.intent or "").lower()
        inv_rate = float(m.get("investment_rate", 0))
        total_income = float(m.get("total_income", 0))
        savings_rate = float(m.get("savings_rate", 0))
        debt_ratio = float(m.get("debt_ratio", 0))
        emergency_fund_months = float(m.get("emergency_fund_months", 0))
        monthly_income = float(profile.get("monthly_income") or 0)
        monthly_income_basis = monthly_income
        monthly_trends = m.get("monthly_trends", {}) or {}
        if monthly_income_basis <= 0 and total_income > 0:
            monthly_income_basis = total_income / max(1, len(monthly_trends) or 1)
        monthly_expenses = float(m.get("total_expenses", 0)) / max(1, len(monthly_trends) or 1)
        if monthly_income_basis > 0 and monthly_expenses == 0 and not monthly_trends:
            monthly_surplus = monthly_income_basis * max(0.10, min(0.20, savings_rate or 0.10))
        else:
            monthly_surplus = max(0.0, monthly_income_basis - monthly_expenses)
        wants_passive_income = any(term in intent for term in ["passive income", "income plan", "monthly income", "cash flow", "dividend"])

        blueprint = build_investment_blueprint(
            monthly_income=monthly_income_basis,
            monthly_surplus=monthly_surplus,
            emergency_fund_months=emergency_fund_months,
            debt_ratio=debt_ratio,
            savings_rate=savings_rate,
            passive_income_intent=wants_passive_income,
        )

        findings = [{"title": "Investment allocation", "detail": f"Investment outflows currently represent {inv_rate * 100:.1f}% of income."}]
        recommendations = []
        risk_alerts = []

        if monthly_income_basis > 0:
            findings.append(
                {
                    "title": "Monthly investable capacity",
                    "detail": f"Estimated monthly income is Rs {monthly_income_basis:,.0f} and current investable surplus is about Rs {monthly_surplus:,.0f}.",
                }
            )
            if monthly_expenses == 0 and not monthly_trends:
                findings.append(
                    {
                        "title": "Expense history is incomplete",
                        "detail": "Because no recurring expense history is loaded yet, the investable amount is being estimated conservatively at roughly 10-20% of monthly income rather than assuming all salary is free cash.",
                    }
                )

        if inv_rate == 0:
            findings.append({"title": "No investments detected", "detail": "No investment outflows found (SIP, mutual funds, stocks). Building wealth requires putting money to work."})
            target_sip = monthly_income_basis * 0.10 if monthly_income_basis > 0 else total_income * 0.10
            recommendations.append({"title": "Start a monthly SIP", "description": f"Begin with Rs {target_sip:,.0f} per month (10% of income) in a diversified equity mutual fund. ELSS funds offer tax benefits under Section 80C.", "potential_saving": 0})
        elif inv_rate < 0.10:
            gap = total_income * 0.15 - total_income * inv_rate
            findings.append({"title": "Below target investment rate", "detail": f"At {inv_rate * 100:.1f}%, investment allocation is below the recommended 15%. Consider increasing by Rs {gap:,.0f} monthly."})
            recommendations.append({"title": "Increase investment allocation", "description": f"Raise SIP by Rs {gap:,.0f} to reach 15% of income. Consider tax-efficient instruments like ELSS and NPS.", "potential_saving": 0})
        elif inv_rate >= 0.15:
            findings.append({"title": "Healthy investment rate", "detail": f"At {inv_rate * 100:.1f}%, investment allocation is above the 15% benchmark. Ensure diversification across equity, debt, and gold."})

        if blueprint.allocations:
            allocation_text = ", ".join(
                f"{slice.weight_pct}% {slice.instrument}" for slice in blueprint.allocations
            )
            findings.append(
                {
                    "title": "Recommended investment mix",
                    "detail": f"For your current position, the {blueprint.stage.replace('_', ' ')} plan is: {allocation_text}.",
                }
            )
            recommendations.append(
                {
                    "title": "Build the monthly investment plan",
                    "description": (
                        f"Deploy about Rs {blueprint.investable_amount:,.0f} per month using the {blueprint.stage.replace('_', ' ')} allocation: "
                        + "; ".join(f"{slice.weight_pct}% {slice.instrument} ({slice.purpose})" for slice in blueprint.allocations)
                    ),
                    "potential_saving": 0,
                }
            )

        if blueprint.guardrails:
            findings.append(
                {
                    "title": "Instrument suitability",
                    "detail": " ".join(blueprint.guardrails[:2]),
                }
            )
            recommendations.append(
                {
                    "title": "Keep speculation outside the core plan",
                    "description": " ".join(blueprint.guardrails),
                    "potential_saving": 0,
                }
            )

        if self.gemini and self.gemini.available:
            ai = await _gemini_analyze(
                self.gemini,
                "Analyze this person's INVESTMENT STRATEGY. Focus on: whether the investment rate (target 15%+) is adequate, "
                "suggest SIP amounts for Indian mutual funds and ETFs, consider tax-advantaged options (ELSS, NPS), "
                "asset allocation based on risk capacity, and explain whether IPOs, MTF, direct stocks, or ETFs fit the plan. "
                "Do not recommend specific stocks, IPOs, or leveraged trades unless live market data is available. "
                "For passive-income questions, prefer diversified accumulation and income buckets over speculation. Be India-specific.",
                context,
            )
            findings.extend(ai.get("findings", []))
            recommendations.extend(ai.get("recommendations", []))
            risk_alerts.extend(ai.get("risk_alerts", []))

        return await self._result(
            started_at=started_at,
            findings=findings,
            recommendations=recommendations,
            risk_alerts=risk_alerts,
            confidence=0.85 if self.gemini and self.gemini.available else 0.55,
            reasoning="Measured income-based investable surplus and translated it into an India-specific allocation plan with instrument guardrails.",
        )


class TaxAgent(BaseAgent):
    name = "tax_agent"
    description = "Surfaces India-first tax efficiency opportunities under Section 80C, 80D, NPS, HRA."
    tools = ["financial_metrics"]

    def __init__(self, gemini: GeminiService | None = None) -> None:
        self.gemini = gemini

    def can_handle(self, intent: str) -> float:
        return 0.87 if any(k in intent.lower() for k in ["tax", "80c", "hra", "nps", "80d", "deduction"]) else 0.2

    async def analyze(self, context: AgentContext) -> AgentResult:
        started_at = perf_counter()
        findings = []
        recommendations = []
        risk_alerts = []

        if self.gemini and self.gemini.available:
            ai = await _gemini_analyze(
                self.gemini,
                "Analyze this person's TAX OPTIMIZATION OPPORTUNITIES under Indian tax law. Focus on: "
                "Section 80C (Rs 1.5L limit — ELSS, PPF, LIC, PF), Section 80D (health insurance), "
                "NPS (extra Rs 50k under 80CCD), HRA exemption, standard deduction. "
                "Compare old vs new tax regime based on their income. Be specific with amounts they can save.",
                context,
            )
            findings.extend(ai.get("findings", []))
            recommendations.extend(ai.get("recommendations", []))
            risk_alerts.extend(ai.get("risk_alerts", []))
        else:
            total_income = float((context.metrics or {}).get("total_income", 0))
            inv_rate = float((context.metrics or {}).get("investment_rate", 0))
            findings.append({
                "title": "Tax optimization overview",
                "detail": f"Based on income of Rs {total_income:,.0f}, here are India-specific tax opportunities.",
            })
            if total_income > 0:
                findings.append({
                    "title": "Section 80C potential",
                    "detail": "Up to Rs 1,50,000 deduction available under 80C via ELSS, PPF, LIC, PF, tuition fees. Check if you're maximizing this.",
                })
                findings.append({
                    "title": "Section 80D — Health insurance",
                    "detail": "Deduction up to Rs 25,000 (Rs 50,000 for seniors) for health insurance premiums. Ensure adequate medical coverage.",
                })
                if inv_rate == 0:
                    recommendations.append({
                        "title": "Start ELSS for dual benefit",
                        "description": "ELSS mutual funds offer both tax saving (80C) and wealth growth (avg 12% p.a.). Lock-in is only 3 years — the shortest among 80C instruments.",
                        "potential_saving": min(total_income * 0.30, 150000) * 0.05,
                    })
                recommendations.append({
                    "title": "NPS for extra Rs 50,000 deduction",
                    "description": "National Pension System contributions qualify for an additional Rs 50,000 deduction under 80CCD(1B), beyond the 80C limit.",
                    "potential_saving": 50000 * 0.30 if total_income > 1000000 else 50000 * 0.20,
                })

        return await self._result(
            started_at=started_at,
            findings=findings,
            recommendations=recommendations,
            risk_alerts=risk_alerts,
            confidence=0.82 if self.gemini and self.gemini.available else 0.45,
            reasoning="Evaluated Indian tax optimization opportunities using available financial signals.",
        )
