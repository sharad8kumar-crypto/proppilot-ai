import { Suspense } from "react";
import { connection } from "next/server";
import { PropertiesView } from "@/components/properties/properties-view";
import { GlassCard } from "@/components/shell/glass-card";
import { PageHeader } from "@/components/shell/page-header";
import { getPropertiesData } from "@/lib/properties-data";

function PropertiesSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true">
      <GlassCard className="h-28 animate-pulse" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <GlassCard key={i} className="h-72 animate-pulse" />
        ))}
      </div>
    </div>
  );
}

// Reads fresh data on every request, streamed in behind Suspense
async function PropertiesContent() {
  await connection();

  let data: Awaited<ReturnType<typeof getPropertiesData>> | null = null;
  let loadError: string | null = null;

  try {
    data = await getPropertiesData();
  } catch (err) {
    loadError = err instanceof Error ? err.message : String(err);
    console.error("[properties] failed to load:", loadError);
  }

  if (!data) {
    return (
      <GlassCard className="p-6" role="alert">
        <h2 className="font-serif text-xl">Could not load properties</h2>
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

  return <PropertiesView properties={data.properties} leads={data.leads} />;
}

export default function PropertiesPage() {
  return (
    <>
      <PageHeader
        title="Properties"
        description="Inventory the AI matches to every buyer. Builders and projects are fictional demo data."
      />
      <Suspense fallback={<PropertiesSkeleton />}>
        <PropertiesContent />
      </Suspense>
    </>
  );
}