"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CreditCard, Heart, ReceiptText, Target } from "lucide-react";

import { cn } from "@/lib/utils";

const TABS = [
  { key: "health", label: "Health", hint: "Your money score", icon: Heart },
  { key: "expenses", label: "Expenses", hint: "Where it goes", icon: ReceiptText },
  { key: "loans", label: "Loans", hint: "Pay off faster", icon: CreditCard },
  { key: "goals", label: "Goals", hint: "Plan the future", icon: Target },
] as const;

export function StoryTabs() {
  const params = useSearchParams();
  const stepParam = params.get("step");
  const current = TABS.find((t) => t.key === stepParam)?.key ?? "health";

  return (
    <nav
      aria-label="Money story sections"
      className="mx-auto mt-2 w-full max-w-[1600px] px-4 sm:px-6 lg:px-8"
    >
      <div className="grid gap-2 rounded-[24px] border border-border/60 bg-background/70 p-2 backdrop-blur-xl sm:grid-cols-4">
        {TABS.map(({ key, label, hint, icon: Icon }) => {
          const active = key === current;
          return (
            <Link
              key={key}
              href={`/analysis?step=${key}`}
              className={cn(
                "group flex items-center gap-3 rounded-2xl border px-3 py-2.5 transition",
                active
                  ? "border-primary/40 bg-primary/15 text-foreground shadow-[inset_0_0_0_1px_rgba(16,185,129,0.18)]"
                  : "border-transparent bg-background/30 text-muted-foreground hover:border-border hover:bg-background/60 hover:text-foreground",
              )}
            >
              <div
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-xl",
                  active
                    ? "bg-primary/25 text-primary ring-1 ring-primary/40"
                    : "bg-background/50 text-muted-foreground group-hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
              </div>
              <div className="min-w-0">
                <p className={cn("text-sm font-semibold", active && "text-foreground")}>
                  {label}
                </p>
                <p className="text-[11px] leading-tight text-muted-foreground">{hint}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
