import { Suspense } from "react";
import { connection } from "next/server";
import { CalendarView } from "@/components/calendar/calendar-view";
import { LiveRefresh } from "@/components/dashboard/live-refresh";
import { GlassCard } from "@/components/shell/glass-card";
import { PageHeader } from "@/components/shell/page-header";
import { getCalendarData } from "@/lib/calendar-data";

function CalendarSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true">
      <GlassCard className="h-16 animate-pulse" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {Array.from({ length: 7 }).map((_, i) => (
          <GlassCard key={i} className="h-48 animate-pulse" />
        ))}
      </div>
    </div>
  );
}

// Reads fresh data on every request, streamed in behind Suspense
async function CalendarContent() {
  await connection();

  let data: Awaited<ReturnType<typeof getCalendarData>> | null = null;
  let loadError: string | null = null;

  try {
    data = await getCalendarData();
  } catch (err) {
    loadError = err instanceof Error ? err.message : String(err);
    console.error("[calendar] failed to load:", loadError);
  }

  if (!data) {
    return (
      <GlassCard className="p-6" role="alert">
        <h2 className="font-serif text-xl">Could not load the calendar</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Check your .env.local keys and run <code>npm run seed</code>.
        </p>
        {process.env.NODE_ENV !== "production" && loadError && (
          <p className="mt-3 rounded-xl bg-danger/10 px-3 py-2 text-xs text-danger">
            {loadError}
          </p>
        )}
      </GlassCard>
    );
  }

  return (
    <>
      <LiveRefresh />
      <CalendarView visits={data.visits} agents={data.agents} todayKey={data.todayKey} />
    </>
  );
}

export default function CalendarPage() {
  return (
    <>
      <PageHeader
        title="Calendar"
        description="Site visits booked by AI and agents appear here live (India Standard Time)."
      />
      <Suspense fallback={<CalendarSkeleton />}>
        <CalendarContent />
      </Suspense>
    </>
  );
}