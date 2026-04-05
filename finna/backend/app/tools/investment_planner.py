from __future__ import annotations

from dataclasses import asdict, dataclass


@dataclass(slots=True)
class AllocationSlice:
    instrument: str
    weight_pct: int
    purpose: str


@dataclass(slots=True)
class InvestmentBlueprint:
    stage: str
    investable_amount: float
    monthly_income: float
    monthly_surplus: float
    allocations: list[AllocationSlice]
    guardrails: list[str]

    def to_dict(self) -> dict:
        return {
            "stage": self.stage,
            "investable_amount": self.investable_amount,
            "monthly_income": self.monthly_income,
            "monthly_surplus": self.monthly_surplus,
            "allocations": [asdict(item) for item in self.allocations],
            "guardrails": self.guardrails,
        }


def build_investment_blueprint(
    *,
    monthly_income: float,
    monthly_surplus: float,
    emergency_fund_months: float,
    debt_ratio: float,
    savings_rate: float,
    passive_income_intent: bool,
) -> InvestmentBlueprint:
    investable_amount = max(0.0, monthly_surplus)

    if monthly_income <= 0 and investable_amount <= 0:
        return InvestmentBlueprint(
            stage="insufficient_data",
            investable_amount=0.0,
            monthly_income=monthly_income,
            monthly_surplus=monthly_surplus,
            allocations=[],
            guardrails=[
                "Add monthly income and recent transactions before relying on investment recommendations.",
                "Do not use IPOs, MTF, or direct stock tips as a substitute for a real asset-allocation plan.",
            ],
        )

    if debt_ratio > 0.30 or emergency_fund_months < 3:
        return InvestmentBlueprint(
            stage="foundation",
            investable_amount=investable_amount,
            monthly_income=monthly_income,
            monthly_surplus=monthly_surplus,
            allocations=[
                AllocationSlice("Liquid fund / sweep FD", 60, "Build emergency liquidity first."),
                AllocationSlice("Short-duration debt fund or target-maturity debt ETF", 25, "Stabilize capital with lower volatility."),
                AllocationSlice("Broad-market index mutual fund or ETF", 15, "Keep a small equity engine running without overcommitting."),
            ],
            guardrails=[
                "MTF is leveraged and should be 0% in a passive-income plan.",
                "IPO applications should not be a monthly wealth engine while the foundation is weak.",
                "Direct stocks should wait until emergency cover reaches at least 6 months and debt pressure falls.",
            ],
        )

    if emergency_fund_months < 6:
        return InvestmentBlueprint(
            stage="stabilization",
            investable_amount=investable_amount,
            monthly_income=monthly_income,
            monthly_surplus=monthly_surplus,
            allocations=[
                AllocationSlice("Broad-market index mutual fund or ETF", 45, "Core compounding bucket."),
                AllocationSlice("Short-duration debt fund / debt ETF", 35, "Complete the resilience layer."),
                AllocationSlice("Gold ETF or sovereign gold allocation", 10, "Diversifier, not a primary engine."),
                AllocationSlice("Flexicap mutual fund", 10, "Optional growth satellite."),
            ],
            guardrails=[
                "Keep MTF at 0%; leverage is not passive income.",
                "Keep IPO exposure small and opportunistic, not part of the base SIP plan.",
            ],
        )

    if passive_income_intent:
        return InvestmentBlueprint(
            stage="income_roadmap",
            investable_amount=investable_amount,
            monthly_income=monthly_income,
            monthly_surplus=monthly_surplus,
            allocations=[
                AllocationSlice("Broad-market index mutual fund or ETF", 40, "Long-term compounding that builds the passive-income corpus."),
                AllocationSlice("Target-maturity debt ETF / high-quality debt fund", 25, "Income stability and drawdown control."),
                AllocationSlice("Short-duration debt or liquid fund", 15, "Near-term cash-flow buffer."),
                AllocationSlice("REIT / InvIT or income-oriented real-asset bucket", 10, "Optional later-stage cash-yield sleeve."),
                AllocationSlice("Direct stocks or thematic ideas", 10, "Satellite only if the user understands stock risk."),
            ],
            guardrails=[
                "Use direct stocks as a capped satellite bucket, not the core passive-income engine.",
                "IPOs should stay below 5% of annual investable capital and only after the core plan is funded.",
                "MTF should remain 0%; leverage is incompatible with passive-income planning.",
            ],
        )

    if savings_rate >= 0.20:
        return InvestmentBlueprint(
            stage="accumulation",
            investable_amount=investable_amount,
            monthly_income=monthly_income,
            monthly_surplus=monthly_surplus,
            allocations=[
                AllocationSlice("Broad-market index mutual fund or ETF", 55, "Core wealth-compounding bucket."),
                AllocationSlice("Flexicap or large-midcap mutual fund", 20, "Diversified growth satellite."),
                AllocationSlice("Target-maturity debt ETF / debt fund", 15, "Stability and rebalancing bucket."),
                AllocationSlice("Gold ETF", 10, "Diversifier against macro shocks."),
            ],
            guardrails=[
                "Keep IPO and MTF outside the base SIP plan.",
                "If choosing direct stocks, cap them to a small experimental sleeve.",
            ],
        )

    return InvestmentBlueprint(
        stage="starter",
        investable_amount=investable_amount,
        monthly_income=monthly_income,
        monthly_surplus=monthly_surplus,
        allocations=[
            AllocationSlice("Broad-market index mutual fund or ETF", 50, "Best default core for a beginner."),
            AllocationSlice("Short-duration debt fund", 30, "Reduces volatility while the corpus is small."),
            AllocationSlice("Gold ETF", 10, "Diversifier."),
            AllocationSlice("Flexicap mutual fund", 10, "Optional growth satellite."),
        ],
        guardrails=[
            "Start with diversified funds and ETFs before moving to direct stocks.",
            "Treat IPO and MTF as non-core, high-risk activities rather than passive-income tools.",
        ],
    )
