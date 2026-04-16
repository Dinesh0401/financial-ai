export type RecoInputs = {
  income: number;
  expenses: number;
  savings: number;
  debt: number;
  categoryTotals?: Record<string, number>;
};

export type Recommendation = {
  agent: "Expense" | "Debt" | "Risk" | "Goal" | "Investment";
  severity: "info" | "warn" | "risk";
  title: string;
  detail: string;
};

export function generateRecommendations(data: RecoInputs): Recommendation[] {
  const out: Recommendation[] = [];
  const income = Math.max(1, data.income);
  const savingsRatio = data.savings / income;
  const debtRatio = data.debt / income;
  const food = data.categoryTotals?.food_dining ?? 0;
  const shopping = data.categoryTotals?.shopping ?? 0;
  const entertainment = data.categoryTotals?.entertainment ?? 0;

  if (food > 0.4 * income) {
    out.push({
      agent: "Expense",
      severity: "warn",
      title: "Food spending is high",
      detail: `You're spending ~${Math.round((food / income) * 100)}% of income on food. Trimming it by 10% could free up ₹${Math.round(food * 0.1).toLocaleString("en-IN")}/month.`,
    });
  }
  if (shopping > 0.2 * income) {
    out.push({
      agent: "Expense",
      severity: "warn",
      title: "Shopping spend above healthy range",
      detail: "Cap discretionary shopping at 15% of income to redirect the surplus into savings.",
    });
  }
  if (entertainment > 0.1 * income) {
    out.push({
      agent: "Expense",
      severity: "info",
      title: "Entertainment budget leaking",
      detail: "Swap 2 paid subscriptions for a shared/annual plan to cut ~20% of this bucket.",
    });
  }

  if (savingsRatio < 0.2) {
    out.push({
      agent: "Risk",
      severity: "risk",
      title: "Low savings buffer",
      detail: `Savings rate is ${Math.round(savingsRatio * 100)}%. Target 20%+. Try an auto-sweep of ₹${Math.max(2000, Math.round(income * 0.05)).toLocaleString("en-IN")}/month into a liquid fund.`,
    });
  }

  if (debtRatio > 0.5) {
    out.push({
      agent: "Debt",
      severity: "risk",
      title: "High debt exposure",
      detail: "Debt repayments exceed 50% of income. Prioritise clearing the highest-interest loan first (avalanche method).",
    });
  } else if (debtRatio > 0.3) {
    out.push({
      agent: "Debt",
      severity: "warn",
      title: "Accelerate EMI payoff",
      detail: "Increase EMI by 10–15% on your top loan — a ₹2,000/mo bump can close the loan up to 2 years earlier.",
    });
  }

  if (savingsRatio >= 0.2 && debtRatio < 0.3) {
    out.push({
      agent: "Investment",
      severity: "info",
      title: "Start/raise SIP",
      detail: `Route ₹${Math.max(3000, Math.round(income * 0.1)).toLocaleString("en-IN")}/month into a diversified equity index SIP for long-term compounding.`,
    });
    out.push({
      agent: "Investment",
      severity: "info",
      title: "Diversify beyond equity",
      detail: "Allocate 10–15% to sovereign gold bonds or a gold ETF as an inflation hedge.",
    });
  }

  return out;
}
