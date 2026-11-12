import "server-only";
import { formatInr, leadDisplayName, timeAgo } from "@/lib/format";
import { getRevenueAtRisk } from "@/lib/metrics";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type {
  ActivityEvent,
  ActivityType,
  DashboardLead,
  FunnelStage,
  LeadSource,
} from "@/types";
import type { LeadRow } from "@/types/db";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const IST_OFFSET = 5.5 * HOUR; // India Standard Time is UTC+5:30

// Midnight today in IST, as a real (UTC) timestamp
function startOfDayIST(now: number): number {
  const ist = new Date(now + IST_OFFSET);
  ist.setUTCHours(0, 0, 0, 0);
  return ist.getTime() - IST_OFFSET;
}

// Monday 00:00 IST of the current week
function startOfWeekIST(now: number): number {
  const ist = new Date(now + IST_OFFSET);
  const daysSinceMonday = (ist.getUTCDay() + 6) % 7;
  ist.setUTCHours(0, 0, 0, 0);
  ist.setUTCDate(ist.getUTCDate() - daysSinceMonday);
  return ist.getTime() - IST_OFFSET;
}

const SOURCE_LABEL: Record<LeadSource, string> = {
  "99acres": "99acres",
  magicbricks: "MagicBricks",
  housing: "Housing",
  facebook: "Facebook",
  whatsapp: "WhatsApp",
  website: "Website",
};

type LeadLite = Pick<
  LeadRow,
  | "id"
  | "name"
  | "source"
  | "bhk"
  | "preferred_locations"
  | "budget_min"
  | "budget_max"
  | "score"
  | "temperature"
  | "stage"
  | "deal_value_estimate"
  | "first_response_ms"
  | "human_baseline_ms"
  | "last_contact_at"
  | "created_at"
>;

type EventRow = {
  id: string;
  type: string;
  payload: Record<string, unknown> | null;
  created_at: string;
  leads: Pick<
    LeadRow,
    "name" | "source" | "bhk" | "preferred_locations" | "budget_max" | "summary"
  > | null;
};

const num = (v: unknown): number | null => {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

function toDashboardLead(row: LeadLite, now: number): DashboardLead {
  const min = num(row.budget_min);
  const max = num(row.budget_max);
  const deal =
    num(row.deal_value_estimate) ??
    (min !== null && max !== null ? Math.round((min + max) / 2) : (max ?? min ?? 0));
  const lastTouch = new Date(row.last_contact_at ?? row.created_at).getTime();

  return {
    id: row.id,
    name: leadDisplayName(row),
    source: row.source,
    bhk: row.bhk,
    locality: row.preferred_locations[0] ?? null,
    budgetMin: min,
    budgetMax: max,
    score: row.score,
    temperature: row.temperature,
    stage: row.stage,
    untouchedHours: Math.max(0, (now - lastTouch) / HOUR),
    dealValue: deal,
  };
}

function describeEvent(e: EventRow): ActivityEvent {
  const lead = e.leads;
  const payloadName = typeof e.payload?.name === "string" ? e.payload.name : null;
  const name = lead?.name ?? payloadName ?? "New lead";
  const score = typeof e.payload?.score === "number" ? e.payload.score : null;
  const scoreText = score !== null ? ` (score ${score})` : "";

  const ago = timeAgo(e.created_at);
  const timeText = ago === "now" ? "just now" : `${ago} ago`;

  const place = lead?.preferred_locations?.[0];
  const bhkText = lead?.bhk ? `${lead.bhk} BHK` : null;

  let type: ActivityType = "ai_qualified";
  let title = `${name}: ${e.type.replace(/_/g, " ")}`;
  let detail = lead?.summary ?? "Activity recorded";

  switch (e.type) {
    case "lead_created":
      type = "lead_created";
      title = `New lead from ${SOURCE_LABEL[lead?.source ?? "website"]}`;
      detail = [name, bhkText, place].filter(Boolean).join(" · ");
      break;
    case "ai_qualified":
      type = "ai_qualified";
      title = `AI qualified ${name}${scoreText}`;
      detail = lead?.summary ?? "Buyer profile captured";
      break;
    case "hot_lead":
      type = "hot_alert";
      title = `Hot lead: ${name}${scoreText}`;
      detail = [
        lead?.budget_max ? `Budget up to ${formatInr(Number(lead.budget_max))}` : null,
        bhkText,
        place,
      ]
        .filter(Boolean)
        .join(" · ") || "Follow up now";
      break;
    case "visit_booked": {
      type = "visit_booked";
      title = "Site visit booked";
      const when = typeof e.payload?.when === "string" ? e.payload.when : null;
      const agent = typeof e.payload?.agent === "string" ? e.payload.agent : null;
      detail = [name, when, agent ? `Agent ${agent}` : null].filter(Boolean).join(" · ");
      break;
    }
    case "property_matched":
      type = "property_matched";
      title = "Properties matched";
      detail = name;
      break;
    case "followup_sent": {
      type = "followup_sent";
      title = "Follow-up sent";
      const label = typeof e.payload?.label === "string" ? e.payload.label : null;
      detail = [name, label].filter(Boolean).join(" · ");
      break;
    }
    case "stage_changed": {
      type = "stage_changed";
      const from = typeof e.payload?.from_label === "string" ? e.payload.from_label : null;
      const to = typeof e.payload?.to_label === "string" ? e.payload.to_label : null;
      title = `${name} moved to ${to ?? "a new stage"}`;
      detail = from && to ? `${from} to ${to}` : "Pipeline updated";
      break;
    }
    case "hot_untouched":
      type = "hot_untouched";
      title = "Hot lead untouched for 48h+";
      detail = name;
      break;
  }

  return { id: e.id, type, title, detail, timeAgo: timeText };
}

const REACHED_QUALIFIED = ["qualified", "site_visit", "negotiation", "booked"];
const REACHED_VISIT = ["site_visit", "negotiation", "booked"];
const REACHED_NEGOTIATION = ["negotiation", "booked"];

export async function getDashboardData() {
  const db = getSupabaseAdmin();
  const now = Date.now();
  const todayStart = startOfDayIST(now);
  const weekStart = startOfWeekIST(now);

  const [leadsRes, visitsRes, eventsRes] = await Promise.all([
    db
      .from("leads")
      .select(
        "id,name,source,bhk,preferred_locations,budget_min,budget_max,score,temperature,stage,deal_value_estimate,first_response_ms,human_baseline_ms,last_contact_at,created_at"
      )
      .order("created_at", { ascending: false })
      .limit(1000),
    db
      .from("site_visits")
      .select("id", { count: "exact", head: true })
      .gte("scheduled_at", new Date(weekStart).toISOString())
      .lt("scheduled_at", new Date(weekStart + 7 * DAY).toISOString()),
    db
      .from("activity_events")
      .select(
        "id,type,payload,created_at,leads(name,source,bhk,preferred_locations,budget_max,summary)"
      )
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  for (const res of [leadsRes, visitsRes, eventsRes]) {
    if (res.error) throw new Error(res.error.message);
  }

  const rows = (leadsRes.data ?? []) as LeadLite[];
  const last30 = rows.filter((r) => new Date(r.created_at).getTime() >= now - 30 * DAY);

  // ---- KPIs ----
  const leadsToday = rows.filter((r) => new Date(r.created_at).getTime() >= todayStart).length;

  const answered = last30.filter((r) => r.first_response_ms !== null);
  const fastAnswered = answered.filter((r) => Number(r.first_response_ms) <= 60_000);
  const autoHandledPct =
    last30.length > 0 ? Math.round((fastAnswered.length / last30.length) * 100) : 0;

  const avgAiMs =
    answered.length > 0
      ? answered.reduce((sum, r) => sum + Number(r.first_response_ms), 0) / answered.length
      : 0;

  const withBaseline = last30.filter((r) => r.human_baseline_ms !== null);
  const avgHumanMs =
    withBaseline.length > 0
      ? withBaseline.reduce((sum, r) => sum + Number(r.human_baseline_ms), 0) /
        withBaseline.length
      : 4 * HOUR + 12 * 60_000; // typical team, used only when no baseline data exists

  const pipelineInr = rows
    .filter((r) => ["qualified", "site_visit", "negotiation"].includes(r.stage))
    .reduce((sum, r) => sum + (num(r.deal_value_estimate) ?? 0), 0);

  // ---- Lists ----
  const dashLeads = rows.map((r) => toDashboardLead(r, now));
  const risk = getRevenueAtRisk(dashLeads);
  const hotLeads = dashLeads.filter(
    (l) => l.temperature === "hot" && l.stage !== "booked" && l.stage !== "lost"
  );

  // ---- Funnel (last 30 days, "reached at least this stage") ----
  const funnel: FunnelStage[] = [
    { label: "New", count: last30.length },
    { label: "Qualified", count: last30.filter((r) => REACHED_QUALIFIED.includes(r.stage)).length },
    { label: "Site Visit", count: last30.filter((r) => REACHED_VISIT.includes(r.stage)).length },
    { label: "Negotiation", count: last30.filter((r) => REACHED_NEGOTIATION.includes(r.stage)).length },
    { label: "Booked", count: last30.filter((r) => r.stage === "booked").length },
  ];

  const activity = ((eventsRes.data ?? []) as unknown as EventRow[]).map(describeEvent);

  const newest = rows[0] ?? null;

  return {
    hasData: rows.length > 0,
    stats: {
      leadsToday,
      autoHandledPct,
      avgResponseSeconds: Math.max(1, Math.round(avgAiMs / 1000)),
      teamAvgSeconds: Math.round(avgHumanMs / 1000),
      pipelineCr: pipelineInr / 10_000_000,
      visitsThisWeek: visitsRes.count ?? 0,
    },
    risk,
    hotLeads,
    funnel,
    activity,
    latestLead: newest ? { name: leadDisplayName(newest), source: newest.source } : null,
  };
}