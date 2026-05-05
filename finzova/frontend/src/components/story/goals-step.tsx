"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import Link from "next/link";
import { Sparkles, Target } from "lucide-react";

import {
  calculateGoalProbability,
  optimizeLoan,
  totalEmi,
  totalExpenses,
  type OnboardingGoal,
  type OnboardingSnapshot,
} from "@/lib/ai/engine";

function isHomeGoal(goal: OnboardingGoal): boolean {
  const text = `${goal.name ?? ""} ${goal.type ?? ""}`.toLowerCase();
  return /home|house|flat|apartment/.test(text);
}

export function GoalsStep({ snapshot }: { snapshot: OnboardingSnapshot }) {
  const expenses = totalExpenses(snapshot.expenses);
  const emi = totalEmi(snapshot.loans);
  const monthlySavings = Math.max(0, snapshot.income - expenses - emi);

  const goals = snapshot.goals || [];

  // Wealth growth at current savings (12% return assumption baked into projection)
  const projection = [1, 2, 3, 5, 7, 10].map((years) => {
    const months = years * 12;
    const r = 0.12 / 12;
    // Future value of monthly contribution
    const fv = monthlySavings > 0 && r > 0
      ? monthlySavings * ((Math.pow(1 + r, months) - 1) / r)
      : monthlySavings * months;
    return { year: `${years}y`, value: Math.round(fv) };
  });

  // Loans paid off by month
  const longestPayoffMonths = snapshot.loans.length > 0
    ? Math.max(
        ...snapshot.loans.map((l) => {
          const opt = optimizeLoan(l);
          return opt && Number.isFinite(opt.currentMonths) ? opt.currentMonths : 0;
        }),
      )
    : 0;
  const debtFreeBy = longestPayoffMonths > 0
    ? new Date(new Date().setMonth(new Date().getMonth() + longestPayoffMonths))
    : null;

  // 5-year story numbers
  const fiveYearSave = projection.find((p) => p.year === "5y")?.value ?? 0;
  const topGoal = goals[0];

  return (
    <section className="space-y-5">
      <div className="rounded-[28px] border border-border/65 bg-gradient-to-br from-primary/20 via-card/80 to-card/60 p-6 shadow-[0_26px_55px_-38px_rgba(0,0,0,0.85)] ring-1 ring-primary/25">
        <p className="text-[11px] uppercase tracking-[0.28em] text-primary">Page 4 · Your goals & future</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-[2.2rem]">
          Where you&apos;ll be in 5 years
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">
          If you keep saving ₹{monthlySavings.toLocaleString("en-IN")}/month and follow the steps from earlier pages, here&apos;s what your future looks like.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-emerald-400/30 bg-gradient-to-br from-emerald-500/12 to-emerald-500/5 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
            <p className="text-[10px] uppercase tracking-[0.18em] text-emerald-300">You&apos;ll have saved</p>
            <p className="mt-1 text-2xl font-bold text-foreground">
              ₹{fiveYearSave.toLocaleString("en-IN")}
            </p>
            <p className="mt-1 text-[11px] text-emerald-200/80">
              at ₹{monthlySavings.toLocaleString("en-IN")}/mo · 12% growth
            </p>
          </div>
          <div className="rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-500/12 to-amber-500/4 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <p className="text-[10px] uppercase tracking-[0.18em] text-amber-300">Loans cleared</p>
            <p className="mt-1 text-2xl font-bold text-foreground">
              {debtFreeBy
                ? debtFreeBy.toLocaleString("en-IN", { month: "short", year: "numeric" })
                : "Already!"}
            </p>
            <p className="mt-1 text-[11px] text-amber-200/80">
              {debtFreeBy
                ? `${longestPayoffMonths} months at current EMIs`
                : "You're debt-free today"}
            </p>
          </div>
          <div className="rounded-2xl border border-primary/35 bg-gradient-to-br from-primary/16 to-primary/6 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
            <p className="text-[10px] uppercase tracking-[0.18em] text-primary">Closer to</p>
            <p className="mt-1 text-2xl font-bold text-foreground">
              {topGoal ? topGoal.name ?? topGoal.type : "Your goals"}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {topGoal ? "based on your top goal" : "add a goal to see"}
            </p>
          </div>
        </div>
      </div>

      {goals.length > 0 ? (
        <div className="space-y-3">
          {goals.map((goal, i) => {
            const goalProb = calculateGoalProbability(goal, monthlySavings);
            const monthlyNeeded = goal.years > 0 ? Math.ceil(goal.targetAmount / (goal.years * 12)) : 0;
            const isUnrealistic = snapshot.income > 0 && monthlyNeeded > snapshot.income;
            const realisticYears = isUnrealistic && monthlySavings > 0
              ? Math.max(goal.years + 1, Math.ceil(goal.targetAmount / (Math.max(monthlySavings, snapshot.income * 0.2) * 12)))
              : null;
            const downpaymentTarget = Math.round(goal.targetAmount * 0.2);
            const downpaymentMonthly = realisticYears
              ? Math.ceil(downpaymentTarget / (realisticYears * 12))
              : Math.ceil(downpaymentTarget / Math.max(1, goal.years * 12));
            const homeLoanEligible = Math.round(monthlySavings * 60);

            return (
              <div
                key={i}
                className="relative overflow-hidden rounded-[26px] border border-border/65 bg-gradient-to-br from-card/90 via-card/75 to-card/55 p-5 shadow-[0_18px_40px_-26px_rgba(0,0,0,0.8)] backdrop-blur-xl"
              >
                <div className="pointer-events-none absolute right-0 top-0 size-28 -translate-y-1/2 translate-x-1/3 rounded-full bg-primary/10 blur-3xl" />
                <div className="relative z-10 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-8 items-center justify-center rounded-xl bg-primary/18 text-primary ring-1 ring-primary/30">
                      <Target className="size-4" />
                    </div>
                    <p className="text-base font-semibold text-foreground">{goal.name ?? goal.type}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-border/40 bg-background/45 px-2.5 py-0.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      ₹{goal.targetAmount.toLocaleString("en-IN")} · {goal.years} year{goal.years === 1 ? "" : "s"}
                    </span>
                    <span className="rounded-full border border-primary/35 bg-primary/10 px-2.5 py-0.5 text-[10px] uppercase tracking-[0.18em] text-primary">
                      Need ₹{monthlyNeeded.toLocaleString("en-IN")}/mo
                    </span>
                  </div>
                </div>

                <div className="relative z-10 mt-3 grid gap-3 sm:grid-cols-[180px_1fr]">
                  <div className="rounded-2xl border border-border/45 bg-background/35 p-3 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Chance</p>
                    <p className="mt-1 text-3xl font-bold text-foreground">
                      {goalProb <= 1 ? "Just started" : `${goalProb}%`}
                    </p>
                    <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/5">
                      <div
                        className={`h-full rounded-full ${
                          goalProb >= 70
                            ? "bg-emerald-400"
                            : goalProb >= 40
                              ? "bg-amber-400"
                              : "bg-red-400"
                        }`}
                        style={{ width: `${Math.max(4, goalProb)}%` }}
                      />
                    </div>
                  </div>

                  {isUnrealistic ? (
                    <div className="rounded-2xl border border-amber-400/35 bg-gradient-to-br from-amber-500/14 to-amber-500/7 p-3">
                      <p className="text-sm font-semibold text-foreground">
                        Hard in {goal.years} year{goal.years === 1 ? "" : "s"} — here&apos;s how to actually do it
                      </p>
                      <p className="mt-1 text-[11px] leading-5 text-amber-100/90">
                        You&apos;d need ₹{monthlyNeeded.toLocaleString("en-IN")}/month — more than your salary.
                      </p>
                      {isHomeGoal(goal) ? (
                        <ol className="mt-3 space-y-2 text-xs leading-5 text-amber-50/95">
                          <li className="flex gap-2">
                            <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-amber-500/40 text-[10px] font-semibold">1</span>
                            <span>
                              <span className="font-semibold">Aim for the 20% downpayment, not the full price.</span>{" "}
                              You only need ₹{downpaymentTarget.toLocaleString("en-IN")} upfront. Bank funds the rest.
                            </span>
                          </li>
                          <li className="flex gap-2">
                            <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-amber-500/40 text-[10px] font-semibold">2</span>
                            <span>
                              Save ₹{downpaymentMonthly.toLocaleString("en-IN")}/month in a Nifty 50 SIP for {realisticYears ?? goal.years} years.
                            </span>
                          </li>
                          <li className="flex gap-2">
                            <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-amber-500/40 text-[10px] font-semibold">3</span>
                            <span>
                              Banks may approve a home loan up to ~₹{homeLoanEligible.toLocaleString("en-IN")} on your current savings.
                            </span>
                          </li>
                          <li className="flex gap-2">
                            <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-amber-500/40 text-[10px] font-semibold">4</span>
                            <span>
                              Update the goal: try <span className="font-semibold">{realisticYears ?? goal.years + 5} years</span> or set the target to <span className="font-semibold">₹{downpaymentTarget.toLocaleString("en-IN")}</span> (downpayment only).
                            </span>
                          </li>
                        </ol>
                      ) : (
                        <p className="mt-2 text-xs leading-5 text-amber-100/90">
                          {realisticYears
                            ? `Try ${realisticYears} years instead — that's roughly ₹${Math.ceil(goal.targetAmount / (realisticYears * 12)).toLocaleString("en-IN")}/mo, doable on your income.`
                            : "Try a smaller target or a longer timeline."}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-emerald-400/30 bg-gradient-to-br from-emerald-500/12 to-emerald-500/5 p-3">
                      <p className="text-sm font-medium text-foreground">
                        Save ₹{monthlyNeeded.toLocaleString("en-IN")}/month to hit it on time
                      </p>
                      <p className="mt-1 text-xs leading-6 text-emerald-200/85">
                        {monthlyNeeded <= monthlySavings
                          ? `You're already saving ₹${monthlySavings.toLocaleString("en-IN")}/month — keep it up and you'll get there.`
                          : `You currently save ₹${monthlySavings.toLocaleString("en-IN")}/month — short by ₹${(monthlyNeeded - monthlySavings).toLocaleString("en-IN")}/month. The expense fixes from page 2 close most of this gap.`}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-3xl border border-border/60 bg-card/70 p-6 text-center">
          <p className="font-semibold text-foreground">You haven&apos;t added a goal yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add at least one goal so I can show you how close you are.
          </p>
          <Link
            href="/onboarding?edit=1"
            className="mt-4 inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/15 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/25"
          >
            <Target className="size-4" />
            Add a goal
          </Link>
        </div>
      )}

      <div className="rounded-3xl border border-border/60 bg-card/70 p-5 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <p className="text-sm font-semibold text-foreground">Wealth growth if you stay the course</p>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Saving ₹{monthlySavings.toLocaleString("en-IN")}/month into an index fund at ~12% growth.
        </p>
        <div className="mt-4 h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={projection} margin={{ top: 8, right: 16, left: 16, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="year" tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 11 }} />
              <YAxis
                tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 11 }}
                tickFormatter={(v) =>
                  v >= 100000 ? `₹${(v / 100000).toFixed(1)}L` : `₹${(v / 1000).toFixed(0)}k`
                }
              />
              <Tooltip
                contentStyle={{
                  background: "rgb(8,18,12)",
                  border: "1px solid rgba(16,185,129,0.3)",
                  borderRadius: 12,
                }}
                formatter={(v) => [`₹${Number(v ?? 0).toLocaleString("en-IN")}`, "Wealth"]}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="rgb(52,211,153)"
                strokeWidth={2.5}
                dot={{ r: 4, fill: "rgb(52,211,153)" }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Compound growth is real. Most of the wealth in year 10 comes from interest, not contributions.
        </p>
      </div>
    </section>
  );
}
