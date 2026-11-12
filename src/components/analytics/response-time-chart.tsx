"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { GlassCard } from "@/components/shell/glass-card";
import { formatDuration } from "@/lib/format";
import type { DailyResponsePoint } from "@/types/analytics";
import { ChartFrame } from "./chart-frame";

type ResponseTimeChartProps = {
  data: DailyResponsePoint[];
  aiSeconds: number | null;
  humanSeconds: number | null;
};

const minutesTick = (v: number) => (v >= 60 ? `${Math.round(v / 60)}h` : `${Math.round(v)}m`);

export function ResponseTimeChart({ data, aiSeconds, humanSeconds }: ResponseTimeChartProps) {
  return (
    <GlassCard className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-serif text-xl">AI vs human response time</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Average first reply to a new lead, last 30 days. Human times are the seeded team baseline.
          </p>
        </div>
        <div className="flex gap-6 text-right">
          <div>
            <p className="text-xs text-muted-foreground">PropPilot AI</p>
            <p className="font-serif text-2xl">
              {aiSeconds !== null ? formatDuration(aiSeconds) : "n/a"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Sales team</p>
            <p className="font-serif text-2xl text-danger">
              {humanSeconds !== null ? formatDuration(humanSeconds) : "n/a"}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5">
        <ChartFrame
          height={280}
          label={`Line chart: AI replies in ${aiSeconds !== null ? formatDuration(aiSeconds) : "seconds"}, the sales team takes ${humanSeconds !== null ? formatDuration(humanSeconds) : "hours"} on average`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
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
                width={44}
                tick={{ fontSize: 11, fill: "#666670" }}
                tickFormatter={minutesTick}
              />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: "1px solid #e7e7ea", fontSize: 12 }}
                formatter={(value) => formatDuration(Number(value) * 60)}
              />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              <Line
                type="monotone"
                dataKey="humanMinutes"
                name="Sales team"
                stroke="#d6333a"
                strokeWidth={2}
                dot={false}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="aiMinutes"
                name="PropPilot AI"
                stroke="#0b0b0f"
                strokeWidth={2.5}
                dot={false}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartFrame>
      </div>
    </GlassCard>
  );
}