"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { GlassCard } from "@/components/shell/glass-card";
import { formatInr } from "@/lib/format";
import type { SourceRow } from "@/types/analytics";
import { ChartFrame } from "./chart-frame";

type SourcePerformanceProps = {
  sources: SourceRow[];
  totals: {
    leads: number;
    qualified: number;
    qualifiedPct: number;
    visits: number;
    bookings: number;
    totalCost: number;
    costPerBooking: number | null;
  };
};

const TH = "px-3 py-2.5 text-left text-xs font-medium text-muted-foreground";
const TD = "px-3 py-3 tabular-nums";

export function SourcePerformance({ sources, totals }: SourcePerformanceProps) {
  const chartData = sources.map((s) => ({
    name: s.label,
    Leads: s.leads,
    Qualified: s.qualified,
    Booked: s.bookings,
  }));

  return (
    <GlassCard className="p-6">
      <h2 className="font-serif text-xl">Source performance</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Which lead source brings quality, and what a booking costs from each. Cost per lead uses demo
        assumptions.
      </p>

      <div className="mt-5">
        <ChartFrame
          height={260}
          label="Bar chart comparing leads, qualified leads and bookings for each lead source. The table below has the same numbers."
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="#e7e7ea" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="name"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "#666670" }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={32}
                allowDecimals={false}
                tick={{ fontSize: 11, fill: "#666670" }}
              />
              <Tooltip
                cursor={{ fill: "rgba(11,11,15,0.04)" }}
                contentStyle={{ borderRadius: 12, border: "1px solid #e7e7ea", fontSize: 12 }}
              />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Leads" fill="#0b0b0f" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Qualified" fill="#1d4ed8" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Booked" fill="#15803d" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartFrame>
      </div>

      <div className="mt-5 overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[640px] text-sm">
          <caption className="sr-only">Lead source performance for the last 30 days</caption>
          <thead className="border-b border-border">
            <tr>
              <th scope="col" className={TH}>Source</th>
              <th scope="col" className={TH}>Leads</th>
              <th scope="col" className={TH}>Qualified</th>
              <th scope="col" className={TH}>Visits</th>
              <th scope="col" className={TH}>Bookings</th>
              <th scope="col" className={TH}>Cost / lead</th>
              <th scope="col" className={TH}>Cost / booking</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sources.map((s) => (
              <tr key={s.source}>
                <th scope="row" className="px-3 py-3 text-left font-medium">
                  {s.label}
                </th>
                <td className={TD}>{s.leads}</td>
                <td className={TD}>
                  {s.qualified} <span className="text-faint">({s.qualifiedPct}%)</span>
                </td>
                <td className={TD}>{s.visits}</td>
                <td className={TD}>{s.bookings}</td>
                <td className={TD}>{formatInr(s.costPerLead)}</td>
                <td className={TD}>
                  {s.costPerBooking !== null ? (
                    formatInr(s.costPerBooking)
                  ) : (
                    <span className="text-faint">No bookings yet</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-border bg-muted font-semibold">
            <tr>
              <th scope="row" className="px-3 py-3 text-left">All sources</th>
              <td className={TD}>{totals.leads}</td>
              <td className={TD}>
                {totals.qualified} <span className="font-normal text-faint">({totals.qualifiedPct}%)</span>
              </td>
              <td className={TD}>{totals.visits}</td>
              <td className={TD}>{totals.bookings}</td>
              <td className={TD}>
                {totals.leads > 0 ? formatInr(Math.round(totals.totalCost / totals.leads)) : "n/a"}
              </td>
              <td className={TD}>
                {totals.costPerBooking !== null ? formatInr(totals.costPerBooking) : "n/a"}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </GlassCard>
  );
}