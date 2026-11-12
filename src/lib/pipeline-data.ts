import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { PipelineLead } from "@/types/pipeline";
import type { LeadRow } from "@/types/db";

const DAY = 86_400_000;

type AgentLite = { id: string; name: string; color: string };

type LeadLite = Pick<
  LeadRow,
  | "id"
  | "name"
  | "source"
  | "bhk"
  | "budget_min"
  | "budget_max"
  | "score"
  | "temperature"
  | "stage"
  | "deal_value_estimate"
  | "assigned_agent_id"
  | "stage_changed_at"
  | "summary"
  | "created_at"
>;

const num = (v: unknown): number | null => {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export async function getPipelineData() {
  const db = getSupabaseAdmin();
  const now = Date.now();

  const [leadsRes, agentsRes, pendingRes] = await Promise.all([
    db
      .from("leads")
      .select(
        "id,name,source,bhk,budget_min,budget_max,score,temperature,stage,deal_value_estimate,assigned_agent_id,stage_changed_at,summary,created_at"
      )
      .order("score", { ascending: false })
      .limit(500),
    db.from("agents").select("id,name,color"),
    db
      .from("followups")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .lt("step", 90),
  ]);

  for (const res of [leadsRes, agentsRes, pendingRes]) {
    if (res.error) throw new Error(res.error.message);
  }

  const agents = new Map(((agentsRes.data ?? []) as AgentLite[]).map((a) => [a.id, a]));

  const leads: PipelineLead[] = ((leadsRes.data ?? []) as LeadLite[]).map((l) => {
    const min = num(l.budget_min);
    const max = num(l.budget_max);
    const deal =
      num(l.deal_value_estimate) ??
      (min !== null && max !== null ? Math.round((min + max) / 2) : (max ?? min ?? 0));
    const changedAt = new Date(l.stage_changed_at ?? l.created_at).getTime();

    return {
      id: l.id,
      name: l.name ?? "New lead",
      source: l.source,
      bhk: l.bhk,
      budgetMin: min,
      budgetMax: max,
      score: l.score,
      temperature: l.temperature,
      stage: l.stage,
      dealValue: deal,
      agent: l.assigned_agent_id ? (agents.get(l.assigned_agent_id) ?? null) : null,
      daysInStage: Math.max(0, Math.floor((now - changedAt) / DAY)),
      summary: l.summary,
    };
  });

  return { leads, pendingFollowups: pendingRes.count ?? 0 };
}