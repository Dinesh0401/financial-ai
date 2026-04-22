"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { formatCurrency } from "@/lib/format";
import type { CashflowPoint } from "@/lib/types";

export function CashflowChart({ data }: { data: CashflowPoint[] }) {
  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-chart-2)" stopOpacity={0.7} />
              <stop offset="95%" stopColor="var(--color-chart-2)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="expenseFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-chart-1)" stopOpacity={0.7} />
              <stop offset="95%" stopColor="var(--color-chart-1)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={12} />
          <YAxis tickFormatter={(value) => `${Math.round(value / 1000)}k`} tickLine={false} axisLine={false} />
          <Tooltip
            cursor={{ stroke: "rgba(255,255,255,0.2)", strokeWidth: 1 }}
            contentStyle={{
              background: "rgba(19, 25, 44, 0.92)",
              borderRadius: 18,
              border: "1px solid rgba(255,255,255,0.08)",
            }}
            formatter={(value) =>
              typeof value === "number" ? formatCurrency(value) : String(value ?? "")
            }
          />
          <Area type="monotone" dataKey="income" stroke="var(--color-chart-2)" fill="url(#incomeFill)" strokeWidth={2.5} />
          <Area type="monotone" dataKey="expenses" stroke="var(--color-chart-1)" fill="url(#expenseFill)" strokeWidth={2.5} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
