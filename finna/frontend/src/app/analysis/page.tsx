"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

import { AppShell } from "@/components/app-shell";

gsap.registerPlugin(useGSAP);
import { HealthGauge } from "@/components/health-gauge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getHealthScore, isAuthenticated } from "@/lib/api";
import { formatPercent } from "@/lib/format";
import type { HealthScoreData } from "@/lib/types";

export default function AnalysisPage() {
  const router = useRouter();
  const [health, setHealth] = useState<HealthScoreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const pageRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!pageRef.current) return;
      const cards = pageRef.current.querySelectorAll("[data-animate='card']");
      if (cards.length === 0) return;
      gsap.fromTo(
        Array.from(cards),
        { autoAlpha: 0, y: 28, scale: 0.98 },
        { autoAlpha: 1, y: 0, scale: 1, duration: 0.6, stagger: 0.12, ease: "power3.out" },
      );
    },
    { scope: pageRef },
  );

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const data = await getHealthScore();
        if (!cancelled) {
          setHealth(data);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load health analysis.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <AppShell>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      </AppShell>
    );
  }

  if (error || !health) {
    return (
      <AppShell>
        <div className="grid min-h-[60vh] place-items-center">
          <Card className="max-w-lg border-border/60 bg-card/80 backdrop-blur-xl">
            <CardContent className="space-y-3 p-8 text-center">
              <h2 className="text-2xl font-semibold">Analysis unavailable</h2>
              <p className="text-sm leading-7 text-muted-foreground">
                {error || "No live analysis data returned."}
              </p>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div ref={pageRef} className="grid gap-6 xl:grid-cols-[0.7fr_1.3fr]">
        <Card data-animate="card" className="border-border/60 bg-card/80 backdrop-blur-xl">
          <CardContent className="flex flex-col items-center gap-6 p-8">
            <HealthGauge score={health.score} />
            <div className="text-center">
              <p className="text-sm uppercase tracking-[0.28em] text-primary">Benchmark</p>
              {health.comparison.available ? (
                <>
                  <p className="mt-2 text-3xl font-semibold">{health.comparison.percentile}th percentile</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Average peer score across {health.comparison.sample_size} comparable accounts is {health.comparison.avg_score}.
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-2 text-2xl font-semibold">Your personal insight</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Showing individual analysis for now. Peer benchmarks unlock automatically as more data is analyzed.
                  </p>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card data-animate="card" className="border-border/60 bg-card/80 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-2xl">Financial health breakdown</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {Object.entries(health.breakdown).map(([key, value]) => (
              <div key={key} className="rounded-3xl border border-border/50 bg-background/30 p-5">
                <p className="text-sm capitalize text-muted-foreground">{key.replaceAll("_", " ")}</p>
                <div className="mt-4 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-3xl font-semibold">{value.score}</p>
                    <p className="text-sm text-muted-foreground">out of {value.max}</p>
                  </div>
                  <p className="text-sm text-primary">
                    {value.value < 1 ? formatPercent(value.value * 100) : value.value.toFixed(1)}
                  </p>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/8">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(8, (value.score / value.max) * 100)}%` }} />
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  Status: {value.status.replaceAll("_", " ")}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
