import math


def calculate_sip(monthly_amount: float, annual_rate: float, years: int) -> dict:
    """SIP future value calculation"""
    r = annual_rate / 100 / 12
    n = years * 12
    if r == 0:
        fv = monthly_amount * n
    else:
        fv = monthly_amount * (((1 + r) ** n - 1) / r) * (1 + r)
    invested = monthly_amount * n
    returns = fv - invested
    return {
        'future_value': round(fv, 2),
        'total_invested': round(invested, 2),
        'total_returns': round(returns, 2),
        'return_pct': round((returns / invested * 100) if invested > 0 else 0, 1),
    }


def calculate_emi(principal: float, annual_rate: float, tenure_months: int) -> dict:
    """EMI calculation using reducing balance method"""
    r = annual_rate / 100 / 12
    if r == 0:
        emi = principal / tenure_months
    else:
        emi = principal * r * (1 + r) ** tenure_months / ((1 + r) ** tenure_months - 1)
    total_payment = emi * tenure_months
    total_interest = total_payment - principal
    return {
        'emi': round(emi, 2),
        'total_payment': round(total_payment, 2),
        'total_interest': round(total_interest, 2),
        'principal': round(principal, 2),
    }


def calculate_ppf(annual_amount: float, years: int = 15, rate: float = 7.1) -> dict:
    """PPF maturity calculation (Indian govt scheme)"""
    r = rate / 100
    fv = 0
    for yr in range(1, years + 1):
        fv = (fv + annual_amount) * (1 + r)
    invested = annual_amount * years
    return {
        'maturity_amount': round(fv, 2),
        'total_invested': round(invested, 2),
        'interest_earned': round(fv - invested, 2),
        'effective_rate': round(rate, 2),
        'lock_in_years': years,
        'tax_benefit': '80C — up to ₹1.5L/year',
    }


def calculate_nps(monthly_amount: float, years: int, expected_return: float = 10.0) -> dict:
    """NPS corpus and annuity estimation"""
    sip_result = calculate_sip(monthly_amount, expected_return, years)
    corpus = sip_result['future_value']
    annuity_corpus = corpus * 0.40  # 40% must be used for annuity
    lump_sum = corpus * 0.60        # 60% can be withdrawn tax-free
    monthly_pension = annuity_corpus * 0.065 / 12  # ~6.5% annuity rate

    return {
        'total_corpus': round(corpus, 2),
        'lump_sum_withdrawal': round(lump_sum, 2),
        'annuity_corpus': round(annuity_corpus, 2),
        'estimated_monthly_pension': round(monthly_pension, 2),
        'total_invested': sip_result['total_invested'],
        'tax_benefit': '80CCD(1B) — additional ₹50,000 over 80C',
    }


def calculate_cibil_impact(missed_emis: int, credit_utilization: float) -> dict:
    """Estimate CIBIL score impact"""
    base_score = 750
    if missed_emis > 0:
        base_score -= missed_emis * 80
    if credit_utilization > 0.30:
        base_score -= int((credit_utilization - 0.30) * 200)
    score = max(300, min(900, base_score))
    category = 'Excellent' if score >= 750 else 'Good' if score >= 700 else 'Fair' if score >= 650 else 'Poor'
    return {
        'estimated_score': score,
        'category': category,
        'loan_eligibility': 'High' if score >= 750 else 'Medium' if score >= 700 else 'Low',
    }


def recommended_sip_allocation(income: float, expenses: float, loans: list, risk_tolerance: str) -> dict:
    """Suggest SIP allocation based on surplus and risk profile"""
    total_emi = sum(float(l.get('monthly_emi', 0) or 0) for l in loans)
    surplus = income - expenses - total_emi
    investable = max(0, surplus * 0.80)  # Keep 20% as liquid

    if risk_tolerance == 'aggressive':
        allocation = {
            'Large Cap Equity': round(investable * 0.30, 0),
            'Mid Cap Equity': round(investable * 0.25, 0),
            'Small Cap Equity': round(investable * 0.20, 0),
            'International Fund': round(investable * 0.15, 0),
            'Debt Fund': round(investable * 0.10, 0),
        }
    elif risk_tolerance == 'conservative':
        allocation = {
            'Large Cap Equity': round(investable * 0.20, 0),
            'Balanced Advantage': round(investable * 0.20, 0),
            'Debt Fund': round(investable * 0.35, 0),
            'PPF': round(investable * 0.15, 0),
            'Liquid Fund': round(investable * 0.10, 0),
        }
    else:  # moderate
        allocation = {
            'Large Cap Equity': round(investable * 0.30, 0),
            'Mid Cap Equity': round(investable * 0.15, 0),
            'Balanced Advantage': round(investable * 0.20, 0),
            'Debt Fund': round(investable * 0.25, 0),
            'PPF': round(investable * 0.10, 0),
        }

    return {
        'total_investable': round(investable, 0),
        'allocation': allocation,
        'emergency_reserve': round(surplus * 0.20, 0),
        'risk_profile': risk_tolerance,
    }
