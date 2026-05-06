from __future__ import annotations

from pydantic import BaseModel, Field


class RecentAlertItem(BaseModel):
    alert_id: str
    title: str
    severity: str
    message: str


class DashboardAiAgent(BaseModel):
    agent_name: str
    status: str
    confidence: float | None = None
    execution_time_ms: int | None = None


class DashboardAiRecommendation(BaseModel):
    title: str
    description: str | None = None
    agent: str | None = None
    priority: str | int | None = None
    potential_saving: float | None = None
    action_items: list[str] = Field(default_factory=list)


class DashboardAiAnalysis(BaseModel):
    summary: str
    agents: list[DashboardAiAgent]
    recommendations: list[DashboardAiRecommendation]
    last_run_at: str | None = None


class DashboardResponse(BaseModel):
    health_score: dict
    monthly_overview: dict
    spending_breakdown: dict[str, float]
    cashflow_chart: list[dict]
    active_goals: list[dict]
    recent_alerts: list[RecentAlertItem]
    quick_insights: list[str]
    ai_analysis: DashboardAiAnalysis
