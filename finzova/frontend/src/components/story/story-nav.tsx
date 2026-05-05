"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, LayoutDashboard } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { StoryStep } from "@/components/story/story-stepper";

const ORDER: StoryStep[] = ["health", "expenses", "loans", "goals"];

export function StoryNav({ current }: { current: StoryStep }) {
  const router = useRouter();
  const idx = ORDER.indexOf(current);
  const prev = idx > 0 ? ORDER[idx - 1] : null;
  const next = idx < ORDER.length - 1 ? ORDER[idx + 1] : null;
  const isLast = idx === ORDER.length - 1;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <Button
        variant="outline"
        onClick={() => prev && router.push(`/analysis?step=${prev}`)}
        disabled={!prev}
        className="w-full justify-center gap-2 sm:w-auto"
      >
        <ArrowLeft className="size-4" />
        {prev ? `Back: ${labelFor(prev)}` : "Start"}
      </Button>

      {isLast ? (
        <Button
          onClick={() => router.push("/dashboard")}
          className="w-full justify-center gap-2 sm:w-auto"
        >
          <LayoutDashboard className="size-4" />
          Open my dashboard
        </Button>
      ) : (
        <Button
          onClick={() => next && router.push(`/analysis?step=${next}`)}
          className="w-full justify-center gap-2 sm:w-auto"
        >
          Next: {next ? labelFor(next) : ""}
          <ArrowRight className="size-4" />
        </Button>
      )}
    </div>
  );
}

function labelFor(step: StoryStep): string {
  switch (step) {
    case "health":
      return "Health";
    case "expenses":
      return "Expenses";
    case "loans":
      return "Loans";
    case "goals":
      return "Goals";
  }
}
