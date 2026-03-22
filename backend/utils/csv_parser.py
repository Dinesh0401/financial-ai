import pandas as pd
import io
from typing import List

BANK_FORMATS = {
    'hdfc': {'date': 'Date', 'amount': 'Withdrawal Amt.', 'desc': 'Narration', 'credit': 'Deposit Amt.'},
    'icici': {'date': 'Transaction Date', 'amount': 'Amount (INR)', 'desc': 'Transaction Remarks', 'credit': None},
    'sbi': {'date': 'Txn Date', 'amount': 'Debit', 'desc': 'Description', 'credit': 'Credit'},
    'axis': {'date': 'Tran Date', 'amount': 'Debit', 'desc': 'PARTICULARS', 'credit': 'Credit'},
    'phonepe': {'date': 'Date', 'amount': 'Debit', 'desc': 'Details', 'credit': 'Credit'},
    'gpay': {'date': 'Date', 'amount': 'Amount', 'desc': 'Description', 'credit': None},
}

BANK_SIGNATURES = {
    'hdfc': ['Withdrawal Amt.', 'Narration', 'Deposit Amt.'],
    'icici': ['Transaction Date', 'Transaction Remarks', 'Amount (INR)'],
    'sbi': ['Txn Date', 'Description', 'Debit'],
    'axis': ['Tran Date', 'PARTICULARS', 'Debit'],
    'phonepe': ['Details', 'Debit'],
    'gpay': ['Google Pay'],
}


def auto_detect_bank(columns: list) -> str:
    cols_str = ' '.join(columns)
    for bank, signatures in BANK_SIGNATURES.items():
        if all(sig in cols_str for sig in signatures):
            return bank
    return 'generic'


def auto_detect_skiprows(content: str) -> int:
    """Detect how many rows to skip before header"""
    lines = content.split('\n')[:20]
    for i, line in enumerate(lines):
        if ',' in line and len(line.split(',')) > 3:
            return i
    return 0


def parse_amount(val) -> float:
    if pd.isna(val) or val == '' or val is None:
        return 0.0
    s = str(val).replace(',', '').replace('₹', '').strip()
    try:
        return abs(float(s))
    except (ValueError, TypeError):
        return 0.0


def auto_map_columns(columns: list) -> dict:
    """Fallback: try to infer column mapping for unknown banks"""
    date_keys = ['date', 'txn date', 'transaction date', 'value date']
    amount_keys = ['debit', 'withdrawal', 'amount', 'amount (inr)']
    desc_keys = ['description', 'narration', 'particulars', 'details', 'remarks']

    cols_lower = {c.lower(): c for c in columns}
    result = {}
    for k in date_keys:
        if k in cols_lower:
            result['date'] = cols_lower[k]
            break
    for k in amount_keys:
        if k in cols_lower:
            result['amount'] = cols_lower[k]
            break
    for k in desc_keys:
        if k in cols_lower:
            result['desc'] = cols_lower[k]
            break
    result.setdefault('date', columns[0] if columns else 'Date')
    result.setdefault('amount', columns[1] if len(columns) > 1 else 'Amount')
    result.setdefault('desc', columns[2] if len(columns) > 2 else 'Description')
    return result


def parse_bank_csv(file_bytes: bytes) -> List[dict]:
    content = file_bytes.decode('utf-8', errors='ignore')
    skiprows = auto_detect_skiprows(content)
    try:
        df = pd.read_csv(io.StringIO(content), skiprows=skiprows)
    except Exception:
        df = pd.read_csv(io.StringIO(content))

    df.columns = df.columns.str.strip()
    bank = auto_detect_bank(df.columns.tolist())
    fmt = BANK_FORMATS.get(bank, auto_map_columns(df.columns.tolist()))

    result = []
    for _, row in df.iterrows():
        try:
            amount = parse_amount(row.get(fmt.get('amount', ''), 0))
            if amount <= 0:
                continue
            date_val = str(row.get(fmt.get('date', ''), '')).strip()
            desc = str(row.get(fmt.get('desc', ''), '')).strip()

            # Determine type
            credit_col = fmt.get('credit')
            credit_amount = parse_amount(row.get(credit_col, 0)) if credit_col else 0
            tx_type = 'credit' if credit_amount > 0 and amount == 0 else 'debit'
            actual_amount = credit_amount if tx_type == 'credit' else amount

            if actual_amount > 0:
                result.append({
                    'date': date_val,
                    'amount': actual_amount,
                    'description': desc,
                    'type': tx_type,
                    'source': f'csv_{bank}',
                })
        except Exception:
            continue

    return result
