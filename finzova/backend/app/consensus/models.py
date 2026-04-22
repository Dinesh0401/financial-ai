from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class EvidenceSensitivity(str, Enum):
    AGGREGATE = "aggregate"
    CATEGORY = "category"
    MERCHANT = "merchant"
    RESTRICTED = "restricted"


class DisclosureLevel(str, Enum):
    SUMMARY = "summary"
    CATEGORY = "category"
    MERCHANT = "merchant"


class ConfidenceBand(str, Enum):
    LOW = "low"
    GUARDED = "guarded"
    HIGH = "high"


class SafetyBias(str, Enum):
    CONSERVATIVE = "conservative"
    BALANCED = "balanced"
    AGGRESSIVE = "aggressive"


class ActionFamily(str, Enum):
    DEBT_REDUCTION = "debt_reduction"
    INVESTMENT_GROWTH = "investment_growth"
    RESERVE_BUILDING = "reserve_building"
    GOAL_CONTRIBUTION = "goal_contribution"
    SPENDING_REDUCTION = "spending_reduction"
    RISK_CONTAINMENT = "risk_containment"
    SHAREABLE_SUMMARY = "shareable_summary"


class ExecutionStatus(str, Enum):
    READY = "ready"
    NEEDS_MORE_DATA = "needs_more_data"
    EXPAND_SCOPE = "expand_scope"
    DOWNGRADED = "downgraded"


class EvidenceAtom(BaseModel):
    source_type: str
    source_id: str
    field_name: str
    summary: str
    sensitivity: EvidenceSensitivity = EvidenceSensitivity.AGGREGATE
    confidence: float = Field(default=0.5, ge=0.0, le=1.0)
    recency_hours: float = Field(default=24.0, ge=0.0)
    completeness_contribution: float = Field(default=0.5, ge=0.0, le=1.0)
    metadata: dict[str, Any] = Field(default_factory=dict)


class AgentClaim(BaseModel):
    claim_id: str
    agent_name: str
    title: str
    recommendation: str
    rationale: str
    action_family: ActionFamily
    confidence: float = Field(default=0.5, ge=0.0, le=1.0)
    intent_fit_hint: float = Field(default=0.5, ge=0.0, le=1.0)
    safety_bias: SafetyBias = SafetyBias.BALANCED
    required_fields: list[str] = Field(default_factory=list)
    missing_fields: list[str] = Field(default_factory=list)
    evidence: list[EvidenceAtom] = Field(default_factory=list)
    follow_up_action: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class ConsensusContext(BaseModel):
    intent: str
    shareable: bool = False
    selected_agents: list[str] = Field(default_factory=list)
    available_agents: list[str] = Field(default_factory=list)
    metrics: dict[str, Any] = Field(default_factory=dict)


class ConsensusScore(BaseModel):
    claim_id: str
    agent_name: str
    evidence_quality: float = Field(ge=0.0, le=1.0)
    data_completeness: float = Field(ge=0.0, le=1.0)
    recency_score: float = Field(ge=0.0, le=1.0)
    intent_fit: float = Field(ge=0.0, le=1.0)
    safety_bias_score: float = Field(ge=0.0, le=1.0)
    weighted_total: float = Field(ge=0.0, le=1.0)
    confidence_band: ConfidenceBand
    rationale: str


class ExecutionGate(BaseModel):
    status: ExecutionStatus
    should_run_more_agents: bool = False
    suggested_agents: list[str] = Field(default_factory=list)
    should_request_more_data: bool = False
    missing_fields: list[str] = Field(default_factory=list)
    downgrade_to: ConfidenceBand | None = None
    rationale: str


class DisclosurePolicy(BaseModel):
    level: DisclosureLevel
    allowed_fields: list[str] = Field(default_factory=list)
    redacted_fields: list[str] = Field(default_factory=list)
    rationale: str


class SuppressedAlternative(BaseModel):
    claim_id: str
    agent_name: str
    recommendation: str
    reason: str


class FinalAdvicePacket(BaseModel):
    winning_claim_id: str
    recommended_action: str
    rationale: str
    suppressed_alternatives: list[SuppressedAlternative] = Field(default_factory=list)
    confidence_band: ConfidenceBand
    evidence_bundle: list[EvidenceAtom] = Field(default_factory=list)
    disclosure_level: DisclosureLevel
    disclosure_policy: DisclosurePolicy
    follow_up_action: str | None = None
    gate: ExecutionGate
    scores: list[ConsensusScore] = Field(default_factory=list)
