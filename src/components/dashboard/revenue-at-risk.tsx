"use client";

import { ShieldAlert } from "lucide-react";
import { GlassCard } from "@/components/shell/glass-card";
import { formatHours, formatInr } from "@/lib/format";
import { CountUp } from "./count-up";

type RiskLead = {
  id: string;
  name: string;
  value: number; // INR
  untouchedHours: number;
};

type RevenueAtRiskProps = {
  totalInr: number;
  count: number;
  leads: RiskLead[];
};

export function RevenueAtRisk({ totalInr, count, leads }: RevenueAtRiskProps) {
  return (
    <GlassCard className="flex h-full flex-col border-danger/20 p-6">
      <div className="flex items-center gap-2">
        <span className="grid size-8 place-items-center rounded-lg bg-danger/10 text-danger">
          <ShieldAlert className="size-4" aria-hidden />
        </span>
        <h2 className="font-serif text-xl">Revenue at risk</h2>
      </div>

      <p className="mt-5 font-serif text-5xl text-danger">
        <CountUp
          value={totalInr / 10_000_000}
          decimals={2}
          prefix="₹"
          suffix=" Cr"
        />
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        {count} Hot leads have had no human touch for 48h or more.
      </p>

      <ul className="mt-5 space-y-3">
        {leads.slice(0, 3).map((lead) => (
          <li
            key={lead.id}
            className="flex items-center justify-between rounded-xl border border-border bg-surface px-3 py-2.5 text-sm"
          >
            <span>
              <span className="block font-medium">{lead.name}</span>
              <span className="text-xs text-danger">
                {formatHours(lead.untouchedHours)} untouched
              </span>
            </span>
            <span className="font-serif text-base">{formatInr(lead.value)}</span>
          </li>
        ))}
      </ul>

      <p className="mt-auto pt-5 text-[11px] text-faint">
        Computed from live lead data: Hot leads untouched for 48h+, valued at
        the midpoint of their budget.
      </p>
    </GlassCard>
  );
}