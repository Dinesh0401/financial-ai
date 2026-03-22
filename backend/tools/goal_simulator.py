import numpy as np


def goal_simulator(
    target: float,
    monthly_savings: float,
    years: float,
    current_amount: float = 0,
    annual_return: float = 0.12,
    simulations: int = 1000,
) -> dict:
    """Monte Carlo simulation for goal probability"""
    months = int(years * 12)
    r_monthly = annual_return / 12
    successes = 0
    final_values = []

    for _ in range(simulations):
        portfolio = float(current_amount)
        for m in range(months):
            monthly_r = np.random.normal(r_monthly, 0.04)
            portfolio = portfolio * (1 + monthly_r) + monthly_savings
        final_values.append(portfolio)
        if portfolio >= target:
            successes += 1

    final_arr = np.array(final_values)
    probability = round(successes / simulations * 100, 1)

    # Generate fan chart data (monthly snapshots)
    chart_data = []
    for m in range(0, months + 1, max(1, months // 24)):
        samples = []
        for _ in range(200):
            p = float(current_amount)
            for step in range(m):
                r = np.random.normal(r_monthly, 0.04)
                p = p * (1 + r) + monthly_savings
            samples.append(p)
        arr = np.array(samples)
        chart_data.append({
            'month': m,
            'p10': round(float(np.percentile(arr, 10)), 0),
            'p50': round(float(np.percentile(arr, 50)), 0),
            'p90': round(float(np.percentile(arr, 90)), 0),
        })

    return {
        'probability': probability,
        'median_outcome': round(float(np.median(final_arr)), 0),
        'p10_outcome': round(float(np.percentile(final_arr, 10)), 0),
        'p90_outcome': round(float(np.percentile(final_arr, 90)), 0),
        'shortfall_risk': round(max(0, target - float(np.median(final_arr))), 0),
        'chart_data': chart_data,
        'simulations': simulations,
    }


def what_if_simulation(
    target: float,
    monthly_savings: float,
    years: float,
    delta_savings: float = 0,
    delta_months: float = 0,
    current_amount: float = 0,
) -> dict:
    """What-if scenario: if we save more or extend timeline"""
    result = goal_simulator(
        target=target,
        monthly_savings=monthly_savings + delta_savings,
        years=years + (delta_months / 12),
        current_amount=current_amount,
    )
    return {'probability': result['probability'], 'median_outcome': result['median_outcome']}
