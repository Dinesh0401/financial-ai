# Financial Agent Consensus Engine

This folder contains the flagship invention package for the platform's financial agent consensus engine.

## Contents

- `disclosure.md`
  - Full invention disclosure for an India-first provisional filing.
- `claims-outline.md`
  - Claim-friendly framing of the independent and dependent embodiments.
- `diagrams/`
  - Claim-ready Mermaid diagrams for the main flows.

## Repo Anchors

- Current product orchestration: [orchestrator.py](../../../backend/app/agents/orchestrator.py)
- Current chat synthesis path: [copilot_service.py](../../../backend/app/services/copilot_service.py)
- Current dashboard insight path: [dashboard_service.py](../../../backend/app/services/dashboard_service.py)
- Prototype consensus interfaces and engine: [engine.py](../../../backend/app/consensus/engine.py)
- Prototype validation scenarios: [test_consensus_engine.py](../../../backend/tests/test_consensus_engine.py)

## Invention Theme

The invention is not "an AI chatbot that gives financial advice." The invention is the deterministic method by which multiple financial specialist agents:

1. decide whether enough data exists to answer,
2. score competing recommendations,
3. arbitrate to one winning action with suppressed alternatives,
4. downgrade certainty when the evidence is incomplete, and
5. release only the minimum evidence required for the answer.

## Filing Posture

- Filing target: India provisional first
- Claim nucleus: advice arbitration
- Dependent embodiments:
  - confidence-gated execution
  - privacy-aware evidence release
- Prior-art search: deferred to a later drafting phase
