import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { candidateSlots, formatSlotAbsolute } from "@/lib/visits";
import type { PropertyRow } from "@/types/db";

export type VisitAgent = { id: string; name: string; color: string };
export type FreeSlot = { start: Date; agentIds: string[] };

export type BookedVisit = {
  visitId: string;
  slot: Date;
  whenText: string;
  agent: VisitAgent;
  property: PropertyRow | null;
};

const HOUR = 3_600_000;

// Slots for the next 3 days where at least one active agent is free,
// plus how many upcoming visits each agent already has.
export async function loadFreeSlots(db: SupabaseClient, now: number) {
  const [agentsRes, visitsRes] = await Promise.all([
    db.from("agents").select("id,name,color").eq("active", true),
    db
      .from("site_visits")
      .select("agent_id,scheduled_at")
      .eq("status", "scheduled")
      .gte("scheduled_at", new Date(now).toISOString()),
  ]);
  if (agentsRes.error) throw agentsRes.error;
  if (visitsRes.error) throw visitsRes.error;

  // alphabetical, so ties are always broken the same way
  const agents = ((agentsRes.data ?? []) as VisitAgent[]).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  const busy = new Set<string>();
  const upcoming = new Map<string, number>();
  for (const v of (visitsRes.data ?? []) as { agent_id: string | null; scheduled_at: string }[]) {
    if (!v.agent_id) continue;
    busy.add(`${v.agent_id}|${new Date(v.scheduled_at).getTime()}`);
    upcoming.set(v.agent_id, (upcoming.get(v.agent_id) ?? 0) + 1);
  }

  const slots: FreeSlot[] = [];
  for (const start of candidateSlots(now, 3, 2)) {
    const agentIds = agents
      .filter((a) => !busy.has(`${a.id}|${start.getTime()}`))
      .map((a) => a.id);
    if (agentIds.length > 0) slots.push({ start, agentIds });
  }

  return { slots, agents, upcoming };
}

// Round robin by load: the free agent with the fewest upcoming visits
export function chooseAgent(
  freeAgentIds: string[],
  agents: VisitAgent[],
  upcoming: Map<string, number>
): VisitAgent | null {
  let best: VisitAgent | null = null;
  let bestCount = Infinity;
  for (const agent of agents) {
    if (!freeAgentIds.includes(agent.id)) continue;
    const count = upcoming.get(agent.id) ?? 0;
    if (count < bestCount) {
      best = agent;
      bestCount = count;
    }
  }
  return best;
}

// Creates the visit, the two reminders and the activity event.
// Returns null if the slot is no longer free. The caller updates the lead row.
export async function bookVisit(
  db: SupabaseClient,
  input: {
    leadId: string;
    leadName: string | null;
    property: PropertyRow | null;
    slot: Date;
    now: number;
  }
): Promise<BookedVisit | null> {
  const { slots, agents, upcoming } = await loadFreeSlots(db, input.now);

  // re-check right before booking (someone else may have taken the slot)
  const match = slots.find((s) => s.start.getTime() === input.slot.getTime());
  if (!match) return null;

  const agent = chooseAgent(match.agentIds, agents, upcoming);
  if (!agent) return null;

  const { data: visit, error: visitError } = await db
    .from("site_visits")
    .insert({
      lead_id: input.leadId,
      property_id: input.property?.id ?? null,
      agent_id: agent.id,
      scheduled_at: input.slot.toISOString(),
      status: "scheduled",
    })
    .select("id")
    .single();
  if (visitError) throw visitError;

  const whenText = formatSlotAbsolute(input.slot);
  const where = input.property ? ` at ${input.property.title} (${input.property.locality})` : "";

  // Reminders 24h and 2h before. Steps 90 and 91 keep them apart from the follow-up sequences.
  const reminders = [
    { step: 90, hoursBefore: 24, when: "tomorrow" },
    { step: 91, hoursBefore: 2, when: "in 2 hours" },
  ]
    .map((r) => ({
      lead_id: input.leadId,
      step: r.step,
      scheduled_for: new Date(input.slot.getTime() - r.hoursBefore * HOUR),
      message: `Reminder: your site visit${where} is ${r.when} (${whenText}). ${agent.name} will meet you there.`,
      status: "pending",
    }))
    .filter((r) => r.scheduled_for.getTime() > input.now)
    .map((r) => ({ ...r, scheduled_for: r.scheduled_for.toISOString() }));

  if (reminders.length > 0) {
    const { error } = await db.from("followups").insert(reminders);
    if (error) console.error("[visit] reminders failed:", error.message);
  }

  const { error: eventError } = await db.from("activity_events").insert({
    lead_id: input.leadId,
    type: "visit_booked",
    payload: {
      name: input.leadName,
      property: input.property?.title ?? null,
      when: whenText,
      agent: agent.name,
    },
  });
  if (eventError) console.error("[visit] activity event failed:", eventError.message);

  return {
    visitId: (visit as { id: string }).id,
    slot: input.slot,
    whenText,
    agent,
    property: input.property,
  };
}