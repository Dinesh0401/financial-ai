from __future__ import annotations

from pydantic import BaseModel


class RecentAlertItem(BaseModel):
    alert_id: str
    title: str
    severity: str
    message: str


class DashboardResponse(BaseModel):
    health_score: dict
    monthly_overview: dict
    spending_breakdown: dict[str, float]
    cashflow_chart: list[dict]
    active_goals: list[dict]
    recent_alerts: list[RecentAlertItem]
    quick_insights: list[str]
