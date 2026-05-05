"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ExpenseStep } from "@/components/story/expense-step";
import { GoalsStep } from "@/components/story/goals-step";
import { HealthStep } from "@/components/story/health-step";
import { LoanStep } from "@/components/story/loan-step";
import { StoryNav } from "@/components/story/story-nav";
import { StoryTabs } from "@/components/story/story-tabs";
import { type StoryStep } from "@/components/story/story-stepper";
import { isAuthenticated } from "@/lib/auth";
import { fetchOnboardingSnapshot, type OnboardingSnapshot } from "@/lib/ai/engine";

gsap.registerPlugin(useGSAP);

const VALID_STEPS: StoryStep[] = ["health", "expenses", "loans", "goals"];

function isStoryStep(value: string | null): value is StoryStep {
  return value !== null && (VALID_STEPS as string[]).includes(value);
}

function AnalysisStory() {
  const router = useRouter();
  const params = useSearchParams();
  const stepParam = params.get("step");
  const step: StoryStep = isStoryStep(stepParam) ? stepParam : "health";

  const [snapshot, setSnapshot] = useState<OnboardingSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const stepRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!stepRef.current) return;
      gsap.fromTo(
        stepRef.current,
        { autoAlpha: 0, y: 20 },
        { autoAlpha: 1, y: 0, duration: 0.5, ease: "power3.out" },
      );
    },
    { scope: stepRef, dependencies: [step] },
  );

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const snap = await fetchOnboardingSnapshot();
        if (!cancelled) setSnapshot(snap);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (loading) {
    return (
      <div className="space-y-5">
        <StoryTabs currentStep={step} />
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!snapshot || snapshot.income <= 0) {
    return (
      <div className="space-y-5">
        <StoryTabs currentStep={step} />
        <div className="grid min-h-[60vh] place-items-center">
          <Card className="max-w-lg border-border/60 bg-card/80 backdrop-blur-xl">
            <CardContent className="space-y-3 p-8 text-center">
              <h2 className="text-2xl font-semibold">We need your numbers first</h2>
              <p className="text-sm leading-7 text-muted-foreground">
                Finish onboarding so I can show your money story across Health, Expenses, Loans and Goals.
              </p>
              <Link href="/onboarding">
                <Button>Finish onboarding</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <StoryTabs currentStep={step} />
      <div ref={stepRef}>
        {step === "health" && <HealthStep snapshot={snapshot} />}
        {step === "expenses" && <ExpenseStep snapshot={snapshot} />}
        {step === "loans" && <LoanStep snapshot={snapshot} />}
        {step === "goals" && <GoalsStep snapshot={snapshot} />}
      </div>
      <StoryNav current={step} />
    </div>
  );
}

export default function AnalysisPage() {
  return (
    <AppShell>
      <Suspense
        fallback={
          <div className="flex min-h-[60vh] items-center justify-center">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        }
      >
        <AnalysisStory />
      </Suspense>
    </AppShell>
  );
}
