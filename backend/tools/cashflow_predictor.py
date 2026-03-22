import pandas as pd
import numpy as np
from typing import List


def cashflow_predictor(transactions: list, months_ahead: int = 6) -> dict:
    """Predict future cashflow using linear trend analysis"""
    if not transactions:
        return {
            'avg_monthly_spend': 0,
            'monthly_trend': 0,
            'projections': [],
            'risk': 'LOW',
        }

    df = pd.DataFrame(transactions)
    df['date'] = pd.to_datetime(df['date'], errors='coerce')
    df = df.dropna(subset=['date'])
    df['amount'] = df['amount'].astype(float)
    df['month'] = df['date'].dt.to_period('M')

    debits = df[df['type'] == 'debit']
    if debits.empty:
        debits = df

    monthly = debits.groupby('month')['amount'].sum()
    
    if len(monthly) < 2:
        avg_spend = float(monthly.mean()) if not monthly.empty else 0
        return {
            'avg_monthly_spend': round(avg_spend, 2),
            'monthly_trend': 0,
            'projections': [{'month': i + 1, 'projected_spend': round(avg_spend, 2)} for i in range(months_ahead)],
            'risk': 'LOW',
        }

    avg_spend = float(monthly.mean())
    x = np.arange(len(monthly))
    trend = float(np.polyfit(x, monthly.values, 1)[0])

    projections = []
    for i in range(months_ahead):
        projected = avg_spend + (trend * (len(monthly) + i))
        projections.append({'month': i + 1, 'projected_spend': round(max(0, projected), 2)})

    risk = 'HIGH' if trend > 500 else 'MEDIUM' if trend > 0 else 'LOW'

    # Category breakdown
    category_spend = {}
    if 'category' in df.columns:
        cat_group = debits.groupby('category')['amount'].sum()
        category_spend = {k: round(float(v), 2) for k, v in cat_group.items()}

    return {
        'avg_monthly_spend': round(avg_spend, 2),
        'monthly_trend': round(trend, 2),
        'projections': projections,
        'risk': risk,
        'category_breakdown': category_spend,
        'months_analyzed': len(monthly),
    }
