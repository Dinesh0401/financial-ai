"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Loader2, PencilLine, PiggyBank, Sparkles } from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

import { AppShell } from "@/components/app-shell";
import { AIInsights } from "@/components/ai-insights";
import { HealthGauge } from "@/components/health-gauge";
import { SpendingBreakdown } from "@/components/spending-breakdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getCurrentUser, getDashboardData, getHealthScore, updateCurrentUser } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";
import type { DashboardData, HealthScoreData, UserProfile } from "@/lib/types";
import {
  calculateHealthBreakdown,
  fetchOnboardingSnapshot,
  totalEmi,
  totalExpenses,
  type OnboardingSnapshot,
} from "@/lib/ai/engine";

gsap.registerPlugin(useGSAP);

type DashboardState = {
  dashboard: DashboardData | null;
  health: HealthScoreData | null;
  profile: UserProfile | null;
  snapshot: OnboardingSnapshot | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  saveError: string | null;
  saveSuccess: string | null;
};

const EMPTY_STATE: DashboardState = {
  dashboard: null,
  health: null,
  profile: null,
  snapshot: null,
  loading: true,
  saving: false,
  error: null,
  saveError: null,
  saveSuccess: null,
};

export default function DashboardPage() {
  const router = useRouter();
  const [state, setState] = useState<DashboardState>(EMPTY_STATE);
  const [monthlyIncome, setMonthlyIncome] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [taxRegime, setTaxRegime] = useState<"old" | "new">("new");
  const [onboardingDone, setOnboardingDone] = useState(false);
  const pageRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!pageRef.current) return;

      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      const statusBar = pageRef.current.querySelector("[data-animate='status']");
      if (statusBar) {
        tl.fromTo(statusBar, { autoAlpha: 0, y: -12 }, { autoAlpha: 1, y: 0, duration: 0.4 });
      }

      const heroCard = pageRef.current.querySelector("[data-animate='hero']");
      if (heroCard) {
        tl.fromTo(heroCard, { autoAlpha: 0, y: 30, scale: 0.98 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.7 }, "-=0.2");
      }

      const heading = pageRef.current.querySelector("[data-animate='hero-heading']");
      if (heading) {
        tl.fromTo(heading, { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.5 }, "-=0.4");
      }

      const gauge = pageRef.current.querySelector("[data-animate='gauge']");
      if (gauge) {
        tl.fromTo(gauge, { autoAlpha: 0, scale: 0.8, rotation: -8 }, { autoAlpha: 1, scale: 1, rotation: 0, duration: 0.8, ease: "back.out(1.5)" }, "-=0.4");
      }

      const profileCard = pageRef.current.querySelector("[data-animate='profile']");
      if (profileCard) {
        tl.fromTo(profileCard, { autoAlpha: 0, x: 30 }, { autoAlpha: 1, x: 0, duration: 0.6 }, "-=0.5");
      }

      const badges = pageRef.current.querySelectorAll("[data-animate='badge']");
      if (badges.length > 0) {
        tl.fromTo(Array.from(badges), { autoAlpha: 0, scale: 0.85 }, { autoAlpha: 1, scale: 1, duration: 0.35, stagger: 0.05 }, "-=0.3");
      }

      const spendingCard = pageRef.current.querySelector("[data-animate='spending']");
      if (spendingCard) {
        tl.fromTo(spendingCard, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.6 }, "-=0.3");
      }
    },
    { scope: pageRef },
  );

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const [dashboard, health, profile, snapshot] = await Promise.all([
          getDashboardData(),
          getHealthScore(),
          getCurrentUser(),
          fetchOnboardingSnapshot().catch(() => null),
        ]);

        if (cancelled) return;

        if (!profile.onboarding_done) {
          router.replace("/onboarding");
          return;
        }

        setState({
          dashboard,
          health,
          profile,
          snapshot,
          loading: false,
          saving: false,
          error: null,
          saveError: null,
          saveSuccess: null,
        });
        setDisplayName(profile.name ?? "");
        setMonthlyIncome(profile.monthly_income == null ? "" : String(profile.monthly_income));
        setTaxRegime(profile.tax_regime);
        setOnboardingDone(profile.onboarding_done);
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "Failed to load dashboard data.";
        setState((current) => ({
          ...current,
          loading: false,
          error: message,
        }));
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSaveProfile() {
    setState((current) => ({ ...current, saving: true, saveError: null, saveSuccess: null }));
    try {
      const updated = await updateCurrentUser({
        name: displayName.trim() || undefined,
        monthly_income: monthlyIncome.trim() ? Number(monthlyIncome) : null,
        tax_regime: taxRegime,
        onboarding_done: onboardingDone,
      });
      setState((current) => ({
        ...current,
        profile: updated,
        saving: false,
        saveSuccess: "Profile updated.",
      }));
      setDisplayName(updated.name ?? "");
      setMonthlyIncome(updated.monthly_income == null ? "" : String(updated.monthly_income));
      setTaxRegime(updated.tax_regime);
      setOnboardingDone(updated.onboarding_done);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update profile.";
      setState((current) => ({ ...current, saving: false, saveError: message }));
    }
  }

  if (state.loading) {
    return (
      <AppShell>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="space-y-4 text-center">
            <Loader2 className="mx-auto size-8 animate-spin text-primary" />
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Loading your live financial dashboard...</p>
              <p className="text-xs text-muted-foreground">Fetching your profile, analysis, and transaction summary.</p>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  if (state.error || !state.dashboard || !state.health || !state.profile) {
    return (
      <AppShell>
        <div className="grid min-h-[60vh] place-items-center">
          <Card className="max-w-xl border-border/60 bg-card/80 backdrop-blur-xl">
            <CardContent className="space-y-4 p-8 text-center">
              <AlertTriangle className="mx-auto size-8 text-primary" />
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold">Couldn&apos;t load your dashboard</h2>
                <p className="text-sm leading-7 text-muted-foreground">
                  {state.error ?? "We hit a snag pulling your latest data. Try reloading — your session is still active."}
                </p>
              </div>
              <div className="flex justify-center gap-2">
                <Button onClick={() => window.location.reload()}>
                  Try again
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    );
  }

  const dashboard = state.dashboard;
  const health = state.health;
  const profile = state.profile;
  const snapshot = state.snapshot;
  const liveLabel = profile.onboarding_done ? "Your data is saved" : "Finish setup to see everything";

  const snapshotHealth = snapshot ? calculateHealthBreakdown(snapshot) : null;
  const hasSnapshot = snapshot !== null && snapshot.income > 0;

  const incomeAmt = hasSnapshot ? snapshot!.income : dashboard.monthly_overview.income;
  const expenseAmt = hasSnapshot
    ? totalExpenses(snapshot!.expenses) + totalEmi(snapshot!.loans)
    : dashboard.monthly_overview.expenses;
  const savingsAmt = hasSnapshot
    ? Math.max(0, incomeAmt - expenseAmt)
    : dashboard.monthly_overview.savings;
  const savingsPct = incomeAmt > 0 ? Math.round((savingsAmt / incomeAmt) * 100) : 0;
  const healthScore = snapshotHealth ? snapshotHealth.overall : health.score;
  const spendingBreakdown = hasSnapshot
    ? { ...snapshot!.expenses, ...(totalEmi(snapshot!.loans) > 0 ? { emi_loan: totalEmi(snapshot!.loans) } : {}) }
    : dashboard.spending_breakdown;
  const firstName = profile.name?.split(" ")[0] ?? null;

  return (
    <AppShell>
      <div ref={pageRef} className="space-y-6">
        <div data-animate="status" className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="relative inline-flex size-2">
              <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/60" />
              <span className="relative size-2 rounded-full bg-emerald-400" />
            </span>
            <span className="text-xs text-muted-foreground">{liveLabel}</span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/onboarding?edit=1"
              className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-primary transition hover:bg-primary/20"
            >
              <PencilLine className="size-3.5" />
              Edit financial data
            </Link>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
          <Card data-animate="hero" className="relative overflow-hidden border-border/60 bg-card/70 backdrop-blur-xl">
            <div className="pointer-events-none absolute -right-16 -top-16 size-72 rounded-full bg-primary/15 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -left-10 size-72 rounded-full bg-emerald-400/10 blur-3xl" />
            <CardContent className="relative grid gap-8 p-6 xl:grid-cols-[minmax(0,1fr)_240px]">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-primary" />
                  <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-primary">Financial Copilot</p>
                </div>
                <h2 data-animate="hero-heading" className="mt-4 text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-[2.35rem]">
                  {firstName ? (
                    <>Hey <span className="bg-gradient-to-r from-primary to-emerald-300 bg-clip-text text-transparent">{firstName}</span>, here&apos;s your money in one glance.</>
                  ) : (
                    <>Your money in one glance.</>
                  )}
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
                  This is the income, spends and loans you entered during setup. Scroll down for a full picture and simple tips.
                </p>
                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-border/50 bg-background/40 p-3">
                    <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                      <ArrowUpRight className="size-3.5 text-emerald-300" /> Income
                    </div>
                    <p className="mt-2 text-lg font-semibold text-foreground">₹{incomeAmt.toLocaleString("en-IN")}</p>
                  </div>
                  <div className="rounded-2xl border border-border/50 bg-background/40 p-3">
                    <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                      <ArrowDownRight className="size-3.5 text-rose-300" /> Expenses
                    </div>
                    <p className="mt-2 text-lg font-semibold text-foreground">₹{expenseAmt.toLocaleString("en-IN")}</p>
                  </div>
                  <div className="rounded-2xl border border-primary/30 bg-primary/10 p-3">
                    <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-primary">
                      <PiggyBank className="size-3.5" /> Saves · {savingsPct}%
                    </div>
                    <p className="mt-2 text-lg font-semibold text-foreground">₹{savingsAmt.toLocaleString("en-IN")}</p>
                  </div>
                </div>
                {dashboard.quick_insights.length > 0 && (
                  <div className="mt-5 flex flex-col gap-2">
                    {dashboard.quick_insights.map((insight) => (
                      <Badge
                        key={insight}
                        data-animate="badge"
                        variant="outline"
                        className="w-full justify-start whitespace-normal break-words rounded-2xl border-primary/30 bg-primary/10 px-3 py-2 text-left text-xs leading-5 text-primary"
                      >
                        {insight}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <div data-animate="gauge" className="flex min-h-[220px] items-center justify-center xl:justify-end">
                <HealthGauge score={healthScore} />
              </div>
            </CardContent>
          </Card>

          <Card data-animate="profile" className="h-fit border-border/60 bg-card/80 backdrop-blur-xl">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <PencilLine className="size-4 text-primary" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-primary">Profile</p>
              </div>
              <CardTitle className="mt-1 text-lg">Quick details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="display-name">Name</Label>
                <Input id="display-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Your name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="monthly-income">Monthly income</Label>
                <Input
                  id="monthly-income"
                  type="number"
                  min="0"
                  step="1"
                  value={monthlyIncome}
                  onChange={(event) => setMonthlyIncome(event.target.value)}
                  placeholder="Monthly income in INR"
                />
              </div>
              <div className="space-y-2">
                <Label>Tax regime</Label>
                <p className="text-[11px] leading-5 text-muted-foreground">
                  India has two tax systems. <span className="text-foreground">New regime</span> uses lower slab rates but most
                  deductions (80C, HRA, insurance) are not allowed. <span className="text-foreground">Old regime</span> has
                  higher slabs but lets you claim those deductions. Pick the one your employer uses for TDS.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {(["new", "old"] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setTaxRegime(option)}
                      className={`rounded-2xl border px-3 py-2 text-sm transition ${
                        taxRegime === option
                          ? "border-primary/40 bg-primary/15 text-foreground"
                          : "border-border/60 bg-background/30 text-muted-foreground"
                      }`}
                    >
                      {option === "new" ? "New regime" : "Old regime"}
                    </button>
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-3 rounded-2xl border border-border/60 bg-background/30 px-3 py-3 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={onboardingDone}
                  onChange={(event) => setOnboardingDone(event.target.checked)}
                  className="size-4 rounded border-border bg-transparent"
                />
                Mark onboarding complete
              </label>
              {state.saveError ? (
                <p className="text-sm text-red-300">{state.saveError}</p>
              ) : state.saveSuccess ? (
                <p className="text-sm text-emerald-300">{state.saveSuccess}</p>
              ) : null}
              <Button className="w-full" onClick={handleSaveProfile} disabled={state.saving}>
                {state.saving ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Saving profile
                  </>
                ) : (
                  "Save profile"
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card data-animate="spending" className="border-border/60 bg-card/80 backdrop-blur-xl">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <ArrowDownRight className="size-4 text-primary" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-primary">Spending</p>
            </div>
            <CardTitle className="mt-1 text-lg">Where your money flows</CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(spendingBreakdown).length > 0 ? (
              <SpendingBreakdown data={spendingBreakdown} />
            ) : (
              <div className="rounded-3xl border border-dashed border-border/60 bg-background/25 p-8 text-center text-sm text-muted-foreground">
                No spending categories yet — add them in onboarding.
              </div>
            )}
          </CardContent>
        </Card>

        <AIInsights
          fallback={{
            income: incomeAmt,
            expenses: expenseAmt,
            savings: savingsAmt,
            categoryTotals: spendingBreakdown,
          }}
        />
      </div>
    </AppShell>
  );
}
