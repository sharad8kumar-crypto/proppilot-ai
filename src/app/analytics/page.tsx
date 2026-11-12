import { Suspense } from "react";
import { connection } from "next/server";
import { AgentLeaderboard } from "@/components/analytics/agent-leaderboard";
import { AnalyticsSummary } from "@/components/analytics/analytics-summary";
import { PipelineValueChart } from "@/components/analytics/pipeline-value-chart";
import { ResponseTimeChart } from "@/components/analytics/response-time-chart";
import { RoiCalculator } from "@/components/analytics/roi-calculator";
import { SourcePerformance } from "@/components/analytics/source-performance";
import { FunnelChart } from "@/components/dashboard/funnel-chart";
import { LiveRefresh } from "@/components/dashboard/live-refresh";
import { GlassCard } from "@/components/shell/glass-card";
import { PageHeader } from "@/components/shell/page-header";
import { getAnalyticsData } from "@/lib/analytics-data";

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <GlassCard key={i} className="h-32 animate-pulse" />
        ))}
      </div>
      <GlassCard className="h-96 animate-pulse" />
    </div>
  );
}

// Reads fresh data on every request, streamed in behind Suspense
async function AnalyticsContent() {
  await connection();

  let data: Awaited<ReturnType<typeof getAnalyticsData>> | null = null;
  let loadError: string | null = null;

  try {
    data = await getAnalyticsData();
  } catch (err) {
    loadError = err instanceof Error ? err.message : String(err);
    console.error("[analytics] failed to load:", loadError);
  }

  if (!data) {
    return (
      <GlassCard className="p-6" role="alert">
        <h2 className="font-serif text-xl">Could not load analytics</h2>
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

  if (!data.hasData) {
    return (
      <GlassCard className="p-8 text-center">
        <h2 className="font-serif text-xl">No leads in the last 30 days</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Run <code>npm run seed</code> to load demo data, or simulate leads in the Inbox.
        </p>
      </GlassCard>
    );
  }

  const { totals } = data;

  return (
    <div className="space-y-6">
      <LiveRefresh />

      <AnalyticsSummary
        leads={totals.leads}
        qualifiedPct={totals.qualifiedPct}
        bookings={totals.bookings}
        aiAvgSeconds={totals.aiAvgSeconds}
        humanAvgSeconds={totals.humanAvgSeconds}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ResponseTimeChart
            data={data.responseSeries}
            aiSeconds={totals.aiAvgSeconds}
            humanSeconds={totals.humanAvgSeconds}
          />
        </div>
        <FunnelChart stages={data.funnel} />
      </div>

      <SourcePerformance sources={data.sources} totals={totals} />

      <div className="grid gap-6 lg:grid-cols-2">
        <AgentLeaderboard agents={data.agents} />
        <PipelineValueChart data={data.pipelineSeries} />
      </div>

      <RoiCalculator autoHandledPct={totals.autoHandledPct} leadsLast30={totals.leads} />
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <>
      <PageHeader
        title="Analytics and ROI"
        description="Which source, which agent, how fast, and how much money is at stake."
      />
      <Suspense fallback={<AnalyticsSkeleton />}>
        <AnalyticsContent />
      </Suspense>
    </>
  );
}