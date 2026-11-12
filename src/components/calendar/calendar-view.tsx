"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { GlassCard } from "@/components/shell/glass-card";
import { MONTHS, WEEKDAYS, formatTimeIST, istDateKey } from "@/lib/visits";
import { cn } from "@/lib/utils";
import type { CalendarAgent, CalendarVisit } from "@/types/calendar";
import { VisitDrawer, VisitStatusChip } from "./visit-drawer";

const DAY_MS = 86_400_000;

// All date math below works on "YYYY-MM-DD" keys (IST calendar dates)
function addDays(key: string, days: number): string {
  return new Date(Date.parse(key) + days * DAY_MS).toISOString().slice(0, 10);
}

function mondayOf(key: string): string {
  const weekday = new Date(Date.parse(key)).getUTCDay(); // 0 = Sunday
  return addDays(key, -((weekday + 6) % 7));
}

function labelOf(key: string) {
  const d = new Date(Date.parse(key));
  return {
    weekday: WEEKDAYS[d.getUTCDay()],
    day: d.getUTCDate(),
    month: MONTHS[d.getUTCMonth()],
    year: d.getUTCFullYear(),
  };
}

type CalendarViewProps = {
  visits: CalendarVisit[];
  agents: CalendarAgent[];
  todayKey: string;
};

export function CalendarView({ visits, agents, todayKey }: CalendarViewProps) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const weekStart = addDays(mondayOf(todayKey), weekOffset * 7);
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  // visits grouped by IST date
  const byDay = useMemo(() => {
    const map = new Map<string, CalendarVisit[]>();
    for (const v of visits) {
      const key = istDateKey(new Date(v.scheduledAt));
      map.set(key, [...(map.get(key) ?? []), v]);
    }
    return map;
  }, [visits]);

  const weekVisits = days.flatMap((d) => byDay.get(d) ?? []);
  const selected = visits.find((v) => v.id === selectedId) ?? null;

  const first = labelOf(days[0]);
  const last = labelOf(days[6]);
  const rangeText = `${first.day} ${first.month} - ${last.day} ${last.month} ${last.year}`;

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <GlassCard className="flex flex-wrap items-center gap-3 p-4">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setWeekOffset((w) => w - 1)}
            aria-label="Previous week"
            className="grid size-9 place-items-center rounded-full bg-secondary hover:bg-accent"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => setWeekOffset((w) => w + 1)}
            aria-label="Next week"
            className="grid size-9 place-items-center rounded-full bg-secondary hover:bg-accent"
          >
            <ChevronRight className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => setWeekOffset(0)}
            disabled={weekOffset === 0}
            className="ml-1 rounded-full bg-secondary px-3.5 py-2 text-xs font-medium hover:bg-accent disabled:opacity-40"
          >
            This week
          </button>
        </div>

        <p className="font-serif text-lg" aria-live="polite">
          {rangeText}
        </p>
        <p className="text-xs text-muted-foreground">
          {weekVisits.length} visit{weekVisits.length === 1 ? "" : "s"}
        </p>

        {/* Agent legend */}
        <ul className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-2" aria-label="Agents">
          {agents.map((a) => {
            const count = weekVisits.filter((v) => v.agent?.id === a.id).length;
            return (
              <li key={a.id} className="flex items-center gap-1.5 text-xs">
                <span
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: a.color }}
                  aria-hidden
                />
                {a.name}
                <span className="text-faint">({count})</span>
              </li>
            );
          })}
        </ul>
      </GlassCard>

      {/* Week grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {days.map((key) => {
          const label = labelOf(key);
          const isToday = key === todayKey;
          const dayVisits = byDay.get(key) ?? [];

          return (
            <section
              key={key}
              aria-label={`${label.weekday} ${label.day} ${label.month}`}
              className={cn(
                "flex min-h-40 flex-col rounded-2xl border bg-muted p-3",
                isToday ? "border-primary" : "border-border"
              )}
            >
              <header className="mb-3 flex items-baseline justify-between">
                <p className="text-sm font-semibold">{label.weekday}</p>
                <p
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs",
                    isToday
                      ? "bg-primary font-semibold text-primary-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  {label.day} {label.month}
                </p>
              </header>

              {dayVisits.length === 0 ? (
                <p className="my-auto text-center text-xs text-faint">No visits</p>
              ) : (
                <ul className="space-y-2">
                  {dayVisits.map((v) => (
                    <li key={v.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(v.id)}
                        aria-label={`${formatTimeIST(new Date(v.scheduledAt))}, ${v.lead?.name ?? "Lead"}, ${v.agent?.name ?? "unassigned"}`}
                        className="block w-full rounded-xl border border-border border-l-4 bg-surface p-2.5 text-left transition-shadow hover:shadow-md hover:shadow-black/5"
                        style={{ borderLeftColor: v.agent?.color ?? "#8a8a93" }}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold">
                            {formatTimeIST(new Date(v.scheduledAt))}
                          </span>
                          <VisitStatusChip status={v.status} />
                        </span>
                        <span className="mt-1 block truncate text-sm font-medium">
                          {v.lead?.name ?? "Lead"}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {v.property?.title ?? "No property selected"}
                        </span>
                        <span className="mt-1 block truncate text-[11px] text-faint">
                          {v.agent?.name ?? "Unassigned"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      {weekVisits.length === 0 && (
        <p className="text-center text-sm text-muted-foreground">
          No visits this week. Ask for a visit in the Inbox chat (for example
          &quot;Kal 11 baje visit karna hai&quot;) and it will appear here live.
        </p>
      )}

      <VisitDrawer visit={selected} onClose={() => setSelectedId(null)} />
    </div>
  );
}