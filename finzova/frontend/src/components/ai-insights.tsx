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
          <h2 className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">Zoya&apos;s take</h2>
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <h2 className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">Zoya&apos;s take</h2>
        </div>
        {lastUpdated && (
          <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Last updated · {lastUpdated}
          </span>
        )}
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
              <p className="mt-1 text-xs text-muted-foreground capitalize">{breakdown.riskLevel.replace("_", " ")}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {breakdown.percentileVsPeers}th percentile vs peers
              </p>
            </div>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/5">
            <div className={`h-full rounded-full ${barColor[tone]}`} style={{ width: `${Math.min(100, Math.max(0, score))}%` }} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {SUBSCORE_LABELS.map(({ key, label }) => {
              const v = breakdown.subScores[key];
              const w = breakdown.weights[key];
              return (
                <div key={key} className="rounded-xl border border-border/50 bg-background/40 px-3 py-2">
                  <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    <span>{label}</span>
                    <span className="opacity-70">·w {w}</span>
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
          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Goal success chance</p>
          {topGoal ? (
            goalProb !== null ? (
              (() => {
                const needed = Math.ceil(topGoal.targetAmount / (topGoal.years * 12));
                const shortfall = Math.max(0, needed - monthlySavings);
                return (
                  <>
                    <p className="mt-4 text-4xl font-bold text-foreground">{goalProb}%</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      for &quot;{topGoal.name ?? topGoal.type}&quot; · need ₹{topGoal.targetAmount.toLocaleString("en-IN")} in {topGoal.years} year{topGoal.years === 1 ? "" : "s"}
                    </p>
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/5">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${goalProb}%` }} />
                    </div>
                    <p className="mt-3 text-[11px] text-muted-foreground">
                      {shortfall > 0
                        ? `Save ₹${needed.toLocaleString("en-IN")}/mo to hit it (you're short by ₹${shortfall.toLocaleString("en-IN")}/mo today).`
                        : `You're on track — keep saving ₹${monthlySavings.toLocaleString("en-IN")}/mo.`}
                    </p>
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

      <div className="rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card/80 to-card/60 p-5 shadow-[0_0_40px_-20px_rgba(16,185,129,0.5)]">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Zoya says</p>
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
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">Suggested actions</p>
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
            <p className="text-sm font-semibold">12-month savings forecast</p>
          </div>
          <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            assumes your spending stays the same
          </span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-border/50 bg-background/40 p-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Baseline (no change)</p>
            <p className="mt-2 text-2xl font-bold text-foreground">
              ₹{forecast.baseline.total.toLocaleString("en-IN")}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              at ₹{forecast.baseline.monthlySavings.toLocaleString("en-IN")}/mo surplus
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/5 p-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-300">If you act on top actions</p>
            <p className="mt-2 text-2xl font-bold text-foreground">
              ₹{forecast.improved.total.toLocaleString("en-IN")}
            </p>
            <p className="mt-1 text-xs text-emerald-200">
              +₹{forecast.improved.delta.toLocaleString("en-IN")} over 12 months
            </p>
            {forecast.improved.unlockedActions.length > 0 && (
              <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                {forecast.improved.unlockedActions.map((a, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-1 size-1 shrink-0 rounded-full bg-emerald-400" />
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
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
          );
        })()}
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
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-foreground">{r.title}</p>
                    <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] opacity-80">
                      {r.agent}
                    </span>
                    {r.impactMonthly > 0 && (
                      <span className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
                        saves ₹{r.impactMonthly.toLocaleString("en-IN")}/mo
                      </span>
                    )}
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
