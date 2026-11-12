"use client";

import { useState } from "react";
import { ChevronDown, Sparkles } from "lucide-react";
import { TemperatureBadge, SourceBadge } from "@/components/shared/badges";
import {
  formatBudget,
  formatDuration,
  formatInr,
  initialsOf,
  leadDisplayName,
  titleCase,
} from "@/lib/format";
import { SCORE_MAX } from "@/lib/scoring";
import { suggestNextAction } from "@/lib/suggest";
import { cn } from "@/lib/utils";
import type { LeadRow, ScoreBreakdown } from "@/types/db";
import type { AgentRow } from "./use-inbox";
import { ScoreGauge } from "./score-gauge";

const BREAKDOWN_ROWS: { key: keyof typeof SCORE_MAX; label: string }[] = [
  { key: "timeline", label: "Timeline urgency" },
  { key: "budget", label: "Budget clarity" },
  { key: "specificity", label: "Location + BHK" },
  { key: "loan_purpose", label: "Loan + purpose" },
  { key: "engagement", label: "Engagement" },
  { key: "visit_intent", label: "Site visit intent" },
];

function budgetLabel(min: number | null, max: number | null): string | null {
  if (min !== null && max !== null) return formatBudget(min, max);
  if (max !== null) return `Up to ${formatInr(max)}`;
  if (min !== null) return `From ${formatInr(min)}`;
  return null;
}

function ProfileRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "text-right text-sm",
          value ? "font-medium" : "text-faint"
        )}
      >
        {value ?? "Not shared yet"}
      </dd>
    </div>
  );
}

function BreakdownList({ breakdown }: { breakdown: ScoreBreakdown }) {
  return (
    <ul className="mt-3 space-y-3">
      {BREAKDOWN_ROWS.map(({ key, label }) => {
        const points = breakdown[key];
        const max = SCORE_MAX[key];
        return (
          <li key={key}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{label}</span>
              <span className="font-medium tabular-nums">
                {points} / {max}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${(points / max) * 100}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function InsightsPanel({
  lead,
  agents,
}: {
  lead: LeadRow;
  agents: AgentRow[];
}) {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const agent = agents.find((a) => a.id === lead.assigned_agent_id) ?? null;
  const action = suggestNextAction(lead);

  const loanText =
    lead.needs_loan === null ? null : lead.needs_loan ? "Needs a home loan" : "No loan needed";

  return (
    <div className="space-y-4">
      {/* Header + gauge */}
      <section className="rounded-2xl border border-border bg-muted p-5">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            {initialsOf(lead.name)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{leadDisplayName(lead)}</p>
            <p className="mt-0.5 flex items-center gap-1.5">
              <SourceBadge source={lead.source} />
              <TemperatureBadge temperature={lead.temperature} />
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-col items-center">
          <ScoreGauge
            key={lead.id}
            score={lead.score}
            temperature={lead.temperature}
          />
          <p className="mt-3 text-xs text-muted-foreground">
            Intent:{" "}
            <span className="font-medium text-foreground">
              {lead.intent ? titleCase(lead.intent) : "Not detected yet"}
            </span>
          </p>
        </div>

        {/* Score breakdown (expand to see why) */}
        <button
          type="button"
          onClick={() => setShowBreakdown((v) => !v)}
          aria-expanded={showBreakdown}
          className="mt-4 flex w-full items-center justify-between rounded-xl bg-background px-3 py-2.5 text-xs font-medium"
        >
          How is this score calculated?
          <ChevronDown
            className={cn("size-4 transition-transform", showBreakdown && "rotate-180")}
            aria-hidden
          />
        </button>
        {showBreakdown &&
          (lead.score_breakdown ? (
            <>
              <BreakdownList breakdown={lead.score_breakdown} />
              <p className="mt-3 text-[11px] text-faint">
                Rule-based scoring in code, not AI. Hot 70+, Warm 40-69, Cold below 40.
              </p>
            </>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">
              No breakdown yet. It appears after the first AI reply.
            </p>
          ))}
      </section>

      {/* Buyer profile */}
      <section className="rounded-2xl border border-border bg-muted p-5">
        <h3 className="font-serif text-base">Buyer profile</h3>
        <dl className="mt-2 divide-y divide-border">
          <ProfileRow label="Budget" value={budgetLabel(lead.budget_min, lead.budget_max)} />
          <ProfileRow label="BHK" value={lead.bhk !== null ? `${lead.bhk} BHK` : null} />
          <ProfileRow
            label="Locations"
            value={lead.preferred_locations.length ? lead.preferred_locations.join(", ") : null}
          />
          <ProfileRow
            label="Timeline"
            value={lead.timeline !== "unknown" ? lead.timeline : null}
          />
          <ProfileRow label="Home loan" value={loanText} />
          <ProfileRow
            label="Purpose"
            value={lead.purpose !== "unknown" ? titleCase(lead.purpose) : null}
          />
        </dl>
      </section>

      {/* AI summary + next action */}
      <section className="rounded-2xl border border-border bg-muted p-5">
        <h3 className="font-serif text-base">AI summary</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {lead.summary ?? "The AI will summarize this lead after the first reply."}
        </p>

        <div className="mt-4 rounded-xl bg-primary p-4 text-primary-foreground">
          <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-primary-foreground/70">
            <Sparkles className="size-3.5" aria-hidden />
            Suggested next action
          </p>
          <p className="mt-1.5 text-sm font-semibold">{action.title}</p>
          <p className="mt-1 text-xs leading-relaxed text-primary-foreground/80">
            {action.detail}
          </p>
        </div>
      </section>

      {/* Meta */}
      <section className="rounded-2xl border border-border bg-muted p-5">
        <dl className="divide-y divide-border">
          <div className="flex items-center justify-between gap-4 py-2">
            <dt className="text-xs text-muted-foreground">Assigned agent</dt>
            <dd className="flex items-center gap-2 text-sm font-medium">
              {agent ? (
                <>
                  <span
                    className="grid size-6 place-items-center rounded-full text-[10px] font-semibold text-white"
                    style={{ backgroundColor: agent.color }}
                    aria-hidden
                  >
                    {initialsOf(agent.name)}
                  </span>
                  {agent.name}
                </>
              ) : (
                <span className="font-normal text-faint">Unassigned</span>
              )}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4 py-2">
            <dt className="text-xs text-muted-foreground">Stage</dt>
            <dd className="text-sm font-medium">{titleCase(lead.stage)}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 py-2">
            <dt className="text-xs text-muted-foreground">Est. deal value</dt>
            <dd className="text-sm font-medium">
              {lead.deal_value_estimate !== null ? formatInr(lead.deal_value_estimate) : "Not known yet"}
            </dd>
          </div>
          {lead.first_response_ms !== null && (
            <div className="flex items-center justify-between gap-4 py-2">
              <dt className="text-xs text-muted-foreground">First response</dt>
              <dd className="text-right text-sm font-medium">
                AI {formatDuration(lead.first_response_ms / 1000)}
                {lead.human_baseline_ms !== null && (
                  <span className="block text-[11px] font-normal text-faint">
                    typical team {formatDuration(lead.human_baseline_ms / 1000)}
                  </span>
                )}
              </dd>
            </div>
          )}
        </dl>
      </section>
    </div>
  );
}