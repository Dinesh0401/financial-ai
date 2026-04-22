"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Bot,
  CheckCircle2,
  FileUp,
  Goal,
  LayoutDashboard,
  Lock,
  ReceiptText,
  Sparkles,
  UserPlus,
} from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isAuthenticated } from "@/lib/auth";

gsap.registerPlugin(useGSAP);

type Step = {
  number: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  tips: string[];
  href?: string;
  cta?: string;
};

const STEPS: Step[] = [
  {
    number: "01",
    title: "Create your account",
    description:
      "Sign in with Google or create an account with email and password. Your credentials and data are encrypted end-to-end.",
    icon: UserPlus,
    tips: [
      "Google sign-in is the fastest (2 clicks)",
      "Password must be at least 8 characters",
      "One account per email",
    ],
    href: "/login",
    cta: "Go to Sign in",
  },
  {
    number: "02",
    title: "Complete the onboarding",
    description:
      "Tell us about your monthly income, recurring expenses, active loans, and financial goals. Fields marked with a red * are required.",
    icon: Sparkles,
    tips: [
      "You can skip expenses if you plan to upload statements",
      "Add every active loan for accurate debt strategy",
      "At least one goal so the AI has a target to plan for",
    ],
    href: "/onboarding",
    cta: "Open onboarding",
  },
  {
    number: "03",
    title: "Upload your bank statement",
    description:
      "Upload a CSV, XLSX, or PDF statement. The AI parser extracts every transaction, classifies merchants, and detects recurring expenses automatically.",
    icon: FileUp,
    tips: [
      "Supports SBI, HDFC, ICICI, Axis, UPI statements",
      "Password-protected PDFs: enter password when prompted",
      "Re-upload safe — duplicates are auto-skipped",
    ],
    href: "/transactions",
    cta: "Upload statement",
  },
  {
    number: "04",
    title: "Review the Dashboard",
    description:
      "See your income, spending, health score, and AI-generated recommendations at a glance. The dashboard refreshes every time new data arrives.",
    icon: LayoutDashboard,
    tips: [
      "Health score updates as you improve habits",
      "Top merchants show where your money actually goes",
      "Alerts surface risks (high debt ratio, unusual spend, etc.)",
    ],
    href: "/dashboard",
    cta: "Open Dashboard",
  },
  {
    number: "05",
    title: "Dive into Analysis",
    description:
      "Breakdown of savings rate, debt-to-income, expense control, and investment discipline. Get a personalized score out of 100.",
    icon: BarChart3,
    tips: [
      "Each sub-score explains what it measures",
      "Peer benchmarks unlock as more data is analyzed",
      "Follow the recommendations to raise your score",
    ],
    href: "/analysis",
    cta: "View Analysis",
  },
  {
    number: "06",
    title: "Create and track Goals",
    description:
      "Add financial goals (emergency fund, home, vehicle, retirement…). The simulator projects whether you'll hit your target and what monthly contribution is needed.",
    icon: Goal,
    tips: [
      "Required: Title, Target amount, Timeline (months)",
      "Success probability is re-computed on every update",
      "If 'Watch' appears — follow the recommended adjustment",
    ],
    href: "/goals",
    cta: "Add a goal",
  },
  {
    number: "07",
    title: "Ask the AI Copilot",
    description:
      "Chat with your AI Copilot for on-demand advice. It knows your transactions, goals, and risk profile — so answers are specific to you, not generic tips.",
    icon: Bot,
    tips: [
      "Try: 'Where am I overspending this month?'",
      "Try: 'How do I pay off my highest-interest loan faster?'",
      "Try: 'Am I saving enough for my house goal?'",
    ],
    href: "/chat",
    cta: "Open AI Copilot",
  },
];

const QUICK_TIPS = [
  "Use the red * markers — those fields must be filled to continue.",
  "Upload fresh statements monthly for accurate insights.",
  "Your data never leaves your account — we don't share it.",
  "The 6 AI agents run in the background automatically.",
];

export default function GuidePage() {
  const router = useRouter();
  const pageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
    }
  }, [router]);

  useGSAP(
    () => {
      if (!pageRef.current) return;
      const cards = pageRef.current.querySelectorAll("[data-animate='card']");
      if (cards.length === 0) return;
      gsap.fromTo(
        Array.from(cards),
        { autoAlpha: 0, y: 24 },
        { autoAlpha: 1, y: 0, duration: 0.55, stagger: 0.08, ease: "power3.out" },
      );
    },
    { scope: pageRef },
  );

  return (
    <AppShell>
      <div ref={pageRef} className="space-y-6">
        {/* Hero */}
        <Card data-animate="card" className="overflow-hidden border-border/60 bg-card/80 backdrop-blur-xl">
          <CardHeader className="border-b border-border/50 bg-gradient-to-r from-primary/10 via-transparent to-transparent">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2">
                <Badge variant="outline" className="rounded-full border-primary/25 bg-primary/10 text-[10px] uppercase tracking-[0.24em] text-primary">
                  Getting Started
                </Badge>
                <CardTitle className="text-3xl sm:text-4xl">How to use Finzova AI</CardTitle>
                <p className="max-w-2xl text-sm leading-7 text-muted-foreground">
                  A 7-step walkthrough to go from zero to full financial visibility.
                  Follow the steps in order the first time — after that, use the app however you like.
                </p>
              </div>
              <Link href="/onboarding">
                <Button size="lg">
                  Start now
                  <ArrowRight className="ml-2 size-4" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
            {QUICK_TIPS.map((tip, i) => (
              <div
                key={i}
                className="flex items-start gap-2 rounded-2xl border border-border/50 bg-background/30 p-3"
              >
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-400" />
                <p className="text-xs leading-6 text-muted-foreground">{tip}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Steps */}
        <div className="grid gap-4 lg:grid-cols-2">
          {STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <Card
                key={step.number}
                data-animate="card"
                className="group relative overflow-hidden border-border/60 bg-card/80 backdrop-blur-xl transition hover:border-primary/40"
              >
                <div className="pointer-events-none absolute -right-8 -top-8 text-[9rem] font-bold leading-none text-primary/5 select-none">
                  {step.number}
                </div>

                <CardHeader className="relative">
                  <div className="flex items-start gap-3">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary">
                      <Icon className="size-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-[0.24em] text-primary">Step {step.number}</p>
                      <CardTitle className="mt-1 text-xl">{step.title}</CardTitle>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="relative space-y-4">
                  <p className="text-sm leading-7 text-muted-foreground">{step.description}</p>

                  <ul className="space-y-2">
                    {step.tips.map((tip, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs leading-6 text-muted-foreground">
                        <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-400" />
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>

                  {step.href && step.cta && (
                    <Link href={step.href} className="inline-flex">
                      <Button variant="outline" size="sm" className="gap-2">
                        {step.cta}
                        <ArrowRight className="size-3.5" />
                      </Button>
                    </Link>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Footer */}
        <Card data-animate="card" className="border-border/60 bg-card/80 backdrop-blur-xl">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
            <div className="flex items-center gap-3">
              <Lock className="size-5 text-primary" />
              <div>
                <p className="font-medium">Your data is yours.</p>
                <p className="text-xs text-muted-foreground">
                  End-to-end encrypted. We never share or sell your financial data.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Link href="/transactions">
                <Button variant="outline">
                  <ReceiptText className="mr-2 size-4" />
                  Upload statement
                </Button>
              </Link>
              <Link href="/chat">
                <Button>
                  <Bot className="mr-2 size-4" />
                  Ask the Copilot
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
