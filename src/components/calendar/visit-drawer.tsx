"use client";

import Link from "next/link";
import { CalendarClock, MapPin, UserRound } from "lucide-react";
import { SourceBadge, TemperatureBadge } from "@/components/shared/badges";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { formatInr } from "@/lib/format";
import { formatSlotAbsolute } from "@/lib/visits";
import { cn } from "@/lib/utils";
import type { CalendarVisit, VisitStatus } from "@/types/calendar";

export const STATUS_META: Record<VisitStatus, { label: string; className: string }> = {
  scheduled: { label: "Scheduled", className: "bg-info/10 text-info ring-info/25" },
  completed: { label: "Completed", className: "bg-success/10 text-success ring-success/25" },
  no_show: { label: "No-show", className: "bg-danger/10 text-danger ring-danger/25" },
  rescheduled: { label: "Rescheduled", className: "bg-warning/10 text-warning ring-warning/25" },
};

export function VisitStatusChip({ status }: { status: VisitStatus }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-background px-2 py-0.5 text-[11px] font-semibold ring-1",
        meta.className
      )}
    >
      {meta.label}
    </span>
  );
}

type VisitDrawerProps = {
  visit: CalendarVisit | null;
  onClose: () => void;
};

export function VisitDrawer({ visit, onClose }: VisitDrawerProps) {
  return (
    <Sheet
      open={visit !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent side="right" className="w-full overflow-y-auto bg-background sm:max-w-md">
        <SheetTitle className="sr-only">Site visit details</SheetTitle>
        {visit && (
          <div className="space-y-6 p-5 pt-10">
            <header>
              <VisitStatusChip status={visit.status} />
              <p className="mt-3 flex items-center gap-2 font-serif text-2xl">
                <CalendarClock className="size-6" aria-hidden />
                {formatSlotAbsolute(new Date(visit.scheduledAt))}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">India Standard Time</p>
            </header>

            <section className="rounded-2xl border border-border bg-muted p-4">
              <h3 className="flex items-center gap-2 font-serif text-base">
                <UserRound className="size-4" aria-hidden />
                Lead
              </h3>
              {visit.lead ? (
                <>
                  <p className="mt-2 flex flex-wrap items-center gap-2 text-sm font-medium">
                    {visit.lead.name}
                    <SourceBadge source={visit.lead.source} />
                    <TemperatureBadge temperature={visit.lead.temperature} />
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Lead score {visit.lead.score} / 100
                  </p>
                  <Link
                    href="/inbox"
                    className="mt-3 inline-block text-xs font-medium underline-offset-2 hover:underline"
                  >
                    Open Inbox
                  </Link>
                </>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">Lead no longer exists.</p>
              )}
            </section>

            <section className="rounded-2xl border border-border bg-muted p-4">
              <h3 className="flex items-center gap-2 font-serif text-base">
                <MapPin className="size-4" aria-hidden />
                Property
              </h3>
              {visit.property ? (
                <>
                  <p className="mt-2 text-sm font-medium">{visit.property.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {visit.property.locality}, {visit.property.city}
                  </p>
                  <p className="mt-2 font-serif text-lg">{formatInr(visit.property.price)}</p>
                </>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  No specific property selected for this visit.
                </p>
              )}
            </section>

            <section className="rounded-2xl border border-border bg-muted p-4">
              <h3 className="font-serif text-base">Agent</h3>
              {visit.agent ? (
                <p className="mt-2 flex items-center gap-2 text-sm font-medium">
                  <span
                    className="size-3 rounded-full"
                    style={{ backgroundColor: visit.agent.color }}
                    aria-hidden
                  />
                  {visit.agent.name}
                </p>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">Unassigned</p>
              )}
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}