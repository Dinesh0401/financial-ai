"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  BarChart3,
  Brain,
  CreditCard,
  Info,
  Lightbulb,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import {
  calculateGoalProbability,
  calculateHealthScore,
  generateRecommendations,
  loadOnboardingSnapshot,
  optimizeLoan,
  totalDebt,
  totalEmi,
  totalExpenses,
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

const AGENTS: { name: string; icon: typeof Wallet; desc: string }[] = [
  { name: "Expense Agent", icon: Wallet, desc: "analyses spending leaks" },
  { name: "Debt Agent", icon: CreditCard, desc: "builds payoff strategy" },
  { name: "Risk Agent", icon: ShieldAlert, desc: "flags savings & debt risk" },
  { name: "Goal Agent", icon: Target, desc: "predicts goal success" },
  { name: "Investment Agent", icon: TrendingUp, desc: "suggests SIP / gold / funds" },
  { name: "Orchestrator", icon: Brain, desc: "merges all agent outputs" },
];

const AGENT_TONE: Record<Recommendation["severity"], string> = {
  info: "border-sky-400/30 bg-sky-500/10 text-sky-200",
  warn: "border-amber-400/30 bg-amber-500/10 text-amber-200",
  risk: "border-red-400/30 bg-red-500/10 text-red-200",
};

const AGENT_ICON: Record<Recommendation["agent"], typeof Wallet> = {
  Expense: Wallet,
  Debt: CreditCard,
  Risk: ShieldAlert,
  Goal: Target,
  Investment: TrendingUp,
};

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

function snapshotFromFallback(f: NonNullable<Props["fallback"]>): OnboardingSnapshot {
  return {
    income: f.income,
    expenses: f.categoryTotals ?? { other: f.expenses },
    loans: [],
    goals: [],
    savedAt: new Date(0).toISOString(),
  };
}

export function AIInsights({ fallback }: Props) {
  const [snapshot, setSnapshot] = useState<OnboardingSnapshot | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSnapshot(loadOnboardingSnapshot());
    setHydrated(true);
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
          <h2 className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">AI Copilot Insights</h2>
        </div>
        <div className="rounded-3xl border border-dashed border-border/60 bg-card/60 p-6 text-sm text-muted-foreground">
          Complete onboarding to unlock your personalised health score, goal forecast and agent recommendations.{" "}
          <Link href="/onboarding" className="text-primary underline">Start onboarding</Link>
        </div>
      </section>
    );
  }

  const score = calculateHealthScore(data);
  const tone = scoreTone(score);
  const band = bandLabel(score);
  const recos = generateRecommendations(data);
  const expenses = totalExpenses(data.expenses);
  const debt = totalDebt(data.loans);
  const emi = totalEmi(data.loans);
  const monthlySavings = Math.max(0, data.income - expenses - emi);

  const topGoal = data.goals[0];
  const goalProb = topGoal ? calculateGoalProbability(topGoal, monthlySavings) : null;

  const topLoan = data.loans[0];
  const loanOpt = topLoan ? optimizeLoan(topLoan) : null;

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
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-primary" />
        <h2 className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">AI Copilot Insights</h2>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-3xl border border-border/60 bg-card/70 p-5">
          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Financial Health Score</p>
          <div className="mt-4 flex items-end gap-3">
            <div className={`bg-gradient-to-br ${toneRing[tone]} rounded-2xl border border-white/10 px-5 py-3`}>
              <p className="text-4xl font-bold">{score}</p>
              <p className="text-[11px] uppercase tracking-[0.2em] opacity-80">/ 100</p>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{band}</p>
              <p className="mt-1 text-xs text-muted-foreground">savings·debt·expense control</p>
            </div>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/5">
            <div className={`h-full rounded-full ${barColor[tone]}`} style={{ width: `${Math.min(100, Math.max(0, score))}%` }} />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-[11px] text-muted-foreground">
            <div>
              <p className="uppercase tracking-[0.18em]">Income</p>
              <p className="mt-1 text-sm font-semibold text-foreground">₹{data.income.toLocaleString("en-IN")}</p>
            </div>
            <div>
              <p className="uppercase tracking-[0.18em]">Expenses</p>
              <p className="mt-1 text-sm font-semibold text-foreground">₹{expenses.toLocaleString("en-IN")}</p>
            </div>
            <div>
              <p className="uppercase tracking-[0.18em]">Saves</p>
              <p className="mt-1 text-sm font-semibold text-foreground">₹{monthlySavings.toLocaleString("en-IN")}</p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-border/60 bg-card/70 p-5">
          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Goal Success Probability</p>
          {topGoal && goalProb !== null ? (
            <>
              <p className="mt-4 text-4xl font-bold text-foreground">{goalProb}%</p>
              <p className="mt-2 text-xs text-muted-foreground">
                for &quot;{topGoal.name ?? topGoal.type}&quot; · target ₹{topGoal.targetAmount.toLocaleString("en-IN")} in {topGoal.years}y
              </p>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/5">
                <div className="h-full rounded-full bg-primary" style={{ width: `${goalProb}%` }} />
              </div>
              <p className="mt-3 text-[11px] text-muted-foreground">
                At ₹{monthlySavings.toLocaleString("en-IN")}/mo you project ₹{(monthlySavings * topGoal.years * 12).toLocaleString("en-IN")}.
              </p>
            </>
          ) : (
            <p className="mt-6 text-sm text-muted-foreground">Add a goal in onboarding to see a projected success rate.</p>
          )}
        </div>

        <div className="rounded-3xl border border-border/60 bg-card/70 p-5">
          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Loan Optimizer</p>
          {loanOpt && topLoan ? (
            <>
              <p className="mt-4 text-sm text-foreground">
                Bump {topLoan.name ?? topLoan.type} EMI to{" "}
                <span className="font-semibold text-primary">₹{loanOpt.boostedEmi.toLocaleString("en-IN")}</span>
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Close {Math.round(loanOpt.monthsSaved / 12)} year{loanOpt.monthsSaved >= 24 ? "s" : ""} earlier —
                save ≈ ₹{Math.round(loanOpt.interestSavedApprox).toLocaleString("en-IN")}
              </p>
              <p className="mt-3 text-[11px] text-muted-foreground">
                Total debt: ₹{debt.toLocaleString("en-IN")} · Current EMI: ₹{emi.toLocaleString("en-IN")}/mo
              </p>
            </>
          ) : (
            <p className="mt-6 text-sm text-muted-foreground">No active loans. Add one in onboarding to see a payoff plan.</p>
          )}
        </div>
      </div>

      <div className="rounded-3xl border border-border/60 bg-card/70 p-5">
        <div className="flex items-center gap-2">
          <BarChart3 className="size-4 text-primary" />
          <p className="text-sm font-semibold">Where your money goes</p>
        </div>
        {(() => {
          const chartData = Object.entries(data.expenses)
            .map(([k, v]) => ({ name: k.replace(/_/g, " "), value: v }))
            .filter((e) => e.value > 0)
            .sort((a, b) => b.value - a.value);
          if (chartData.length === 0) {
            return (
              <p className="mt-4 text-sm text-muted-foreground">
                No expenses captured. Edit your onboarding to add category spend.
              </p>
            );
          }
          return (
            <div className="mt-4 h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 24, left: 16, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis type="number" tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 11 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fill: "rgba(255,255,255,0.75)", fontSize: 12, textTransform: "capitalize" }} />
                  <Tooltip
                    contentStyle={{ background: "rgb(8,18,12)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 12 }}
                    formatter={(v: number) => [`₹${v.toLocaleString("en-IN")}`, "Spent"]}
                    cursor={{ fill: "rgba(16,185,129,0.08)" }}
                  />
                  <Bar dataKey="value" radius={[0, 8, 8, 0]} fill="rgb(52,211,153)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          );
        })()}
      </div>

      <div className="rounded-3xl border border-border/60 bg-card/70 p-5">
        <div className="flex items-center gap-2">
          <Brain className="size-4 text-primary" />
          <p className="text-sm font-semibold">6 AI agents working on your money</p>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {AGENTS.map(({ name, icon: Icon, desc }) => (
            <div key={name} className="flex items-start gap-3 rounded-2xl border border-border/50 bg-background/40 p-3">
              <div className="flex size-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Icon className="size-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{name}</p>
                  <span className="inline-flex size-1.5 animate-pulse rounded-full bg-emerald-400" />
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-border/60 bg-card/70 p-5">
        <div className="flex items-center gap-2">
          <Lightbulb className="size-4 text-primary" />
          <p className="text-sm font-semibold">Personalised recommendations</p>
        </div>
        <ul className="mt-4 space-y-2">
          {recos.map((r, i) => {
            const Icon = AGENT_ICON[r.agent];
            const SevIcon = r.severity === "risk" ? AlertTriangle : r.severity === "warn" ? ShieldAlert : Info;
            return (
              <li key={i} className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${AGENT_TONE[r.severity]}`}>
                <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-black/20">
                  <Icon className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground">{r.title}</p>
                    <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] opacity-80">
                      {r.agent}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-5 opacity-90">{r.detail}</p>
                </div>
                <SevIcon className="size-4 shrink-0 opacity-70" />
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
