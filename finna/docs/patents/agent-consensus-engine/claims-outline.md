# Claim Outline

## Independent Claim Theme

A computer-implemented method for generating a financial recommendation from multiple specialist financial agents, the method comprising:

1. receiving multiple structured recommendation claims from respective specialist agents,
2. receiving evidence atoms associated with the claims,
3. computing a consensus score for each claim based on:
   - evidence quality,
   - data completeness,
   - evidence recency,
   - user-intent fit, and
   - safety bias,
4. selecting a winning claim according to the consensus scores,
5. suppressing one or more alternative claims that do not win,
6. generating a final advice packet comprising:
   - a recommended action,
   - one or more suppressed alternatives,
   - a confidence band,
   - an evidence bundle,
   - a disclosure level, and
   - a follow-up action.

## Dependent Claim Themes

### Dependent Embodiment: Confidence-Gated Execution

- Before selecting the winning claim, determine whether required financial inputs are missing.
- If missing, trigger one or more of:
  - requesting additional financial fields,
  - running additional specialist agents,
  - downgrading the confidence band.

### Dependent Embodiment: Conservative Merge Rule

- When a goal-oriented claim wins and a risk-oriented claim is within a threshold distance of the winning score, merge a conservative guardrail from the risk-oriented claim into the final advice packet.

### Dependent Embodiment: Privacy-Aware Evidence Release

- Determine a disclosure policy from the user intent and sharing context.
- Filter the evidence bundle according to summary, category, or merchant-level disclosure.
- Redact merchant or account-level evidence while preserving the winning recommendation.

### Dependent Embodiment: Shareable Financial Summary

- For a shareable planning request, the final advice packet omits merchant-level evidence and instead returns category-level evidence with the same recommended action.

### Dependent Embodiment: Dynamic Winner Reversal

- Recompute consensus scores when new evidence changes recency or completeness.
- Permit a prior suppressed claim to become the winning claim on a subsequent run for the same user.

## Example Claim Anchors from the Product

- debt payoff vs SIP increase
- goal funding vs emergency reserve protection
- merchant-level risk alert vs shareable category-level summary
- passive-income planning with missing income or surplus inputs

## Drafting Notes

- Keep the independent claim focused on arbitration and final advice packet generation.
- Avoid centering the independent claim on generic LLM behavior.
- Use finance-specific agent roles and evidence packaging in the specification as embodiments, not as limitations unless strategically needed.
