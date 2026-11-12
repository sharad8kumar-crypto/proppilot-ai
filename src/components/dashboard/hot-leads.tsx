import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { GlassCard } from "@/components/shell/glass-card";
import { SourceBadge, TemperatureBadge } from "@/components/shared/badges";
import { AT_RISK_HOURS } from "@/lib/metrics";
import { formatBudget, formatHours, formatInr, initialsOf } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DashboardLead } from "@/types";

function budgetText(min: number | null, max: number | null): string {
  if (min !== null && max !== null) return formatBudget(min, max);
  if (max !== null) return `Up to ${formatInr(max)}`;
  if (min !== null) return `From ${formatInr(min)}`;
  return "Budget not shared";
}

export function HotLeads({ leads }: { leads: DashboardLead[] }) {
  // Hot leads that have been waiting the longest come first
  const rows = leads
    .filter((l) => l.temperature === "hot" && l.stage !== "booked" && l.stage !== "lost")
    .sort((a, b) => b.untouchedHours - a.untouchedHours)
    .slice(0, 5);

  return (
    <GlassCard className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-xl">Hot leads needing attention</h2>
          <p className="mt-1 text-sm text-muted-foreground">Longest waiting first.</p>
        </div>
        <Link
          href="/inbox"
          className="flex items-center gap-1 text-xs font-medium text-foreground hover:underline"
        >
          Open inbox <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No Hot leads waiting. Open the Inbox and press + to simulate a new lead.
        </p>
      ) : (
        <ul className="mt-5 divide-y divide-border">
          {rows.map((lead) => {
            const atRisk = lead.untouchedHours >= AT_RISK_HOURS;
            return (
              <li
                key={lead.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold">
                  {initialsOf(lead.name)}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    {lead.name}
                    <SourceBadge source={lead.source} />
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {lead.bhk ? `${lead.bhk} BHK` : "BHK not set"} ·{" "}
                    {lead.locality ?? "Location not set"} ·{" "}
                    {budgetText(lead.budgetMin, lead.budgetMax)}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "text-xs",
                      atRisk ? "font-medium text-danger" : "text-muted-foreground"
                    )}
                  >
                    {formatHours(lead.untouchedHours)}
                  </span>
                  <span
                    className="grid size-9 place-items-center rounded-full border border-border bg-surface font-serif text-sm"
                    title="Lead score out of 100"
                  >
                    {lead.score}
                  </span>
                  <TemperatureBadge temperature={lead.temperature} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </GlassCard>
  );
}