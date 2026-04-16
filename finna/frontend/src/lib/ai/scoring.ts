export type ScoreInputs = {
  income: number;
  expenses: number;
  savings: number;
  debt: number;
};

export function calculateHealthScore({ income, expenses, savings, debt }: ScoreInputs): number {
  if (income <= 0) return 0;
  const savingsRatio = Math.max(0, Math.min(1, savings / income));
  const debtRatio = Math.max(0, Math.min(1, debt / income));
  const expenseControl = Math.max(0, Math.min(1, 1 - expenses / income));
  const raw = savingsRatio * 40 + (1 - debtRatio) * 30 + expenseControl * 30;
  return Math.round(raw);
}

export function scoreBand(score: number): { label: string; tone: "emerald" | "amber" | "red" } {
  if (score >= 75) return { label: "Strong", tone: "emerald" };
  if (score >= 50) return { label: "Improving", tone: "amber" };
  return { label: "At risk", tone: "red" };
}
