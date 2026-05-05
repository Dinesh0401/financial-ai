"use client";

import Link from "next/link";
import { ArrowRight, CreditCard, Heart, ReceiptText, Target } from "lucide-react";

import { cn } from "@/lib/utils";

export type StoryTabKey = "health" | "expenses" | "loans" | "goals";

const TABS: Array<{
  key: StoryTabKey;
  label: string;
  hint: string;
  icon: typeof Heart;
}> = [
  { key: "health", label: "Health", hint: "Your money score", icon: Heart },
  { key: "expenses", label: "Expenses", hint: "Where it goes", icon: ReceiptText },
  { key: "loans", label: "Loans", hint: "Pay off faster", icon: CreditCard },
  { key: "goals", label: "Goals", hint: "Plan the future", icon: Target },
];

type StoryTabsProps = {
  currentStep?: StoryTabKey | null;
  onStepChange?: (step: StoryTabKey) => void;
  className?: string;
};

export function StoryTabs({ currentStep, onStepChange, className }: StoryTabsProps) {
  const activeStep = currentStep ?? "health";

  return (
    <nav aria-label="Money story sections" className={cn("w-full", className)}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {TABS.map(({ key, label, hint, icon: Icon }) => {
          const active = activeStep !== null && key === activeStep;
          const cardClassName = cn(
            "group flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition",
            active
              ? "border-primary/50 bg-primary/15 text-foreground shadow-[inset_0_0_0_1px_rgba(16,185,129,0.18)]"
              : "border-border/50 bg-background/40 text-muted-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-foreground",
          );

          const content = (
            <>
              <div
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-2xl ring-1",
                  active
                    ? "bg-primary/25 text-primary ring-primary/45"
                    : "bg-primary/15 text-primary ring-primary/30",
                )}
              >
                <Icon className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">{label}</p>
                <p className="text-xs text-muted-foreground">{hint}</p>
              </div>
              <ArrowRight className="size-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
            </>
          );

          if (onStepChange) {
            return (
              <button
                key={key}
                type="button"
                onClick={() => onStepChange(key)}
                aria-current={active ? "page" : undefined}
                className={cardClassName}
              >
                {content}
              </button>
            );
          }

          return (
            <Link
              key={key}
              href={`/analysis?step=${key}`}
              aria-current={active ? "page" : undefined}
              className={cardClassName}
            >
              {content}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
