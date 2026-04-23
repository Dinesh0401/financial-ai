"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowDownRight,
  ArrowUpRight,
  Coffee,
  Lightbulb,
  Loader2,
  PartyPopper,
  PiggyBank,
  Shield,
  Sparkles,
  TrendingUp,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboardData, getHealthScore, getTransactionSummary, isAuthenticated } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import type { DashboardData, HealthScoreData, TransactionSummary } from "@/lib/types";

gsap.registerPlugin(useGSAP);

type Mood = {
  emoji: string;
  title: string;
  caption: string;
  tone: "good" | "okay" | "warn";
};

function moodFromScore(score: number): Mood {
  if (score >= 75) return { emoji: "🎯", title: "You're crushing it", caption: "Keep your current rhythm — small tweaks give you outsized wins from here.", tone: "good" };
  if (score >= 55) return { emoji: "🙂", title: "You're on a good path", caption: "A couple of adjustments this month will move you into the strong zone.", tone: "okay" };
  if (score >= 35) return { emoji: "⚠️", title: "There's room to grow", caption: "Focus on one thing at a time — the recommendations below are ordered by impact.", tone: "warn" };
  return { emoji: "🚧", title: "Let's rebuild together", caption: "Start with the top recommendation. Small wins compound fast.", tone: "warn" };
}

type Action = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  why: string;
  impact: string;
};

export default function AnalysisPage() {
  const router = useRouter();
  const [health, setHealth] = useState<HealthScoreData | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [summary, setSummary] = useState<TransactionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const pageRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!pageRef.current) return;
      const cards = pageRef.current.querySelectorAll("[data-animate='card']");
      if (cards.length === 0) return;
      gsap.fromTo(
        Array.from(cards),
        { autoAlpha: 0, y: 24 },
        { autoAlpha: 1, y: 0, duration: 0.55, stagger: 0.08, ease: "power3.out" },
      );
    },
    { scope: pageRef },
  );

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [h, d, s] = await Promise.all([
          getHealthScore().catch(() => null),
          getDashboardData().catch(() => null),
          getTransactionSummary().catch(() => null),
        ]);
        if (cancelled) return;
        setHealth(h);
        setDashboard(d);
        setSummary(s);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Failed to load.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const mood = useMemo(() => moodFromScore(health?.score ?? 0), [health?.score]);

  const overview = dashboard?.monthly_overview;
  const savingsRate = overview && overview.income > 0 ? (overview.savings / overview.income) * 100 : 0;

  // Derive wins and watch-outs from the data
  const wins = useMemo(() => {
    const out: string[] = [];
    if (savingsRate >= 20) out.push(`You saved ${savingsRate.toFixed(0)}% of your income this month — that's above the healthy 20% mark.`);
    if (overview && overview.expenses < overview.income) out.push(`Expenses (${formatCurrency(overview.expenses)}) stayed under your income (${formatCurrency(overview.income)}). Good discipline.`);
    if (health && health.score >= 70) out.push(`Your overall financial health score is ${health.score}/100 — that's strong.`);
    if (summary && summary.recurring_expenses.length > 0) out.push(`We spotted ${summary.recurring_expenses.length} recurring expense${summary.recurring_expenses.length > 1 ? "s" : ""} — great visibility into your fixed costs.`);
    if (out.length === 0) out.push("Keep uploading statements — the AI needs a bit more data to celebrate your wins.");
    return out;
  }, [savingsRate, overview, health, summary]);

  const watchOuts = useMemo(() => {
    const out: string[] = [];
    if (savingsRate < 10 && overview && overview.income > 0) out.push(`Your savings rate is ${savingsRate.toFixed(0)}% — aim for at least 20% to build a real buffer.`);
    if (overview && overview.expenses > overview.income) out.push(`You're spending more than you earn this month. The gap is ${formatCurrency(overview.expenses - overview.income)}.`);
    if (summary && summary.top_merchants[0] && summary.top_merchants[0].total > (overview?.income ?? 0) * 0.2) {
      out.push(`${summary.top_merchants[0].name} took a big chunk — ${formatCurrency(summary.top_merchants[0].total)} across ${summary.top_merchants[0].count} transactions.`);
    }
    if (health && health.score < 55) out.push(`Your health score is ${health.score}/100 — we've got a clear plan to lift it.`);
    return out;
  }, [savingsRate, overview, summary, health]);

  const actions: Action[] = useMemo(() => {
    const list: Action[] = [];
    if (savingsRate < 20) {
      list.push({
        icon: PiggyBank,
        title: "Set a weekly savings auto-transfer",
        why: "Even ₹500/week adds up to ₹26,000 a year and builds your emergency buffer on autopilot.",
        impact: "Raises savings rate by ~5%",
      });
    }
    if (summary && summary.top_merchants[0]) {
      list.push({
        icon: Coffee,
        title: `Review spending at ${summary.top_merchants[0].name}`,
        why: `You spent ${formatCurrency(summary.top_merchants[0].total)} here over ${summary.top_merchants[0].count} visits this month.`,
        impact: "Cut 20% to save meaningfully",
      });
    }
    if (summary && summary.recurring_expenses.length > 0) {
      list.push({
        icon: Shield,
        title: "Audit your recurring expenses",
        why: `You have ${summary.recurring_expenses.length} subscriptions running. Cancel the ones you forgot about.`,
        impact: "Typical savings: ₹500-2000/month",
      });
    }
    list.push({
      icon: TrendingUp,
      title: "Ask Zova for a custom plan",
      why: "She sees your full picture and can answer specific questions about your goals, debt, and spending.",
      impact: "Personalised recommendations in seconds",
    });
    return list.slice(0, 4);
  }, [savingsRate, summary]);

  if (loading) {
    return (
      <AppShell>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      </AppShell>
    );
  }

  if (error && !health && !dashboard) {
    return (
      <AppShell>
        <div className="grid min-h-[60vh] place-items-center">
          <Card className="max-w-lg border-border/60 bg-card/80 backdrop-blur-xl">
            <CardContent className="space-y-3 p-8 text-center">
              <h2 className="text-2xl font-semibold">We can't tell your story yet</h2>
              <p className="text-sm leading-7 text-muted-foreground">
                Upload a bank statement so the AI has something to analyse — then check back here.
              </p>
              <Link href="/transactions">
                <Button>Upload statement</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div ref={pageRef} className="space-y-6">
        {/* Mood hero */}
        <Card
          data-animate="card"
          className={`overflow-hidden border-border/60 bg-card/80 backdrop-blur-xl ${
            mood.tone === "good"
              ? "ring-1 ring-emerald-500/20"
              : mood.tone === "warn"
                ? "ring-1 ring-amber-500/20"
                : "ring-1 ring-primary/20"
          }`}
        >
          <CardHeader className="border-b border-border/50 bg-gradient-to-r from-primary/10 via-transparent to-transparent pb-6">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="text-5xl">{mood.emoji}</div>
                <div className="space-y-2">
                  <Badge variant="outline" className="rounded-full border-primary/25 bg-primary/10 text-[10px] uppercase tracking-[0.24em] text-primary">
                    My Money Story · This Month
                  </Badge>
                  <CardTitle className="text-3xl sm:text-4xl">{mood.title}</CardTitle>
                  <p className="max-w-xl text-sm leading-7 text-muted-foreground">{mood.caption}</p>
                </div>
              </div>
              <div className="flex items-center gap-6 rounded-3xl border border-border/60 bg-background/40 px-6 py-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Health Score</p>
                  <p className="mt-2 text-4xl font-semibold">{health?.score ?? "—"}<span className="text-xl text-muted-foreground">/100</span></p>
                </div>
                {overview && (
                  <div className="border-l border-border/50 pl-6">
                    <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Savings Rate</p>
                    <p className={`mt-2 text-4xl font-semibold ${savingsRate >= 20 ? "text-emerald-400" : savingsRate >= 10 ? "text-amber-300" : "text-red-400"}`}>
                      {savingsRate.toFixed(0)}%
                    </p>
                  </div>
                )}
              </div>
            </div>
          </CardHeader>

          {overview && (
            <CardContent className="grid gap-4 p-5 sm:grid-cols-3">
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                <div className="flex items-center gap-2 text-emerald-300">
                  <ArrowUpRight className="size-4" />
                  <p className="text-xs uppercase tracking-[0.18em]">You earned</p>
                </div>
                <p className="mt-3 text-2xl font-semibold">{formatCurrency(overview.income)}</p>
              </div>
              <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4">
                <div className="flex items-center gap-2 text-red-300">
                  <ArrowDownRight className="size-4" />
                  <p className="text-xs uppercase tracking-[0.18em]">You spent</p>
                </div>
                <p className="mt-3 text-2xl font-semibold">{formatCurrency(overview.expenses)}</p>
              </div>
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                <div className="flex items-center gap-2 text-primary">
                  <Wallet className="size-4" />
                  <p className="text-xs uppercase tracking-[0.18em]">You kept</p>
                </div>
                <p className="mt-3 text-2xl font-semibold">{formatCurrency(overview.savings)}</p>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Wins + Watch-outs */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card data-animate="card" className="border-emerald-500/20 bg-emerald-500/[0.04] backdrop-blur-xl">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-xl">
                <PartyPopper className="size-5 text-emerald-400" />
                Your wins
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {wins.map((w, i) => (
                <div key={i} className="flex items-start gap-3 rounded-2xl border border-emerald-500/15 bg-background/30 p-3">
                  <span className="text-emerald-400">✓</span>
                  <p className="text-sm leading-7 text-foreground/90">{w}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card data-animate="card" className="border-amber-500/20 bg-amber-500/[0.04] backdrop-blur-xl">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-xl">
                <TriangleAlert className="size-5 text-amber-300" />
                Things to watch
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {watchOuts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No red flags this month. Nice.</p>
              ) : (
                watchOuts.map((w, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-background/30 p-3">
                    <span className="text-amber-300">!</span>
                    <p className="text-sm leading-7 text-foreground/90">{w}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Action plan */}
        <Card data-animate="card" className="border-border/60 bg-card/80 backdrop-blur-xl">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Lightbulb className="size-5 text-primary" />
                Your action plan this week
              </CardTitle>
              <Link href="/chat">
                <Button variant="outline" size="sm">
                  <Sparkles className="mr-2 size-4" />
                  Ask Zova
                </Button>
              </Link>
            </div>
            <p className="text-sm text-muted-foreground">
              Start with the first one. Small, specific steps beat big vague goals.
            </p>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {actions.map((action, i) => {
              const Icon = action.icon;
              return (
                <div
                  key={i}
                  className="group relative overflow-hidden rounded-3xl border border-border/50 bg-background/30 p-5 transition hover:border-primary/40"
                >
                  <div className="absolute right-4 top-4 text-xs font-semibold text-primary/50">
                    #{i + 1}
                  </div>
                  <div className="flex size-10 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </div>
                  <h3 className="mt-3 text-base font-semibold">{action.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">{action.why}</p>
                  <p className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
                    <TrendingUp className="size-3.5" />
                    {action.impact}
                  </p>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Where your money went (simple narrative) */}
        {summary && summary.top_merchants.length > 0 && (
          <Card data-animate="card" className="border-border/60 bg-card/80 backdrop-blur-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-2xl">Where your money went</CardTitle>
              <p className="text-sm text-muted-foreground">Your top 5 merchants this month.</p>
            </CardHeader>
            <CardContent className="space-y-2">
              {summary.top_merchants.slice(0, 5).map((m, i) => {
                const maxSpend = summary.top_merchants[0].total;
                const width = Math.max(8, (m.total / maxSpend) * 100);
                return (
                  <div key={m.name} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">#{i + 1}</span>
                        <span>{m.name}</span>
                        <span className="text-xs text-muted-foreground">· {m.count} visits</span>
                      </span>
                      <span className="font-medium">{formatCurrency(m.total)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/5">
                      <div className="h-full rounded-full bg-primary/70" style={{ width: `${width}%` }} />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
