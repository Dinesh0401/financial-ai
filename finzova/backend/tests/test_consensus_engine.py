from app.consensus import (
    ActionFamily,
    AgentClaim,
    ConsensusContext,
    ConsensusEngine,
    DisclosureLevel,
    EvidenceAtom,
    EvidenceSensitivity,
    ExecutionStatus,
    SafetyBias,
)


def _atom(
    *,
    field_name: str,
    summary: str,
    sensitivity: EvidenceSensitivity,
    confidence: float,
    recency_hours: float,
    completeness: float,
) -> EvidenceAtom:
    return EvidenceAtom(
        source_type="analysis_result",
        source_id=f"atom-{field_name}",
        field_name=field_name,
        summary=summary,
        sensitivity=sensitivity,
        confidence=confidence,
        recency_hours=recency_hours,
        completeness_contribution=completeness,
    )


def test_arbitration_prefers_debt_paydown_when_reserve_is_weak() -> None:
    engine = ConsensusEngine()
    context = ConsensusContext(
        intent="Should I increase my SIP or prepay debt first?",
        metrics={
            "debt_ratio": 0.34,
            "emergency_fund_months": 1.5,
            "savings_rate": 0.08,
        },
    )
    claims = [
        AgentClaim(
            claim_id="debt-first",
            agent_name="debt_agent",
            title="Prioritize EMI prepayment",
            recommendation="Prepay the costliest EMI before increasing SIP contributions.",
            rationale="Debt service is constraining flexibility and the reserve buffer is weak.",
            action_family=ActionFamily.DEBT_REDUCTION,
            confidence=0.78,
            intent_fit_hint=0.82,
            safety_bias=SafetyBias.CONSERVATIVE,
            evidence=[
                _atom(
                    field_name="debt_ratio",
                    summary="Debt ratio is elevated relative to income.",
                    sensitivity=EvidenceSensitivity.CATEGORY,
                    confidence=0.84,
                    recency_hours=18,
                    completeness=0.90,
                )
            ],
        ),
        AgentClaim(
            claim_id="invest-more",
            agent_name="investment_agent",
            title="Increase SIP",
            recommendation="Increase SIP contributions now to accelerate long-term compounding.",
            rationale="The current SIP rate is below the long-term target.",
            action_family=ActionFamily.INVESTMENT_GROWTH,
            confidence=0.86,
            intent_fit_hint=0.86,
            safety_bias=SafetyBias.AGGRESSIVE,
            evidence=[
                _atom(
                    field_name="investment_rate",
                    summary="Investment rate is below the desired target.",
                    sensitivity=EvidenceSensitivity.CATEGORY,
                    confidence=0.82,
                    recency_hours=12,
                    completeness=0.88,
                )
            ],
        ),
    ]

    packet = engine.build_packet(claims=claims, context=context)

    assert packet.winning_claim_id == "debt-first"
    assert packet.recommended_action.startswith("Prepay the costliest EMI")
    assert any(item.claim_id == "invest-more" for item in packet.suppressed_alternatives)


def test_execution_gate_requests_more_data_for_incomplete_passive_income_prompt() -> None:
    engine = ConsensusEngine()
    context = ConsensusContext(
        intent="Build a passive income plan for me.",
        selected_agents=["investment_agent"],
        available_agents=["investment_agent", "risk_agent", "goal_agent"],
        metrics={"debt_ratio": 0.10, "emergency_fund_months": 4.0},
    )
    claims = [
        AgentClaim(
            claim_id="income-ladder",
            agent_name="investment_agent",
            title="Passive income ladder",
            recommendation="Start building a passive income ladder with diversified core funds.",
            rationale="The portfolio can be staged once income and surplus are validated.",
            action_family=ActionFamily.INVESTMENT_GROWTH,
            confidence=0.70,
            intent_fit_hint=0.90,
            safety_bias=SafetyBias.BALANCED,
            required_fields=["monthly_income", "monthly_surplus", "emergency_fund_months"],
            missing_fields=["monthly_income", "monthly_surplus"],
        )
    ]

    gate = engine.evaluate_execution_gate(claims=claims, context=context)

    assert gate.status == ExecutionStatus.NEEDS_MORE_DATA
    assert gate.should_request_more_data is True
    assert set(gate.missing_fields) == {"monthly_income", "monthly_surplus"}
    assert "risk_agent" in gate.suggested_agents
    assert "goal_agent" in gate.suggested_agents


def test_shareable_context_redacts_merchant_level_evidence() -> None:
    engine = ConsensusEngine()
    context = ConsensusContext(
        intent="Create a shareable plan summary for my spending situation.",
        shareable=True,
        metrics={"savings_rate": 0.14},
    )
    claims = [
        AgentClaim(
            claim_id="cut-delivery",
            agent_name="expense_agent",
            title="Reduce delivery spend",
            recommendation="Reduce food-delivery spend by tightening category caps.",
            rationale="Delivery concentration is crowding out savings capacity.",
            action_family=ActionFamily.SPENDING_REDUCTION,
            confidence=0.80,
            intent_fit_hint=0.78,
            safety_bias=SafetyBias.CONSERVATIVE,
            evidence=[
                _atom(
                    field_name="merchant",
                    summary="Swiggy exceeded the normal monthly range.",
                    sensitivity=EvidenceSensitivity.MERCHANT,
                    confidence=0.88,
                    recency_hours=6,
                    completeness=0.9,
                ),
                _atom(
                    field_name="food_dining",
                    summary="Food dining category rose 31% month over month.",
                    sensitivity=EvidenceSensitivity.CATEGORY,
                    confidence=0.81,
                    recency_hours=6,
                    completeness=0.92,
                ),
            ],
        )
    ]

    packet = engine.build_packet(claims=claims, context=context)

    assert packet.disclosure_level == DisclosureLevel.CATEGORY
    assert all(atom.sensitivity != EvidenceSensitivity.MERCHANT for atom in packet.evidence_bundle)
    assert "merchant" in packet.disclosure_policy.redacted_fields


def test_goal_and_risk_claims_merge_into_conservative_adjustment_plan() -> None:
    engine = ConsensusEngine()
    context = ConsensusContext(
        intent="Can I keep funding my car goal?",
        metrics={
            "debt_ratio": 0.18,
            "emergency_fund_months": 2.5,
            "savings_rate": 0.11,
        },
    )
    claims = [
        AgentClaim(
            claim_id="goal-on-track",
            agent_name="goal_agent",
            title="Goal remains feasible",
            recommendation="Continue the current car-goal contribution schedule.",
            rationale="The goal is still feasible within the current timeline.",
            action_family=ActionFamily.GOAL_CONTRIBUTION,
            confidence=0.79,
            intent_fit_hint=0.89,
            safety_bias=SafetyBias.BALANCED,
            evidence=[
                _atom(
                    field_name="goal_probability",
                    summary="Success probability remains above the comfort threshold.",
                    sensitivity=EvidenceSensitivity.CATEGORY,
                    confidence=0.82,
                    recency_hours=20,
                    completeness=0.87,
                )
            ],
        ),
        AgentClaim(
            claim_id="risk-guardrail",
            agent_name="risk_agent",
            title="Guardrail on overspending",
            recommendation="Reduce discretionary overspending before locking in the next goal contribution.",
            rationale="Reserve coverage is thin and overspending is increasing fragility.",
            action_family=ActionFamily.RISK_CONTAINMENT,
            confidence=0.77,
            intent_fit_hint=0.72,
            safety_bias=SafetyBias.CONSERVATIVE,
            follow_up_action="Cut discretionary spending for one cycle and rebuild emergency buffer.",
            evidence=[
                _atom(
                    field_name="emergency_fund_months",
                    summary="Emergency coverage is below the preferred buffer.",
                    sensitivity=EvidenceSensitivity.CATEGORY,
                    confidence=0.84,
                    recency_hours=10,
                    completeness=0.90,
                )
            ],
        ),
    ]

    packet = engine.build_packet(claims=claims, context=context)

    assert packet.winning_claim_id == "goal-on-track"
    assert "only after applying the conservative guardrail" in packet.recommended_action
    assert packet.follow_up_action == "Cut discretionary spending for one cycle and rebuild emergency buffer."


def test_fresher_and_more_complete_evidence_can_change_the_winner() -> None:
    engine = ConsensusEngine()
    context = ConsensusContext(
        intent="Should I focus on reserve building or step up investing?",
        metrics={
            "debt_ratio": 0.08,
            "emergency_fund_months": 4.2,
            "savings_rate": 0.18,
        },
    )
    reserve_claim = AgentClaim(
        claim_id="reserve",
        agent_name="risk_agent",
        title="Build reserve first",
        recommendation="Top up the emergency reserve before increasing market exposure.",
        rationale="The reserve is still below the full safety target.",
        action_family=ActionFamily.RESERVE_BUILDING,
        confidence=0.76,
        intent_fit_hint=0.74,
        safety_bias=SafetyBias.CONSERVATIVE,
        evidence=[
            _atom(
                field_name="emergency_fund_months",
                summary="Reserve coverage is below the ideal target.",
                sensitivity=EvidenceSensitivity.CATEGORY,
                confidence=0.83,
                recency_hours=240,
                completeness=0.86,
            )
        ],
    )
    invest_fresh = AgentClaim(
        claim_id="invest",
        agent_name="investment_agent",
        title="Increase investing",
        recommendation="Increase ETF and mutual-fund contributions with the latest surplus.",
        rationale="Cashflow has improved enough to support measured growth.",
        action_family=ActionFamily.INVESTMENT_GROWTH,
        confidence=0.79,
        intent_fit_hint=0.84,
        safety_bias=SafetyBias.BALANCED,
        evidence=[
            _atom(
                field_name="monthly_surplus",
                summary="Surplus improved in the latest cycle.",
                sensitivity=EvidenceSensitivity.CATEGORY,
                confidence=0.82,
                recency_hours=8,
                completeness=0.95,
            )
        ],
    )

    fresh_packet = engine.build_packet(claims=[reserve_claim, invest_fresh], context=context)
    assert fresh_packet.winning_claim_id == "invest"

    invest_stale = invest_fresh.model_copy(
        update={
            "missing_fields": ["latest_income_refresh"],
            "evidence": [
                _atom(
                    field_name="monthly_surplus",
                    summary="Surplus estimate is based on older cycles.",
                    sensitivity=EvidenceSensitivity.CATEGORY,
                    confidence=0.76,
                    recency_hours=360,
                    completeness=0.62,
                )
            ],
        }
    )
    reserve_fresh = reserve_claim.model_copy(
        update={
            "evidence": [
                _atom(
                    field_name="emergency_fund_months",
                    summary="Reserve coverage remains below the full six-month target.",
                    sensitivity=EvidenceSensitivity.CATEGORY,
                    confidence=0.86,
                    recency_hours=4,
                    completeness=0.9,
                )
            ]
        }
    )

    stale_packet = engine.build_packet(claims=[reserve_fresh, invest_stale], context=context)
    assert stale_packet.winning_claim_id == "reserve"
