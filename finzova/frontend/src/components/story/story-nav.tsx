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
    <div className="mx-auto grid w-full max-w-2xl grid-cols-2 gap-3">
      <Button
        variant="outline"
        onClick={() => prev && router.push(`/analysis?step=${prev}`)}
        disabled={!prev}
        className="min-h-11 w-full justify-center gap-2 px-4 py-2.5 text-sm"
      >
        <ArrowLeft className="size-4" />
        {prev ? `Back: ${labelFor(prev)}` : "Start"}
      </Button>

      {isLast ? (
        <Button
          onClick={() => router.push("/dashboard")}
          className="min-h-11 w-full justify-center gap-2 px-4 py-2.5 text-sm"
        >
          <LayoutDashboard className="size-4" />
          Open my dashboard
        </Button>
      ) : (
        <Button
          onClick={() => next && router.push(`/analysis?step=${next}`)}
          className="min-h-11 w-full justify-center gap-2 px-4 py-2.5 text-sm"
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
