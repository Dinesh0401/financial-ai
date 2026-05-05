"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  BarChart3,
  Brain,
  CheckCircle2,
  CircleDot,
  CreditCard,
  Gamepad2,
  Info,
  Lightbulb,
  LineChart,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingUp,
  Wallet,
  XCircle,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import {
  calculateGoalProbability,
  calculateHealthBreakdown,
  fetchOnboardingSnapshot,
  generateAgentTraces,
  generateAiSummary,
  generateRecommendations,
  optimizeLoan,
  projectForecast,
  totalDebt,
  totalEmi,
  totalExpenses,
  type AgentTrace,
  type DiagnosticSignal,
  type OnboardingSnapshot,
  type Recommendation,
} from "@/lib/ai/engine";

type Props = {
  fallback?: {
    income: number;
    expenses: number;
    savings: number;
    categoryTotals?: Record<string, number>;
  };
};

const AGENT_TONE: Record<Recommendation["severity"], string> = {
  info: "border-sky-400/30 bg-sky-500/10 text-sky-200",
  warn: "border-amber-400/30 bg-amber-500/10 text-amber-200",
  risk: "border-red-400/30 bg-red-500/10 text-red-200",
};

const AGENT_ICON: Record<AgentTrace["agent"], typeof Wallet> = {
  Expense: Wallet,
  Debt: CreditCard,
  Risk: ShieldAlert,
  Goal: Target,
  Investment: TrendingUp,
  Orchestrator: Brain,
};

const VERDICT_STYLE: Record<DiagnosticSignal["verdict"], { dot: string; label: string; Icon: typeof CheckCircle2 }> = {
  good: { dot: "bg-emerald-400", label: "text-emerald-300", Icon: CheckCircle2 },
  watch: { dot: "bg-amber-400", label: "text-amber-300", Icon: CircleDot },
  bad: { dot: "bg-red-400", label: "text-red-300", Icon: XCircle },
};

const SUBSCORE_LABELS: { key: "savings" | "debt" | "expense" | "liquidity"; label: string }[] = [
  { key: "savings", label: "Savings" },
  { key: "debt", label: "Debt" },
  { key: "expense", label: "Expense" },
  { key: "liquidity", label: "Liquidity" },
];

function scoreTone(score: number): "emerald" | "amber" | "red" {
  if (score >= 75) return "emerald";
  if (score >= 50) return "amber";
  return "red";
}

function bandLabel(score: number): string {
  if (score >= 75) return "Strong";
  if (score >= 50) return "Improving";
  return "At risk";
}

function subScoreBar(score: number): string {
  if (score >= 75) return "bg-emerald-400";
  if (score >= 50) return "bg-amber-400";
  return "bg-red-400";
}

function humanizeCategory(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function relativeTime(iso: string): string | null {
  const t = Date.parse(iso);
  if (!Number.isFinite(t) || t <= 0) return null;
  const diffMs = Date.now() - t;
  if (diffMs < 0) return "just now";
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const days = Math.floor(hr / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

function snapshotFromFallback(f: NonNullable<Props["fallback"]>): OnboardingSnapshot {
  return {
    income: f.income,
    expenses: f.categoryTotals ?? { other: f.expenses },
    loans: [],
    goals: [],
    savedAt: new Date(0).toISOString(),
  };
}

type Alert = {
  tone: "warn" | "good" | "info";
  emoji: string;
  text: string;
};

function TopAlerts({
  data,
  breakdown,
  recos,
}: {
  data: OnboardingSnapshot;
  breakdown: ReturnType<typeof calculateHealthBreakdown>;
  recos: Recommendation[];
}) {
  const alerts: Alert[] = [];
  const m = breakdown.metrics;
  const foodSpend = data.expenses.food_dining ?? data.expenses.food ?? 0;

  if (foodSpend > 0 && m.income > 0 && foodSpend > m.income * 0.2) {
    const safeLine = Math.round(m.income * 0.2);
    const over = foodSpend - safeLine;
    alerts.push({
      tone: "warn",
      emoji: "⚠️",
      text: `You are overspending ₹${over.toLocaleString("en-IN")}/month on food.`,
    });
  }

  // High-interest loan detected
  const highLoan = [...(data.loans || [])].sort((a, b) => b.interest - a.interest)[0];
  if (highLoan) {
    alerts.push({
      tone: "warn",
      emoji: "🔥",
      text: `High-interest loan detected (${highLoan.interest}%) — pay ${highLoan.name ?? highLoan.type} first.`,
    });
  }

  // Smart alert: risky EMI ratio
  if (m.income > 0 && m.debtServiceRatio > 0.4) {
    alerts.push({
      tone: "warn",
      emoji: "⚠️",
      text: `Your EMI ratio is risky (${Math.round(m.debtServiceRatio * 100)}% of income).`,
    });
  }

  // Smart alert: no weekly buffer
  if (m.income > 0 && m.savingsRatio < 0.1) {
    alerts.push({
      tone: "warn",
      emoji: "⚠️",
      text: `You overspend this month. Set a weekly cap so spending doesn't run ahead.`,
    });
  }

  // Total possible savings (good news)
  const totalPotentialSave = recos
    .filter((r) => r.impactMonthly > 0)
    .reduce((s, r) => s + r.impactMonthly, 0);
  if (totalPotentialSave > 0) {
    alerts.push({
      tone: "good",
      emoji: "✅",
      text: `You can save ₹${totalPotentialSave.toLocaleString("en-IN")}/month if you follow the plan.`,
    });
  }

  // Healthy savings rate (good news)
  if (m.savingsRatio >= 0.2 && m.savings > 0) {
    alerts.push({
      tone: "good",
      emoji: "🎉",
      text: `Great save rate! You save ${Math.round(m.savingsRatio * 100)}% of what you earn. Keep going.`,
    });
  }

  // Debt-free
  if ((data.loans || []).length === 0) {
    alerts.push({
      tone: "good",
      emoji: "✅",
      text: `You're debt-free. Keep new EMIs out unless they're truly essential.`,
    });
  }

  if (alerts.length === 0) return null;

  return (
    <div className="rounded-3xl border border-border/60 bg-card/70 p-5">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-primary" />
        <p className="text-sm font-semibold">In one glance</p>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        The big things you should know about your money right now.
      </p>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {alerts.slice(0, 6).map((a, i) => (
          <li
            key={i}
            className={`flex items-start gap-3 rounded-2xl border px-3 py-3 text-sm leading-6 ${
              a.tone === "warn"
                ? "border-amber-400/30 bg-amber-500/10 text-amber-100"
                : a.tone === "good"
                  ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
                  : "border-sky-400/30 bg-sky-500/10 text-sky-100"
            }`}
          >
            <span className="text-base leading-none">{a.emoji}</span>
            <span className="flex-1">{a.text}</span>
          </li>
        ))}
      </ul>
      <a
        href="#action-list"
        className="mt-3 inline-flex text-xs font-medium text-primary underline-offset-4 hover:underline"
      >
        Open the action list below
      </a>
    </div>
  );
}

export function AIInsights({ fallback }: Props) {
  const [snapshot, setSnapshot] = useState<OnboardingSnapshot | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [showAgents, setShowAgents] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const remote = await fetchOnboardingSnapshot();
      if (!cancelled) {
        setSnapshot(remote);
        setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const data: OnboardingSnapshot | null = useMemo(() => {
    if (snapshot && snapshot.income > 0) return snapshot;
    if (fallback && fallback.income > 0) return snapshotFromFallback(fallback);
    return null;
  }, [snapshot, fallback]);

  if (!hydrated) return null;

  if (!data) {
    return (
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <h2 className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">Zova&apos;s take</h2>
        </div>
        <div className="rounded-3xl border border-dashed border-border/60 bg-card/60 p-6 text-sm text-muted-foreground">
          Complete onboarding to unlock your personalised health score, goal forecast and agent recommendations.{" "}
          <Link href="/onboarding" className="text-primary underline">Start onboarding</Link>
        </div>
      </section>
    );
  }

  const breakdown = calculateHealthBreakdown(data);
  const score = breakdown.overall;
  const tone = scoreTone(score);
  const band = bandLabel(score);
  const recos = generateRecommendations(data);
  const traces = generateAgentTraces(data);
  const forecast = projectForecast(data, 12);
  const summary = generateAiSummary(data);
  const expenses = totalExpenses(data.expenses);
  const debt = totalDebt(data.loans);
  const emi = totalEmi(data.loans);
  const monthlySavings = Math.max(0, data.income - expenses - emi);
  const lastUpdated = relativeTime(data.savedAt);

  const topGoal = data.goals[0];
  const goalProb = topGoal && topGoal.targetAmount > 0 && topGoal.years > 0
    ? calculateGoalProbability(topGoal, monthlySavings)
    : null;

  const topLoan = [...data.loans].sort((a, b) => b.interest - a.interest)[0];
  const loanOpt = topLoan ? optimizeLoan(topLoan) : null;
  const foodSpend = data.expenses.food_dining ?? data.expenses.food ?? 0;
  const expenseEntries = Object.entries(data.expenses)
    .filter(([, amount]) => amount > 0)
    .map(([key, amount]) => ({ key, amount, name: humanizeCategory(key) }))
    .sort((a, b) => b.amount - a.amount);
  const topNonFoodSpend = expenseEntries.find(
    (item) => item.key !== "food_dining" && item.key !== "food" && item.key !== "emi_loan",
  );
  const topNonFoodReductionFactor = topNonFoodSpend
    ? topNonFoodSpend.key === "rent_housing" || topNonFoodSpend.key === "rent"
      ? 0.9
      : topNonFoodSpend.key === "healthcare" || topNonFoodSpend.key === "education"
        ? 0.9
        : 0.7
    : 0.7;
  const topNonFoodSpendNow = topNonFoodSpend?.amount ?? 0;
  const topNonFoodSpendTarget = topNonFoodSpendNow > 0
    ? Math.round(topNonFoodSpendNow * topNonFoodReductionFactor)
    : 0;
  const foodTarget = foodSpend > 0 ? Math.round(foodSpend * 0.6) : 0;
  const totalSavingsCreated =
    Math.max(0, foodSpend - foodTarget) + Math.max(0, topNonFoodSpendNow - topNonFoodSpendTarget);
  const essentialMonthly = Math.max(
    0,
    (data.expenses.rent_housing ?? data.expenses.rent ?? 0) +
      (data.expenses.food_dining ?? data.expenses.food ?? 0) +
      (data.expenses.transport ?? 0) +
      (data.expenses.healthcare ?? 0) +
      emi,
  );
  const emergencyRequired = essentialMonthly * 3;
  const emergencyCurrent = 0;
  const emergencyGap = Math.max(0, emergencyRequired - emergencyCurrent);
  const emergencyBuildMonths =
    monthlySavings > 0 ? Math.ceil(emergencyGap / Math.max(1, monthlySavings)) : null;
  const sipSeed = Math.min(Math.max(0, monthlySavings), Math.max(0, data.income * 0.2));
  const actionSip = sipSeed >= 500 ? Math.floor(sipSeed / 500) * 500 : Math.floor(sipSeed / 100) * 100;
  const forecastActions = recos
    .filter((r) => r.impactMonthly > 0 && r.severity !== "info")
    .slice(0, 3);
  const extraMonthlyFromPlan = Math.max(0, forecast.improved.monthlySavings - forecast.baseline.monthlySavings);
  const expenseChartData = expenseEntries.map((e) => ({ name: e.name, value: e.amount }));
  const gameLevel =
    data.loans.length === 0 && score >= 80
      ? "Debt-Free Hero"
      : score >= 55
        ? "Smart Investor"
        : "Beginner Saver";
  const fiveYearSavings = Math.max(0, forecast.improved.monthlySavings * 60);
  const canBeDebtFreeIn5Years = loanOpt ? loanOpt.boostedMonths <= 60 : data.loans.length === 0;
  const peerSpendHigherThan = Math.max(0, Math.min(100, 100 - breakdown.percentileVsPeers));

  const toneRing: Record<typeof tone, string> = {
    emerald: "from-emerald-500/30 to-emerald-500/0 text-emerald-300",
    amber: "from-amber-500/30 to-amber-500/0 text-amber-300",
    red: "from-red-500/30 to-red-500/0 text-red-300",
  };
  const barColor: Record<typeof tone, string> = {
    emerald: "bg-emerald-400",
    amber: "bg-amber-400",
    red: "bg-red-400",
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <h2 className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">Zova&apos;s take</h2>
        </div>
        {lastUpdated && (
          <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Last updated · {lastUpdated}
          </span>
        )}
      </div>

      <TopAlerts data={data} breakdown={breakdown} recos={recos} />

      <div className="rounded-3xl border border-border/60 bg-card/70 p-5">
        <div className="flex items-center gap-2">
          <Lightbulb className="size-4 text-primary" />
          <p className="text-sm font-semibold">What should I do next?</p>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Follow these steps in order.</p>
        <ol className="mt-4 space-y-2 text-sm">
          <li className="flex gap-2 rounded-xl border border-border/50 bg-background/35 px-3 py-2">
            <span className="text-primary">1.</span>
            <span>
              {foodSpend > 0
                ? <>Reduce food spending to about <span className="font-semibold">₹{foodTarget.toLocaleString("en-IN")}/month</span>.</>
                : "Keep food spending under 20% of income."}
            </span>
          </li>
          <li className="flex gap-2 rounded-xl border border-border/50 bg-background/35 px-3 py-2">
            <span className="text-primary">2.</span>
            <span>
              {topLoan
                ? <>Pay <span className="font-semibold">{topLoan.name ?? topLoan.type}</span> first ({topLoan.interest}% interest).</>
                : "Close your highest-interest loan first."}
            </span>
          </li>
          <li className="flex gap-2 rounded-xl border border-border/50 bg-background/35 px-3 py-2">
            <span className="text-primary">3.</span>
            <span>
              {actionSip > 0
                ? <>Start SIP <span className="font-semibold">₹{actionSip.toLocaleString("en-IN")}</span> every month.</>
                : "Start with a small auto-save (₹500/month), then convert it to SIP."}
            </span>
          </li>
        </ol>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-3xl border border-border/60 bg-card/70 p-5">
          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Your money score</p>
          <div className="mt-4 flex items-end gap-3">
            <div className={`bg-gradient-to-br ${toneRing[tone]} rounded-2xl border border-white/10 px-5 py-3`}>
              <p className="text-4xl font-bold">{score}</p>
              <p className="text-[11px] uppercase tracking-[0.2em] opacity-80">/ 100</p>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{band}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Better than {breakdown.percentileVsPeers} out of 100 people like you
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                You are spending more than {peerSpendHigherThan} out of 100 people in your income range.
              </p>
            </div>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/5">
            <div className={`h-full rounded-full ${barColor[tone]}`} style={{ width: `${Math.min(100, Math.max(0, score))}%` }} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {SUBSCORE_LABELS.map(({ key, label }) => {
              const v = breakdown.subScores[key];
              return (
                <div key={key} className="rounded-xl border border-border/50 bg-background/40 px-3 py-2">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    {label}
                  </div>
                  <p className="mt-1 text-sm font-semibold text-foreground">{v}/100</p>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/5">
                    <div className={`h-full rounded-full ${subScoreBar(v)}`} style={{ width: `${v}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-[11px] text-muted-foreground">
            <div>
              <p className="uppercase tracking-[0.18em]">You earn</p>
              <p className="mt-1 text-sm font-semibold text-foreground">₹{data.income.toLocaleString("en-IN")}</p>
            </div>
            <div>
              <p className="uppercase tracking-[0.18em]">You spend</p>
              <p className="mt-1 text-sm font-semibold text-foreground">₹{expenses.toLocaleString("en-IN")}</p>
            </div>
            <div>
              <p className="uppercase tracking-[0.18em]">You save</p>
              <p className="mt-1 text-sm font-semibold text-foreground">₹{monthlySavings.toLocaleString("en-IN")}</p>
            </div>
          </div>
          <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/5 p-3">
            <div className="flex items-center gap-2">
              <Gamepad2 className="size-4 text-primary" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Your level</p>
            </div>
            <p className="mt-2 text-sm font-semibold text-foreground">{gameLevel}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {gameLevel === "Beginner Saver"
                ? "Hit score 55 to unlock Smart Investor."
                : gameLevel === "Smart Investor"
                  ? "Close high-interest debt and cross 80 to become Debt-Free Hero."
                  : "Amazing! Keep compounding and keep this badge."}
            </p>
          </div>
        </div>

        <div className="rounded-3xl border border-border/60 bg-card/70 p-5">
          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Goal success chance</p>
          {topGoal ? (
            goalProb !== null ? (
              (() => {
                const needed = Math.ceil(topGoal.targetAmount / (topGoal.years * 12));
                const shortfall = Math.max(0, needed - monthlySavings);
                const isUnrealistic = data.income > 0 && needed > data.income;
                const requiredIncomeForTimeline = expenses + emi + needed;
                const incomeGapForTimeline = Math.max(0, requiredIncomeForTimeline - data.income);
                const suggestedIncomeTarget = Math.ceil(requiredIncomeForTimeline / 1000) * 1000;
                const suggestedPartTime = incomeGapForTimeline > 0 ? Math.ceil(incomeGapForTimeline / 500) * 500 : 0;
                const feasibleYears = data.income > 0
                  ? Math.ceil(topGoal.targetAmount / (Math.max(monthlySavings, data.income * 0.2) * 12))
                  : null;
                return (
                  <>
                    <p className="mt-4 text-4xl font-bold text-foreground">{goalProb}%</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      for &quot;{topGoal.name ?? topGoal.type}&quot; · need ₹{topGoal.targetAmount.toLocaleString("en-IN")} in {topGoal.years} year{topGoal.years === 1 ? "" : "s"}
                    </p>
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/5">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${goalProb}%` }} />
                    </div>
                    {isUnrealistic ? (
                      (() => {
                        const isHomeGoal =
                          /home|house|apartment|flat/i.test(topGoal.name ?? "") ||
                          topGoal.type === "home" ||
                          topGoal.type === "house";
                        const downpaymentTarget = Math.round(topGoal.targetAmount * 0.2);
                        const realisticYears = feasibleYears && feasibleYears > topGoal.years ? feasibleYears : 10;
                        const downpaymentMonthly = Math.ceil(downpaymentTarget / (realisticYears * 12));
                        const homeLoanEligible = Math.round(monthlySavings * 60); // rough 60x EMI capacity
                        return (
                          <div className="mt-3 rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-[11px] leading-5 text-amber-100">
                            <p className="text-sm font-semibold text-foreground">
                              Hard in {topGoal.years} year{topGoal.years === 1 ? "" : "s"} — but here&apos;s how to actually do it
                            </p>
                            <p className="mt-1">
                              You&apos;d need ₹{needed.toLocaleString("en-IN")}/month, more than your whole salary. That&apos;s not realistic.
                            </p>
                            {isHomeGoal ? (
                              <ol className="mt-3 space-y-2 text-xs leading-5 text-amber-50/95">
                                <li className="flex gap-2">
                                  <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-amber-500/40 text-[10px] font-semibold">1</span>
                                  <span>
                                    <span className="font-semibold">Aim for the downpayment, not the full price.</span> You only need 20% upfront ≈ ₹{downpaymentTarget.toLocaleString("en-IN")}. The bank pays the rest as a home loan.
                                  </span>
                                </li>
                                <li className="flex gap-2">
                                  <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-amber-500/40 text-[10px] font-semibold">2</span>
                                  <span>
                                    Save ₹{downpaymentMonthly.toLocaleString("en-IN")}/month for {realisticYears} years in a SIP (Nifty 50 index fund). At ~12% returns this builds your downpayment.
                                  </span>
                                </li>
                                <li className="flex gap-2">
                                  <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-amber-500/40 text-[10px] font-semibold">3</span>
                                  <span>
                                    On your current savings of ₹{monthlySavings.toLocaleString("en-IN")}/month, banks may approve a home loan up to about ₹{homeLoanEligible.toLocaleString("en-IN")}. Check eligibility on your bank app.
                                  </span>
                                </li>
                                <li className="flex gap-2">
                                  <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-amber-500/40 text-[10px] font-semibold">4</span>
                                  <span>
                                    Update your goal: change timeline to <span className="font-semibold">{realisticYears} years</span> or change target to <span className="font-semibold">₹{downpaymentTarget.toLocaleString("en-IN")}</span> (downpayment only).
                                  </span>
                                </li>
                              </ol>
                            ) : (
                              <p className="mt-1">
                                {feasibleYears && feasibleYears > topGoal.years
                                  ? `Try ${feasibleYears} years instead — that's roughly ₹${Math.ceil(topGoal.targetAmount / (feasibleYears * 12)).toLocaleString("en-IN")}/mo, doable on your income.`
                                  : "Try a smaller target or a longer timeline. Edit your goal to make it realistic."}
                              </p>
                            )}
                          </div>
                        );
                      })()
                    ) : (
                      <p className="mt-3 text-[11px] text-muted-foreground">
                        {shortfall > 0
                          ? `Save ₹${needed.toLocaleString("en-IN")}/mo to hit it (you're short by ₹${shortfall.toLocaleString("en-IN")}/mo today).`
                          : `You're on track — keep saving ₹${monthlySavings.toLocaleString("en-IN")}/mo.`}
                      </p>
                    )}
                    {incomeGapForTimeline > 0 && (
                      <div className="mt-3 rounded-xl border border-sky-400/30 bg-sky-500/10 p-3 text-[11px] leading-5 text-sky-100">
                        <p className="font-semibold">How to finish this goal in time</p>
                        <p className="mt-1">
                          To manage current expenses + EMIs and this goal, you need about ₹{suggestedIncomeTarget.toLocaleString("en-IN")}/month income.
                          You are short by ₹{incomeGapForTimeline.toLocaleString("en-IN")}/month.
                          {suggestedPartTime > 0
                            ? ` Try part-time/freelance income of ₹${suggestedPartTime.toLocaleString("en-IN")}/month or a salary increase to the same level.`
                            : " Keep current income and increase savings discipline."}
                        </p>
                      </div>
                    )}
                  </>
                );
              })()
            ) : (
              <p className="mt-6 text-sm text-muted-foreground">
                Add a valid goal amount and timeline to see your success chance.
              </p>
            )
          ) : (
            <p className="mt-6 text-sm text-muted-foreground">Add a goal in onboarding to see how close you are.</p>
          )}
        </div>

        <div className="rounded-3xl border border-border/60 bg-card/70 p-5">
          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Pay your loan faster</p>
          {loanOpt && topLoan ? (
            <>
              <p className="mt-3 inline-flex rounded-full border border-red-400/30 bg-red-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-red-200">
                🔥 Pay this first ({topLoan.interest}% interest)
              </p>
              <p className="mt-4 text-sm text-foreground">
                Pay <span className="font-semibold text-primary">₹{loanOpt.boostedEmi.toLocaleString("en-IN")}/mo</span>
                {" "}instead of ₹{topLoan.emi.toLocaleString("en-IN")}/mo on your {topLoan.name ?? topLoan.type}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {loanOpt.monthsSaved >= 1
                  ? `Finishes ${loanOpt.monthsSaved >= 12 ? Math.round(loanOpt.monthsSaved / 12) + ' year' + (loanOpt.monthsSaved >= 24 ? 's' : '') : loanOpt.monthsSaved + ' months'} sooner.`
                  : `Closes a bit faster.`}
                {" "}Saves about ₹{Math.round(loanOpt.interestSavedApprox).toLocaleString("en-IN")} in interest.
              </p>
              <div className="mt-3 rounded-xl border border-border/50 bg-background/35 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Interest saved view</p>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-emerald-400"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.max(6, (loanOpt.interestSavedApprox / Math.max(1, topLoan.balance)) * 100),
                      )}%`,
                    }}
                  />
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  About ₹{Math.round(loanOpt.interestSavedApprox).toLocaleString("en-IN")} saved when you add this extra EMI.
                </p>
              </div>
              <ol className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                <li>1. Keep all regular EMIs running.</li>
                <li>2. Add the extra amount only to this highest-interest loan.</li>
                <li>3. After this closes, move the same extra amount to the next loan.</li>
              </ol>
              <p className="mt-3 text-[11px] text-muted-foreground">
                You owe ₹{debt.toLocaleString("en-IN")} · paying ₹{emi.toLocaleString("en-IN")}/mo today
              </p>
            </>
          ) : (
            <p className="mt-6 text-sm text-muted-foreground">No active loans. Add one in onboarding to see a payoff plan.</p>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl border border-border/60 bg-card/70 p-5">
          <div className="flex items-center gap-2">
            <BarChart3 className="size-4 text-primary" />
            <p className="text-sm font-semibold">Savings creation strategy</p>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Before vs after plan</p>
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex items-center justify-between rounded-xl border border-border/50 bg-background/35 px-3 py-2">
              <span>Food</span>
              <span className="font-medium">
                ₹{foodSpend.toLocaleString("en-IN")} → ₹{foodTarget.toLocaleString("en-IN")}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border/50 bg-background/35 px-3 py-2">
              <span>{topNonFoodSpend?.name ?? "Next highest spend"}</span>
              <span className="font-medium">
                ₹{topNonFoodSpendNow.toLocaleString("en-IN")} → ₹{topNonFoodSpendTarget.toLocaleString("en-IN")}
              </span>
            </div>
            <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-emerald-100">
              Total savings created: <span className="font-semibold">₹{totalSavingsCreated.toLocaleString("en-IN")}/month</span>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-border/60 bg-card/70 p-5">
          <div className="flex items-center gap-2">
            <ShieldAlert className="size-4 text-primary" />
            <p className="text-sm font-semibold">Emergency risk simulation</p>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl border border-border/50 bg-background/35 p-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Can you survive 3 months?</p>
              <p className="mt-1 text-sm font-semibold text-foreground">{emergencyCurrent >= emergencyRequired ? "Yes" : "Not yet"}</p>
              <p className="mt-1 text-xs text-muted-foreground">Need ₹{emergencyRequired.toLocaleString("en-IN")} for 3 months.</p>
            </div>
            <div className="rounded-xl border border-border/50 bg-background/35 p-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Emergency fund</p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                Required ₹{emergencyRequired.toLocaleString("en-IN")} · Current ₹{emergencyCurrent.toLocaleString("en-IN")}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {emergencyBuildMonths ? `At your current savings pace, you can build this in about ${emergencyBuildMonths} months.` : "Start by auto-saving every month to build this fund."}
              </p>
            </div>
          </div>
          <div className="mt-3 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            Smart alert: {breakdown.metrics.debtServiceRatio > 0.4 ? "Your EMI ratio is risky." : "EMI ratio is under control."}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl border border-border/60 bg-card/70 p-5">
          <div className="flex items-center gap-2">
            <LineChart className="size-4 text-primary" />
            <p className="text-sm font-semibold">Financial roadmap</p>
          </div>
          <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
            <div className="rounded-xl border border-border/50 bg-background/35 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Year 1-2</p>
              <p className="mt-1 text-xs text-muted-foreground">Cut overspending, build emergency fund, and attack high-interest debt.</p>
            </div>
            <div className="rounded-xl border border-border/50 bg-background/35 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Year 3-5</p>
              <p className="mt-1 text-xs text-muted-foreground">Increase SIPs, reduce remaining debt, and push goal funding faster.</p>
            </div>
            <div className="rounded-xl border border-border/50 bg-background/35 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Year 5-10</p>
              <p className="mt-1 text-xs text-muted-foreground">Stay debt-light, grow investments, and complete long-term goals.</p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card/80 to-card/60 p-5">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <p className="text-sm font-semibold">AI financial story (5 years)</p>
          </div>
          <p className="mt-3 text-sm text-foreground">
            If you follow this plan, in 5 years you can save about <span className="font-semibold">₹{fiveYearSavings.toLocaleString("en-IN")}</span>,{" "}
            {canBeDebtFreeIn5Years ? "be debt-free" : "cut most of your high-interest debt"}, and move closer to{" "}
            <span className="font-semibold">{topGoal?.name ?? topGoal?.type ?? "your top goal"}</span>.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            This is based on your current income and the action plan above — no impossible monthly target.
          </p>
        </div>
      </div>

      <div className="rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card/80 to-card/60 p-5 shadow-[0_0_40px_-20px_rgba(16,185,129,0.5)]">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Zova says</p>
        </div>
        <p className="mt-3 text-base font-semibold text-foreground">{summary.headline}</p>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {summary.diagnostics.map((d, i) => {
            const style = VERDICT_STYLE[d.verdict];
            const Icon = style.Icon;
            return (
              <li key={i} className="flex items-start gap-2 rounded-2xl border border-border/50 bg-background/40 px-3 py-2 text-sm">
                <Icon className={`mt-0.5 size-4 shrink-0 ${style.label}`} />
                <div className="min-w-0">
                  <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${style.label}`}>{d.label}</p>
                  <p className="mt-0.5 text-sm text-foreground">{d.value}</p>
                </div>
              </li>
            );
          })}
        </ul>
        <div className="mt-4 rounded-2xl border border-primary/20 bg-background/40 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">Top 3 things to do</p>
          <ul className="mt-2 space-y-1.5 text-sm text-foreground">
            {summary.suggestedActions.map((a, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-1 size-1.5 shrink-0 rounded-full bg-emerald-400" />
                <span>{a}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-3xl border border-border/60 bg-card/70 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <LineChart className="size-4 text-primary" />
            <p className="text-sm font-semibold">Comparison mode · current vs optimized</p>
          </div>
          <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            12-month projection
          </span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-border/50 bg-background/40 p-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Current plan</p>
            <p className="mt-2 text-2xl font-bold text-foreground">
              ₹{forecast.baseline.total.toLocaleString("en-IN")}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              saving ₹{forecast.baseline.monthlySavings.toLocaleString("en-IN")}/month
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/5 p-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-300">Optimized plan</p>
            <p className="mt-2 text-2xl font-bold text-foreground">
              ₹{forecast.improved.total.toLocaleString("en-IN")}
            </p>
            <p className="mt-1 text-xs text-emerald-200">
              That&apos;s ₹{forecast.improved.delta.toLocaleString("en-IN")} extra over 12 months
            </p>
            <p className="mt-1 text-xs text-emerald-200">
              Monthly saving goes from ₹{Math.max(0, forecast.baseline.monthlySavings).toLocaleString("en-IN")} to ₹{Math.max(0, forecast.improved.monthlySavings).toLocaleString("en-IN")}
              {" "}({extraMonthlyFromPlan.toLocaleString("en-IN")} extra per month).
            </p>
            <div className="mt-3 rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
                How to reach this optimized plan
              </p>
              {forecastActions.length > 0 ? (
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {forecastActions.map((a, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="mt-1 size-1 shrink-0 rounded-full bg-emerald-400" />
                      <span>{a.title} (+₹{a.impactMonthly.toLocaleString("en-IN")}/month)</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">
                  Follow the action list below to raise your monthly savings.
                </p>
              )}
            </div>
            <p className="mt-2 text-xs text-emerald-200">
              Suggested SIP amount: {actionSip > 0 ? `₹${actionSip.toLocaleString("en-IN")}/month` : "Start with ₹500/month and increase gradually"}.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-border/60 bg-card/70 p-5">
        <div className="flex items-center gap-2">
          <BarChart3 className="size-4 text-primary" />
          <p className="text-sm font-semibold">Where your money goes</p>
        </div>
        {expenseChartData.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            No expenses captured. Edit your onboarding to add category spend.
          </p>
        ) : (
          <>
            <div className="mt-3 rounded-xl border border-border/50 bg-background/35 p-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Auto-categorized expenses</p>
              <p className="mt-1 text-xs text-muted-foreground">
                We grouped your spend into {expenseChartData.length} categories automatically.
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {expenseChartData.slice(0, 5).map((c) => (
                  <span
                    key={c.name}
                    className="rounded-full border border-border/50 bg-card/60 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground"
                  >
                    {c.name}: ₹{c.value.toLocaleString("en-IN")}
                  </span>
                ))}
              </div>
            </div>
            <div className="mt-4 h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={expenseChartData} layout="vertical" margin={{ top: 4, right: 24, left: 16, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis type="number" tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 11 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fill: "rgba(255,255,255,0.75)", fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{ background: "rgb(8,18,12)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 12 }}
                    formatter={(v) => [`₹${Number(v ?? 0).toLocaleString("en-IN")}`, "Spent"]}
                    cursor={{ fill: "rgba(16,185,129,0.08)" }}
                  />
                  <Bar dataKey="value" radius={[0, 8, 8, 0]} fill="rgb(52,211,153)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>

      <div className="rounded-3xl border border-border/60 bg-card/70 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Brain className="size-4 text-primary" />
            <p className="text-sm font-semibold">How we figured this out</p>
          </div>
          <button
            type="button"
            onClick={() => setShowAgents((v) => !v)}
            className="rounded-full border border-border/60 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground transition hover:text-foreground"
          >
            {showAgents ? "Hide details" : "Show details"}
          </button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Six rule-based checks run on your numbers — savings, debt, risk, goals, investments, and a summary — with no AI guessing.
        </p>
        {showAgents && (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {traces.map((t) => {
            const Icon = AGENT_ICON[t.agent];
            return (
              <div key={t.agent} className="rounded-2xl border border-border/50 bg-background/40 p-4">
                <div className="flex items-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-xl bg-primary/15 text-primary">
                    <Icon className="size-4" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">{t.agent} Agent</p>
                  <span className="inline-flex size-1.5 animate-pulse rounded-full bg-emerald-400" />
                </div>
                <dl className="mt-3 space-y-1.5 text-xs">
                  <div>
                    <dt className="inline font-semibold uppercase tracking-[0.18em] text-muted-foreground">Checked · </dt>
                    <dd className="inline text-foreground">{t.observation}</dd>
                  </div>
                  <div>
                    <dt className="inline font-semibold uppercase tracking-[0.18em] text-muted-foreground">Found · </dt>
                    <dd className="inline text-foreground">{t.analysis}</dd>
                  </div>
                  <div>
                    <dt className="inline font-semibold uppercase tracking-[0.18em] text-primary">Takeaway · </dt>
                    <dd className="inline text-foreground">{t.output}</dd>
                  </div>
                </dl>
                {t.signals.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {t.signals.map((s, i) => (
                      <span
                        key={i}
                        className="rounded-full border border-border/50 bg-card/60 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground"
                      >
                        {s.label}: <span className="text-foreground">{s.value}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        )}
      </div>

      <div id="action-list" className="rounded-3xl border border-border/60 bg-card/70 p-5">
        <div className="flex items-center gap-2">
          <Lightbulb className="size-4 text-primary" />
          <p className="text-sm font-semibold">What you should do — step by step</p>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Each card tells you what's wrong, and exactly how to fix it. Pick one and start with step 1.
        </p>
        <ol className="mt-4 space-y-3">
          {recos.map((r, i) => {
            const Icon = AGENT_ICON[r.agent];
            const SevIcon = r.severity === "risk" ? AlertTriangle : r.severity === "warn" ? ShieldAlert : Info;
            return (
              <li key={i} className={`rounded-2xl border px-4 py-4 text-sm ${AGENT_TONE[r.severity]}`}>
                <div className="flex items-start gap-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-black/20">
                    <span className="text-xs font-bold text-foreground">#{i + 1}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-foreground">{r.title}</p>
                      {r.impactMonthly > 0 && (
                        <span className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
                          saves ₹{r.impactMonthly.toLocaleString("en-IN")}/mo
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs leading-5 opacity-90">{r.detail}</p>
                    {r.howTo && r.howTo.length > 0 && (
                      <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80">
                          How to do it
                        </p>
                        <ol className="mt-2 space-y-1.5 text-xs leading-5 text-foreground/90">
                          {r.howTo.map((step, idx) => (
                            <li key={idx} className="flex gap-2">
                              <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-foreground/15 text-[10px] font-semibold">
                                {idx + 1}
                              </span>
                              <span>{step}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </div>
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-black/15">
                    <SevIcon className="size-4 opacity-70" />
                  </div>
                  <Icon className="hidden" />
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
