"use client";

import { getOnboardingSnapshotApi, saveOnboardingSnapshotApi } from "@/lib/api";

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

const STORAGE_KEY = "finzova_onboarding_snapshot";

function isValidSnapshot(x: unknown): x is OnboardingSnapshot {
  if (!x || typeof x !== "object") return false;
  const s = x as Partial<OnboardingSnapshot>;
  return (
    typeof s.income === "number" &&
    Number.isFinite(s.income) &&
    typeof s.expenses === "object" &&
    s.expenses !== null &&
    Array.isArray(s.loans) &&
    Array.isArray(s.goals)
  );
}

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
    const parsed = JSON.parse(raw);
    return isValidSnapshot(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function clearOnboardingSnapshot(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

export async function persistOnboardingSnapshot(
  data: Omit<OnboardingSnapshot, "savedAt">,
): Promise<void> {
  saveOnboardingSnapshot(data);
  await saveOnboardingSnapshotApi({
    income: data.income,
    expenses: data.expenses,
    loans: data.loans,
    goals: data.goals,
  });
}

export async function fetchOnboardingSnapshot(): Promise<OnboardingSnapshot | null> {
  const remote = await getOnboardingSnapshotApi();
  if (remote && isValidSnapshot(remote)) {
    const snap: OnboardingSnapshot = {
      income: remote.income,
      expenses: remote.expenses,
      loans: remote.loans,
      goals: remote.goals,
      savedAt: remote.savedAt ?? new Date().toISOString(),
    };
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snap));
    }
    return snap;
  }
  return loadOnboardingSnapshot();
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

export type HealthBreakdown = {
  overall: number;
  subScores: {
    savings: number;
    debt: number;
    expense: number;
    liquidity: number;
  };
  weights: {
    savings: number;
    debt: number;
    expense: number;
    liquidity: number;
  };
  riskLevel: "critical" | "at_risk" | "stable" | "strong";
  metrics: {
    income: number;
    expenses: number;
    debt: number;
    emi: number;
    savings: number;
    savingsRatio: number;
    debtServiceRatio: number;
    expenseRatio: number;
    debtToIncomeYears: number;
  };
  percentileVsPeers: number;
};

export function calculateHealthBreakdown(data: OnboardingSnapshot): HealthBreakdown {
  const income = Math.max(1, data.income);
  const expenses = totalExpenses(data.expenses);
  const debt = totalDebt(data.loans);
  const emi = totalEmi(data.loans);
  const savings = Math.max(0, income - expenses - emi);

  const savingsRatio = Math.max(0, Math.min(1, savings / income));
  const debtServiceRatio = Math.max(0, Math.min(1, emi / income));
  const expenseRatio = Math.max(0, expenses / income);
  const debtToIncomeYears = debt / (income * 12);

  const savingsSub = Math.round(Math.min(1, savingsRatio / 0.25) * 100);
  const debtSub = Math.round(Math.max(0, Math.min(1, 1 - debtServiceRatio / 0.5)) * 100);
  const expenseSub = Math.round(Math.max(0, Math.min(1, 1 - expenseRatio / 0.9)) * 100);
  const liquiditySub = Math.round(Math.max(0, Math.min(1, 1 - debtToIncomeYears / 0.5)) * 100);

  const weights = { savings: 0.4, debt: 0.2, expense: 0.25, liquidity: 0.15 };
  const overall = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        savingsSub * weights.savings +
          debtSub * weights.debt +
          expenseSub * weights.expense +
          liquiditySub * weights.liquidity,
      ),
    ),
  );

  const riskLevel: HealthBreakdown["riskLevel"] =
    overall >= 75 ? "strong" : overall >= 55 ? "stable" : overall >= 35 ? "at_risk" : "critical";

  // deterministic peer percentile using a logistic curve on savings rate anchored at 20%
  const x = (savingsRatio - 0.2) * 8;
  const sigmoid = 1 / (1 + Math.exp(-x));
  const percentileVsPeers = Math.round(sigmoid * 100);

  return {
    overall,
    subScores: { savings: savingsSub, debt: debtSub, expense: expenseSub, liquidity: liquiditySub },
    weights,
    riskLevel,
    metrics: {
      income,
      expenses,
      debt,
      emi,
      savings,
      savingsRatio,
      debtServiceRatio,
      expenseRatio,
      debtToIncomeYears,
    },
    percentileVsPeers,
  };
}

export function calculateHealthScore(data: OnboardingSnapshot): number {
  return calculateHealthBreakdown(data).overall;
}

export type Recommendation = {
  agent: "Expense" | "Debt" | "Risk" | "Goal" | "Investment";
  severity: "info" | "warn" | "risk";
  title: string;
  detail: string;
  howTo: string[];
  impactMonthly: number;
  priority: number;
  rationale: string;
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
    const cut = Math.round(food * 0.15);
    rec.push({
      agent: "Expense",
      severity: "warn",
      title: "You're spending too much on food",
      detail: `Food costs ₹${food.toLocaleString("en-IN")}/month — that's ${Math.round((food / income) * 100)}% of what you earn (most people stay under 15%). Trim it by 15% and you save ₹${cut.toLocaleString("en-IN")}/month.`,
      howTo: [
        "Cook 2-3 dinners at home each week — saves ₹800-1,500/week vs Swiggy/Zomato.",
        "Set a ₹250 limit per food-delivery order in the app settings.",
        "Order weekly groceries from BigBasket/DMart on Sunday instead of daily kirana runs.",
      ],
      impactMonthly: cut,
      priority: 6,
      rationale: `food share = ${(food / income).toFixed(2)} of income`,
    });
  }
  if (rent > 0.35 * income) {
    const cut = Math.round((rent - 0.3 * income) * 0.6);
    rec.push({
      agent: "Expense",
      severity: "warn",
      title: "Your rent is eating too much",
      detail: `Rent is ₹${rent.toLocaleString("en-IN")} (${Math.round((rent / income) * 100)}% of income). A typical safe number is under 30%. Moving to a ₹${Math.round(0.3 * income).toLocaleString("en-IN")} place would save you ₹${cut.toLocaleString("en-IN")}/month.`,
      howTo: [
        "Look at places 2-3 km away from your current spot — usually ₹5-10k cheaper.",
        "Get a flatmate to split rent + utilities; cuts your share in half overnight.",
        "Renegotiate at lease renewal — tell your landlord you're considering a move.",
      ],
      impactMonthly: cut,
      priority: 5,
      rationale: `rent share = ${(rent / income).toFixed(2)} of income`,
    });
  }
  if (shopping > 0.2 * income) {
    const cut = Math.round((shopping - 0.15 * income) * 0.7);
    rec.push({
      agent: "Expense",
      severity: "info",
      title: "Online shopping is leaking money",
      detail: `You're spending ${Math.round((shopping / income) * 100)}% of income on shopping. Capping it at 15% frees ₹${cut.toLocaleString("en-IN")}/month for savings.`,
      howTo: [
        "Open Amazon/Flipkart/Myntra and delete every saved card — extra friction kills impulse buys.",
        "Anything over ₹2,000? Add to cart and wait 72 hours before checkout.",
        "Move ₹" + cut.toLocaleString("en-IN") + "/month to a separate 'do-not-touch' account on salary day.",
      ],
      impactMonthly: cut,
      priority: 3,
      rationale: `shopping share = ${(shopping / income).toFixed(2)} of income`,
    });
  }
  if (entertainment > 0.1 * income) {
    const cut = Math.round(entertainment * 0.2);
    rec.push({
      agent: "Expense",
      severity: "info",
      title: "Subscription pile is too big",
      detail: `Entertainment + subscriptions are ${Math.round((entertainment / income) * 100)}% of income. Trim them and recover about ₹${cut.toLocaleString("en-IN")}/month.`,
      howTo: [
        "Open GPay or PhonePe → 'UPI Autopay' → cancel anything you haven't used in 30 days.",
        "Pick 2 OTTs to keep active and rotate the rest. Share annual family plans (4-way splits are fair).",
        "Swap one theatre outing/month for home viewing — saves ₹800-1,500 each time.",
      ],
      impactMonthly: cut,
      priority: 2,
      rationale: `entertainment share = ${(entertainment / income).toFixed(2)} of income`,
    });
  }

  if (savingsRatio < 0.2) {
    const target = Math.max(2000, Math.round(income * 0.05));
    rec.push({
      agent: "Risk",
      severity: savingsRatio < 0.1 ? "risk" : "warn",
      title: "You're not saving enough",
      detail: `Right now you save ${Math.round(Math.max(0, savingsRatio) * 100)}% of what you earn. The safe number is at least 20%. Even ₹${target.toLocaleString("en-IN")}/month into a separate savings account builds a buffer.`,
      howTo: [
        "Open your bank app today and create a new savings account (most banks: 'Add account' → 'Goal account' or '2nd savings').",
        `Set up an auto-transfer of ₹${target.toLocaleString("en-IN")} from your main account on salary day (1st or 7th).`,
        "Don't keep the new account's debit card. Out of sight, out of spend.",
      ],
      impactMonthly: target,
      priority: savingsRatio < 0.1 ? 10 : 8,
      rationale: `savings share = ${savingsRatio.toFixed(2)} of income`,
    });
  }

  if (debt > income * 6) {
    const topLoan = [...data.loans].sort((a, b) => b.interest - a.interest)[0];
    const topName = topLoan ? (topLoan.name ?? topLoan.type) : "highest-rate loan";
    rec.push({
      agent: "Debt",
      severity: "risk",
      title: "Your total debt is too high",
      detail: `You owe ₹${debt.toLocaleString("en-IN")} — that's ${(debt / income).toFixed(1)} months of your income. Attack the loan that costs you the most interest first.`,
      howTo: [
        `Pay extra on your ${topName} (highest interest) every month — even ₹500 extra cuts months off the loan.`,
        "Don't take any new EMI for the next 6 months — no new credit cards, no buy-now-pay-later.",
        "Once one loan closes, redirect that EMI amount onto the next-highest-rate loan (snowball it).",
      ],
      impactMonthly: 0,
      priority: 9,
      rationale: `debt is ${(debt / income).toFixed(1)} months of income`,
    });
  }
  if (emi > 0.5 * income) {
    rec.push({
      agent: "Debt",
      severity: "risk",
      title: "Your EMIs are way too heavy",
      detail: `EMIs eat ${Math.round((emi / income) * 100)}% of your income. Safe is under 30%. You need to bring this down before anything else.`,
      howTo: [
        "Call your bank's loan helpline this week and ask if they can lower your interest rate (especially if you've been paying on time).",
        "Check 2-3 other banks for a balance transfer — even a 2% rate drop saves ₹2,000-5,000/month on a ₹5L loan.",
        "Pause all new EMIs (no new car, no new card, no BNPL) until your EMI ratio is under 50%.",
      ],
      impactMonthly: Math.round((emi - 0.5 * income) * 0.3),
      priority: 10,
      rationale: `emi share = ${(emi / income).toFixed(2)} of income`,
    });
  } else if (emi > 0.3 * income) {
    rec.push({
      agent: "Debt",
      severity: "warn",
      title: "Pay off your top loan faster",
      detail: `EMIs are ${Math.round((emi / income) * 100)}% of income. Adding 15% to your top-rate EMI closes that loan 18-24 months earlier.`,
      howTo: [
        "Identify your highest-interest loan (usually credit card or personal loan).",
        "Set up a manual extra payment of 15% of that EMI on the same day each month — most banks allow extra principal payment in the app.",
        "Don't reduce the regular EMI — keep the extra as a separate principal pre-payment.",
      ],
      impactMonthly: Math.round(emi * 0.15),
      priority: 5,
      rationale: `emi share = ${(emi / income).toFixed(2)} of income`,
    });
  }

  if (savingsRatio >= 0.2 && emi < 0.3 * income) {
    const sip = Math.max(3000, Math.round(income * 0.1));
    const sipFiveY = Math.round(((sip * 12 * (Math.pow(1.12, 5) - 1)) / 0.12));
    rec.push({
      agent: "Investment",
      severity: "info",
      title: "Start (or step up) a monthly SIP",
      detail: `You have spare cash. Put ₹${sip.toLocaleString("en-IN")}/month into a simple index fund — at typical 12% returns, that grows to ₹${sipFiveY.toLocaleString("en-IN")} in 5 years.`,
      howTo: [
        "Download Zerodha Coin or Groww app and complete KYC (5 minutes with PAN + Aadhaar).",
        "Search for 'Nifty 50 Index Fund' (UTI, HDFC, or ICICI all work). Pick any one — they're nearly identical.",
        `Set up a monthly SIP of ₹${sip.toLocaleString("en-IN")} on a date 2 days after salary.`,
      ],
      impactMonthly: sip,
      priority: 4,
      rationale: `savings rate healthy + low EMI burden`,
    });
    rec.push({
      agent: "Investment",
      severity: "info",
      title: "Add a small gold safety net",
      detail: `Put about ₹${Math.round(sip * 0.12).toLocaleString("en-IN")}/month (10-15% of your spare cash) into gold for inflation protection.`,
      howTo: [
        "Wait for the next RBI Sovereign Gold Bond (SGB) tranche — they release one every few months. Buy through your broker.",
        "Or simpler: buy 'Nippon Gold ETF' on Zerodha — instant, no lock-in.",
        "Don't buy physical gold (jewellery) for investment — making charges eat 10-20%.",
      ],
      impactMonthly: Math.round(sip * 0.12),
      priority: 2,
      rationale: `add gold for diversification`,
    });
  }

  if (rec.length === 0) {
    rec.push({
      agent: "Investment",
      severity: "info",
      title: "You're doing great — keep compounding",
      detail: "No red flags right now. Automate one SIP, check it once a quarter, and raise the amount 10% each year.",
      howTo: [
        "Open Zerodha Coin or Groww and start a monthly SIP into a Nifty 50 Index Fund.",
        "Set a calendar reminder for every January 1 to bump your SIP amount by 10%.",
        "Review your portfolio every 3 months — that's it. Don't churn.",
      ],
      impactMonthly: 0,
      priority: 1,
      rationale: `no major risks detected`,
    });
  }

  rec.sort((a, b) => b.priority - a.priority);
  return rec;
}

export type AgentTrace = {
  agent: "Expense" | "Debt" | "Risk" | "Goal" | "Investment" | "Orchestrator";
  observation: string;
  analysis: string;
  output: string;
  signals: { label: string; value: string }[];
};

export function generateAgentTraces(data: OnboardingSnapshot): AgentTrace[] {
  const b = calculateHealthBreakdown(data);
  const m = b.metrics;
  const e = data.expenses || {};
  const traces: AgentTrace[] = [];

  traces.push({
    agent: "Expense",
    observation: `Looked at ${Object.keys(e).length} spending categories adding up to ₹${m.expenses.toLocaleString("en-IN")}.`,
    analysis: `You spend ${(m.expenseRatio * 100).toFixed(0)}% of what you earn. Biggest chunk: ${topCategory(e) ?? "—"}.`,
    output: m.expenseRatio > 0.7 ? "Your spending is a bit high" : "Spending looks okay",
    signals: [
      { label: "spent vs earned", value: `${(m.expenseRatio * 100).toFixed(0)}%` },
      { label: "top category", value: topCategory(e) ?? "n/a" },
      { label: "spending score", value: `${b.subScores.expense}/100` },
    ],
  });

  traces.push({
    agent: "Debt",
    observation:
      data.loans.length === 0
        ? "No loans on your profile — nothing to pay off."
        : `Checked ${data.loans.length} loan${data.loans.length === 1 ? "" : "s"} totalling ₹${m.debt.toLocaleString("en-IN")}.`,
    analysis:
      data.loans.length === 0
        ? "No EMIs eating into your income."
        : `EMIs take ${(m.debtServiceRatio * 100).toFixed(0)}% of your income and total debt is ${m.debtToIncomeYears.toFixed(2)} years of earnings.`,
    output:
      data.loans.length === 0
        ? "Debt-free — keep it that way"
        : m.debtServiceRatio > 0.5
          ? "EMIs are too high — consider refinancing"
          : m.debtServiceRatio > 0.3
            ? "EMIs are okay, but try to pay off faster"
            : "EMIs are light",
    signals: [
      { label: "emi vs income", value: `${(m.debtServiceRatio * 100).toFixed(0)}%` },
      { label: "debt in years of income", value: m.debtToIncomeYears.toFixed(2) },
      { label: "debt score", value: `${b.subScores.debt}/100` },
    ],
  });

  traces.push({
    agent: "Risk",
    observation: `Looked at how much cushion you have if income stops.`,
    analysis: `You save ${(m.savingsRatio * 100).toFixed(0)}% of your income. Safety score ${b.subScores.liquidity}/100.`,
    output:
      m.savingsRatio < 0.1
        ? "Low safety net — build emergency savings"
        : m.savingsRatio < 0.2
          ? "Below ideal safety buffer"
          : "Safety net looks good",
    signals: [
      { label: "savings rate", value: `${(m.savingsRatio * 100).toFixed(0)}%` },
      { label: "overall risk", value: b.riskLevel.replace("_", " ") },
      { label: "vs peers", value: `${b.percentileVsPeers}th percentile` },
    ],
  });

  const topGoal = data.goals[0];
  const goalProb = topGoal && topGoal.targetAmount > 0 && topGoal.years > 0
    ? calculateGoalProbability(topGoal, m.savings)
    : null;
  const goalNeeded = topGoal && topGoal.years > 0 ? Math.ceil(topGoal.targetAmount / (topGoal.years * 12)) : 0;
  traces.push({
    agent: "Goal",
    observation: topGoal
      ? `Checked your "${topGoal.name ?? topGoal.type}" — need ₹${topGoal.targetAmount.toLocaleString("en-IN")} in ${topGoal.years} year${topGoal.years === 1 ? "" : "s"}.`
      : "No goals added yet.",
    analysis: topGoal
      ? `You'd need to save ₹${goalNeeded.toLocaleString("en-IN")}/mo. Right now you save ₹${m.savings.toLocaleString("en-IN")}/mo.`
      : "Add a goal so we can show you how close you are.",
    output:
      goalProb === null
        ? "Waiting for a goal"
        : goalProb >= 80
          ? `On track — about ${goalProb}% chance`
          : goalProb >= 40
            ? `Stretch goal — about ${goalProb}% chance`
            : `Tough at current savings — about ${goalProb}% chance`,
    signals: [
      { label: "goals added", value: String(data.goals.length) },
      { label: "top goal chance", value: goalProb !== null ? `${goalProb}%` : "—" },
    ],
  });

  traces.push({
    agent: "Investment",
    observation: `Worked out what's left over each month after bills and EMIs.`,
    analysis: `You have ₹${m.savings.toLocaleString("en-IN")}/mo free. A balanced split would put ~₹${Math.round(m.savings * 0.6).toLocaleString("en-IN")}/mo into equity.`,
    output:
      m.savings <= 0
        ? "No surplus yet — cut costs before investing"
        : m.savingsRatio < 0.2
          ? "Build an emergency fund first, then start a SIP"
          : "Ready for a mutual-fund SIP plus a little gold",
    signals: [
      { label: "free cash", value: `₹${m.savings.toLocaleString("en-IN")}/mo` },
      { label: "equity share", value: `₹${Math.round(Math.max(0, m.savings * 0.6)).toLocaleString("en-IN")}/mo` },
    ],
  });

  traces.push({
    agent: "Orchestrator",
    observation: `Combined the five checks above into one final score.`,
    analysis: `Savings counts ${Math.round(b.weights.savings * 100)}%, expenses ${Math.round(b.weights.expense * 100)}%, debt ${Math.round(b.weights.debt * 100)}%, safety net ${Math.round(b.weights.liquidity * 100)}%.`,
    output: `Final score ${b.overall}/100 · ${b.riskLevel.replace("_", " ")}`,
    signals: [
      { label: "overall", value: `${b.overall}/100` },
      { label: "risk", value: b.riskLevel.replace("_", " ") },
      { label: "vs peers", value: `${b.percentileVsPeers}th percentile` },
    ],
  });

  return traces;
}

function topCategory(e: Record<string, number>): string | null {
  let best: { k: string; v: number } | null = null;
  for (const [k, v] of Object.entries(e)) {
    if (!best || v > best.v) best = { k, v };
  }
  return best && best.v > 0 ? best.k.replace(/_/g, " ") : null;
}

export type Forecast = {
  months: number;
  baseline: { monthlySavings: number; total: number };
  improved: { monthlySavings: number; total: number; delta: number; unlockedActions: string[] };
};

export function projectForecast(data: OnboardingSnapshot, months = 12): Forecast {
  const b = calculateHealthBreakdown(data);
  const baselineMonthly = b.metrics.savings;
  const recs = generateRecommendations(data);
  const unlocked = recs
    .filter((r) => r.impactMonthly > 0 && r.severity !== "info")
    .slice(0, 3);
  const improvedMonthly = baselineMonthly + unlocked.reduce((s, r) => s + r.impactMonthly, 0);
  return {
    months,
    baseline: {
      monthlySavings: baselineMonthly,
      total: Math.max(0, baselineMonthly * months),
    },
    improved: {
      monthlySavings: improvedMonthly,
      total: Math.max(0, improvedMonthly * months),
      delta: Math.max(0, (improvedMonthly - baselineMonthly) * months),
      unlockedActions: unlocked.map((r) => r.title),
    },
  };
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

export type DiagnosticSignal = {
  label: string;
  value: string;
  verdict: "good" | "watch" | "bad";
};

export type AiSummary = {
  headline: string;
  diagnostics: DiagnosticSignal[];
  suggestedActions: string[];
  riskLevel: HealthBreakdown["riskLevel"];
  peerPercentile: number;
};

function verdict(level: "good" | "watch" | "bad"): DiagnosticSignal["verdict"] {
  return level;
}

export function generateAiSummary(data: OnboardingSnapshot): AiSummary {
  const b = calculateHealthBreakdown(data);
  const m = b.metrics;
  const recs = generateRecommendations(data);

  const savingsPct = Math.round(m.savingsRatio * 100);
  const emiPct = Math.round(m.debtServiceRatio * 100);
  const expensePct = Math.round(m.expenseRatio * 100);
  const debtX = m.debt / Math.max(1, m.income);

  const diagnostics: DiagnosticSignal[] = [
    {
      label: "How much you save",
      value:
        savingsPct >= 20
          ? `${savingsPct}% of income — that's healthy`
          : savingsPct >= 10
            ? `${savingsPct}% of income — try to push past 20%`
            : `${savingsPct}% of income — too low, aim for 20%`,
      verdict: savingsPct >= 20 ? verdict("good") : savingsPct >= 10 ? verdict("watch") : verdict("bad"),
    },
    {
      label: "EMI load",
      value:
        emiPct <= 30
          ? `${emiPct}% of income — comfortable`
          : emiPct <= 50
            ? `${emiPct}% of income — getting tight`
            : `${emiPct}% of income — too heavy`,
      verdict: emiPct <= 30 ? verdict("good") : emiPct <= 50 ? verdict("watch") : verdict("bad"),
    },
    {
      label: "How much you spend",
      value:
        expensePct <= 60
          ? `${expensePct}% of income — well managed`
          : expensePct <= 80
            ? `${expensePct}% of income — bit high`
            : `${expensePct}% of income — way too high`,
      verdict: expensePct <= 60 ? verdict("good") : expensePct <= 80 ? verdict("watch") : verdict("bad"),
    },
    {
      label: "Total debt",
      value:
        m.debt === 0
          ? "No loans — debt-free"
          : debtX <= 6
            ? `${debtX.toFixed(1)} months of income owed — manageable`
            : `${debtX.toFixed(1)} months of income owed — heavy`,
      verdict: m.debt === 0 ? verdict("good") : debtX <= 6 ? verdict("watch") : verdict("bad"),
    },
    {
      label: "Vs people like you",
      value:
        b.percentileVsPeers >= 60
          ? `Better than ${b.percentileVsPeers} of 100 — top end`
          : b.percentileVsPeers >= 30
            ? `Around the middle of ${b.percentileVsPeers} of 100`
            : `Behind most — ${b.percentileVsPeers} of 100`,
      verdict:
        b.percentileVsPeers >= 60 ? verdict("good") : b.percentileVsPeers >= 30 ? verdict("watch") : verdict("bad"),
    },
  ];

  const topActions = recs
    .slice(0, 3)
    .map((r) =>
      r.impactMonthly > 0
        ? `${r.title} — saves you ₹${r.impactMonthly.toLocaleString("en-IN")}/month`
        : r.title,
    );

  const headline =
    b.riskLevel === "strong"
      ? `Score ${b.overall}/100 — you're doing well. Better than ${b.percentileVsPeers} out of 100 people. Keep it up.`
      : b.riskLevel === "stable"
        ? `Score ${b.overall}/100 — okay, but ${diagnostics.filter((d) => d.verdict !== "good").length} things need a fix.`
        : b.riskLevel === "at_risk"
          ? `Score ${b.overall}/100 — needs attention. Start with the top ${Math.min(3, recs.length)} actions below.`
          : `Score ${b.overall}/100 — concerning. Saving only ${savingsPct}% and EMIs at ${emiPct}% is too risky. Let's fix this.`;

  return {
    headline,
    diagnostics,
    suggestedActions: topActions.length > 0 ? topActions : ["You're on track — automate investments and review quarterly."],
    riskLevel: b.riskLevel,
    peerPercentile: b.percentileVsPeers,
  };
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
