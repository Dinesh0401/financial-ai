import anthropic
from config import settings

CATEGORY_MAP = {
    # Food Delivery
    'swiggy': 'Food Delivery', 'zomato': 'Food Delivery', 'dunzo': 'Food Delivery', 'blinkit': 'Groceries',
    # Transport
    'uber': 'Transport', 'ola': 'Transport', 'rapido': 'Transport', 'metro card': 'Transport',
    # Streaming/Subscriptions
    'netflix': 'Subscription', 'spotify': 'Subscription', 'hotstar': 'Subscription',
    'prime video': 'Subscription', 'apple music': 'Subscription', 'youtube premium': 'Subscription',
    # Shopping
    'amazon': 'Shopping', 'flipkart': 'Shopping', 'myntra': 'Shopping', 'meesho': 'Shopping',
    'nykaa': 'Shopping', 'ajio': 'Shopping',
    # EMI/Loans
    'hdfc emi': 'EMI', 'icici emi': 'EMI', 'sbi emi': 'EMI', 'axis emi': 'EMI',
    'emi': 'EMI', 'loan': 'EMI', 'repayment': 'EMI',
    # Groceries
    'bigbasket': 'Groceries', 'zepto': 'Groceries', 'dmart': 'Groceries', 'reliance fresh': 'Groceries',
    'more supermarket': 'Groceries', 'nature basket': 'Groceries',
    # Housing/Utilities
    'rent': 'Housing', 'electricity': 'Utilities', 'airtel': 'Utilities', 'jio': 'Utilities',
    'bsnl': 'Utilities', 'water bill': 'Utilities', 'gas': 'Utilities', 'maintenance': 'Housing',
    # Health
    'gym': 'Health', 'pharmacy': 'Health', 'hospital': 'Health', 'medical': 'Health',
    'apollo': 'Health', 'practo': 'Health', '1mg': 'Health', 'netmeds': 'Health',
    # Fuel
    'petrol': 'Fuel', 'hp pump': 'Fuel', 'fuel': 'Fuel', 'indian oil': 'Fuel', 'bharat petroleum': 'Fuel',
    # Dining
    'restaurant': 'Dining', 'cafe': 'Dining', 'starbucks': 'Dining', 'mcdonalds': 'Dining',
    'dominos': 'Dining', 'pizza': 'Dining', 'kfc': 'Dining',
    # Investments
    'zerodha': 'Investment', 'groww': 'Investment', 'kuvera': 'Investment', 'sip': 'Investment',
    'mutual fund': 'Investment', 'nps': 'Investment', 'ppf': 'Investment',
    # Insurance
    'insurance': 'Insurance', 'lic': 'Insurance', 'term plan': 'Insurance',
    # Education
    'school fee': 'Education', 'college fee': 'Education', 'udemy': 'Education',
    'coursera': 'Education', 'byju': 'Education', 'unacademy': 'Education',
    # Entertainment
    'bookmyshow': 'Entertainment', 'pvr': 'Entertainment', 'inox': 'Entertainment',
    # Travel
    'irctc': 'Travel', 'makemytrip': 'Travel', 'goibibo': 'Travel', 'yatra': 'Travel',
    'cleartrip': 'Travel', 'airline': 'Travel', 'hotel': 'Travel',
}


def expense_classifier(description: str, amount: float) -> dict:
    """Classify a transaction using keyword matching with LLM fallback"""
    desc_lower = description.lower()
    
    # Keyword match
    for keyword, category in CATEGORY_MAP.items():
        if keyword in desc_lower:
            return {
                'category': category,
                'confidence': 0.95,
                'method': 'keyword',
            }
    
    # LLM fallback
    if settings.ANTHROPIC_API_KEY:
        try:
            return classify_with_llm(description, amount)
        except Exception:
            pass
    
    return {'category': 'Other', 'confidence': 0.5, 'method': 'fallback'}


def classify_with_llm(description: str, amount: float) -> dict:
    """Use Claude API to classify unknown merchants"""
    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    
    categories = ['Food Delivery', 'Transport', 'Subscription', 'Shopping', 'EMI', 
                  'Groceries', 'Housing', 'Utilities', 'Health', 'Fuel', 'Dining',
                  'Investment', 'Insurance', 'Education', 'Entertainment', 'Travel',
                  'Salary', 'Transfer', 'Other']
    
    message = client.messages.create(
        model="claude-3-haiku-20240307",
        max_tokens=50,
        messages=[{
            "role": "user",
            "content": f"Classify this Indian bank transaction into exactly one category.\n"
                       f"Transaction: '{description}', Amount: ₹{amount}\n"
                       f"Categories: {', '.join(categories)}\n"
                       f"Reply with ONLY the category name, nothing else."
        }]
    )
    
    category = message.content[0].text.strip()
    if category not in categories:
        category = 'Other'
    
    return {'category': category, 'confidence': 0.85, 'method': 'llm'}


def classify_batch(transactions: list) -> list:
    """Classify a list of transactions"""
    return [
        {**tx, **expense_classifier(tx.get('description', ''), tx.get('amount', 0))}
        for tx in transactions
    ]
