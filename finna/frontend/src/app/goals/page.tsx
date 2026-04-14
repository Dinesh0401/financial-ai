"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Plus, RefreshCw, Target } from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

import { AppShell } from "@/components/app-shell";

gsap.registerPlugin(useGSAP);
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatPercent } from "@/lib/format";
import { API_BASE_URL, createGoal, getGoalPrediction, getGoals, isAuthenticated } from "@/lib/api";
import type { GoalPrediction } from "@/lib/types";

const GOAL_TYPES = [
  { value: "emergency_fund", label: "Emergency Fund" },
  { value: "vehicle", label: "Vehicle" },
  { value: "home", label: "Home" },
  { value: "education", label: "Education" },
  { value: "retirement", label: "Retirement" },
  { value: "vacation", label: "Vacation" },
  { value: "wedding", label: "Wedding" },
  { value: "investment", label: "Investment" },
  { value: "debt_payoff", label: "Debt Payoff" },
  { value: "custom", label: "Custom" },
];

type NewGoalForm = {
  goal_type: string;
  title: string;
  target_amount: string;
  timeline_months: string;
  current_amount: string;
};

const emptyForm: NewGoalForm = {
  goal_type: "emergency_fund",
  title: "",
  target_amount: "",
  timeline_months: "12",
  current_amount: "0",
};

function formatBackendError(error: string) {
  if (error.toLowerCase().includes("failed to fetch")) {
    return `Could not reach the backend at ${API_BASE_URL}. Check that the API is running, then retry.`;
  }
  return error;
}

export default function GoalsPage() {
  const router = useRouter();
  const [goals, setGoals] = useState<GoalPrediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<NewGoalForm>(emptyForm);
  const [creating, setCreating] = useState(false);
  const [createMessage, setCreateMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof NewGoalForm, string>>>({});

  function updateField<K extends keyof NewGoalForm>(key: K, rawValue: string) {
    let value = rawValue;
    let err = "";

    if (key === "target_amount" || key === "current_amount" || key === "timeline_months") {
      // Only allow digits and one decimal point
      const hadInvalid = /[^0-9.]/.test(rawValue) || (rawValue.match(/\./g)?.length ?? 0) > 1;
      value = rawValue.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");
      if (hadInvalid) err = "Numbers only";
      else if (value && Number(value) <= 0 && key !== "current_amount") err = "Must be greater than 0";
    }

    if (key === "title" && rawValue.length > 0 && rawValue.trim().length === 0) {
      err = "Title cannot be empty";
    }

    setFieldErrors((current) => ({ ...current, [key]: err }));
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function loadGoals() {
    setLoading(true);
    setError("");
    try {
      const liveGoals = await getGoals();
      const goalsWithIds = liveGoals.filter((goal): goal is typeof goal & { goal_id: string } => Boolean(goal.goal_id));
      const predictions =
        goalsWithIds.length === 0
          ? []
          : await Promise.all(goalsWithIds.map((goal) => getGoalPrediction(goal.goal_id)));
      setGoals(predictions);
    } catch (loadError) {
      setError(formatBackendError(loadError instanceof Error ? loadError.message : "Failed to load goals."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }
    loadGoals();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreateGoal(event: React.FormEvent) {
    event.preventDefault();
    setCreating(true);
    setError("");
    setCreateMessage("");

    try {
      const targetAmount = Number(form.target_amount);
      const timelineMonths = Number(form.timeline_months);
      const currentAmount = Number(form.current_amount) || 0;

      if (!form.title.trim()) throw new Error("Title is required.");
      if (!Number.isFinite(targetAmount) || targetAmount <= 0) throw new Error("Target amount must be a positive number.");
      if (!Number.isFinite(timelineMonths) || timelineMonths < 1) throw new Error("Timeline must be at least 1 month.");

      const result = await createGoal({
        goal_type: form.goal_type,
        title: form.title.trim(),
        target_amount: targetAmount,
        timeline_months: timelineMonths,
        current_amount: currentAmount,
      });

      setCreateMessage(
        `Goal created. Monthly required: ${formatCurrency(result.monthly_required)}. Success probability: ${formatPercent(result.success_probability)}.`,
      );
      setForm(emptyForm);
      setShowForm(false);
      await loadGoals();
    } catch (createError) {
      setError(formatBackendError(createError instanceof Error ? createError.message : "Failed to create goal."));
    } finally {
      setCreating(false);
    }
  }

  const pageRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!pageRef.current) return;
      const cards = pageRef.current.querySelectorAll("[data-animate='card']");
      if (cards.length === 0) return;
      gsap.fromTo(
        Array.from(cards),
        { autoAlpha: 0, y: 28, scale: 0.98 },
        { autoAlpha: 1, y: 0, scale: 1, duration: 0.6, stagger: 0.1, ease: "power3.out" },
      );
    },
    { scope: pageRef },
  );

  return (
    <AppShell>
      <div ref={pageRef} className="space-y-6">
        <Card data-animate="card" className="overflow-hidden border-border/60 bg-card/80 shadow-[0_24px_60px_-40px_rgba(0,0,0,0.75)] backdrop-blur-xl">
          <CardHeader className="border-b border-border/50 bg-gradient-to-r from-primary/8 via-transparent to-transparent pb-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2">
                <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/10 text-[10px] uppercase tracking-[0.24em] text-primary">
                  Live goals
                </Badge>
                <CardTitle className="flex items-center gap-2 text-2xl sm:text-3xl">
                  <Target className="size-6 text-primary" />
                  Financial Goals
                </CardTitle>
                <p className="max-w-2xl text-sm leading-7 text-muted-foreground">
                  Track goal feasibility, monthly contributions, and success probability in one place.
                </p>
              </div>
              <Button onClick={() => setShowForm((current) => !current)}>
                <Plus className="mr-2 size-4" />
                {showForm ? "Close form" : "New Goal"}
              </Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-4 p-4 sm:p-6">
            {createMessage && (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                {createMessage}
              </div>
            )}

            {error && (
              <Card className="border-amber-500/25 bg-amber-500/10">
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-300" />
                    <div>
                      <p className="font-medium text-amber-100">Goals data unavailable</p>
                      <p className="mt-1 text-sm leading-7 text-amber-100/80">{error}</p>
                    </div>
                  </div>
                  <Button variant="outline" onClick={loadGoals} className="shrink-0 border-amber-300/30 bg-background/40 text-amber-50 hover:bg-amber-300/10">
                    <RefreshCw className="mr-2 size-4" />
                    Retry
                  </Button>
                </CardContent>
              </Card>
            )}

            {showForm && (
              <Card className="border-primary/20 bg-primary/5 shadow-[0_18px_45px_-35px_rgba(0,0,0,0.65)] backdrop-blur-xl">
                <CardHeader className="pb-3">
                  <CardTitle className="text-xl">Create a new financial goal</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleCreateGoal} className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm text-muted-foreground" htmlFor="goal-type">
                        Goal type
                      </label>
                      <select
                        id="goal-type"
                        value={form.goal_type}
                        onChange={(e) => setForm((current) => ({ ...current, goal_type: e.target.value }))}
                        style={{ colorScheme: "dark" }}
                        className="h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
                      >
                        {GOAL_TYPES.map((type) => (
                          <option key={type.value} value={type.value} className="bg-background text-foreground">
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm text-muted-foreground" htmlFor="goal-title">
                        Title
                      </label>
                      <Input
                        id="goal-title"
                        value={form.title}
                        onChange={(e) => updateField("title", e.target.value)}
                        placeholder="e.g. Emergency Fund"
                        required
                      />
                      {fieldErrors.title && (
                        <p className="text-xs text-red-400">{fieldErrors.title}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm text-muted-foreground" htmlFor="goal-target">
                        Target amount (Rs)
                      </label>
                      <Input
                        id="goal-target"
                        inputMode="decimal"
                        value={form.target_amount}
                        onChange={(e) => updateField("target_amount", e.target.value)}
                        placeholder="500000"
                        required
                      />
                      {fieldErrors.target_amount && (
                        <p className="text-xs text-red-400">{fieldErrors.target_amount}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm text-muted-foreground" htmlFor="goal-timeline">
                        Timeline (months)
                      </label>
                      <Input
                        id="goal-timeline"
                        inputMode="numeric"
                        value={form.timeline_months}
                        onChange={(e) => updateField("timeline_months", e.target.value)}
                        placeholder="12"
                        required
                      />
                      {fieldErrors.timeline_months && (
                        <p className="text-xs text-red-400">{fieldErrors.timeline_months}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm text-muted-foreground" htmlFor="goal-current">
                        Current savings (Rs)
                      </label>
                      <Input
                        id="goal-current"
                        inputMode="decimal"
                        value={form.current_amount}
                        onChange={(e) => updateField("current_amount", e.target.value)}
                        placeholder="0"
                      />
                      {fieldErrors.current_amount && (
                        <p className="text-xs text-red-400">{fieldErrors.current_amount}</p>
                      )}
                    </div>

                    <div className="flex items-end">
                      <Button type="submit" disabled={creating} className="w-full">
                        {creating ? (
                          <>
                            <Loader2 className="mr-2 size-4 animate-spin" />
                            Creating
                          </>
                        ) : (
                          "Create Goal"
                        )}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>

        {loading ? (
          <Card className="border-border/60 bg-card/80 shadow-[0_18px_45px_-35px_rgba(0,0,0,0.65)] backdrop-blur-xl">
            <CardContent className="flex min-h-[30vh] items-center justify-center p-8">
              <div className="flex items-center gap-3 text-muted-foreground">
                <Loader2 className="size-5 animate-spin text-primary" />
                Loading your goal projections...
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {goals.length === 0 ? (
              <Card className="border-border/60 bg-card/80 shadow-[0_18px_45px_-35px_rgba(0,0,0,0.65)] backdrop-blur-xl lg:col-span-2">
                <CardContent className="p-8 text-center">
                  <Target className="mx-auto size-10 text-muted-foreground" />
                  <h2 className="mt-4 text-xl font-semibold">No goals yet</h2>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">
                    Click &quot;New Goal&quot; above to create your first financial goal. The simulator will calculate progress trajectories and success probability.
                  </p>
                </CardContent>
              </Card>
            ) : (
              goals.map((goal) => (
                <Card key={goal.goal.goal_id ?? goal.goal.title} className="border-border/60 bg-card/80 shadow-[0_18px_45px_-35px_rgba(0,0,0,0.65)] backdrop-blur-xl">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-2xl">{goal.goal.title}</CardTitle>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {goal.goal.timeline_months} months target
                        </p>
                      </div>
                      <Badge className={goal.on_track ? "rounded-full bg-emerald-500/15 text-emerald-300" : "rounded-full bg-amber-500/15 text-amber-200"}>
                        {goal.on_track ? "On track" : "Watch"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="rounded-3xl border border-border/50 bg-background/30 p-4">
                        <p className="text-sm text-muted-foreground">Target</p>
                        <p className="mt-2 text-2xl font-semibold">{formatCurrency(goal.goal.target_amount)}</p>
                      </div>
                      <div className="rounded-3xl border border-border/50 bg-background/30 p-4">
                        <p className="text-sm text-muted-foreground">Projected</p>
                        <p className="mt-2 text-2xl font-semibold">{formatCurrency(goal.projected_amount)}</p>
                      </div>
                    </div>

                    <div className="rounded-3xl border border-border/50 bg-background/30 p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Success probability</p>
                          <p className="mt-2 text-3xl font-semibold">{formatPercent(goal.success_probability)}</p>
                        </div>
                        <p className="text-sm text-primary">{goal.on_track ? "On track" : "Needs intervention"}</p>
                      </div>
                      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/8">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${Math.max(8, Math.min(goal.success_probability, 100))}%` }}
                        />
                      </div>
                    </div>

                    {goal.recommended_adjustments?.[0] && (
                      <div className="rounded-3xl border border-border/50 bg-background/30 p-4">
                        <p className="text-[0.72rem] uppercase tracking-[0.24em] text-primary">Recommended adjustment</p>
                        <p className="mt-3 text-sm leading-7 text-muted-foreground">{goal.recommended_adjustments[0]}</p>
                      </div>
                    )}

                    <p className="text-xs text-muted-foreground">
                      {goal.months_remaining} months remaining. Goal target: {formatCurrency(goal.goal.target_amount)}.
                    </p>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
