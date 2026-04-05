import { ArrowUpRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function MetricCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "default" | "positive" | "warning";
}) {
  const badgeClass =
    tone === "positive"
      ? "bg-emerald-500/15 text-emerald-300"
      : tone === "warning"
        ? "bg-amber-500/15 text-amber-200"
        : "bg-primary/15 text-primary";

  return (
    <Card className="border-border/60 bg-card/85 backdrop-blur-xl">
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <CardTitle className="mt-2 text-3xl font-semibold tracking-tight">{value}</CardTitle>
        </div>
        <Badge className={badgeClass}>
          <ArrowUpRight className="mr-1 size-3.5" />
          Live
        </Badge>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

