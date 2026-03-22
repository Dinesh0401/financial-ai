def risk_analyzer(income: float, expenses_total: float, loans: list, savings: float) -> dict:
    """Rule-based financial risk scoring"""
    total_emi = sum(float(l.get('monthly_emi', 0) or 0) for l in loans)
    dti = total_emi / income if income > 0 else 1
    eti = expenses_total / income if income > 0 else 1
    emergency_months = savings / expenses_total if expenses_total > 0 else 0

    flags = []
    
    # Debt-to-Income
    if dti > 0.50:
        flags.append({
            'code': 'CRITICAL_DTI',
            'severity': 'CRITICAL',
            'title': 'Extreme Debt Burden',
            'msg': f'EMI is {dti*100:.0f}% of income — severely limits financial freedom',
            'action': 'Immediately call your lender to restructure loans',
        })
    elif dti > 0.40:
        flags.append({
            'code': 'HIGH_DTI',
            'severity': 'HIGH',
            'title': 'High Debt-to-Income',
            'msg': f'EMI consumes {dti*100:.0f}% of income — RBI recommends below 40%',
            'action': 'Use Avalanche method to reduce debt urgently',
        })

    # Expense trap
    if eti > 0.95:
        flags.append({
            'code': 'EXPENSE_TRAP',
            'severity': 'CRITICAL',
            'title': 'Expense Trap',
            'msg': f'{eti*100:.0f}% of income is spent — leaving almost nothing for savings',
            'action': 'Cut discretionary spending immediately, focus on 50/30/20 rule',
        })
    elif eti > 0.85:
        flags.append({
            'code': 'HIGH_EXPENSES',
            'severity': 'HIGH',
            'title': 'Over-Spending',
            'msg': f'{eti*100:.0f}% of income spent — below 80% recommended',
            'action': 'Identify and cut top 3 expense categories',
        })

    # Emergency fund
    if emergency_months < 1:
        flags.append({
            'code': 'NO_EMERGENCY',
            'severity': 'CRITICAL',
            'title': 'No Emergency Fund',
            'msg': 'Less than 1 month of expenses saved — one crisis can cascade to debt',
            'action': 'Build ₹10,000 emergency starter fund before any investment',
        })
    elif emergency_months < 3:
        flags.append({
            'code': 'LOW_EMERGENCY',
            'severity': 'HIGH',
            'title': 'Insufficient Emergency Fund',
            'msg': f'Only {emergency_months:.1f} months of emergency cover — need 3-6 months',
            'action': 'Set aside 10% of surplus monthly until you reach 3 months of expenses',
        })

    # Savings insufficient
    savings_rate = (income - expenses_total) / income if income > 0 else 0
    if savings_rate < 0:
        flags.append({
            'code': 'NEGATIVE_SAVINGS',
            'severity': 'CRITICAL',
            'title': 'Spending More Than Earning',
            'msg': 'Monthly deficit detected — you are running into debt each month',
            'action': 'Immediate budget intervention required',
        })
    elif savings_rate < 0.10:
        flags.append({
            'code': 'LOW_SAVINGS',
            'severity': 'MEDIUM',
            'title': 'Low Savings Rate',
            'msg': f'Saving only {savings_rate*100:.0f}% of income — target 20%+',
            'action': 'Automate a SIP before the salary hits your account',
        })

    severity_order = {'CRITICAL': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1}
    overall_severity = 'LOW'
    if any(f['severity'] == 'CRITICAL' for f in flags):
        overall_severity = 'CRITICAL'
    elif any(f['severity'] == 'HIGH' for f in flags):
        overall_severity = 'HIGH'
    elif any(f['severity'] == 'MEDIUM' for f in flags):
        overall_severity = 'MEDIUM'

    return {
        'flags': flags,
        'severity': overall_severity,
        'flag_count': len(flags),
        'debt_to_income': round(dti * 100, 1),
        'expense_to_income': round(eti * 100, 1),
        'emergency_months': round(emergency_months, 1),
        'savings_rate': round(savings_rate * 100, 1),
    }
