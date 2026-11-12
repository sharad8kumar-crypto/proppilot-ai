"use client";

import { useEffect, useState } from "react";
import { SourceBadge, TemperatureBadge } from "@/components/shared/badges";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { budgetText } from "@/lib/budget";
import { stepLabel } from "@/lib/followups";
import { formatInr, initialsOf } from "@/lib/format";
import { STAGES, isStage } from "@/lib/stages";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { formatSlotAbsolute } from "@/lib/visits";
import { cn } from "@/lib/utils";
import type { FollowupRow, FollowupStatus, Stage } from "@/types/db";
import type { PipelineLead } from "@/types/pipeline";

const STATUS_STYLE: Record<FollowupStatus, string> = {
  pending: "bg-info/10 text-info ring-info/25",
  sent: "bg-success/10 text-success ring-success/25",
  cancelled: "bg-secondary text-muted-foreground ring-border",
};

// Loads this lead's follow-up sequence (public read via RLS)
function useFollowups(leadId: string) {
  const [state, setState] = useState<{ id: string; rows: FollowupRow[] } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const db = getSupabaseBrowser();
      const { data, error } = await db
        .from("followups")
        .select("*")
        .eq("lead_id", leadId)
        .order("scheduled_for", { ascending: true });
      if (cancelled) return;
      setState({ id: leadId, rows: error ? [] : ((data ?? []) as FollowupRow[]) });
    })();
    return () => {
      cancelled = true;
    };
  }, [leadId]);

  const loading = state === null || state.id !== leadId;
  return { loading, rows: loading ? [] : state.rows };
}

function FollowupList({ leadId }: { leadId: string }) {
  const { loading, rows } = useFollowups(leadId);

  if (loading) {
    return <div className="mt-3 h-20 animate-pulse rounded-xl bg-muted" />;
  }

  if (rows.length === 0) {
    return (
      <p className="mt-3 rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
        No follow-ups yet. The sequence is created from the lead&apos;s temperature once the AI has
        chatted with them.
      </p>
    );
  }

  return (
    <ol className="mt-3 space-y-2.5">
      {rows.map((r) => (
        <li key={r.id} className="rounded-xl border border-border bg-surface p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">{stepLabel(r.step)}</p>
            <span
              className={cn(
                "rounded-full bg-background px-2 py-0.5 text-[11px] font-semibold capitalize ring-1",
                STATUS_STYLE[r.status]
              )}
            >
              {r.status}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {r.status === "sent" ? "Sent" : "Scheduled"}{" "}
            {formatSlotAbsolute(new Date(r.sent_at ?? r.scheduled_for))}
          </p>
          {r.message && (
            <p className="mt-2 rounded-lg bg-muted px-3 py-2 text-xs leading-relaxed">{r.message}</p>
          )}
        </li>
      ))}
    </ol>
  );
}

function DrawerBody({
  lead,
  onMove,
}: {
  lead: PipelineLead;
  onMove: (id: string, stage: Stage) => void;
}) {
  return (
    <div className="space-y-6 p-5 pt-10">
      <header>
        <div className="flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
            {initialsOf(lead.name)}
          </span>
          <div className="min-w-0">
            <h2 className="truncate font-serif text-xl">{lead.name}</h2>
            <p className="mt-1 flex items-center gap-1.5">
              <SourceBadge source={lead.source} />
              <TemperatureBadge temperature={lead.temperature} />
            </p>
          </div>
        </div>
        {lead.summary && (
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{lead.summary}</p>
        )}
      </header>

      <dl className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-muted p-3">
          <dt className="text-[11px] text-muted-foreground">Lead score</dt>
          <dd className="mt-0.5 text-sm font-semibold">{lead.score} / 100</dd>
        </div>
        <div className="rounded-xl bg-muted p-3">
          <dt className="text-[11px] text-muted-foreground">Est. deal value</dt>
          <dd className="mt-0.5 text-sm font-semibold">
            {lead.dealValue > 0 ? formatInr(lead.dealValue) : "Not known yet"}
          </dd>
        </div>
        <div className="rounded-xl bg-muted p-3">
          <dt className="text-[11px] text-muted-foreground">Requirement</dt>
          <dd className="mt-0.5 text-sm font-semibold">
            {lead.bhk ? `${lead.bhk} BHK` : "BHK not set"}
            <span className="block text-xs font-normal text-muted-foreground">
              {budgetText(lead.budgetMin, lead.budgetMax)}
            </span>
          </dd>
        </div>
        <div className="rounded-xl bg-muted p-3">
          <dt className="text-[11px] text-muted-foreground">Agent</dt>
          <dd className="mt-0.5 flex items-center gap-2 text-sm font-semibold">
            {lead.agent ? (
              <>
                <span
                  className="size-3 rounded-full"
                  style={{ backgroundColor: lead.agent.color }}
                  aria-hidden
                />
                {lead.agent.name}
              </>
            ) : (
              <span className="font-normal text-faint">Unassigned</span>
            )}
          </dd>
        </div>
      </dl>

      <div>
        <label htmlFor="drawer-stage" className="text-sm font-medium">
          Pipeline stage
        </label>
        <select
          id="drawer-stage"
          value={lead.stage}
          onChange={(e) => {
            if (isStage(e.target.value)) onMove(lead.id, e.target.value);
          }}
          className="mt-1.5 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus-visible:border-primary"
        >
          {STAGES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <section>
        <h3 className="font-serif text-base">Follow-up sequence</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Automatic follow-ups for a {lead.temperature} lead. Times are India Standard Time.
        </p>
        <FollowupList leadId={lead.id} />
      </section>
    </div>
  );
}

type LeadDrawerProps = {
  lead: PipelineLead | null;
  onClose: () => void;
  onMove: (id: string, stage: Stage) => void;
};

export function LeadDrawer({ lead, onClose, onMove }: LeadDrawerProps) {
  return (
    <Sheet
      open={lead !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent side="right" className="w-full overflow-y-auto bg-background p-0 sm:max-w-md">
        <SheetTitle className="sr-only">{lead?.name ?? "Lead details"}</SheetTitle>
        {lead && <DrawerBody key={lead.id} lead={lead} onMove={onMove} />}
      </SheetContent>
    </Sheet>
  );
}