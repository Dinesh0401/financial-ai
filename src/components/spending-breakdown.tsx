"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { formatCurrency } from "@/lib/format";

const palette = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "var(--color-primary)",
];

export function SpendingBreakdown({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data).map(([name, value]) => ({ name, value }));

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <div className="h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={entries} dataKey="value" innerRadius={62} outerRadius={96} paddingAngle={4}>
              {entries.map((entry, index) => (
                <Cell key={entry.name} fill={palette[index % palette.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: "rgba(19, 25, 44, 0.92)",
                borderRadius: 18,
                border: "1px solid rgba(255,255,255,0.08)",
              }}
              formatter={(value) =>
                typeof value === "number" ? formatCurrency(value) : String(value ?? "")
              }
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="space-y-3">
        {entries.map((entry, index) => (
          <div
            key={entry.name}
            className="flex items-center justify-between rounded-2xl border border-border/50 bg-background/40 px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <span
                className="size-3 rounded-full"
                style={{ backgroundColor: palette[index % palette.length] }}
              />
              <span className="text-sm capitalize text-foreground">{entry.name.replaceAll("_", " ")}</span>
            </div>
            <span className="text-sm text-muted-foreground">{formatCurrency(entry.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
