from __future__ import annotations

import random
from dataclasses import dataclass
from decimal import Decimal


@dataclass(slots=True)
class GoalSimulationResult:
    monthly_required: Decimal
    success_probability: float
    percentile_10: Decimal
    percentile_50: Decimal
    percentile_90: Decimal
    iterations: int
    assumptions: dict[str, float]

    def to_dict(self) -> dict:
        return {
            "monthly_required": float(self.monthly_required),
            "success_probability": round(self.success_probability, 2),
            "percentile_10": float(self.percentile_10),
            "percentile_50": float(self.percentile_50),
            "percentile_90": float(self.percentile_90),
            "iterations": self.iterations,
            "assumptions": self.assumptions,
        }


def simulate_goal(
    *,
    target_amount: Decimal,
    current_amount: Decimal,
    timeline_months: int,
    monthly_saving: Decimal,
    annual_return_rate: float = 0.08,
    annual_inflation: float = 0.06,
    annual_volatility: float = 0.12,
    iterations: int = 2000,
) -> GoalSimulationResult:
    timeline_months = max(1, timeline_months)
    required = max(Decimal("0.00"), (target_amount - current_amount) / Decimal(timeline_months))
    monthly_return = annual_return_rate / 12
    monthly_inflation = annual_inflation / 12
    monthly_volatility = annual_volatility / (12**0.5)

    outcomes: list[Decimal] = []
    for _ in range(iterations):
        corpus = float(current_amount)
        for _month in range(timeline_months):
            random_return = random.gauss(monthly_return, monthly_volatility)
            corpus = max(0.0, corpus * (1 + random_return) + float(monthly_saving))
        real_value = corpus / ((1 + monthly_inflation) ** timeline_months)
        outcomes.append(Decimal(str(round(real_value, 2))))

    outcomes.sort()
    success_probability = (
        sum(1 for outcome in outcomes if outcome >= target_amount) / len(outcomes) * 100 if outcomes else 0.0
    )

    def percentile(index: float) -> Decimal:
        position = min(len(outcomes) - 1, max(0, int(index * (len(outcomes) - 1))))
        return outcomes[position] if outcomes else Decimal("0.00")

    return GoalSimulationResult(
        monthly_required=required.quantize(Decimal("0.01")),
        success_probability=success_probability,
        percentile_10=percentile(0.10),
        percentile_50=percentile(0.50),
        percentile_90=percentile(0.90),
        iterations=iterations,
        assumptions={
            "monthly_saving": float(monthly_saving),
            "return_rate": annual_return_rate,
            "inflation": annual_inflation,
            "volatility": annual_volatility,
        },
    )

