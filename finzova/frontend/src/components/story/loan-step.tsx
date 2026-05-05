"use client";

import { CalendarCheck, Flame, ShieldCheck } from "lucide-react";

import {
  generateRecommendations,
  optimizeLoan,
  totalDebt,
  totalEmi,
  type OnboardingLoan,
  type OnboardingSnapshot,
} from "@/lib/ai/engine";

function addMonthsToToday(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toLocaleString("en-IN", { month: "short", year: "numeric" });
}

const PAYOFF_TIPS: string[] = [
  "Call your bank's loan helpline this week and ask if they can lower your interest rate (especially if you've been paying on time).",
  "Check 2-3 other banks for a balance transfer — even a 2% rate drop saves Rs 2,000-5,000/month on a Rs 5L loan.",
  "Add 10-20% to your EMI as 'extra principal payment' through the bank app. It cuts months off the loan and saves big interest.",
  "Don't take new credit cards or BNPL while clearing existing loans — interest piles up faster than savings grow.",
];

function normalizedLoanType(type: string | undefined): string {
  return (type ?? "").trim().toLowerCase();
}

function getLoanPayoffTips(loan: OnboardingLoan): string[] {
  const type = normalizedLoanType(loan.type);

  if (type.includes("credit card")) {
    return [
      "Freeze this card for new spends until the balance is zero.",
      "Pay more than the minimum every month so the statement balance actually shrinks.",
      "If the APR is painful, move the balance to a lower-rate option and close the original card fast.",
    ];
  }

  if (type.includes("gold")) {
    return [
      "Treat this as a short bridge loan and close it with any bonus, tax refund, or sale proceeds.",
      "Avoid renewals or rollovers unless absolutely necessary.",
      "Make a little extra principal payment each month so the pledged gold is released sooner.",
    ];
  }

  if (type.includes("home")) {
    return [
      "Keep the EMI on autopay, then send bonuses or salary hikes straight to principal.",
      "Ask the bank for a rate reset or tenure reduction when rates fall.",
      "Don't rush to overpay this before higher-interest debt is gone.",
    ];
  }

  if (type.includes("personal")) {
    return [
      "Put extra principal toward this loan on the same day your salary lands.",
      "Ask the lender for a lower rate if you have a clean repayment history.",
      "Close it before taking any new EMI.",
    ];
  }

  if (type.includes("car")) {
    return [
      "Keep the EMI steady and send any spare cash to principal.",
      "Don't roll accessories or insurance into a fresh refinance.",
      "Close it early once your higher-rate debt is gone.",
    ];
  }

  if (type.includes("education")) {
    return [
      "Use any tax refund or bonus to make lump-sum principal payments.",
      "Keep interest from capitalising if your lender allows prepayment.",
      "Once income grows, step up the EMI instead of stretching the tenure.",
    ];
  }

  if (type.includes("two-wheeler") || type.includes("two wheeler") || type.includes("bike")) {
    return [
      "Add a small extra payment each month and close it fast.",
      "Avoid extending the tenure for gadgets or accessories.",
      "Redirect that EMI to your next goal after it closes.",
    ];
  }

  return PAYOFF_TIPS;
}

export function LoanStep({ snapshot }: { snapshot: OnboardingSnapshot }) {
  const loans = snapshot.loans || [];
  const debt = totalDebt(loans);
  const emi = totalEmi(loans);
  const ranked: OnboardingLoan[] = [...loans].sort((a, b) => b.interest - a.interest);

  const debtRecos = generateRecommendations(snapshot).filter((r) => r.agent === "Debt");

  if (ranked.length === 0) {
    return (
      <section className="space-y-5">
        <div className="rounded-3xl border border-emerald-400/30 bg-gradient-to-br from-emerald-500/15 via-card/70 to-card/60 p-8 ring-1 ring-emerald-400/30">
          <p className="text-[11px] uppercase tracking-[0.28em] text-primary">Page 3 · Your loans</p>
          <div className="mt-3 flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-emerald-500/25 text-emerald-200">
              <ShieldCheck className="size-6" />
            </div>
            <div>
              <h2 className="text-3xl font-semibold tracking-tight text-foreground">You&apos;re debt-free.</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                No EMIs eating your salary. Keep it that way — avoid new credit cards or BNPL unless truly essential.
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-3xl border border-border/60 bg-card/70 p-5 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Why this matters</p>
          <p className="mt-1">
            Every rupee you don&apos;t pay in interest is a rupee that can grow in a SIP or sit in your safety net. Stay
            this way and you&apos;ll hit your goals years earlier than someone with EMIs.
          </p>
        </div>
      </section>
    );
  }

  const longestPayoffMonths = Math.max(
    ...ranked.map((l) => {
      const opt = optimizeLoan(l);
      return opt && Number.isFinite(opt.currentMonths) ? opt.currentMonths : 0;
    }),
  );

  const debtRatio = snapshot.income > 0 ? emi / snapshot.income : 0;
  const ratioTone =
    debtRatio <= 0.3 ? "good" : debtRatio <= 0.5 ? "okay" : "warn";

  return (
    <section className="space-y-5">
      <div
        className={`rounded-3xl border border-border/60 bg-gradient-to-br p-6 ring-1 ${
          ratioTone === "good"
            ? "from-emerald-500/10 ring-emerald-400/25"
            : ratioTone === "okay"
              ? "from-amber-500/10 ring-amber-400/25"
              : "from-red-500/10 ring-red-400/30"
        } via-card/70 to-card/60`}
      >
        <p className="text-[11px] uppercase tracking-[0.28em] text-primary">Page 3 · Your loans</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-[2.2rem]">
          You owe ₹{debt.toLocaleString("en-IN")}
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">
          Across {ranked.length} loan{ranked.length === 1 ? "" : "s"}, you pay{" "}
          <span className="font-semibold text-foreground">₹{emi.toLocaleString("en-IN")}/month</span> in EMIs
          {snapshot.income > 0 && (
            <>
              {" "}
              — that&apos;s {Math.round(debtRatio * 100)}% of what you earn.
            </>
          )}
        </p>

        {longestPayoffMonths > 0 && (
          <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-border/50 bg-background/40 px-4 py-2 text-xs text-foreground">
            <CalendarCheck className="size-3.5 text-primary" />
            <span>
              At your current pace, you&apos;ll be debt-free by{" "}
              <span className="font-semibold">{addMonthsToToday(longestPayoffMonths)}</span>
            </span>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {ranked.map((loan, i) => {
          const opt = optimizeLoan(loan);
          const isTop = i === 0 && ranked.length > 1;
          const eta = opt && Number.isFinite(opt.currentMonths) ? addMonthsToToday(opt.currentMonths) : null;
          const payoffTips = getLoanPayoffTips(loan);
          return (
            <div
              key={i}
              className={`rounded-3xl border p-5 ${
                isTop
                  ? "border-red-400/40 bg-red-500/5"
                  : "border-border/60 bg-card/70 backdrop-blur-xl"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                {isTop && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-red-200">
                    <Flame className="size-3" /> Pay this first
                  </span>
                )}
                <p className="text-base font-semibold text-foreground">
                  {loan.name || loan.type || "Loan"}
                </p>
                <span className="rounded-full border border-border/50 bg-background/40 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  {loan.interest.toFixed(1)}% interest
                </span>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <div className="rounded-2xl border border-border/40 bg-background/30 p-3">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">You owe</p>
                  <p className="mt-1 text-base font-semibold text-foreground">
                    ₹{loan.balance.toLocaleString("en-IN")}
                  </p>
                </div>
                <div className="rounded-2xl border border-border/40 bg-background/30 p-3">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Monthly EMI</p>
                  <p className="mt-1 text-base font-semibold text-foreground">
                    ₹{loan.emi.toLocaleString("en-IN")}
                  </p>
                </div>
                <div className="rounded-2xl border border-border/40 bg-background/30 p-3">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Closes by</p>
                  <p className="mt-1 text-base font-semibold text-foreground">
                    {eta ?? "—"}
                  </p>
                </div>
              </div>

              {opt && opt.monthsSaved > 0 && (
                <div className="mt-3 rounded-2xl border border-emerald-400/25 bg-emerald-500/5 p-3">
                  <p className="text-xs leading-6 text-emerald-100">
                    Pay <span className="font-semibold">₹{opt.boostedEmi.toLocaleString("en-IN")}/mo</span>{" "}
                    instead of ₹{loan.emi.toLocaleString("en-IN")}/mo →{" "}
                    finishes <span className="font-semibold">{opt.monthsSaved} months sooner</span>, saves about{" "}
                    <span className="font-semibold">
                      ₹{Math.round(opt.interestSavedApprox).toLocaleString("en-IN")}
                    </span>{" "}
                    in interest.
                  </p>
                </div>
              )}

              <div className="mt-3 rounded-2xl border border-border/40 bg-background/25 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Tailored payoff steps
                </p>
                <ol className="mt-2 space-y-2 text-xs leading-5 text-foreground/85">
                  {payoffTips.map((step, tipIndex) => (
                    <li key={tipIndex} className="flex gap-2">
                      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                        {tipIndex + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-3xl border border-border/60 bg-card/70 p-5 backdrop-blur-xl">
        <p className="text-sm font-semibold text-foreground">How to actually pay these off faster</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Pick one step today. Don&apos;t try all four at once.
        </p>
        <ol className="mt-4 space-y-2.5 text-sm leading-6 text-foreground/90">
          {(debtRecos[0]?.howTo && debtRecos[0].howTo.length > 0 ? debtRecos[0].howTo : PAYOFF_TIPS).map(
            (step, idx) => (
              <li key={idx} className="flex gap-3 rounded-2xl border border-border/40 bg-background/30 px-3 py-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                  {idx + 1}
                </span>
                <span>{step}</span>
              </li>
            ),
          )}
        </ol>
      </div>
    </section>
  );
}
