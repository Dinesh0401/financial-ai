from __future__ import annotations

import asyncio
import json
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.base_agent import AgentContext
from app.agents.orchestrator import OrchestratorAgent
from app.models.chat_message import ChatMessage
from app.models.goal import Goal
from app.models.transaction import Transaction
from app.models.user import User
from app.services.gemini_service import GeminiService
from app.tools.financial_metrics import compute_financial_metrics
from app.tools.investment_planner import build_investment_blueprint


def _sse(event: str, payload: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(payload)}\n\n"


def _format_rupees(value: float) -> str:
    return f"Rs {value:,.0f}"


def _is_investment_intent(message: str) -> bool:
    lowered = message.lower()
    keywords = (
        "invest",
        "sip",
        "mutual fund",
        "mutual funds",
        "etf",
        "stock",
        "stocks",
        "ipo",
        "mtf",
        "passive income",
        "dividend",
        "portfolio",
    )
    return any(keyword in lowered for keyword in keywords)


def _is_loan_intent(message: str) -> bool:
    lowered = message.lower()
    keywords = (
        "loan",
        "debt",
        "emi",
        "payoff",
        "pay off",
        "prepay",
        "avalanche",
        "snowball",
        "refinance",
    )
    return any(keyword in lowered for keyword in keywords)


def _is_expense_intent(message: str) -> bool:
    lowered = message.lower()
    keywords = (
        "monthly expense",
        "monthly expenses",
        "expense",
        "expenses",
        "spending",
        "spend",
        "where am i spending",
        "how much i spend",
        "how much i spent",
    )
    return any(keyword in lowered for keyword in keywords)


def _is_reduce_intent(message: str) -> bool:
    lowered = message.lower()
    phrases = (
        "how can i reduce",
        "how do i reduce",
        "how to reduce",
        "reduce it",
        "reduce my",
        "reduce this",
        "cut down",
        "cut back",
        "how to cut",
        "where can i cut",
        "how can i save",
        "how do i save",
        "how to save more",
        "save more",
        "spend less",
        "lower my expenses",
        "lower my spending",
        "bring it down",
        "bring down",
        "trim my",
        "tips to save",
        "ways to save",
    )
    return any(p in lowered for p in phrases)


CATEGORY_TIPS: dict[str, list[str]] = {
    "food": [
        "Cook 2-3 dinners a week at home — typically saves Rs 800-1,500/week vs Swiggy/Zomato.",
        "Batch-order groceries on Sunday; skip midweek quick-commerce trips that add 15-20%.",
        "Put a Rs 250 order cap in your food app to block late-night impulse orders.",
    ],
    "food_dining": [
        "Cook 2-3 dinners a week at home — typically saves Rs 800-1,500/week vs Swiggy/Zomato.",
        "Put a Rs 250 per-order cap in your food app to block late-night impulse orders.",
    ],
    "rent": [
        "If rent is above 30% of income, a 2-3 km shift out of the prime zone usually saves Rs 5,000-10,000/month.",
        "A flatmate share halves both rent and utilities right away.",
    ],
    "rent_housing": [
        "If rent is above 30% of income, a 2-3 km shift out of the prime zone usually saves Rs 5,000-10,000/month.",
        "A flatmate share halves both rent and utilities right away.",
    ],
    "housing": [
        "If rent is above 30% of income, a 2-3 km shift out of the prime zone usually saves Rs 5,000-10,000/month.",
    ],
    "transport": [
        "Swap 2-3 weekly cab rides for metro/bus — Rs 1,200-2,000/month back in a metro city.",
        "Consolidate errands into one trip; fuel cost per km drops on longer trips vs many short starts.",
    ],
    "fuel": [
        "Keep tyre pressure at spec and service on time — typical fuel drop of 6-10%.",
        "Work-from-home 2 days/week if allowed — easy 20-30% fuel saving.",
    ],
    "shopping": [
        "Delete saved cards from Amazon/Flipkart/Myntra — cart friction cuts impulse spend ~40%.",
        "Use the 72-hour wait rule for any non-essential item over Rs 2,000.",
    ],
    "entertainment": [
        "Audit OTTs — keep 2 active and rotate, share annual family plans; saves Rs 400-900/mo.",
        "Replace one theatre outing/month with home viewing — Rs 800-1,500 saved per swap.",
    ],
    "subscriptions": [
        "Open 'UPI Autopay' in GPay/PhonePe and cancel anything you haven't used in 30+ days.",
    ],
    "utilities": [
        "Switch remaining bulbs to LED — recovers Rs 200-400/month on a typical 2BHK.",
        "Unplug the geyser + TV standby loops; 5-8% off the bill.",
    ],
    "emi_loan": [
        "If any loan is above 12% interest, consider a balance transfer — can save Rs 2,000-5,000/month.",
        "Round up your EMI by 10% — closes the loan 18-24 months earlier and cuts total interest.",
    ],
    "groceries": [
        "Buy staples monthly at BigBasket/DMart instead of daily at the kirana — 15-20% cheaper on average.",
        "Shop from a list; avoid the end-cap placement traps.",
    ],
    "healthcare": [
        "Keep a top-up health policy (Rs 300-500/month) — one ER visit can wipe out 6 months of savings.",
        "Use employer cashless OPD if you have it; don't pay out of pocket when claimable.",
    ],
    "insurance": [
        "Review term cover against your current salary — under-insurance is the common case.",
    ],
    "education": [
        "Children's tuition fees qualify under 80C. If you're on the old regime, claim it.",
    ],
    "personal_care": [
        "Bulk-order toiletries via Amazon 'Subscribe & Save' — 10-15% off on the same items.",
    ],
    "travel": [
        "Book trains/flights 45+ days ahead — 30-50% cheaper than within-fortnight bookings.",
    ],
    "miscellaneous": [
        "Tag these spends for 14 days — 'miscellaneous' usually hides 2-3 fixable leaks.",
    ],
    "other": [
        "Tag these spends for 14 days — 'other' usually hides 2-3 fixable leaks.",
    ],
}


def _tips_for_category(raw_key: str) -> list[str]:
    norm = raw_key.lower().replace("-", "_").strip()
    if norm in CATEGORY_TIPS:
        return CATEGORY_TIPS[norm]
    flat = norm.replace("_", " ")
    aliases = {
        "food": ("food", "dining", "restaurant", "swiggy", "zomato"),
        "rent": ("rent", "housing", "home loan"),
        "transport": ("transport", "commute", "ola", "uber", "cab", "ride"),
        "fuel": ("fuel", "petrol", "diesel"),
        "shopping": ("shopping", "clothes", "apparel", "myntra", "flipkart"),
        "entertainment": ("entertainment", "movie", "ott", "netflix", "prime"),
        "subscriptions": ("subscription", "streaming"),
        "utilities": ("utility", "utilities", "electricity", "water", "internet", "broadband", "wifi"),
        "emi_loan": ("emi", "loan"),
        "groceries": ("grocer", "vegetable", "kirana"),
        "healthcare": ("health", "medical", "doctor", "medicine", "pharma"),
        "insurance": ("insurance",),
        "education": ("education", "tuition", "school", "college"),
        "personal_care": ("personal care", "salon", "beauty"),
        "travel": ("travel", "vacation", "trip", "holiday"),
    }
    for key, words in aliases.items():
        if any(w in flat for w in words):
            return CATEGORY_TIPS[key]
    return [
        "Track this category daily for 14 days — awareness alone usually shaves 10-15%.",
        "Set a weekly cap in your budgeting app and treat it as a hard stop.",
        "Before each spend ask 'need or want?' — if 'want', wait 48 hours.",
    ]


def _build_reduction_plan(snapshot: dict | None, metrics: dict) -> str:
    if not isinstance(snapshot, dict):
        snapshot = {}
    total, breakdown = _extract_snapshot_expenses(snapshot)

    if total <= 0:
        category_breakdown = metrics.get("category_breakdown", {}) or {}
        for category, amount in category_breakdown.items():
            try:
                val = float(amount or 0)
            except (TypeError, ValueError):
                continue
            if val > 0:
                breakdown.append((str(category), val))
                total += val
        breakdown.sort(key=lambda item: item[1], reverse=True)

    if not breakdown:
        return (
            "I need your monthly spending split before I can give you concrete cuts. "
            "Add category-wise expenses in onboarding or upload a bank/UPI statement and ask me again."
        )

    top = breakdown[:3]
    income = 0.0
    try:
        income = float(snapshot.get("income") or 0)
    except (TypeError, ValueError):
        income = 0.0
    if income <= 0:
        try:
            income = float(metrics.get("total_income", 0) or 0)
        except (TypeError, ValueError):
            income = 0.0

    lines: list[str] = []
    if income > 0:
        lines.append(
            f"Here is a concrete reduction plan for your top {len(top)} spending areas on your Rs {income:,.0f}/mo income."
        )
    else:
        lines.append(
            f"Here is a concrete reduction plan for your top {len(top)} spending areas."
        )
    lines.append("")

    total_save = 0
    for key, amount in top:
        pretty = key.replace("_", " ").title()
        share_pct = (amount / total * 100) if total > 0 else 0
        save = int(round(amount * 0.15))
        total_save += save
        lines.append(
            f"**{pretty}** — Rs {amount:,.0f}/mo ({share_pct:.0f}% of spend) · target a 15% trim ≈ Rs {save:,}/mo back"
        )
        for tip in _tips_for_category(key)[:2]:
            lines.append(f"- {tip}")
        lines.append("")

    lines.append(f"**If you hit all three: about Rs {total_save:,}/month back.**")
    lines.append(f"Over 12 months that compounds to roughly Rs {total_save * 12:,}.")
    lines.append("")
    lines.append(
        "Start with just one category — one clean win beats half-doing three. "
        "Tell me which one you want to tackle first and I'll give you a weekly plan."
    )
    return "\n".join(lines)


def _extract_snapshot_expenses(snapshot: dict | None) -> tuple[float, list[tuple[str, float]]]:
    if not isinstance(snapshot, dict):
        return 0.0, []

    raw_expenses = snapshot.get("expenses")
    if not isinstance(raw_expenses, dict):
        return 0.0, []

    normalized: list[tuple[str, float]] = []
    for category, amount in raw_expenses.items():
        try:
            parsed = float(amount or 0)
        except (TypeError, ValueError):
            continue
        if parsed > 0:
            normalized.append((str(category), parsed))

    normalized.sort(key=lambda item: item[1], reverse=True)
    return sum(amount for _, amount in normalized), normalized


def _build_monthly_expense_answer(*, metrics: dict, profile: dict, snapshot: dict | None) -> str:
    monthly_income, monthly_expenses, monthly_surplus, conservative_estimate = _estimate_monthly_capacity(
        metrics,
        profile,
    )
    monthly_trends = metrics.get("monthly_trends", {}) or {}
    trend_months = sorted(monthly_trends.keys())
    latest_month = trend_months[-1] if trend_months else None
    latest_expenses = (
        float(monthly_trends.get(latest_month, {}).get("expenses", 0) or 0)
        if latest_month
        else 0.0
    )
    total_expenses = float(metrics.get("total_expenses", 0) or 0)

    snapshot_total, snapshot_breakdown = _extract_snapshot_expenses(snapshot)

    if monthly_expenses > 0 or latest_expenses > 0 or total_expenses > 0:
        lines = [
            "Here is your monthly expense view based on your current transaction data.",
            "",
            "**Monthly Expenses**",
            f"- Average monthly expenses: `{_format_rupees(monthly_expenses if monthly_expenses > 0 else latest_expenses)}`",
        ]

        if latest_month and latest_expenses > 0:
            lines.append(
                f"- Latest month (`{latest_month}`): `{_format_rupees(latest_expenses)}`"
            )

        if monthly_income > 0:
            lines.append(f"- Monthly income considered: `{_format_rupees(monthly_income)}`")
            lines.append(
                f"- Approx monthly surplus after expenses: `{_format_rupees(max(0.0, monthly_surplus))}`"
            )

        category_breakdown = metrics.get("category_breakdown", {}) or {}
        if category_breakdown:
            top = sorted(
                (
                    (str(category), float(amount or 0))
                    for category, amount in category_breakdown.items()
                    if float(amount or 0) > 0
                ),
                key=lambda item: item[1],
                reverse=True,
            )[:5]
            if top:
                lines.append("")
                lines.append("**Top spend categories**")
                lines.extend(
                    [
                        f"- {category.replace('_', ' ').title()}: `{_format_rupees(amount)}`"
                        for category, amount in top
                    ]
                )

        if conservative_estimate:
            lines.append("")
            lines.append(
                "_Note: this monthly figure is conservative because the transaction history is still sparse._"
            )

        return "\n".join(lines)

    if snapshot_total > 0:
        lines = [
            "Here is your monthly expense view from your onboarding data.",
            "",
            "**Monthly Expenses**",
            f"- Monthly expenses (onboarding): `{_format_rupees(snapshot_total)}`",
        ]

        if monthly_income > 0:
            projected_surplus = monthly_income - snapshot_total
            lines.append(f"- Monthly income considered: `{_format_rupees(monthly_income)}`")
            lines.append(
                f"- Projected monthly surplus: `{_format_rupees(max(0.0, projected_surplus))}`"
            )

        if snapshot_breakdown:
            lines.append("")
            lines.append("**Top spend categories**")
            lines.extend(
                [
                    f"- {category.replace('_', ' ').title()}: `{_format_rupees(amount)}`"
                    for category, amount in snapshot_breakdown[:5]
                ]
            )

        lines.extend(
            [
                "",
                "If you upload statements, I can also show month-by-month trends and merchant-level breakdown.",
            ]
        )
        return "\n".join(lines)

    return (
        "I can show your monthly expenses, but I do not have expense data yet. "
        "Please complete onboarding expenses or upload at least one statement so I can calculate it accurately."
    )


def _estimate_monthly_capacity(metrics: dict, profile: dict) -> tuple[float, float, float, bool]:
    monthly_trends = metrics.get("monthly_trends", {}) or {}
    month_count = max(1, len(monthly_trends) or 1)

    monthly_income = float(profile.get("monthly_income") or 0)
    total_income = float(metrics.get("total_income", 0) or 0)
    if monthly_income <= 0 and total_income > 0:
        monthly_income = total_income / month_count

    total_expenses = float(metrics.get("total_expenses", 0) or 0)
    monthly_expenses = total_expenses / month_count if total_expenses > 0 else 0.0

    conservative_estimate = False
    savings_rate = float(metrics.get("savings_rate", 0) or 0)
    if monthly_income > 0 and monthly_expenses == 0 and not monthly_trends:
        monthly_surplus = monthly_income * max(0.10, min(0.20, savings_rate or 0.10))
        conservative_estimate = True
    else:
        monthly_surplus = max(0.0, monthly_income - monthly_expenses)

    return monthly_income, monthly_expenses, monthly_surplus, conservative_estimate


def _build_investment_fallback(
    *,
    message: str,
    metrics: dict,
    profile: dict,
    orchestrated: dict,
) -> str:
    monthly_income, monthly_expenses, monthly_surplus, conservative_estimate = _estimate_monthly_capacity(
        metrics,
        profile,
    )
    blueprint = build_investment_blueprint(
        monthly_income=monthly_income,
        monthly_surplus=monthly_surplus,
        emergency_fund_months=float(metrics.get("emergency_fund_months", 0) or 0),
        debt_ratio=float(metrics.get("debt_ratio", 0) or 0),
        savings_rate=float(metrics.get("savings_rate", 0) or 0),
        passive_income_intent="passive income" in message.lower() or "monthly income" in message.lower(),
    )

    sections: list[str] = []
    stage_label = blueprint.stage.replace("_", " ").title()
    sections.append(f"**Income-Based Investment Plan**\n\n{stage_label} plan built from your current income, expenses, debt load, emergency reserve, and detected savings capacity.")

    snapshot_lines = []
    if monthly_income > 0:
        snapshot_lines.append(f"- Monthly income considered: `{_format_rupees(monthly_income)}`")
    if monthly_expenses > 0:
        snapshot_lines.append(f"- Estimated monthly expenses: `{_format_rupees(monthly_expenses)}`")
    snapshot_lines.append(f"- Investable amount right now: `{_format_rupees(blueprint.investable_amount)}`")
    snapshot_lines.append(f"- Emergency fund cover: `{float(metrics.get('emergency_fund_months', 0) or 0):.1f} months`")
    snapshot_lines.append(f"- Debt ratio: `{float(metrics.get('debt_ratio', 0) or 0) * 100:.1f}%`")
    if conservative_estimate:
        snapshot_lines.append("- Investable amount is estimated conservatively because complete recurring-expense history is not loaded yet.")
    sections.append("**Current Snapshot**\n" + "\n".join(snapshot_lines))

    if blueprint.allocations:
        allocation_lines = []
        for index, item in enumerate(blueprint.allocations, start=1):
            amount = blueprint.investable_amount * item.weight_pct / 100
            allocation_lines.append(
                f"{index}. `{_format_rupees(amount)}` into **{item.instrument}** ({item.weight_pct}%). Purpose: {item.purpose}"
            )
        sections.append("**Recommended Monthly Allocation**\n" + "\n".join(allocation_lines))

    guardrail_lines = [
        f"- {guardrail}"
        for guardrail in blueprint.guardrails
    ]
    if guardrail_lines:
        sections.append("**Instrument Fit**\n" + "\n".join(guardrail_lines))

    key_signals = []
    for finding in orchestrated.get("findings", []):
        title = str(finding.get("title", "")).lower()
        if title in {
            "monthly investable capacity",
            "expense history is incomplete",
            "recommended investment mix",
            "instrument suitability",
            "emergency fund gap",
            "elevated debt pressure",
            "critical debt load",
        }:
            key_signals.append(f"- **{finding.get('title', '')}**: {finding.get('detail', '')}")
    if key_signals:
        sections.append("**Why This Plan Fits**\n" + "\n".join(key_signals[:4]))

    next_steps = []
    if blueprint.stage == "insufficient_data":
        next_steps.append("1. Add your monthly income on the dashboard and upload at least one recent bank or UPI statement.")
        next_steps.append("2. Start with diversified funds and ETFs only after the app can see your actual cash-flow pattern.")
    else:
        next_steps.append(f"1. Set up one monthly auto-invest of about `{_format_rupees(blueprint.investable_amount)}` and split it across the core buckets above.")
        next_steps.append("2. Keep direct stocks as a small satellite sleeve only after the core ETF or mutual-fund plan is funded.")
        next_steps.append("3. Keep MTF out of the passive-income plan, and treat IPOs as occasional speculative exposure rather than the base strategy.")
    sections.append("**Next Steps**\n" + "\n".join(next_steps))

    return "\n\n".join(sections)


def _months_to_close(principal: float, annual_rate_pct: float, emi: float) -> int | None:
    if principal <= 0 or emi <= 0 or annual_rate_pct < 0:
        return None
    r = (annual_rate_pct / 12.0) / 100.0
    if r == 0:
        return int(round(principal / emi))
    if emi <= principal * r:
        return None
    import math
    n = math.log(emi / (emi - principal * r)) / math.log(1 + r)
    return int(math.ceil(n))


def _build_snapshot_loan_answer(*, snapshot_loans: list[dict], profile: dict) -> str:
    ranked = sorted(
        snapshot_loans,
        key=lambda l: float(l.get("interest") or 0),
        reverse=True,
    )
    lines = [
        "Here is the payoff plan based on the loans you entered during setup.",
        "",
        "**Your Loans (highest-rate first)**",
    ]
    total_balance = 0.0
    total_emi = 0.0
    for idx, loan in enumerate(ranked, 1):
        name = loan.get("name") or loan.get("type") or "Loan"
        balance = float(loan.get("balance") or 0)
        emi = float(loan.get("emi") or 0)
        rate = float(loan.get("interest") or 0)
        total_balance += balance
        total_emi += emi
        months = _months_to_close(balance, rate, emi)
        boosted_emi = round(emi * 1.2)
        boosted_months = _months_to_close(balance, rate, boosted_emi)
        if months and boosted_months:
            saved = max(0, months - boosted_months)
            lines.append(
                f"{idx}. **{name}** — Rs {balance:,.0f} at {rate:.1f}% · EMI Rs {emi:,.0f} · closes in ~{months} months. "
                f"Bump EMI to Rs {boosted_emi:,.0f} and you close it ~{saved} months earlier."
            )
        else:
            lines.append(f"{idx}. **{name}** — Rs {balance:,.0f} at {rate:.1f}% · EMI Rs {emi:,.0f}.")

    lines.extend([
        "",
        "**Totals**",
        f"- Outstanding debt: Rs {total_balance:,.0f}",
        f"- Total EMI per month: Rs {total_emi:,.0f}",
        "",
        "**What to do next**",
        "1. Attack the top-rate loan first (avalanche method) — interest savings are the largest there.",
        "2. Keep minimum EMIs running on the rest.",
        "3. Avoid taking on any new EMIs while you clear these.",
    ])
    return "\n".join(lines)


def _build_no_loan_debt_fallback(*, metrics: dict, profile: dict) -> str:
    monthly_income, monthly_expenses, monthly_surplus, conservative_estimate = _estimate_monthly_capacity(
        metrics,
        profile,
    )
    suggested_redirect = max(0.0, monthly_surplus)
    if suggested_redirect <= 0 and monthly_income > 0:
        suggested_redirect = monthly_income * 0.05

    lines = [
        "I checked your latest data and there is no active loan or EMI outflow to optimize right now.",
        "",
        "**Current Snapshot**",
    ]
    if monthly_income > 0:
        lines.append(f"- Monthly income considered: `{_format_rupees(monthly_income)}`")
    if monthly_expenses > 0:
        lines.append(f"- Monthly expenses considered: `{_format_rupees(monthly_expenses)}`")
    lines.append(f"- Debt ratio detected: `{float(metrics.get('debt_ratio', 0) or 0) * 100:.1f}%`")

    lines.extend(
        [
            "",
            "**What To Do Instead**",
            f"1. Redirect about `{_format_rupees(suggested_redirect)}` per month into emergency fund and SIPs (adjust as comfortable).",
            "2. Keep debt at zero by avoiding new EMIs unless they are essential.",
            "3. If you recently took a loan, sync fresh transactions and ask again for a payoff order.",
        ]
    )

    if conservative_estimate:
        lines.extend(
            [
                "",
                "_Note: the monthly redirect number is conservative because complete recurring-expense history is not loaded yet._",
            ]
        )

    return "\n".join(lines)


class CopilotService:
    def __init__(self, orchestrator: OrchestratorAgent, gemini: GeminiService) -> None:
        self.orchestrator = orchestrator
        self.gemini = gemini

    async def stream_chat(
        self,
        *,
        session: AsyncSession,
        user: User,
        message: str,
        session_id: str | None,
    ):
        conversation_id = session_id or str(uuid4())

        # Load user's financial data
        transactions = (
            await session.execute(select(Transaction).where(Transaction.user_id == user.id))
        ).scalars().all()
        goals = (
            await session.execute(select(Goal).where(Goal.user_id == user.id))
        ).scalars().all()

        # Load recent conversation history
        recent_messages = (
            await session.execute(
                select(ChatMessage)
                .where(ChatMessage.user_id == user.id, ChatMessage.session_id == conversation_id)
                .order_by(ChatMessage.created_at.desc())
                .limit(10)
            )
        ).scalars().all()
        history = [{"role": m.role, "content": m.content} for m in reversed(recent_messages)]

        metrics = compute_financial_metrics(transactions)
        metrics_dict = metrics.to_dict()

        context = AgentContext(
            user_id=str(user.id),
            intent=message,
            transactions=[
                {
                    "merchant": txn.merchant,
                    "amount": float(txn.amount),
                    "category": txn.category.value,
                    "txn_type": txn.txn_type.value,
                    "date": txn.date.isoformat(),
                }
                for txn in transactions[:100]  # Limit context size
            ],
            metrics=metrics_dict,
            goals=[
                {
                    "title": goal.title,
                    "target_amount": float(goal.target_amount),
                    "success_probability": float(goal.success_probability or 0),
                }
                for goal in goals
            ],
            profile={
                "monthly_income": float(user.monthly_income) if user.monthly_income is not None else None,
                "tax_regime": user.tax_regime,
                "currency": user.currency,
            },
            conversation_history=history,
        )

        # Phase 1: Emit thinking event
        yield _sse("thinking", {"agent": "orchestrator", "thought": f"Analyzing: {message[:100]}..."})
        await asyncio.sleep(0)

        # Phase 2: Run multi-agent analysis
        orchestrated = await self.orchestrator.run(context, intent=message)

        # Emit agent tool calls and results
        for agent in orchestrated["agents"]:
            yield _sse("tool_call", {
                "agent": agent["agent_name"],
                "tool": ",".join(agent["tools_used"]),
                "input": {"intent": message},
            })
            yield _sse("tool_result", {
                "agent": agent["agent_name"],
                "tool": ",".join(agent["tools_used"]),
                "output": agent["findings"][:3],  # Limit for SSE payload size
            })

        # Phase 3: Stream the conversational response from Gemini
        yield _sse("thinking", {"agent": "copilot", "thought": "Generating personalized response..."})

        # Build conversation prompt with agent findings
        findings_text = "\n".join(
            f"- [{f.get('title', '')}] {f.get('detail', '')}"
            for f in orchestrated["findings"]
            if f.get("detail")
        )
        recommendations_text = "\n".join(
            f"- {r.get('title', '')}: {r.get('description', '')}"
            for r in orchestrated["recommendations"]
            if r.get("description")
        )

        debt_ratio = float(metrics_dict.get("debt_ratio", 0) or 0)
        snapshot_loans = []
        if isinstance(user.onboarding_snapshot, dict):
            raw_loans = user.onboarding_snapshot.get("loans") or []
            if isinstance(raw_loans, list):
                snapshot_loans = [l for l in raw_loans if isinstance(l, dict) and float(l.get("balance") or 0) > 0]

        if _is_reduce_intent(message):
            final_message = _build_reduction_plan(
                snapshot=user.onboarding_snapshot if isinstance(user.onboarding_snapshot, dict) else None,
                metrics=metrics_dict,
            )
            yield _sse("message", {"content": final_message})

            session.add(ChatMessage(user_id=user.id, session_id=conversation_id, role="user", content=message))
            session.add(
                ChatMessage(
                    user_id=user.id,
                    session_id=conversation_id,
                    role="assistant",
                    content=final_message,
                    agent_reasoning={"agents": [a["agent_name"] for a in orchestrated["agents"]], "findings_count": len(orchestrated["findings"])},
                    tools_used=[agent["agent_name"] for agent in orchestrated["agents"]],
                )
            )
            await session.flush()

            yield _sse("done", {
                "session_id": conversation_id,
                "tools_used": [agent["agent_name"] for agent in orchestrated["agents"]],
            })
            return

        if _is_expense_intent(message):
            final_message = _build_monthly_expense_answer(
                metrics=metrics_dict,
                profile=context.profile,
                snapshot=user.onboarding_snapshot if isinstance(user.onboarding_snapshot, dict) else None,
            )
            yield _sse("message", {"content": final_message})

            session.add(ChatMessage(user_id=user.id, session_id=conversation_id, role="user", content=message))
            session.add(
                ChatMessage(
                    user_id=user.id,
                    session_id=conversation_id,
                    role="assistant",
                    content=final_message,
                    agent_reasoning={"agents": [a["agent_name"] for a in orchestrated["agents"]], "findings_count": len(orchestrated["findings"])},
                    tools_used=[agent["agent_name"] for agent in orchestrated["agents"]],
                )
            )
            await session.flush()

            yield _sse("done", {
                "session_id": conversation_id,
                "tools_used": [agent["agent_name"] for agent in orchestrated["agents"]],
            })
            return

        if _is_loan_intent(message) and debt_ratio <= 0:
            if snapshot_loans:
                final_message = _build_snapshot_loan_answer(snapshot_loans=snapshot_loans, profile=context.profile)
            else:
                final_message = _build_no_loan_debt_fallback(metrics=metrics_dict, profile=context.profile)
            yield _sse("message", {"content": final_message})

            session.add(ChatMessage(user_id=user.id, session_id=conversation_id, role="user", content=message))
            session.add(
                ChatMessage(
                    user_id=user.id,
                    session_id=conversation_id,
                    role="assistant",
                    content=final_message,
                    agent_reasoning={"agents": [a["agent_name"] for a in orchestrated["agents"]], "findings_count": len(orchestrated["findings"])},
                    tools_used=[agent["agent_name"] for agent in orchestrated["agents"]],
                )
            )
            await session.flush()

            yield _sse("done", {
                "session_id": conversation_id,
                "tools_used": [agent["agent_name"] for agent in orchestrated["agents"]],
            })
            return

        snapshot_block = ""
        if isinstance(user.onboarding_snapshot, dict):
            snap_total, snap_breakdown = _extract_snapshot_expenses(user.onboarding_snapshot)
            snap_income = 0.0
            try:
                snap_income = float(user.onboarding_snapshot.get("income") or 0)
            except (TypeError, ValueError):
                snap_income = 0.0
            snap_emi_total = 0.0
            raw_snap_loans = user.onboarding_snapshot.get("loans") or []
            if isinstance(raw_snap_loans, list):
                for loan in raw_snap_loans:
                    if isinstance(loan, dict):
                        try:
                            snap_emi_total += float(loan.get("emi") or 0)
                        except (TypeError, ValueError):
                            continue

            if snap_total > 0 or snap_income > 0:
                category_lines = "\n".join(
                    f"  - {category.replace('_', ' ').title()}: Rs {amount:,.0f}/mo"
                    + (f" ({(amount / snap_total * 100):.0f}% of spend)" if snap_total > 0 else "")
                    for category, amount in snap_breakdown[:6]
                )
                snapshot_block = (
                    "\nONBOARDING SNAPSHOT (self-reported monthly numbers — authoritative when transactions are missing):\n"
                    f"- Monthly income: Rs {snap_income:,.0f}\n"
                    f"- Total monthly expenses: Rs {snap_total:,.0f}\n"
                    f"- Total monthly EMIs: Rs {snap_emi_total:,.0f}\n"
                    + (f"- Top categories:\n{category_lines}\n" if snap_breakdown else "")
                )

        system_prompt = (
            "You are an India-first agentic AI financial copilot with 6 specialist agents. "
            "You have just run multiple specialist agents (expense, debt, goal, risk, investment, tax) "
            "on the user's real financial data. Use the agent findings below to give a personalized, "
            "conversational response. Be specific with numbers (use Rs). Be actionable. "
            "When the user asks simple follow-ups like 'how can I reduce it', 'cut this down', 'save more', "
            "ground every tip in their actual top categories from the snapshot, give 2-3 India-specific steps per category, "
            "and quantify the monthly rupee saving of each suggestion. Do not give generic advice. "
            "If the user asks about affordability or goals, give clear yes/no with reasoning. "
            "If the user asks for an investment plan, build it from income, surplus, debt, and emergency-fund capacity. "
            "If debt ratio is 0 and no loans exist in the snapshot, explicitly say no active loan is detected and do not invent payoff order, lenders, or debt amounts. "
            "Do not recommend specific stocks, IPOs, or MTF trades unless live market data and suitability data are available. "
            "Explain that ETFs and diversified mutual funds are core instruments, while direct stocks are satellite ideas and MTF is not a passive-income tool. "
            "Keep it concise but thorough (2-4 paragraphs max).\n\n"
            f"FINANCIAL CONTEXT:\n"
            f"Income: Rs {metrics_dict.get('total_income', 0):,.0f}\n"
            f"Expenses: Rs {metrics_dict.get('total_expenses', 0):,.0f}\n"
            f"Profile monthly income: Rs {(float(user.monthly_income) if user.monthly_income is not None else 0):,.0f}\n"
            f"Savings rate: {metrics_dict.get('savings_rate', 0) * 100:.1f}%\n"
            f"Health score: based on {len(transactions)} transactions"
            f"{snapshot_block}\n\n"
            f"AGENT FINDINGS:\n{findings_text}\n\n"
            f"RECOMMENDATIONS:\n{recommendations_text or 'None generated.'}"
        )

        history_prompt = ""
        if history:
            history_prompt = "\nCONVERSATION HISTORY:\n" + "\n".join(
                f"{m['role'].upper()}: {m['content'][:200]}" for m in history[-4:]
            ) + "\n"

        user_prompt = f"{history_prompt}\nUSER: {message}\nASSISTANT:"

        # Stream the response
        full_response = []
        async for chunk in self.gemini.stream(
            system_instruction=system_prompt,
            prompt=user_prompt,
            temperature=0.6,
            max_tokens=2048,
        ):
            full_response.append(chunk)
            yield _sse("message", {"content": chunk})

        final_message = "".join(full_response)
        if not final_message:
            if _is_investment_intent(message):
                final_message = _build_investment_fallback(
                    message=message,
                    metrics=metrics_dict,
                    profile=context.profile,
                    orchestrated=orchestrated,
                )
                yield _sse("message", {"content": final_message})

            if final_message:
                session.add(ChatMessage(user_id=user.id, session_id=conversation_id, role="user", content=message))
                session.add(
                    ChatMessage(
                        user_id=user.id,
                        session_id=conversation_id,
                        role="assistant",
                        content=final_message,
                        agent_reasoning={"agents": [a["agent_name"] for a in orchestrated["agents"]], "findings_count": len(orchestrated["findings"])},
                        tools_used=[agent["agent_name"] for agent in orchestrated["agents"]],
                    )
                )
                await session.flush()

                yield _sse("done", {
                    "session_id": conversation_id,
                    "tools_used": [agent["agent_name"] for agent in orchestrated["agents"]],
                })
                return

            # Build a meaningful fallback from agent findings when Gemini is unavailable
            fallback_parts = []
            summary = orchestrated.get("summary", "")
            if summary and summary != "Not enough financial history is available yet to produce a strong multi-agent summary.":
                fallback_parts.append(summary)

            findings = orchestrated.get("findings", [])
            if findings:
                fallback_parts.append("\n**Key findings from AI agents:**")
                for f in findings[:5]:
                    title = f.get("title", "")
                    detail = f.get("detail", "")
                    if detail:
                        fallback_parts.append(f"- **{title}**: {detail}")

            recs = orchestrated.get("recommendations", [])
            if recs:
                fallback_parts.append("\n**Agent recommendations:**")
                for r in recs[:3]:
                    title = r.get("title", "")
                    desc = r.get("description", "")
                    if desc:
                        fallback_parts.append(f"- **{title}**: {desc}")

            if not fallback_parts:
                fallback_parts.append(
                    "I've run multi-agent analysis on your financial data. "
                    "Add onboarding expenses or upload transactions to get detailed insights from the "
                    "Expense, Debt, Goal, Risk, Investment, and Tax agents."
                )

            final_message = "\n".join(fallback_parts)
            yield _sse("message", {"content": final_message})

        # Save to DB
        session.add(ChatMessage(user_id=user.id, session_id=conversation_id, role="user", content=message))
        session.add(
            ChatMessage(
                user_id=user.id,
                session_id=conversation_id,
                role="assistant",
                content=final_message,
                agent_reasoning={"agents": [a["agent_name"] for a in orchestrated["agents"]], "findings_count": len(orchestrated["findings"])},
                tools_used=[agent["agent_name"] for agent in orchestrated["agents"]],
            )
        )
        await session.flush()

        yield _sse("done", {
            "session_id": conversation_id,
            "tools_used": [agent["agent_name"] for agent in orchestrated["agents"]],
        })
