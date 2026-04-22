from __future__ import annotations

from abc import ABC, abstractmethod
from time import perf_counter
from typing import Any

from pydantic import BaseModel, Field


class AgentContext(BaseModel):
    user_id: str
    intent: str | None = None
    transactions: list[dict] = Field(default_factory=list)
    metrics: dict | None = None
    goals: list[dict] = Field(default_factory=list)
    analysis: dict | None = None
    profile: dict = Field(default_factory=dict)
    conversation_history: list[dict] = Field(default_factory=list)


class AgentResult(BaseModel):
    agent_name: str
    status: str
    findings: list[dict] = Field(default_factory=list)
    recommendations: list[dict] = Field(default_factory=list)
    risk_alerts: list[dict] = Field(default_factory=list)
    confidence: float
    reasoning: str
    tools_used: list[str] = Field(default_factory=list)
    execution_time_ms: int


class BaseAgent(ABC):
    name: str
    description: str
    tools: list[str]

    @abstractmethod
    async def analyze(self, context: AgentContext) -> AgentResult:
        raise NotImplementedError

    @abstractmethod
    def can_handle(self, intent: str) -> float:
        raise NotImplementedError

    async def _result(
        self,
        *,
        started_at: float,
        findings: list[dict] | None = None,
        recommendations: list[dict] | None = None,
        risk_alerts: list[dict] | None = None,
        confidence: float = 0.8,
        reasoning: str,
        tools_used: list[str] | None = None,
    ) -> AgentResult:
        return AgentResult(
            agent_name=self.name,
            status="success",
            findings=findings or [],
            recommendations=recommendations or [],
            risk_alerts=risk_alerts or [],
            confidence=confidence,
            reasoning=reasoning,
            tools_used=tools_used or self.tools,
            execution_time_ms=int((perf_counter() - started_at) * 1000),
        )
