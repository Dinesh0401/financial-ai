"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDown, Check, Sparkles } from "lucide-react";

import {
  generateRecommendations,
  totalEmi,
  totalExpenses,
  type OnboardingSnapshot,
} from "@/lib/ai/engine";

type CategoryRule = {
  label: string;
  pctOfIncome: number;
  absoluteFloor: number;
  tip: string;
};

const CATEGORY_RULES: Record<string, CategoryRule> = {
  food_dining: {
    label: "Food",
    pctOfIncome: 0.15,
    absoluteFloor: 1500,
    tip: "Cook 2-3 dinners a week, cap food-app orders at ₹250.",
  },
  food: {
    label: "Food",
    pctOfIncome: 0.15,
    absoluteFloor: 1500,
    tip: "Cook 2-3 dinners a week, cap food-app orders at ₹250.",
  },
  rent_housing: {
    label: "Rent",
    pctOfIncome: 0.3,
    absoluteFloor: 6000,
    tip: "Look 2-3 km away from prime areas or split with a flatmate.",
  },
  rent: {
    label: "Rent",
    pctOfIncome: 0.3,
    absoluteFloor: 6000,
    tip: "Look 2-3 km away from prime areas or split with a flatmate.",
  },
  transport: {
    label: "Transport",
    pctOfIncome: 0.1,
    absoluteFloor: 1500,
    tip: "Swap weekly cabs for metro/bus, work-from-home days save fuel.",
  },
  shopping: {
    label: "Shopping",
    pctOfIncome: 0.1,
    absoluteFloor: 1000,
    tip: "Delete saved cards on Amazon/Flipkart, 72-hr wait on items > ₹2k.",
  },
  entertainment: {
    label: "Entertainment",
    pctOfIncome: 0.05,
    absoluteFloor: 500,
    tip: "Audit OTTs — keep 2 active and rotate, share annual family plans.",
  },
  healthcare: {
    label: "Healthcare",
    pctOfIncome: 0.05,
    absoluteFloor: 500,
    tip: "Use employer cashless if available; keep a top-up policy.",
  },
  education: {
    label: "Education",
    pctOfIncome: 0.1,
    absoluteFloor: 1000,
    tip: "Tuition fees qualify for 80C; claim it on the old regime.",
  },
  other: {
    label: "Other",
    pctOfIncome: 0.05,
    absoluteFloor: 500,
    tip: "Tag these spends for 14 days — 'other' usually hides 2-3 leaks.",
  },
};

type TrimRow = {
  key: string;
  label: string;
  current: number;
  target: number;
  saved: number;
  withinTarget: boolean;
  tip: string;
};

function buildTrimRows(
  expenses: Record<string, number>,
  income: number,
): TrimRow[] {
  const rows: TrimRow[] = [];
  for (const [rawKey, amount] of Object.entries(expenses)) {
    if (amount <= 0) continue;
    const rule = CATEGORY_RULES[rawKey] ?? {
      label: rawKey.replace(/_/g, " "),
      pctOfIncome: 0.1,
      absoluteFloor: 500,
      tip: "Track this for 14 days and set a weekly cap.",
    };
    const incomeBased = income > 0 ? Math.round(income * rule.pctOfIncome) : Infinity;
    const target = Math.max(rule.absoluteFloor, incomeBased);
    const withinTarget = amount <= target;
    const saved = withinTarget ? 0 : amount - target;
    rows.push({
      key: rawKey,
      label: rule.label,
      current: amount,
      target,
      saved,
      withinTarget,
      tip: rule.tip,
    });
  }
  return rows.sort((a, b) => b.saved - a.saved || b.current - a.current);
}

export function ExpenseStep({ snapshot }: { snapshot: OnboardingSnapshot }) {
  const expenses = totalExpenses(snapshot.expenses);
  const emi = totalEmi(snapshot.loans);
  const totalOut = expenses + emi;
  const income = snapshot.income;
  const expensePct = income > 0 ? Math.round((totalOut / income) * 100) : 0;

  const allRecos = generateRecommendations(snapshot);
  const expenseRecos = allRecos.filter((r) => r.agent === "Expense").slice(0, 3);
  const totalSavePotential = expenseRecos.reduce((s, r) => s + r.impactMonthly, 0);

  const chartData = Object.entries(snapshot.expenses)
    .map(([k, v]) => ({ name: k.replace(/_/g, " "), value: v }))
    .filter((e) => e.value > 0)
    .sort((a, b) => b.value - a.value);

  const ranked = [...chartData].slice(0, 3);

  return (
    <section className="space-y-5">
      <div className="rounded-3xl border border-border/60 bg-gradient-to-br from-rose-500/10 via-card/70 to-card/60 p-6 ring-1 ring-rose-500/20">
        <p className="text-[11px] uppercase tracking-[0.28em] text-primary">Page 2 · Where your money goes</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-[2.2rem]">
          You spend ₹{totalOut.toLocaleString("en-IN")} a month
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">
          That&apos;s {expensePct}% of what you earn. Here&apos;s where it&apos;s going and the easiest places to trim.
        </p>

        {income > 0 && (
          <div className="mt-5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Spent vs earned</span>
              <span>
                ₹{totalOut.toLocaleString("en-IN")} of ₹{income.toLocaleString("en-IN")}
              </span>
            </div>
            <div className="mt-2 h-3 overflow-hidden rounded-full bg-white/5">
              <div
                className={`h-full rounded-full ${
                  expensePct <= 60
                    ? "bg-emerald-400"
                    : expensePct <= 85
                      ? "bg-amber-400"
                      : "bg-red-400"
                }`}
                style={{ width: `${Math.min(100, expensePct)}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {expensePct <= 60
                ? "Healthy — you keep most of what you earn."
                : expensePct <= 85
                  ? "Bit high — trimming the top categories below frees real cash."
                  : "Way too high — you're spending almost everything you earn."}
            </p>
          </div>
        )}
      </div>

      {chartData.length > 0 && (
        <div className="rounded-3xl border border-border/60 bg-card/70 p-5 backdrop-blur-xl">
          <p className="text-sm font-semibold text-foreground">By category</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Each bar is one spending category — long bars are where most of your money goes.
          </p>
          <div className="mt-4 h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 24, left: 16, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis
                  type="number"
                  tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 11 }}
                  tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={110}
                  tick={{ fill: "rgba(255,255,255,0.75)", fontSize: 12 }}
                />
                <Tooltip
                  contentStyle={{
                    background: "rgb(8,18,12)",
                    border: "1px solid rgba(16,185,129,0.3)",
                    borderRadius: 12,
                  }}
                  formatter={(v) => [`₹${Number(v ?? 0).toLocaleString("en-IN")}`, "Spent"]}
                  cursor={{ fill: "rgba(16,185,129,0.08)" }}
                />
                <Bar dataKey="value" radius={[0, 8, 8, 0]} fill="rgb(52,211,153)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {(() => {
        const trims = buildTrimRows(snapshot.expenses, income);
        const overspent = trims.filter((t) => !t.withinTarget);
        const totalCanSave = overspent.reduce((s, t) => s + t.saved, 0);

        if (trims.length === 0) return null;

        return (
          <div className="rounded-3xl border border-border/60 bg-card/70 p-5 backdrop-blur-xl">
            <div className="flex items-center gap-2">
              <ArrowDown className="size-4 text-emerald-300" />
              <p className="text-sm font-semibold text-foreground">Reduce to → Healthy target</p>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {totalCanSave > 0
                ? `Trim each category to its healthy line and free up ₹${totalCanSave.toLocaleString("en-IN")}/month.`
                : "Each line below shows your current spend vs what's typical for your income. You're within range on all of them."}
            </p>
            <ul className="mt-4 space-y-2">
              {trims.map((t) => (
                <li
                  key={t.key}
                  className={`rounded-2xl border px-3 py-3 text-sm ${
                    t.withinTarget
                      ? "border-emerald-400/25 bg-emerald-500/5"
                      : "border-amber-400/35 bg-amber-500/5"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold capitalize text-foreground">{t.label}</p>
                    <div className="flex items-center gap-2 text-foreground/90">
                      <span
                        className={`tabular-nums ${
                          t.withinTarget ? "text-emerald-100" : "text-amber-100"
                        }`}
                      >
                        ₹{t.current.toLocaleString("en-IN")}
                      </span>
                      <ArrowDown className="size-3.5 -rotate-90 text-muted-foreground" />
                      <span className="tabular-nums font-semibold text-emerald-200">
                        ₹{t.target.toLocaleString("en-IN")}
                      </span>
                      {t.withinTarget ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">
                          <Check className="size-3" /> Within range
                        </span>
                      ) : (
                        <span className="rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
                          +₹{t.saved.toLocaleString("en-IN")}/mo
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{t.tip}</p>
                </li>
              ))}
            </ul>
            {totalCanSave > 0 && (
              <div className="mt-4 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm">
                <span className="font-semibold text-emerald-100">
                  Total you can save: ₹{totalCanSave.toLocaleString("en-IN")}/month
                </span>
                <span className="ml-1 text-emerald-200/85">
                  · ₹{(totalCanSave * 12).toLocaleString("en-IN")}/year if you stick with it.
                </span>
              </div>
            )}
          </div>
        );
      })()}

      {totalSavePotential > 0 && (
        <div className="rounded-3xl border border-emerald-400/30 bg-emerald-500/10 p-5">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-emerald-300" />
            <p className="text-sm font-semibold text-emerald-100">
              Detailed playbook — save up to ₹{totalSavePotential.toLocaleString("en-IN")}/month
            </p>
          </div>
          <p className="mt-1 text-xs text-emerald-200/90">
            Pick the easiest fix below and start there.
          </p>
        </div>
      )}

      {expenseRecos.length > 0 ? (
        <div className="space-y-3">
          {expenseRecos.map((r, i) => (
            <div
              key={i}
              className="rounded-3xl border border-amber-400/25 bg-amber-500/5 p-5"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-full bg-amber-500/25 text-xs font-bold text-amber-100">
                  #{i + 1}
                </span>
                <p className="font-medium text-foreground">{r.title}</p>
                {r.impactMonthly > 0 && (
                  <span className="rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
                    saves ₹{r.impactMonthly.toLocaleString("en-IN")}/mo
                  </span>
                )}
              </div>
              <p className="mt-2 text-xs leading-6 text-foreground/85">{r.detail}</p>
              {r.howTo && r.howTo.length > 0 && (
                <div className="mt-3 rounded-2xl border border-white/10 bg-black/25 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80">
                    How to do it
                  </p>
                  <ol className="mt-2 space-y-1.5 text-xs leading-6 text-foreground/90">
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
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border border-border/60 bg-card/70 p-5 text-sm text-muted-foreground">
          {ranked.length > 0 ? (
            <>
              <p className="font-medium text-foreground">Your top spending areas</p>
              <ul className="mt-3 space-y-1.5">
                {ranked.map((r) => (
                  <li key={r.name} className="flex items-center justify-between text-foreground/90">
                    <span className="capitalize">{r.name}</span>
                    <span className="font-medium">₹{r.value.toLocaleString("en-IN")}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">
                Nothing screams &quot;cut me first&quot; — your spending is balanced.
              </p>
            </>
          ) : (
            <p>Add your monthly spending in onboarding to unlock category-wise tips.</p>
          )}
        </div>
      )}
    </section>
  );
}
