# Invention Disclosure

## Title

Financial Agent Consensus Engine for Multi-Agent Personal Finance Decisioning

## Problem Statement

Conventional finance copilots have three structural failures:

1. they over-disclose raw financial data while explaining advice,
2. they produce overconfident recommendations when key inputs are missing, and
3. they collapse conflicting agent outputs into one opaque answer without exposing why one recommendation won.

The platform already operates as a multi-agent financial system with specialist agents for expense analysis, debt strategy, goal planning, risk monitoring, investment guidance, and tax optimization. The invention disclosed here governs how these agents are orchestrated and how their competing recommendations are resolved before the user sees a final answer.

## Core Mechanism

The invention is a deterministic consensus engine that transforms multiple specialist agent claims into one `FinalAdvicePacket`.

The engine performs three linked operations:

1. `Advice arbitration`
   - Score each agent claim using evidence quality, data completeness, recency, intent fit, and safety bias.
   - Select one winning action and suppress lower-ranked alternatives.
   - Merge a secondary conservative claim into the winner when the claims are close and user safety would otherwise degrade.

2. `Confidence-gated execution`
   - Determine whether the current claims are sufficient to answer.
   - If not sufficient, ask for missing fields, expand the participating agent set, or downgrade certainty before answering.

3. `Privacy-aware evidence release`
   - Determine the disclosure level required by the current intent.
   - Filter the evidence bundle to summary, category, or merchant level.
   - Redact merchant and account-level details when the question is shareable or when granular data is not needed.

## Internal Interfaces

The invention is concretized in the prototype interfaces implemented in the backend consensus module:

- `AgentClaim`
  - Agent output candidate with recommendation, rationale, safety bias, evidence, and missing-field state.
- `EvidenceAtom`
  - Smallest evidence unit used during arbitration, carrying source, field, sensitivity, recency, completeness contribution, and confidence.
- `ConsensusScore`
  - Weighted scoring record for one claim across evidence quality, completeness, recency, intent fit, and safety.
- `ExecutionGate`
  - Gate result that decides whether the engine is ready, needs more data, should expand scope, or must downgrade certainty.
- `DisclosurePolicy`
  - Output of the privacy-aware release layer describing allowed fields, redactions, and disclosure level.
- `FinalAdvicePacket`
  - Final internal packet with winning recommendation, suppressed alternatives, confidence band, filtered evidence bundle, disclosure level, and follow-up action.

## Primary Embodiment: Advice Arbitration

The primary embodiment resolves financial advice conflicts from multiple specialist agents.

### Example 1: Debt payoff vs increase SIP

- Debt agent recommends paying down EMI first.
- Investment agent recommends increasing SIP first.
- The consensus engine favors the debt-first action when debt ratio is elevated or reserve coverage is weak, even if the investment claim has high nominal confidence.

### Example 2: Goal contribution vs reserve protection

- Goal agent says a goal remains feasible.
- Risk agent warns that emergency reserve coverage is too thin.
- The engine keeps the goal recommendation but injects a conservative guardrail, producing a combined instruction such as:
  - continue the goal only after reducing overspending or rebuilding the emergency buffer.

### Example 3: Merchant alert vs shareable summary

- Expense agent uses merchant-level evidence internally.
- The user asks for a shareable planning summary.
- The engine preserves the advice but redacts merchant-level evidence and returns only category-level proof.

## Dependent Embodiment 1: Confidence-Gated Execution Graph

This embodiment determines whether enough evidence exists to answer the question at all.

Illustrative rules:

- If a passive-income prompt arrives without monthly income or monthly surplus, the engine requests more data and suggests expanding scope to risk and goal agents.
- If only one specialist has run for a cross-domain question, the engine suggests running additional agents before final arbitration.
- If claims are close but data completeness is weak, the engine downgrades certainty to a guarded confidence band rather than presenting a high-confidence answer.

## Dependent Embodiment 2: Privacy-Aware Consensus Layer

This embodiment adjusts disclosure granularity based on the user intent and sharing context.

Illustrative rules:

- Merchant troubleshooting: merchant-level evidence allowed
- Investment or goal planning: category-level evidence preferred
- Shareable plan or exported summary: merchant-level evidence redacted
- Default explanation: summary-level evidence when fine-grained data is unnecessary

The technical novelty is that privacy is decided after arbitration but before answer packaging, so the engine can use detailed evidence internally without always revealing that evidence externally.

## System Mapping to Current Product

The invention maps directly onto the current product architecture:

- Orchestrator already coordinates six specialist agents.
- Chat already synthesizes specialist outputs into a user-facing answer.
- Dashboard already consumes risk, goal, and health outputs.
- Investment planning, debt guidance, and risk detection already generate the conflict scenarios needed by the arbitration layer.

Current repo anchors:

- orchestration source: `backend/app/agents/orchestrator.py`
- chat synthesis source: `backend/app/services/copilot_service.py`
- dashboard insight source: `backend/app/services/dashboard_service.py`
- prototype consensus engine: `backend/app/consensus/engine.py`

## Why This Is Not a Generic Chatbot Patent

The inventive step is not merely "using AI to provide financial advice." The inventive step is the specific method by which:

- multiple specialist financial agents emit structured claims,
- those claims are scored with deterministic financial-safety weights,
- missing data changes the execution path before the answer is finalized,
- competing claims are either suppressed or merged,
- and the final evidence bundle is filtered according to disclosure rules.

That combination creates a defensible technical process around arbitration, certainty control, and disclosure minimization.

## Validation Scenarios Implemented in the Repo

The prototype implementation includes passing validations for:

1. debt-first arbitration when reserve coverage is weak,
2. passive-income gating when monthly cashflow inputs are missing,
3. shareable plan redaction from merchant-level to category-level evidence,
4. conservative guardrail merging between goal and risk claims,
5. winner changes when evidence recency and completeness change.

These are implemented in `backend/tests/test_consensus_engine.py`.

## Assumptions

- Filing target is India provisional first.
- This is one flagship claim family, not a multi-patent portfolio.
- Advice arbitration is the independent claim nucleus.
- Confidence-gated execution and privacy-aware evidence release are dependent embodiments.
- No formal prior-art search is included in this package.
