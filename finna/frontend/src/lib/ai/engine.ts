"use client";

export type OnboardingLoan = {
  type: string;
  name?: string;
  balance: number;
  emi: number;
  interest: number;
};

export type OnboardingGoal = {
  type: string;
  name?: string;
  targetAmount: number;
  years: number;
  priority?: "high" | "medium" | "low";
};

export type OnboardingSnapshot = {
  income: number;
  expenses: Record<string, number>;
  loans: OnboardingLoan[];
  goals: OnboardingGoal[];
  savedAt: string;
};

const STORAGE_KEY = "finna_onboarding_snapshot";

export function saveOnboardingSnapshot(data: Omit<OnboardingSnapshot, "savedAt">): void {
  if (typeof window === "undefined") return;
  const payload: OnboardingSnapshot = { ...data, savedAt: new Date().toISOString() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function loadOnboardingSnapshot(): OnboardingSnapshot | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as OnboardingSnapshot;
  } catch {
    return null;
  }
}

export function clearOnboardingSnapshot(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

export function totalExpenses(expenses: Record<string, number>): number {
  return Object.values(expenses || {}).reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
}

export function totalDebt(loans: OnboardingLoan[]): number {
  return (loans || []).reduce((a, l) => a + (Number.isFinite(l.balance) ? l.balance : 0), 0);
}

export function totalEmi(loans: OnboardingLoan[]): number {
  return (loans || []).reduce((a, l) => a + (Number.isFinite(l.emi) ? l.emi : 0), 0);
}

export function calculateHealthScore(data: OnboardingSnapshot): number {
  const income = Math.max(1, data.income);
  const expenses = totalExpenses(data.expenses);
  const debt = totalDebt(data.loans);
  const emi = totalEmi(data.loans);
  const savings = Math.max(0, income - expenses - emi);

  const savingsRatio = Math.max(0, Math.min(1, savings / income));
  const debtServiceRatio = Math.max(0, Math.min(1, emi / income));
  const expenseControl = Math.max(0, Math.min(1, 1 - expenses / income));
  const debtLoadRatio = Math.max(0, Math.min(1, debt / (income * 12)));

  const score =
    savingsRatio * 40 +
    (1 - debtServiceRatio) * 20 +
    expenseControl * 25 +
    (1 - debtLoadRatio) * 15;

  return Math.max(0, Math.min(100, Math.round(score)));
}

export type Recommendation = {
  agent: "Expense" | "Debt" | "Risk" | "Goal" | "Investment";
  severity: "info" | "warn" | "risk";
  title: string;
  detail: string;
};

export function generateRecommendations(data: OnboardingSnapshot): Recommendation[] {
  const rec: Recommendation[] = [];
  const income = Math.max(1, data.income);
  const e = data.expenses || {};
  const expenses = totalExpenses(e);
  const debt = totalDebt(data.loans);
  const emi = totalEmi(data.loans);
  const savings = income - expenses - emi;
  const savingsRatio = savings / income;

  const food = e.food_dining ?? e.food ?? 0;
  const rent = e.rent_housing ?? e.rent ?? 0;
  const shopping = e.shopping ?? 0;
  const entertainment = e.entertainment ?? 0;

  if (food > 0.4 * income) {
    rec.push({
      agent: "Expense",
      severity: "warn",
      title: "Food spending is high",
      detail: `Food is ${Math.round((food / income) * 100)}% of income. Trimming 10% frees ₹${Math.round(food * 0.1).toLocaleString("en-IN")}/month.`,
    });
  }
  if (rent > 0.35 * income) {
    rec.push({
      agent: "Expense",
      severity: "warn",
      title: "High rent burden",
      detail: `Rent is ${Math.round((rent / income) * 100)}% of income. Target ≤30% — consider a lower-rent location at renewal.`,
    });
  }
  if (shopping > 0.2 * income) {
    rec.push({
      agent: "Expense",
      severity: "info",
      title: "Shopping is eating savings",
      detail: "Cap discretionary shopping at 15% of income; redirect the surplus into an auto-SIP.",
    });
  }
  if (entertainment > 0.1 * income) {
    rec.push({
      agent: "Expense",
      severity: "info",
      title: "Subscription/entertainment leak",
      detail: "Consolidate streaming to 1–2 services and switch to annual plans to cut ~20%.",
    });
  }

  if (savingsRatio < 0.2) {
    rec.push({
      agent: "Risk",
      severity: "risk",
      title: "Low savings buffer",
      detail: `Savings rate is ${Math.round(savingsRatio * 100)}%. Target 20%+. Auto-sweep ₹${Math.max(2000, Math.round(income * 0.05)).toLocaleString("en-IN")}/month into a liquid fund.`,
    });
  }

  if (debt > income * 6) {
    rec.push({
      agent: "Debt",
      severity: "risk",
      title: "High debt exposure",
      detail: `Total debt is ${Math.round(debt / income)}× monthly income. Prioritise the highest-interest loan (avalanche method).`,
    });
  }
  if (emi > 0.5 * income) {
    rec.push({
      agent: "Debt",
      severity: "risk",
      title: "EMI overload",
      detail: "Monthly EMIs exceed 50% of income. Pause new credit, refinance top-rate loan, and negotiate tenure.",
    });
  } else if (emi > 0.3 * income) {
    rec.push({
      agent: "Debt",
      severity: "warn",
      title: "Accelerate EMI payoff",
      detail: "Bump your top-rate EMI by 10–15%. A ₹2,000/mo boost can close the loan up to 2 years sooner.",
    });
  }

  if (savingsRatio >= 0.2 && emi < 0.3 * income) {
    rec.push({
      agent: "Investment",
      severity: "info",
      title: "Start or raise SIP",
      detail: `Route ₹${Math.max(3000, Math.round(income * 0.1)).toLocaleString("en-IN")}/month into a diversified equity index SIP for long-term compounding.`,
    });
    rec.push({
      agent: "Investment",
      severity: "info",
      title: "Diversify beyond equity",
      detail: "Allocate 10–15% to sovereign gold bonds / gold ETFs as an inflation hedge.",
    });
  }

  if (rec.length === 0) {
    rec.push({
      agent: "Investment",
      severity: "info",
      title: "You're on track — compound it",
      detail: "Nothing urgent. Automate a monthly SIP and review quarterly to stay ahead of inflation.",
    });
  }
  return rec;
}

export function calculateGoalProbability(
  goal: OnboardingGoal,
  monthlySavings: number,
): number {
  if (goal.targetAmount <= 0 || goal.years <= 0) return 0;
  const projected = Math.max(0, monthlySavings) * goal.years * 12;
  const ratio = projected / goal.targetAmount;
  if (ratio >= 1.1) return 90;
  if (ratio >= 1) return 80;
  if (ratio >= 0.85) return 65;
  if (ratio >= 0.7) return 55;
  if (ratio >= 0.5) return 40;
  if (ratio >= 0.3) return 25;
  return 15;
}

export type LoanOptimization = {
  currentMonths: number;
  boostedEmi: number;
  boostedMonths: number;
  monthsSaved: number;
  interestSavedApprox: number;
};

function monthsToClose(principal: number, monthlyRate: number, emi: number): number {
  if (emi <= principal * monthlyRate) return Infinity;
  const n = Math.log(emi / (emi - principal * monthlyRate)) / Math.log(1 + monthlyRate);
  return Math.ceil(n);
}

export function optimizeLoan(loan: OnboardingLoan): LoanOptimization | null {
  if (loan.balance <= 0 || loan.emi <= 0 || loan.interest <= 0) return null;
  const r = loan.interest / 12 / 100;
  const currentMonths = monthsToClose(loan.balance, r, loan.emi);
  if (!Number.isFinite(currentMonths)) return null;
  const boostedEmi = Math.round(loan.emi * 1.2);
  const boostedMonths = monthsToClose(loan.balance, r, boostedEmi);
  const monthsSaved = Math.max(0, currentMonths - boostedMonths);
  const interestSavedApprox = Math.max(
    0,
    loan.emi * currentMonths - boostedEmi * boostedMonths,
  );
  return { currentMonths, boostedEmi, boostedMonths, monthsSaved, interestSavedApprox };
}
