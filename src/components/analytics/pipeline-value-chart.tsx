"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { GlassCard } from "@/components/shell/glass-card";
import type { DailyPipelinePoint } from "@/types/analytics";
import { ChartFrame } from "./chart-frame";

export function PipelineValueChart({ data }: { data: DailyPipelinePoint[] }) {
  const total = data.length > 0 ? data[data.length - 1].cumulativeCr : 0;

  return (
    <GlassCard className="p-6">
      <h2 className="font-serif text-xl">Pipeline value added</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Cumulative deal value of new leads entering the pipeline, last 30 days.
      </p>
      <p className="mt-3 font-serif text-3xl">₹{total.toFixed(1)} Cr</p>

      <div className="mt-4">
        <ChartFrame
          height={240}
          label={`Area chart: pipeline value added reached ${total.toFixed(1)} crore rupees over 30 days`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="#e7e7ea" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "#666670" }}
                interval="preserveStartEnd"
                minTickGap={28}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={56}
                tick={{ fontSize: 11, fill: "#666670" }}
                tickFormatter={(v: number) => `₹${Math.round(v)} Cr`}
              />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: "1px solid #e7e7ea", fontSize: 12 }}
                formatter={(value) => `₹${Number(value).toFixed(2)} Cr`}
              />
              <Area
                type="monotone"
                dataKey="cumulativeCr"
                name="Pipeline value added"
                stroke="#0b0b0f"
                strokeWidth={2}
                fill="#0b0b0f"
                fillOpacity={0.08}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartFrame>
      </div>
    </GlassCard>
  );
}