"use client";

import {
  Bot,
  CalendarCheck,
  IndianRupee,
  ShieldAlert,
  Timer,
  Users,
} from "lucide-react";
import { formatDuration } from "@/lib/format";
import { KpiCard } from "./kpi-card";

type KpiGridProps = {
  leadsToday: number;
  autoHandledPct: number;
  avgResponseSeconds: number;
  teamAvgSeconds: number;
  pipelineCr: number;
  visitsThisWeek: number;
  revenueAtRiskCr: number;
  atRiskCount: number;
};

export function KpiGrid({
  leadsToday,
  autoHandledPct,
  avgResponseSeconds,
  teamAvgSeconds,
  pipelineCr,
  visitsThisWeek,
  revenueAtRiskCr,
  atRiskCount,
}: KpiGridProps) {
  return (
    <section
      aria-label="Key metrics"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
    >
      <KpiCard
        index={0}
        label="Leads today"
        icon={Users}
        value={leadsToday}
        hint="Across all 6 sources"
        tone="info"
      />
      <KpiCard
        index={1}
        label="Auto-handled"
        icon={Bot}
        value={autoHandledPct}
        suffix="%"
        hint="AI replied within 60 seconds (30 days)"
        tone="success"
      />
      <KpiCard
        index={2}
        label="Avg AI response"
        icon={Timer}
        value={avgResponseSeconds}
        suffix="s"
        hint={`Team average is ${formatDuration(teamAvgSeconds)}`}
        tone="gold"
      />
      <KpiCard
        index={3}
        label="Pipeline value"
        icon={IndianRupee}
        value={pipelineCr}
        decimals={1}
        prefix="₹"
        suffix=" Cr"
        hint="Qualified, site visit and negotiation"
        tone="gold"
      />
      <KpiCard
        index={4}
        label="Site visits this week"
        icon={CalendarCheck}
        value={visitsThisWeek}
        hint="Booked by AI and agents"
        tone="success"
      />
      <KpiCard
        index={5}
        label="Revenue at risk"
        icon={ShieldAlert}
        value={revenueAtRiskCr}
        decimals={2}
        prefix="₹"
        suffix=" Cr"
        hint={`${atRiskCount} Hot leads untouched for 48h+`}
        tone="danger"
      />
    </section>
  );
}