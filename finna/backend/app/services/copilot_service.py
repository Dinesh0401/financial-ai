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
        if _is_loan_intent(message) and debt_ratio <= 0:
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

        system_prompt = (
            "You are an India-first agentic AI financial copilot with 6 specialist agents. "
            "You have just run multiple specialist agents (expense, debt, goal, risk, investment, tax) "
            "on the user's real financial data. Use the agent findings below to give a personalized, "
            "conversational response. Be specific with numbers (use Rs). Be actionable. "
            "If the user asks about affordability or goals, give clear yes/no with reasoning. "
            "If the user asks for an investment plan, build it from income, surplus, debt, and emergency-fund capacity. "
            "If debt ratio is 0 or there are no active EMI/loan outflows, explicitly say no active loan is detected and do not invent payoff order, lenders, or debt amounts. "
            "Do not recommend specific stocks, IPOs, or MTF trades unless live market data and suitability data are available. "
            "Explain that ETFs and diversified mutual funds are core instruments, while direct stocks are satellite ideas and MTF is not a passive-income tool. "
            "Keep it concise but thorough (2-4 paragraphs max).\n\n"
            f"FINANCIAL CONTEXT:\n"
            f"Income: Rs {metrics_dict.get('total_income', 0):,.0f}\n"
            f"Expenses: Rs {metrics_dict.get('total_expenses', 0):,.0f}\n"
            f"Profile monthly income: Rs {(float(user.monthly_income) if user.monthly_income is not None else 0):,.0f}\n"
            f"Savings rate: {metrics_dict.get('savings_rate', 0) * 100:.1f}%\n"
            f"Health score: based on {len(transactions)} transactions\n\n"
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
                    "Upload more transactions to get detailed insights from the "
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
