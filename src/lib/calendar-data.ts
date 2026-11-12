import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { istDateKey } from "@/lib/visits";
import type { LeadSource, Temperature } from "@/types";
import type { CalendarAgent, CalendarVisit, VisitStatus } from "@/types/calendar";

const WEEK = 7 * 24 * 3_600_000;

type RawVisit = {
  id: string;
  scheduled_at: string;
  status: VisitStatus;
  leads: {
    id: string;
    name: string | null;
    source: LeadSource;
    temperature: Temperature;
    score: number;
  } | null;
  properties: {
    title: string;
    locality: string;
    city: string;
    price_inr: number;
  } | null;
  agents: CalendarAgent | null;
};

export async function getCalendarData() {
  const db = getSupabaseAdmin();
  const now = Date.now();

  const [visitsRes, agentsRes] = await Promise.all([
    db
      .from("site_visits")
      .select(
        "id,scheduled_at,status,leads(id,name,source,temperature,score),properties(title,locality,city,price_inr),agents(id,name,color)"
      )
      .gte("scheduled_at", new Date(now - 8 * WEEK).toISOString())
      .lte("scheduled_at", new Date(now + 8 * WEEK).toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(1000),
    db.from("agents").select("id,name,color").eq("active", true).order("name"),
  ]);

  for (const res of [visitsRes, agentsRes]) {
    if (res.error) throw new Error(res.error.message);
  }

  const visits: CalendarVisit[] = ((visitsRes.data ?? []) as unknown as RawVisit[]).map((v) => ({
    id: v.id,
    scheduledAt: v.scheduled_at,
    status: v.status,
    lead: v.leads
      ? {
          id: v.leads.id,
          name: v.leads.name ?? "New lead",
          source: v.leads.source,
          temperature: v.leads.temperature,
          score: v.leads.score,
        }
      : null,
    property: v.properties
      ? {
          title: v.properties.title,
          locality: v.properties.locality,
          city: v.properties.city,
          price: Number(v.properties.price_inr),
        }
      : null,
    agent: v.agents,
  }));

  return {
    visits,
    agents: (agentsRes.data ?? []) as CalendarAgent[],
    todayKey: istDateKey(now), // computed on the server so the browser never needs the clock
  };
}