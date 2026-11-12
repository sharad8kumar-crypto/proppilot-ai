import { Suspense } from "react";
import { connection } from "next/server";
import { LiveRefresh } from "@/components/dashboard/live-refresh";
import { FollowupPanel } from "@/components/pipeline/followup-panel";
import { PipelineBoard } from "@/components/pipeline/pipeline-board";
import { GlassCard } from "@/components/shell/glass-card";
import { PageHeader } from "@/components/shell/page-header";
import { getPipelineData } from "@/lib/pipeline-data";

function PipelineSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true">
      <GlassCard className="h-28 animate-pulse" />
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <GlassCard key={i} className="h-96 w-72 shrink-0 animate-pulse" />
        ))}
      </div>
    </div>
  );
}

// Reads fresh data on every request, streamed in behind Suspense
async function PipelineContent() {
  await connection();

  let data: Awaited<ReturnType<typeof getPipelineData>> | null = null;
  let loadError: string | null = null;

  try {
    data = await getPipelineData();
  } catch (err) {
    loadError = err instanceof Error ? err.message : String(err);
    console.error("[pipeline] failed to load:", loadError);
  }

  if (!data) {
    return (
      <GlassCard className="p-6" role="alert">
        <h2 className="font-serif text-xl">Could not load the pipeline</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Check your .env.local keys, run the Phase 7 SQL (stage_changed_at column) and{" "}
          <code>npm run seed</code>.
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
    <div className="space-y-5">
      <LiveRefresh />
      <FollowupPanel pendingCount={data.pendingFollowups} />
      <PipelineBoard leads={data.leads} />
    </div>
  );
}

export default function PipelinePage() {
  return (
    <>
      <PageHeader
        title="Pipeline"
        description="Drag leads from New to Booked. Stage changes are saved instantly."
      />
      <Suspense fallback={<PipelineSkeleton />}>
        <PipelineContent />
      </Suspense>
    </>
  );
}