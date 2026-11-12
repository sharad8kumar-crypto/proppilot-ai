import "server-only";
import { COST_PER_LEAD, SOURCE_LABEL, SOURCE_ORDER } from "@/lib/analytics-config";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { MONTHS, istDateKey } from "@/lib/visits";
import type { FunnelStage, LeadSource } from "@/types";
import type {
  AgentStats,
  DailyPipelinePoint,
  DailyResponsePoint,
  SourceRow,
} from "@/types/analytics";
import type { Stage } from "@/types/db";

const DAY = 86_400_000;
const REACHED_QUALIFIED: Stage[] = ["qualified", "site_visit", "negotiation", "booked"];
const REACHED_VISIT: Stage[] = ["site_visit", "negotiation", "booked"];
const REACHED_NEGOTIATION: Stage[] = ["negotiation", "booked"];

type LeadLite = {
  id: string;
  source: LeadSource;
  stage: Stage;
  created_at: string;
  first_response_ms: number | null;
  human_baseline_ms: number | null;
  deal_value_estimate: number | null;
  assigned_agent_id: string | null;
};

type VisitLite = { lead_id: string; agent_id: string | null; status: string };
type AgentLite = { id: string; name: string; color: string };

const num = (v: unknown): number | null => {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const average = (values: number[]): number | null =>
  values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : null;

// "2026-11-09" -> "9 Nov"
function dayLabel(key: string): string {
  const d = new Date(Date.parse(key));
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

export async function getAnalyticsData() {
  const db = getSupabaseAdmin();
  const now = Date.now();
  const since = new Date(now - 30 * DAY).toISOString();

  const [leadsRes, visitsRes, agentsRes] = await Promise.all([
    db
      .from("leads")
      .select(
        "id,source,stage,created_at,first_response_ms,human_baseline_ms,deal_value_estimate,assigned_agent_id"
      )
      .gte("created_at", since)
      .limit(1000),
    db.from("site_visits").select("lead_id,agent_id,status"),
    db.from("agents").select("id,name,color").eq("active", true).order("name"),
  ]);

  for (const res of [leadsRes, visitsRes, agentsRes]) {
    if (res.error) throw new Error(res.error.message);
  }

  const leads = (leadsRes.data ?? []) as LeadLite[];
  const leadById = new Map(leads.map((l) => [l.id, l]));
  const visits = ((visitsRes.data ?? []) as VisitLite[]).filter((v) => leadById.has(v.lead_id));
  const agents = (agentsRes.data ?? []) as AgentLite[];

  // ---- Headline numbers ----
  const qualifiedCount = leads.filter((l) => REACHED_QUALIFIED.includes(l.stage)).length;
  const bookingsCount = leads.filter((l) => l.stage === "booked").length;

  const aiTimes = leads
    .filter((l) => l.first_response_ms !== null)
    .map((l) => Number(l.first_response_ms));
  const humanTimes = leads
    .filter((l) => l.human_baseline_ms !== null)
    .map((l) => Number(l.human_baseline_ms));

  const aiAvgMs = average(aiTimes);
  const humanAvgMs = average(humanTimes);
  const fastCount = aiTimes.filter((ms) => ms <= 60_000).length;

  // ---- Source performance ----
  const sources: SourceRow[] = SOURCE_ORDER.map((source) => {
    const rows = leads.filter((l) => l.source === source);
    const qualified = rows.filter((l) => REACHED_QUALIFIED.includes(l.stage)).length;
    const bookings = rows.filter((l) => l.stage === "booked").length;
    const visitCount = visits.filter((v) => leadById.get(v.lead_id)?.source === source).length;
    const totalCost = rows.length * COST_PER_LEAD[source];

    return {
      source,
      label: SOURCE_LABEL[source],
      leads: rows.length,
      qualified,
      qualifiedPct: rows.length > 0 ? Math.round((qualified / rows.length) * 100) : 0,
      visits: visitCount,
      bookings,
      costPerLead: COST_PER_LEAD[source],
      totalCost,
      costPerBooking: bookings > 0 ? Math.round(totalCost / bookings) : null,
    };
  });

  const totalCost = sources.reduce((sum, s) => sum + s.totalCost, 0);

  // ---- Agent leaderboard ----
  const agentStats: AgentStats[] = agents
    .map((agent) => {
      const assigned = leads.filter((l) => l.assigned_agent_id === agent.id);
      const conversions = assigned.filter((l) => l.stage === "booked").length;
      const baselines = assigned
        .filter((l) => l.human_baseline_ms !== null)
        .map((l) => Number(l.human_baseline_ms));

      return {
        id: agent.id,
        name: agent.name,
        color: agent.color,
        leadsHandled: assigned.length,
        visits: visits.filter((v) => v.agent_id === agent.id).length,
        conversions,
        conversionPct:
          assigned.length > 0 ? Math.round((conversions / assigned.length) * 100) : 0,
        avgResponseMs: average(baselines),
      };
    })
    .sort((a, b) => b.conversions - a.conversions || b.leadsHandled - a.leadsHandled);

  // ---- Daily series (last 30 days, India dates) ----
  const dayKeys = Array.from({ length: 30 }, (_, i) => istDateKey(now - (29 - i) * DAY));
  const byDay = new Map<string, LeadLite[]>();
  for (const lead of leads) {
    const key = istDateKey(new Date(lead.created_at));
    byDay.set(key, [...(byDay.get(key) ?? []), lead]);
  }

  const responseSeries: DailyResponsePoint[] = dayKeys.map((key) => {
    const rows = byDay.get(key) ?? [];
    const ai = average(
      rows.filter((l) => l.first_response_ms !== null).map((l) => Number(l.first_response_ms))
    );
    const human = average(
      rows.filter((l) => l.human_baseline_ms !== null).map((l) => Number(l.human_baseline_ms))
    );
    return {
      day: key,
      label: dayLabel(key),
      aiMinutes: ai !== null ? ai / 60_000 : null,
      humanMinutes: human !== null ? human / 60_000 : null,
    };
  });

  let cumulative = 0;
  const pipelineSeries: DailyPipelinePoint[] = dayKeys.map((key) => {
    const added = (byDay.get(key) ?? [])
      .filter((l) => l.stage !== "lost")
      .reduce((sum, l) => sum + (num(l.deal_value_estimate) ?? 0), 0);
    cumulative += added;
    return {
      day: key,
      label: dayLabel(key),
      addedCr: added / 10_000_000,
      cumulativeCr: cumulative / 10_000_000,
    };
  });

  // ---- Funnel (same "reached at least this stage" logic as the dashboard) ----
  const funnel: FunnelStage[] = [
    { label: "New", count: leads.length },
    { label: "Qualified", count: qualifiedCount },
    { label: "Site Visit", count: leads.filter((l) => REACHED_VISIT.includes(l.stage)).length },
    {
      label: "Negotiation",
      count: leads.filter((l) => REACHED_NEGOTIATION.includes(l.stage)).length,
    },
    { label: "Booked", count: bookingsCount },
  ];

  return {
    hasData: leads.length > 0,
    totals: {
      leads: leads.length,
      qualified: qualifiedCount,
      qualifiedPct: leads.length > 0 ? Math.round((qualifiedCount / leads.length) * 100) : 0,
      visits: visits.length,
      bookings: bookingsCount,
      totalCost,
      costPerBooking: bookingsCount > 0 ? Math.round(totalCost / bookingsCount) : null,
      aiAvgSeconds: aiAvgMs !== null ? Math.max(1, Math.round(aiAvgMs / 1000)) : null,
      humanAvgSeconds: humanAvgMs !== null ? Math.round(humanAvgMs / 1000) : null,
      autoHandledPct: leads.length > 0 ? Math.round((fastCount / leads.length) * 100) : 0,
    },
    sources,
    agents: agentStats,
    responseSeries,
    pipelineSeries,
    funnel,
  };
}