def calculate_health_score(income: float, expenses: float, loans: list, savings: float, goals: list) -> dict:
    score = 0.0
    breakdown = {}

    # 1. Savings rate (25 pts max)
    surplus = income - expenses
    savings_rate = surplus / income if income > 0 else 0
    s_pts = min(25, max(0, savings_rate * 100))
    score += s_pts
    breakdown['savings_rate'] = {'score': round(s_pts, 1), 'max': 25, 'value': round(savings_rate * 100, 1)}

    # 2. Debt-to-income ratio (25 pts max)
    total_emi = sum(float(l.get('monthly_emi', 0) or 0) for l in loans)
    dti = total_emi / income if income > 0 else 1
    d_pts = max(0, 25 - (dti * 62.5))
    score += d_pts
    breakdown['debt_ratio'] = {'score': round(d_pts, 1), 'max': 25, 'value': round(dti * 100, 1)}

    # 3. Emergency fund (20 pts max) — 6 months = full score
    em_months = savings / expenses if expenses > 0 else 0
    e_pts = min(20, em_months * 20 / 6)
    score += e_pts
    breakdown['emergency_fund'] = {'score': round(e_pts, 1), 'max': 20, 'value': round(em_months, 1)}

    # 4. Goal readiness (15 pts max) — 60%+ probability = on track
    on_track = sum(1 for g in goals if float(g.get('probability', 0) or 0) >= 60)
    g_pts = (on_track / max(len(goals), 1)) * 15 if goals else 7.5
    score += g_pts
    breakdown['goal_readiness'] = {'score': round(g_pts, 1), 'max': 15, 'value': on_track}

    # 5. Expense efficiency (15 pts max)
    exp_ratio = expenses / income if income > 0 else 1
    x_pts = max(0, 15 - (exp_ratio - 0.5) * 30)
    score += x_pts
    breakdown['expense_efficiency'] = {'score': round(x_pts, 1), 'max': 15, 'value': round(exp_ratio * 100, 1)}

    total = round(min(score, 100), 1)
    grade = 'A' if total >= 80 else 'B' if total >= 60 else 'C' if total >= 40 else 'D'
    label = 'Excellent' if total >= 80 else 'Good' if total >= 60 else 'Needs Work' if total >= 40 else 'Critical'

    return {
        'total': total,
        'grade': grade,
        'label': label,
        'breakdown': breakdown,
        'surplus': round(surplus, 2),
        'total_emi': round(total_emi, 2),
    }
