from app.tools.investment_planner import build_investment_blueprint


def test_passive_income_plan_avoids_mtf_as_core() -> None:
    blueprint = build_investment_blueprint(
        monthly_income=120000,
        monthly_surplus=30000,
        emergency_fund_months=8,
        debt_ratio=0.10,
        savings_rate=0.25,
        passive_income_intent=True,
    )

    assert blueprint.stage == "income_roadmap"
    assert any("MTF" in rule for rule in blueprint.guardrails)
    assert any("Broad-market index mutual fund or ETF" == item.instrument for item in blueprint.allocations)


def test_foundation_plan_prioritizes_liquidity_when_reserve_is_weak() -> None:
    blueprint = build_investment_blueprint(
        monthly_income=80000,
        monthly_surplus=12000,
        emergency_fund_months=1.5,
        debt_ratio=0.18,
        savings_rate=0.10,
        passive_income_intent=False,
    )

    assert blueprint.stage == "foundation"
    assert blueprint.allocations[0].instrument == "Liquid fund / sweep FD"
    assert blueprint.allocations[0].weight_pct == 60


def test_insufficient_data_plan_blocks_speculative_shortcuts() -> None:
    blueprint = build_investment_blueprint(
        monthly_income=0,
        monthly_surplus=0,
        emergency_fund_months=0,
        debt_ratio=0,
        savings_rate=0,
        passive_income_intent=True,
    )

    assert blueprint.stage == "insufficient_data"
    assert blueprint.allocations == []
    assert any("IPOs" in rule for rule in blueprint.guardrails)
