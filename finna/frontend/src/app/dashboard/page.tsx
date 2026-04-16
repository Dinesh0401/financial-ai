"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Brain, Loader2, Network } from "lucide-react";
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
import { clearSession, isAuthenticated } from "@/lib/auth";
import type { DashboardData, HealthScoreData, UserProfile } from "@/lib/types";

gsap.registerPlugin(useGSAP);

type DashboardState = {
  dashboard: DashboardData | null;
  health: HealthScoreData | null;
  profile: UserProfile | null;
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
        const [dashboard, health, profile] = await Promise.all([
          getDashboardData(),
          getHealthScore(),
          getCurrentUser(),
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
                <h2 className="text-2xl font-semibold">Live dashboard unavailable</h2>
                <p className="text-sm leading-7 text-muted-foreground">
                  {state.error ?? "The backend did not return your live financial data."}
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-3">
                <Button onClick={() => router.refresh()}>Retry</Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    clearSession();
                    router.replace("/login");
                  }}
                >
                  Sign in again
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
  const liveLabel = profile.onboarding_done ? "Live data connected" : "Live data connected, profile needs completion";

  return (
    <AppShell>
      <div ref={pageRef} className="space-y-6">
        <div data-animate="status" className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-muted-foreground">{liveLabel}</span>
          </div>
          <div className="hidden items-center gap-1.5 sm:flex">
            <Network className="size-3.5 text-primary" />
            <span className="text-[10px] uppercase tracking-wider text-primary">Agents Active</span>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
          <Card data-animate="hero" className="grid-stripes border-border/60 bg-card/70 backdrop-blur-xl">
            <CardContent className="grid gap-8 p-6 xl:grid-cols-[minmax(0,1fr)_220px]">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Brain className="size-4 text-primary" />
                  <p className="text-xs uppercase tracking-[0.3em] text-primary">AI-Powered Dashboard</p>
                </div>
                <h2 data-animate="hero-heading" className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                  {profile.name ? `${profile.name}, here is your live financial intelligence.` : "Your live financial intelligence."}
                </h2>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">
                  Real backend data only. No mock values, no fake fallback numbers, just your authenticated financial profile and analysis.
                </p>
                <div className="mt-6 flex flex-col gap-2">
                  {dashboard.quick_insights.length > 0 ? (
                    dashboard.quick_insights.map((insight) => (
                      <Badge
                        key={insight}
                        data-animate="badge"
                        variant="outline"
                        className="w-full justify-start whitespace-normal break-words rounded-2xl border-primary/30 bg-primary/10 px-3 py-2 text-left text-xs leading-5 text-primary"
                      >
                        {insight}
                      </Badge>
                    ))
                  ) : (
                    <Badge
                      data-animate="badge"
                      variant="outline"
                      className="w-full justify-start whitespace-normal break-words rounded-2xl border-border/60 bg-background/30 px-3 py-2 text-left text-xs leading-5 text-muted-foreground"
                    >
                      Add transactions to unlock live insights.
                    </Badge>
                  )}
                </div>
              </div>
              <div data-animate="gauge" className="flex min-h-[220px] items-center justify-center xl:justify-end">
                <HealthGauge score={health.score} />
              </div>
            </CardContent>
          </Card>

          <Card data-animate="profile" className="h-fit border-border/60 bg-card/80 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-xl">Profile intake</CardTitle>
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
          <CardHeader>
            <CardTitle className="text-xl">Spending mix</CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(dashboard.spending_breakdown).length > 0 ? (
              <SpendingBreakdown data={dashboard.spending_breakdown} />
            ) : (
              <div className="rounded-3xl border border-dashed border-border/60 bg-background/25 p-8 text-center text-sm text-muted-foreground">
                No spending categories yet.
              </div>
            )}
          </CardContent>
        </Card>

        <AIInsights
          income={dashboard.monthly_overview.income}
          expenses={dashboard.monthly_overview.expenses}
          savings={dashboard.monthly_overview.savings}
          categoryTotals={dashboard.spending_breakdown}
        />
      </div>
    </AppShell>
  );
}
