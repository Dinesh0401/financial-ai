from __future__ import annotations

from math import exp

from app.consensus.models import (
    ActionFamily,
    AgentClaim,
    ConfidenceBand,
    ConsensusContext,
    ConsensusScore,
    DisclosureLevel,
    DisclosurePolicy,
    EvidenceAtom,
    EvidenceSensitivity,
    ExecutionGate,
    ExecutionStatus,
    FinalAdvicePacket,
    SafetyBias,
    SuppressedAlternative,
)


class ConsensusEngine:
    """Internal prototype of the flagship arbitration engine described in the patent package."""

    WEIGHTS = {
        "evidence_quality": 0.30,
        "data_completeness": 0.25,
        "recency_score": 0.15,
        "intent_fit": 0.15,
        "safety_bias_score": 0.15,
    }

    def evaluate_execution_gate(
        self,
        *,
        claims: list[AgentClaim],
        context: ConsensusContext,
    ) -> ExecutionGate:
        missing_fields = sorted({field for claim in claims for field in claim.missing_fields})
        intent = context.intent.lower()
        suggested_agents = self._suggest_agents(intent=intent, context=context)

        if missing_fields:
            return ExecutionGate(
                status=ExecutionStatus.NEEDS_MORE_DATA,
                should_run_more_agents=bool(suggested_agents),
                suggested_agents=suggested_agents,
                should_request_more_data=True,
                missing_fields=missing_fields,
                downgrade_to=ConfidenceBand.GUARDED,
                rationale=(
                    "One or more claims are operating with missing financial inputs, so the engine "
                    "requires more data before presenting a fully confident recommendation."
                ),
            )

        if suggested_agents:
            return ExecutionGate(
                status=ExecutionStatus.EXPAND_SCOPE,
                should_run_more_agents=True,
                suggested_agents=suggested_agents,
                should_request_more_data=False,
                missing_fields=[],
                downgrade_to=ConfidenceBand.GUARDED,
                rationale=(
                    "The current agent set is incomplete for this intent. Expanding scope would improve "
                    "conflict resolution and reduce the chance of one-dimensional advice."
                ),
            )

        return ExecutionGate(
            status=ExecutionStatus.READY,
            should_run_more_agents=False,
            suggested_agents=[],
            should_request_more_data=False,
            missing_fields=[],
            downgrade_to=None,
            rationale="The current claims contain enough information for deterministic arbitration.",
        )

    def score_claims(
        self,
        *,
        claims: list[AgentClaim],
        context: ConsensusContext,
    ) -> list[ConsensusScore]:
        scores: list[ConsensusScore] = []
        for claim in claims:
            evidence_quality = self._evidence_quality(claim)
            data_completeness = self._data_completeness(claim)
            recency_score = self._recency_score(claim)
            intent_fit = self._intent_fit(claim=claim, intent=context.intent)
            safety_bias_score = self._safety_bias_score(claim=claim, metrics=context.metrics)
            weighted_total = (
                (evidence_quality * self.WEIGHTS["evidence_quality"])
                + (data_completeness * self.WEIGHTS["data_completeness"])
                + (recency_score * self.WEIGHTS["recency_score"])
                + (intent_fit * self.WEIGHTS["intent_fit"])
                + (safety_bias_score * self.WEIGHTS["safety_bias_score"])
            )
            scores.append(
                ConsensusScore(
                    claim_id=claim.claim_id,
                    agent_name=claim.agent_name,
                    evidence_quality=round(evidence_quality, 4),
                    data_completeness=round(data_completeness, 4),
                    recency_score=round(recency_score, 4),
                    intent_fit=round(intent_fit, 4),
                    safety_bias_score=round(safety_bias_score, 4),
                    weighted_total=round(weighted_total, 4),
                    confidence_band=self._score_to_band(weighted_total),
                    rationale=(
                        f"Evidence={evidence_quality:.2f}, completeness={data_completeness:.2f}, "
                        f"recency={recency_score:.2f}, intent={intent_fit:.2f}, safety={safety_bias_score:.2f}."
                    ),
                )
            )
        return sorted(scores, key=lambda item: item.weighted_total, reverse=True)

    def build_packet(
        self,
        *,
        claims: list[AgentClaim],
        context: ConsensusContext,
    ) -> FinalAdvicePacket:
        if not claims:
            raise ValueError("ConsensusEngine.build_packet requires at least one claim.")

        gate = self.evaluate_execution_gate(claims=claims, context=context)
        scores = self.score_claims(claims=claims, context=context)
        score_by_claim = {score.claim_id: score for score in scores}
        claim_by_id = {claim.claim_id: claim for claim in claims}

        winner = claim_by_id[scores[0].claim_id]
        runner_up = claim_by_id[scores[1].claim_id] if len(scores) > 1 else None

        disclosure_policy = self._build_disclosure_policy(context=context)
        evidence_bundle = self._filter_evidence(
            evidence=winner.evidence,
            level=disclosure_policy.level,
        )

        recommended_action = winner.recommendation
        follow_up_action = winner.follow_up_action
        rationale = winner.rationale

        if runner_up is not None:
            winner_score = score_by_claim[winner.claim_id].weighted_total
            runner_score = score_by_claim[runner_up.claim_id].weighted_total
            if (
                winner.action_family == ActionFamily.GOAL_CONTRIBUTION
                and runner_up.action_family in {ActionFamily.SPENDING_REDUCTION, ActionFamily.RISK_CONTAINMENT}
                and runner_score >= winner_score - 0.10
            ):
                recommended_action = (
                    f"{winner.recommendation} only after applying the conservative guardrail: "
                    f"{runner_up.recommendation}"
                )
                follow_up_action = runner_up.follow_up_action or runner_up.recommendation
                rationale = (
                    f"{winner.rationale} The goal remains feasible, but the engine merged in a risk-first "
                    f"guardrail because the secondary claim is close in score and more conservative."
                )

        confidence_band = score_by_claim[winner.claim_id].confidence_band
        if gate.downgrade_to is not None:
            confidence_band = self._more_conservative_band(confidence_band, gate.downgrade_to)

        suppressed_alternatives = [
            SuppressedAlternative(
                claim_id=claim.claim_id,
                agent_name=claim.agent_name,
                recommendation=claim.recommendation,
                reason=self._suppression_reason(
                    winner_score=score_by_claim[winner.claim_id],
                    alternative_score=score_by_claim[claim.claim_id],
                    winner=winner,
                    alternative=claim,
                ),
            )
            for claim in claims
            if claim.claim_id != winner.claim_id
        ]

        return FinalAdvicePacket(
            winning_claim_id=winner.claim_id,
            recommended_action=recommended_action,
            rationale=rationale,
            suppressed_alternatives=suppressed_alternatives,
            confidence_band=confidence_band,
            evidence_bundle=evidence_bundle,
            disclosure_level=disclosure_policy.level,
            disclosure_policy=disclosure_policy,
            follow_up_action=follow_up_action,
            gate=gate,
            scores=scores,
        )

    def _suggest_agents(self, *, intent: str, context: ConsensusContext) -> list[str]:
        preferred: list[str] = []
        if any(token in intent for token in ("invest", "passive income", "sip", "etf", "ipo", "mtf")):
            preferred = ["risk_agent", "goal_agent", "investment_agent"]
        elif any(token in intent for token in ("goal", "afford", "car", "house", "retirement")):
            preferred = ["risk_agent", "investment_agent", "goal_agent"]
        elif any(token in intent for token in ("debt", "loan", "emi")):
            preferred = ["risk_agent", "debt_agent", "investment_agent"]
        elif any(token in intent for token in ("merchant", "shareable", "share", "spending")):
            preferred = ["expense_agent", "risk_agent"]

        available = set(context.available_agents)
        selected = set(context.selected_agents)
        return [agent for agent in preferred if agent in available and agent not in selected]

    def _evidence_quality(self, claim: AgentClaim) -> float:
        if not claim.evidence:
            return claim.confidence * 0.7
        quality = sum(atom.confidence for atom in claim.evidence) / len(claim.evidence)
        return max(0.0, min(1.0, (quality * 0.75) + (claim.confidence * 0.25)))

    def _data_completeness(self, claim: AgentClaim) -> float:
        if not claim.required_fields:
            evidence_completeness = (
                sum(atom.completeness_contribution for atom in claim.evidence) / len(claim.evidence)
                if claim.evidence
                else 0.7
            )
            return max(0.0, min(1.0, evidence_completeness))
        present = len(claim.required_fields) - len(claim.missing_fields)
        base = present / max(1, len(claim.required_fields))
        return max(0.0, min(1.0, base))

    def _recency_score(self, claim: AgentClaim) -> float:
        if not claim.evidence:
            return 0.5
        average_hours = sum(atom.recency_hours for atom in claim.evidence) / len(claim.evidence)
        return max(0.0, min(1.0, exp(-average_hours / 168.0)))

    def _intent_fit(self, *, claim: AgentClaim, intent: str) -> float:
        lowered = intent.lower()
        intent_bonus = 0.0
        family_keywords = {
            ActionFamily.DEBT_REDUCTION: ("debt", "loan", "emi", "credit"),
            ActionFamily.INVESTMENT_GROWTH: ("invest", "sip", "etf", "stock", "passive income", "ipo"),
            ActionFamily.RESERVE_BUILDING: ("reserve", "emergency", "buffer"),
            ActionFamily.GOAL_CONTRIBUTION: ("goal", "afford", "car", "house", "retirement"),
            ActionFamily.SPENDING_REDUCTION: ("spend", "merchant", "cut", "budget"),
            ActionFamily.RISK_CONTAINMENT: ("risk", "warning", "alert", "shareable"),
            ActionFamily.SHAREABLE_SUMMARY: ("shareable", "share", "summary"),
        }
        if any(keyword in lowered for keyword in family_keywords.get(claim.action_family, ())):
            intent_bonus = 0.20
        return max(0.0, min(1.0, claim.intent_fit_hint + intent_bonus))

    def _safety_bias_score(self, *, claim: AgentClaim, metrics: dict) -> float:
        debt_ratio = float(metrics.get("debt_ratio", 0) or 0)
        emergency_fund_months = float(metrics.get("emergency_fund_months", 0) or 0)
        savings_rate = float(metrics.get("savings_rate", 0) or 0)

        debt_pressure = min(1.0, debt_ratio / 0.40) if debt_ratio > 0 else 0.0
        reserve_pressure = min(1.0, max(0.0, 6.0 - emergency_fund_months) / 6.0)
        savings_pressure = min(1.0, max(0.0, 0.20 - savings_rate) / 0.20)
        risk_pressure = max(debt_pressure, reserve_pressure, savings_pressure)

        if claim.safety_bias == SafetyBias.CONSERVATIVE:
            return min(1.0, 0.55 + (0.45 * risk_pressure))
        if claim.safety_bias == SafetyBias.BALANCED:
            return min(1.0, 0.65 + (0.20 * (1.0 - abs(risk_pressure - 0.5))))
        return min(1.0, 0.35 + (0.45 * (1.0 - risk_pressure)))

    def _score_to_band(self, score: float) -> ConfidenceBand:
        if score < 0.45:
            return ConfidenceBand.LOW
        if score < 0.75:
            return ConfidenceBand.GUARDED
        return ConfidenceBand.HIGH

    def _build_disclosure_policy(self, *, context: ConsensusContext) -> DisclosurePolicy:
        intent = context.intent.lower()

        if context.shareable:
            return DisclosurePolicy(
                level=DisclosureLevel.CATEGORY,
                allowed_fields=["category", "amount_range", "trend", "confidence_band", "recommended_action"],
                redacted_fields=["merchant", "upi_id", "account_number", "exact_timestamp"],
                rationale="Shareable mode strips merchant-level evidence and only exposes category-level proof.",
            )

        if any(token in intent for token in ("merchant", "fraud", "unusual transaction", "swiggy", "zomato", "uber")):
            return DisclosurePolicy(
                level=DisclosureLevel.MERCHANT,
                allowed_fields=["merchant", "date", "amount", "category", "recommended_action"],
                redacted_fields=["upi_id", "account_number"],
                rationale="Troubleshooting and merchant-specific questions need merchant-level evidence.",
            )

        if any(token in intent for token in ("invest", "passive income", "goal", "share", "dashboard", "plan")):
            return DisclosurePolicy(
                level=DisclosureLevel.CATEGORY,
                allowed_fields=["category", "trend", "amount_range", "recommended_action", "confidence_band"],
                redacted_fields=["merchant", "upi_id", "account_number"],
                rationale="Planning flows only need category-level evidence to explain the selected advice.",
            )

        return DisclosurePolicy(
            level=DisclosureLevel.SUMMARY,
            allowed_fields=["recommended_action", "confidence_band", "summary"],
            redacted_fields=["merchant", "category", "upi_id", "account_number", "exact_timestamp"],
            rationale="Default disclosure stays at summary level when detailed evidence is unnecessary.",
        )

    def _filter_evidence(
        self,
        *,
        evidence: list[EvidenceAtom],
        level: DisclosureLevel,
    ) -> list[EvidenceAtom]:
        threshold = {
            DisclosureLevel.SUMMARY: 0,
            DisclosureLevel.CATEGORY: 1,
            DisclosureLevel.MERCHANT: 2,
        }[level]

        rank = {
            EvidenceSensitivity.AGGREGATE: 0,
            EvidenceSensitivity.CATEGORY: 1,
            EvidenceSensitivity.MERCHANT: 2,
            EvidenceSensitivity.RESTRICTED: 3,
        }

        filtered = [atom for atom in evidence if rank[atom.sensitivity] <= threshold]
        if filtered:
            return filtered
        return [
            EvidenceAtom(
                source_type="consensus_engine",
                source_id="summary-redaction",
                field_name="summary",
                summary="Detailed evidence was redacted by disclosure policy. Arbitration proceeded on internal signals.",
                sensitivity=EvidenceSensitivity.AGGREGATE,
                confidence=0.7,
                recency_hours=0.0,
                completeness_contribution=0.7,
            )
        ]

    def _more_conservative_band(
        self,
        current: ConfidenceBand,
        requested: ConfidenceBand,
    ) -> ConfidenceBand:
        order = {
            ConfidenceBand.LOW: 0,
            ConfidenceBand.GUARDED: 1,
            ConfidenceBand.HIGH: 2,
        }
        reverse = {value: key for key, value in order.items()}
        return reverse[min(order[current], order[requested])]

    def _suppression_reason(
        self,
        *,
        winner_score: ConsensusScore,
        alternative_score: ConsensusScore,
        winner: AgentClaim,
        alternative: AgentClaim,
    ) -> str:
        if alternative_score.weighted_total < winner_score.weighted_total - 0.10:
            return "Suppressed because the claim scored materially lower on evidence, completeness, or safety."
        if winner.safety_bias == SafetyBias.CONSERVATIVE and alternative.safety_bias == SafetyBias.AGGRESSIVE:
            return "Suppressed because the engine favored the safer action under current financial pressure."
        return "Suppressed because it remained a viable alternative but did not win the final arbitration."
