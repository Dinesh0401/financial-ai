"use client";

import { useState } from "react";
import { Brain, CheckCircle2, CircleDot, CreditCard, ShieldAlert, Target, TrendingUp, Wallet, XCircle } from "lucide-react";

import {
  calculateHealthBreakdown,
  generateAgentTraces,
  generateAiSummary,
  totalEmi,
  totalExpenses,
  type AgentTrace,
  type OnboardingSnapshot,
} from "@/lib/ai/engine";

const AGENT_ICON: Record<AgentTrace["agent"], typeof Wallet> = {
  Expense: Wallet,
  Debt: CreditCard,
  Risk: ShieldAlert,
  Goal: Target,
  Investment: TrendingUp,
  Orchestrator: Brain,
};

const VERDICT_ICON = {
  good: CheckCircle2,
  watch: CircleDot,
  bad: XCircle,
} as const;

const VERDICT_TONE = {
  good: "text-emerald-300",
  watch: "text-amber-300",
  bad: "text-red-300",
} as const;

const SUBSCORE_LABELS: Array<{ key: "savings" | "debt" | "expense" | "liquidity"; label: string; hint: string }> = [
  { key: "savings", label: "How much you save", hint: "After bills + EMIs each month" },
  { key: "debt", label: "EMI load", hint: "Share of income going to loans" },
  { key: "expense", label: "How much you spend", hint: "Spending vs what you earn" },
  { key: "liquidity", label: "Safety net", hint: "Cushion if income stops" },
];

function bandLabel(score: number): { label: string; tone: "good" | "okay" | "warn" } {
  if (score >= 75) return { label: "Strong", tone: "good" };
  if (score >= 55) return { label: "Improving", tone: "okay" };
  if (score >= 35) return { label: "Needs attention", tone: "warn" };
  return { label: "At risk", tone: "warn" };
}

function subBarColor(score: number): string {
  if (score >= 75) return "bg-emerald-400";
  if (score >= 50) return "bg-amber-400";
  return "bg-red-400";
}

export function HealthStep({ snapshot }: { snapshot: OnboardingSnapshot }) {
  const breakdown = calculateHealthBreakdown(snapshot);
  const summary = generateAiSummary(snapshot);
  const traces = generateAgentTraces(snapshot);
  const [showAgents, setShowAgents] = useState(false);
  const score = breakdown.overall;
  const band = bandLabel(score);
  const expenses = totalExpenses(snapshot.expenses);
  const emi = totalEmi(snapshot.loans);
  const savings = Math.max(0, snapshot.income - expenses - emi);

  const heroTone =
    band.tone === "good"
      ? "from-emerald-500/15 via-emerald-500/5 to-transparent ring-emerald-400/30"
      : band.tone === "warn"
        ? "from-red-500/15 via-amber-500/5 to-transparent ring-amber-400/30"
        : "from-primary/15 via-primary/5 to-transparent ring-primary/30";

  return (
    <section className="space-y-5">
      <div
        className={`overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br p-6 ring-1 ${heroTone}`}
      >
        <p className="text-[11px] uppercase tracking-[0.28em] text-primary">Page 1 · Your money health</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-[2.2rem]">
          {band.tone === "good"
            ? "You're doing well — let's keep it that way."
            : band.tone === "okay"
              ? "You're on a good path — small tweaks ahead."
              : "There's room to grow — start with the top fix."}
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
          {summary.headline}
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
          <div className="rounded-3xl border border-white/10 bg-background/40 px-6 py-5 text-center">
            <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Your money score</p>
            <p className="mt-2 text-5xl font-bold text-foreground">{score}</p>
            <p className="text-xs text-muted-foreground">/ 100</p>
            <p className="mt-2 text-sm font-medium text-foreground">{band.label}</p>
          </div>
          <div className="rounded-3xl border border-border/50 bg-background/30 p-4">
            <p className="text-xs text-muted-foreground">
              You&apos;re doing better than{" "}
              <span className="font-semibold text-foreground">
                {breakdown.percentileVsPeers} out of 100
              </span>{" "}
              people earning around the same as you. Here&apos;s how the score breaks down:
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {SUBSCORE_LABELS.map(({ key, label, hint }) => {
                const v = breakdown.subScores[key];
                return (
                  <div key={key} className="rounded-xl border border-border/40 bg-background/40 px-3 py-2">
                    <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                      <span>{label}</span>
                      <span className="text-foreground">{v}/100</span>
                    </div>
                    <p className="mt-1 text-[10px] text-muted-foreground">{hint}</p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/5">
                      <div
                        className={`h-full rounded-full ${subBarColor(v)}`}
                        style={{ width: `${Math.min(100, Math.max(4, v))}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/5 p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-300">You earn</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            ₹{snapshot.income.toLocaleString("en-IN")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">per month</p>
        </div>
        <div className="rounded-2xl border border-rose-400/25 bg-rose-500/5 p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-rose-300">You spend</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            ₹{(expenses + emi).toLocaleString("en-IN")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">incl. EMIs</p>
        </div>
        <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-primary">You save</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            ₹{savings.toLocaleString("en-IN")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {snapshot.income > 0
              ? `${Math.round((savings / snapshot.income) * 100)}% of income`
              : "after everything"}
          </p>
        </div>
      </div>

      <div className="rounded-3xl border border-border/60 bg-card/70 p-5 backdrop-blur-xl">
        <p className="text-sm font-semibold text-foreground">What this means</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Five quick checks on your numbers. Green is good, amber needs a look, red needs action.
        </p>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {summary.diagnostics.map((d, i) => {
            const Icon = VERDICT_ICON[d.verdict];
            return (
              <li
                key={i}
                className="flex items-start gap-2 rounded-2xl border border-border/50 bg-background/40 px-3 py-3"
              >
                <Icon className={`mt-0.5 size-4 shrink-0 ${VERDICT_TONE[d.verdict]}`} />
                <div className="min-w-0">
                  <p className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${VERDICT_TONE[d.verdict]}`}>
                    {d.label}
                  </p>
                  <p className="mt-0.5 text-sm leading-6 text-foreground">{d.value}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="rounded-3xl border border-border/60 bg-card/70 p-5 backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Brain className="size-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">Agentic AI · how we figured this out</p>
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
          Six rule-based AI agents looked at your numbers — Expense, Debt, Risk, Goal, Investment, and an Orchestrator that combines them. No guessing, just math on your data.
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
                  </div>
                  <dl className="mt-3 space-y-1.5 text-xs">
                    <div>
                      <dt className="inline font-semibold uppercase tracking-[0.18em] text-muted-foreground">Saw · </dt>
                      <dd className="inline text-foreground">{t.observation}</dd>
                    </div>
                    <div>
                      <dt className="inline font-semibold uppercase tracking-[0.18em] text-muted-foreground">Thought · </dt>
                      <dd className="inline text-foreground">{t.analysis}</dd>
                    </div>
                    <div>
                      <dt className="inline font-semibold uppercase tracking-[0.18em] text-primary">Said · </dt>
                      <dd className="inline text-foreground">{t.output}</dd>
                    </div>
                  </dl>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
