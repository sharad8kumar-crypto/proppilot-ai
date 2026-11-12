"use client";

import { BadgeCheck, Target, Timer, Users } from "lucide-react";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { formatDuration } from "@/lib/format";

type AnalyticsSummaryProps = {
  leads: number;
  qualifiedPct: number;
  bookings: number;
  aiAvgSeconds: number | null;
  humanAvgSeconds: number | null;
};

export function AnalyticsSummary({
  leads,
  qualifiedPct,
  bookings,
  aiAvgSeconds,
  humanAvgSeconds,
}: AnalyticsSummaryProps) {
  return (
    <section
      aria-label="Summary for the last 30 days"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      <KpiCard
        index={0}
        label="Leads (30 days)"
        icon={Users}
        value={leads}
        hint="Across all sources"
        tone="info"
      />
      <KpiCard
        index={1}
        label="Qualified rate"
        icon={Target}
        value={qualifiedPct}
        suffix="%"
        hint="Leads that reached Qualified or beyond"
        tone="success"
      />
      <KpiCard
        index={2}
        label="Bookings"
        icon={BadgeCheck}
        value={bookings}
        hint="Leads in the Booked stage"
        tone="success"
      />
      <KpiCard
        index={3}
        label="Avg AI response"
        icon={Timer}
        value={aiAvgSeconds ?? 0}
        suffix="s"
        hint={
          humanAvgSeconds !== null
            ? `Sales team: ${formatDuration(humanAvgSeconds)}`
            : "No team baseline yet"
        }
        tone="gold"
      />
    </section>
  );
}