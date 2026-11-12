import { Suspense } from "react";
import { connection } from "next/server";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { FunnelChart } from "@/components/dashboard/funnel-chart";
import { HotLeads } from "@/components/dashboard/hot-leads";
import { KpiGrid } from "@/components/dashboard/kpi-grid";
import { LiveRefresh } from "@/components/dashboard/live-refresh";
import { RevenueAtRisk } from "@/components/dashboard/revenue-at-risk";
import { SpeedToLead } from "@/components/dashboard/speed-to-lead";
import { GlassCard } from "@/components/shell/glass-card";
import { PageHeader } from "@/components/shell/page-header";
import { getDashboardData } from "@/lib/dashboard-data";

// Shown instantly while the live data loads
function DashboardSkeleton() {
  return (
    <>
      <PageHeader
        title="Command Center"
        description="Your entire sales operation at a glance, live."
      />
      <div className="space-y-6" aria-busy="true">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <GlassCard key={i} className="h-32 animate-pulse" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <GlassCard className="h-72 animate-pulse lg:col-span-2" />
          <GlassCard className="h-72 animate-pulse" />
        </div>
      </div>
    </>
  );
}

// Reads fresh data on every request. It streams in behind the Suspense boundary below.
async function Dashboard() {
  await connection(); // opt in to request-time rendering (database reads)

  let data: Awaited<ReturnType<typeof getDashboardData>> | null = null;
  let loadError: string | null = null;

  try {
    data = await getDashboardData();
  } catch (err) {
    loadError = err instanceof Error ? err.message : String(err);
    console.error("[dashboard] failed to load:", loadError);
  }

  if (!data) {
    return (
      <>
        <PageHeader title="Command Center" description="Your sales operation at a glance." />
        <GlassCard className="p-6" role="alert">
          <h2 className="font-serif text-xl">Could not load live data</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Check your .env.local keys, make sure the SQL schema is created, and run{" "}
            <code>npm run seed</code>.
          </p>
          {process.env.NODE_ENV !== "production" && loadError && (
            <p className="mt-3 rounded-xl bg-danger/10 px-3 py-2 text-xs text-danger">
              {loadError}
            </p>
          )}
        </GlassCard>
      </>
    );
  }

  const { stats, risk } = data;

  return (
    <>
      <LiveRefresh />
      <PageHeader
        title="Command Center"
        description="Your entire sales operation at a glance, live."
        actions={
          <span className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted-foreground">
            <span className="size-1.5 rounded-full bg-success" aria-hidden />
            Live data
          </span>
        }
      />

      {!data.hasData || !data.latestLead ? (
        <GlassCard className="p-8 text-center">
          <h2 className="font-serif text-xl">No leads yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Run <code>npm run seed</code> to load demo data, or open the Inbox and press + to
            simulate your first lead.
          </p>
        </GlassCard>
      ) : (
        <div className="space-y-6">
          <KpiGrid
            leadsToday={stats.leadsToday}
            autoHandledPct={stats.autoHandledPct}
            avgResponseSeconds={stats.avgResponseSeconds}
            teamAvgSeconds={stats.teamAvgSeconds}
            pipelineCr={stats.pipelineCr}
            visitsThisWeek={stats.visitsThisWeek}
            revenueAtRiskCr={risk.total / 10_000_000}
            atRiskCount={risk.count}
          />

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <SpeedToLead
                aiSeconds={stats.avgResponseSeconds}
                teamSeconds={stats.teamAvgSeconds}
                latestLead={data.latestLead}
              />
            </div>
            <RevenueAtRisk totalInr={risk.total} count={risk.count} leads={risk.leads} />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <FunnelChart stages={data.funnel} />
              <HotLeads leads={data.hotLeads} />
            </div>
            <ActivityFeed events={data.activity} />
          </div>
        </div>
      )}
    </>
  );
}

export default function CommandCenterPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Dashboard />
    </Suspense>
  );
}