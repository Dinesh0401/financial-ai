"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Sparkles } from "lucide-react";

import {
  generateRecommendations,
  totalEmi,
  totalExpenses,
  type OnboardingSnapshot,
} from "@/lib/ai/engine";

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

      {totalSavePotential > 0 && (
        <div className="rounded-3xl border border-emerald-400/30 bg-emerald-500/10 p-5">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-emerald-300" />
            <p className="text-sm font-semibold text-emerald-100">
              You can save up to ₹{totalSavePotential.toLocaleString("en-IN")}/month
            </p>
          </div>
          <p className="mt-1 text-xs text-emerald-200/90">
            By acting on the 3 fixes below. Pick the easiest one and start there.
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
