"use client";

import type { ComponentType } from "react";
import { Loader2, Network, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type AgentDescriptor = {
  name: string;
  icon: ComponentType<{ className?: string }>;
  desc: string;
};

function normalizeAgentName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\bagent\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function AgentStatusCard({
  agents,
  activeAgents,
}: {
  agents: AgentDescriptor[];
  activeAgents: string[];
}) {
  const activeCount = agents.filter((agent) =>
    activeAgents.some((current) => normalizeAgentName(current) === normalizeAgentName(agent.name)),
  ).length;

  return (
    <Card className="overflow-hidden border-border/60 bg-card/80 shadow-[0_20px_50px_-35px_rgba(0,0,0,0.65)] backdrop-blur-xl">
      <div className="border-b border-border/50 bg-gradient-to-r from-primary/10 via-transparent to-transparent">
        <CardHeader className="space-y-3 pb-4">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Network className="size-5 text-primary" />
              Agent Activity
            </CardTitle>
            <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/10 text-[10px] uppercase tracking-[0.24em] text-primary">
              {activeCount} active
            </Badge>
          </div>
          <p className="text-xs leading-6 text-muted-foreground">
            Specialist agents available for live analysis and conflict resolution.
          </p>
        </CardHeader>
      </div>
      <CardContent className="space-y-2 p-4">
        {agents.map(({ name, icon: Icon, desc }) => {
          const active = activeAgents.some(
            (current) => normalizeAgentName(current) === normalizeAgentName(name),
          );

          return (
            <div
              key={name}
              className={cn(
                "flex items-start gap-3 rounded-3xl border px-3 py-3 text-sm transition-all",
                active
                  ? "border-primary/35 bg-gradient-to-r from-primary/12 via-primary/8 to-background/30 text-foreground shadow-[0_10px_30px_-24px_rgba(0,0,0,0.55)]"
                  : "border-border/50 bg-background/30 text-muted-foreground",
              )}
            >
              <div
                className={cn(
                  "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-2xl",
                  active ? "bg-primary/15 text-primary" : "bg-background/60 text-muted-foreground",
                )}
              >
                <Icon className="size-4.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground">{name}</p>
                  {active ? (
                    <Badge className="rounded-full bg-emerald-500/15 text-[10px] uppercase tracking-[0.24em] text-emerald-300">
                      Active
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="rounded-full border-border/70 bg-background/60 text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                      Idle
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-xs leading-6 text-muted-foreground">{desc}</p>
              </div>
              {active ? <Loader2 className="mt-1 size-3.5 shrink-0 animate-spin text-primary" /> : null}
            </div>
          );
        })}

        {activeCount === 0 && (
          <div className="rounded-3xl border border-dashed border-border/60 bg-background/25 px-4 py-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2 text-primary">
              <Sparkles className="size-4" />
              Waiting for the next financial question
            </div>
            <p className="mt-2 leading-6">
              Ask about spending, goals, investments, or tax planning to activate the right specialist agents.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
