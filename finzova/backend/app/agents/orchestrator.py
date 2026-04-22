from __future__ import annotations

from typing import Iterable

from app.agents.base_agent import AgentContext, AgentResult
from app.agents.specialists import DebtAgent, ExpenseAgent, GoalAgent, InvestmentAgent, RiskAgent, TaxAgent
from app.config.settings import Settings
from app.services.gemini_service import GeminiService


class OrchestratorAgent:
    def __init__(self, settings: Settings, gemini: GeminiService) -> None:
        self.settings = settings
        self.gemini = gemini
        self.agents = [
            ExpenseAgent(gemini=gemini),
            DebtAgent(gemini=gemini),
            GoalAgent(gemini=gemini),
            RiskAgent(gemini=gemini),
            InvestmentAgent(gemini=gemini),
            TaxAgent(gemini=gemini),
        ]

    async def run(self, context: AgentContext, *, intent: str | None = None) -> dict:
        selected_agents = self._select_agents(intent or context.intent or "general analysis")
        results: list[AgentResult] = [await agent.analyze(context) for agent in selected_agents]
        recommendations = [item for result in results for item in result.recommendations]
        alerts = [item for result in results for item in result.risk_alerts]
        findings = [item for result in results for item in result.findings]
        synthesis = await self._synthesize(intent or "general analysis", findings, context)
        return {
            "agents": [result.model_dump() for result in results],
            "recommendations": recommendations,
            "alerts": alerts,
            "findings": findings,
            "summary": synthesis,
        }

    def _select_agents(self, intent: str) -> list:
        ranked = sorted(self.agents, key=lambda agent: agent.can_handle(intent), reverse=True)
        top_score = ranked[0].can_handle(intent) if ranked else 0
        selected = [agent for agent in ranked if agent.can_handle(intent) >= max(0.45, top_score - 0.25)]
        return selected or ranked[:3]

    async def _synthesize(self, intent: str, findings: Iterable[dict], context: AgentContext) -> str:
        finding_text = "\n".join(
            f"- {item.get('title', '')}: {item.get('detail', '')}"
            for item in findings
            if item.get("detail")
        )
        if not finding_text:
            return "Not enough financial history is available yet to produce a strong multi-agent summary."

        prompt = (
            f"User's question/intent: {intent}\n\n"
            f"Agent findings from multiple specialist agents:\n{finding_text}\n\n"
            "Synthesize these findings into a clear, actionable summary (4-6 sentences). "
            "Lead with the most important insight. Use Rs for Indian Rupees. "
            "Be direct and specific — this person wants to know what to DO, not just what IS."
        )
        system = (
            "You are an India-first agentic AI financial copilot. "
            "You synthesize findings from 6 specialist agents (expense, debt, goal, risk, investment, tax) "
            "into a unified financial perspective. Be conversational but authoritative. "
            "Always use Indian context (Rs, Indian tax laws, UPI, Indian banks)."
        )
        result = await self.gemini.generate(system_instruction=system, prompt=prompt, temperature=0.5)
        if result:
            return result
        return self._fallback_summary(findings)

    def _fallback_summary(self, findings: Iterable[dict]) -> str:
        details = [item.get("detail", "") for item in findings if item.get("detail")]
        if not details:
            return "Not enough financial history is available yet to produce a strong multi-agent summary."
        return " ".join(details[:3])
