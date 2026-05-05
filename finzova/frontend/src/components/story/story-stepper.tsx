"use client";

import { Heart, ReceiptText, CreditCard, Target, Check } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

export type StoryStep = "health" | "expenses" | "loans" | "goals";

const STEPS: Array<{ key: StoryStep; label: string; icon: typeof Heart }> = [
  { key: "health", label: "Health", icon: Heart },
  { key: "expenses", label: "Expenses", icon: ReceiptText },
  { key: "loans", label: "Loans", icon: CreditCard },
  { key: "goals", label: "Goals", icon: Target },
];

export function StoryStepper({ current }: { current: StoryStep }) {
  const currentIndex = STEPS.findIndex((s) => s.key === current);
  return (
    <div className="rounded-3xl border border-border/60 bg-card/70 p-5 backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-primary">
            Your Money Story
          </p>
          <p className="mt-1 text-base font-semibold text-foreground">
            Step {currentIndex + 1} of {STEPS.length} · {STEPS[currentIndex]?.label}
          </p>
        </div>
      </div>

      <ol className="mt-5 grid grid-cols-4 gap-2">
        {STEPS.map((step, idx) => {
          const Icon = step.icon;
          const isCurrent = idx === currentIndex;
          const isDone = idx < currentIndex;
          return (
            <li key={step.key}>
              <Link
                href={`/analysis?step=${step.key}`}
                className={cn(
                  "group block rounded-2xl border px-3 py-3 transition",
                  isCurrent
                    ? "border-primary/50 bg-primary/15 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.18)]"
                    : isDone
                      ? "border-emerald-400/30 bg-emerald-500/10 hover:border-emerald-400/50"
                      : "border-border/50 bg-background/30 hover:border-border",
                )}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-xl",
                      isCurrent
                        ? "bg-primary/25 text-primary ring-1 ring-primary/40"
                        : isDone
                          ? "bg-emerald-500/25 text-emerald-300"
                          : "bg-background/40 text-muted-foreground",
                    )}
                  >
                    {isDone ? <Check className="size-3.5" /> : <Icon className="size-3.5" />}
                  </div>
                  <span
                    className={cn(
                      "text-xs font-medium",
                      isCurrent ? "text-foreground" : "text-muted-foreground group-hover:text-foreground",
                    )}
                  >
                    {step.label}
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export const STORY_STEPS = STEPS.map((s) => s.key);
