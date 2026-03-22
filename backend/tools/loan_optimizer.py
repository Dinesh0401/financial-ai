import numpy as np
import math


def loan_optimizer(loans: list, extra_monthly: float = 0) -> dict:
    """Avalanche method: attack highest interest rate loan first"""
    if not loans:
        return {'strategy': [], 'total_interest': 0, 'method': 'Avalanche (Highest Interest First)'}

    loans_copy = [dict(l) for l in loans]
    for l in loans_copy:
        l['outstanding'] = float(l.get('outstanding', 0) or 0)
        l['annual_rate'] = float(l.get('annual_rate', 0) or 0)
        l['monthly_emi'] = float(l.get('monthly_emi', 0) or 1)

    sorted_loans = sorted(loans_copy, key=lambda x: x['annual_rate'], reverse=True)
    total_interest = 0
    strategy = []

    for i, loan in enumerate(sorted_loans):
        r = loan['annual_rate'] / 100 / 12
        emi = loan['monthly_emi']
        outstanding = loan['outstanding']

        if emi > 0 and outstanding > 0 and r > 0 and emi > r * outstanding:
            try:
                n = -math.log(1 - r * outstanding / emi) / math.log(1 + r)
            except (ValueError, ZeroDivisionError):
                n = outstanding / emi if emi > 0 else 360
        else:
            n = outstanding / max(emi, 1)

        interest = max(0, emi * n - outstanding)
        total_interest += interest

        # Extra payment reduces tenure on highest-priority loan
        accelerated_emi = emi + (extra_monthly if i == 0 else 0)
        if accelerated_emi > emi and r > 0 and accelerated_emi > r * outstanding:
            try:
                accelerated_n = -math.log(1 - r * outstanding / accelerated_emi) / math.log(1 + r)
                months_saved = n - accelerated_n
                interest_saved = interest - max(0, accelerated_emi * accelerated_n - outstanding)
            except (ValueError, ZeroDivisionError):
                months_saved = 0
                interest_saved = 0
        else:
            months_saved = 0
            interest_saved = 0

        strategy.append({
            'loan': loan.get('loan_type', f'Loan {i+1}'),
            'outstanding': loan['outstanding'],
            'rate': loan['annual_rate'],
            'monthly_emi': emi,
            'priority': i + 1,
            'action': 'ATTACK FIRST' if i == 0 else 'MINIMUM EMI',
            'estimated_months': round(n, 0),
            'total_interest': round(interest, 0),
            'months_saved': round(months_saved, 0),
            'interest_saved': round(interest_saved, 0),
        })

    return {
        'strategy': strategy,
        'total_interest': round(total_interest, 0),
        'method': 'Avalanche (Highest Interest First)',
        'extra_monthly': extra_monthly,
    }


def snowball_optimizer(loans: list) -> dict:
    """Snowball method: attack smallest balance first (for psychological wins)"""
    loans_copy = [dict(l) for l in loans]
    for l in loans_copy:
        l['outstanding'] = float(l.get('outstanding', 0) or 0)
    sorted_loans = sorted(loans_copy, key=lambda x: x['outstanding'])
    strategy = []
    for i, loan in enumerate(sorted_loans):
        strategy.append({
            'loan': loan.get('loan_type', f'Loan {i+1}'),
            'outstanding': loan['outstanding'],
            'priority': i + 1,
            'action': 'PAY OFF FIRST' if i == 0 else 'MINIMUM',
            'why': 'Smallest balance — quickest psychological win',
        })
    return {'strategy': strategy, 'method': 'Snowball (Smallest Balance First)'}
