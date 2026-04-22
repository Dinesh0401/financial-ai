from __future__ import annotations

from pydantic import BaseModel


class AnalysisRunRequest(BaseModel):
    force_refresh: bool = False


class AnalysisRunResponse(BaseModel):
    analysis_id: str
    financial_score: int
    risk_level: str
    metrics: dict
    recommendations: list[dict]
    agent_traces: dict | None = None


class BenchmarkComparison(BaseModel):
    available: bool = False
    sample_size: int = 0
    percentile: int | None = None
    avg_score: int | None = None
    note: str | None = None


class HealthScoreResponse(BaseModel):
    score: int
    breakdown: dict[str, dict]
    trend: list[int]
    comparison: BenchmarkComparison


class RisksResponse(BaseModel):
    alerts: list[dict]
    overall_risk: str
