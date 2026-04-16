export type GoalInputs = {
  goalAmount: number;
  currentAmount?: number;
  monthlySavings: number;
  months: number;
};

export function goalProbability({ goalAmount, currentAmount = 0, monthlySavings, months }: GoalInputs): number {
  if (goalAmount <= 0 || months <= 0) return 0;
  const projected = currentAmount + monthlySavings * months;
  const ratio = projected / goalAmount;
  if (ratio >= 1.1) return 90;
  if (ratio >= 1) return 80;
  if (ratio >= 0.85) return 65;
  if (ratio >= 0.6) return 45;
  if (ratio >= 0.4) return 30;
  return 15;
}
