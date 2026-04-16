"use client";

import { AlertTriangle, Brain, CreditCard, Info, Lightbulb, ShieldAlert, Sparkles, Target, TrendingUp, Wallet } from "lucide-react";

import { calculateHealthScore, scoreBand } from "@/lib/ai/scoring";
import { generateRecommendations, type Recommendation } from "@/lib/ai/recommendation";
import { goalProbability } from "@/lib/ai/goal";
import { optimizeLoan } from "@/lib/ai/loan";

type Props = {
  income: number;
  expenses: number;
  savings: number;
  debt?: number;
  categoryTotals?: Record<string, number>;
  topGoal?: { title: string; target: number; current?: number; months: number };
  topLoan?: { principal: number; annualRatePct: number; emi: number };
};

const AGENTS = [
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

export function AIInsights({ income, expenses, savings, debt = 0, categoryTotals, topGoal, topLoan }: Props) {
  const score = calculateHealthScore({ income, expenses, savings, debt });
  const band = scoreBand(score);
  const recos = generateRecommendations({ income, expenses, savings, debt, categoryTotals });

  const goalProb = topGoal
    ? goalProbability({
        goalAmount: topGoal.target,
        currentAmount: topGoal.current,
        monthlySavings: Math.max(0, savings),
        months: topGoal.months,
      })
    : null;

  const loanOpt = topLoan ? optimizeLoan(topLoan) : null;

  const toneRing: Record<typeof band.tone, string> = {
    emerald: "from-emerald-500/30 to-emerald-500/0 text-emerald-300",
    amber: "from-amber-500/30 to-amber-500/0 text-amber-300",
    red: "from-red-500/30 to-red-500/0 text-red-300",
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
            <div className={`bg-gradient-to-br ${toneRing[band.tone]} rounded-2xl border border-white/10 px-5 py-3`}>
              <p className="text-4xl font-bold">{score}</p>
              <p className="text-[11px] uppercase tracking-[0.2em] opacity-80">/ 100</p>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{band.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">savings·debt·expense control</p>
            </div>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/5">
            <div
              className={`h-full rounded-full ${
                band.tone === "emerald" ? "bg-emerald-400" : band.tone === "amber" ? "bg-amber-400" : "bg-red-400"
              }`}
              style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
            />
          </div>
        </div>

        <div className="rounded-3xl border border-border/60 bg-card/70 p-5">
          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Goal Success Probability</p>
          {goalProb !== null && topGoal ? (
            <>
              <p className="mt-4 text-4xl font-bold text-foreground">{goalProb}%</p>
              <p className="mt-2 text-xs text-muted-foreground">for "{topGoal.title}"</p>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/5">
                <div className="h-full rounded-full bg-primary" style={{ width: `${goalProb}%` }} />
              </div>
            </>
          ) : (
            <p className="mt-6 text-sm text-muted-foreground">Add a goal to see your projected success rate.</p>
          )}
        </div>

        <div className="rounded-3xl border border-border/60 bg-card/70 p-5">
          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Loan Optimizer</p>
          {loanOpt ? (
            <>
              <p className="mt-4 text-sm text-foreground">
                Bump EMI to <span className="font-semibold text-primary">₹{loanOpt.boostedEmi.toLocaleString("en-IN")}</span>
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Close the loan {Math.round(loanOpt.monthsSaved / 12)} year{loanOpt.monthsSaved >= 24 ? "s" : ""} earlier —
                save ≈ ₹{Math.round(loanOpt.interestSavedApprox).toLocaleString("en-IN")}
              </p>
            </>
          ) : (
            <p className="mt-6 text-sm text-muted-foreground">No active loan. Add one in onboarding to see a payoff plan.</p>
          )}
        </div>
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
        {recos.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            You're doing well — nothing urgent. Upload a fresh statement to refresh agent analysis.
          </p>
        ) : (
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
        )}
      </div>
    </section>
  );
}
