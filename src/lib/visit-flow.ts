import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { composeMessage } from "@/lib/ai/compose";
import { bookVisit, loadFreeSlots, type BookedVisit } from "@/lib/visit-booking";
import { formatSlot, pickOfferSlots, resolveVisitChoice } from "@/lib/visits";
import type { LeadRow, MessageRow, PropertyRow } from "@/types/db";

export type VisitFlowResult =
  | { kind: "none" }
  | { kind: "offered"; slots: Date[]; createdAt: string }
  | { kind: "booked"; booked: BookedVisit; createdAt: string };

type VisitFlowInput = {
  db: SupabaseClient;
  lead: LeadRow;
  message: string;
  requestedTime: string | null;
  wantsVisit: boolean; // the AI flagged that the buyer wants to visit
  history: MessageRow[];
  channel: string;
  visitProperties: PropertyRow[]; // properties the buyer has seen (first one is booked)
  now: number;
};

async function saveAiMessage(
  db: SupabaseClient,
  leadId: string,
  channel: string,
  content: string,
  propertyIds: string[]
): Promise<string> {
  const createdAt = new Date().toISOString();
  const { error } = await db.from("messages").insert({
    lead_id: leadId,
    sender: "ai",
    channel,
    content,
    property_ids: propertyIds,
    created_at: createdAt,
  });
  if (error) throw error;
  return createdAt;
}

export async function runVisitFlow(input: VisitFlowInput): Promise<VisitFlowResult> {
  const { db, lead, now } = input;

  // Never double-book: a lead with an upcoming visit is left alone
  const { data: upcomingVisits, error } = await db
    .from("site_visits")
    .select("id")
    .eq("lead_id", lead.id)
    .eq("status", "scheduled")
    .gt("scheduled_at", new Date(now).toISOString())
    .limit(1);
  if (error) throw error;
  if ((upcomingVisits ?? []).length > 0) return { kind: "none" };

  const offered = (lead.visit_offer ?? [])
    .map((s) => new Date(s))
    .filter((d) => !Number.isNaN(d.getTime()) && d.getTime() > now);

  if (!input.wantsVisit && offered.length === 0) return { kind: "none" };

  const { slots, agents, upcoming } = await loadFreeSlots(db, now);
  const free = slots.map((s) => s.start);
  if (free.length === 0) return { kind: "none" };

  const choice = resolveVisitChoice({
    message: input.message,
    requestedTime: input.requestedTime,
    now,
    offered,
    free,
  });

  // ---- Book the chosen slot ----
  if (choice.slot) {
    const property = input.visitProperties[0] ?? null;
    const booked = await bookVisit(db, {
      leadId: lead.id,
      leadName: lead.name,
      property,
      slot: choice.slot,
      now,
    });

    if (booked) {
      const slotText = formatSlot(booked.slot, now);
      const facts = [
        `SLOT: ${slotText}`,
        ...(property ? [`PROPERTY: ${property.title} in ${property.locality}`] : []),
        `AGENT: ${booked.agent.name}`,
      ];
      const required = [slotText, booked.agent.name, ...(property ? [property.title] : [])];

      const composed = await composeMessage({
        mode: "visit_confirmed",
        buyerMessage: input.message,
        history: input.history,
        optionCount: 0,
        facts,
        assumption: "",
      });

      let content = composed.text;
      if (!composed.ok || !required.every((s) => content.includes(s))) {
        content = `Your site visit is confirmed for ${slotText}${
          property ? ` at ${property.title}, ${property.locality}` : ""
        }. ${booked.agent.name} will meet you there, and we will send a reminder before the visit.`;
      }

      const createdAt = await saveAiMessage(
        db,
        lead.id,
        input.channel,
        content,
        property ? [property.id] : []
      );
      return { kind: "booked", booked, createdAt };
    }
    // the slot was taken a moment ago: fall through and offer fresh slots
  }

  // ---- Offer slots (only if the buyer actually wants a visit) ----
  if (!input.wantsVisit) return { kind: "none" };

  const offerSlots = pickOfferSlots(free, 3);
  const slotTexts = offerSlots.map((s) => formatSlot(s, now));
  const facts = [
    ...(choice.specified ? ["NOTE: the time the buyer asked for is not available"] : []),
    ...slotTexts.map((t) => `SLOT: ${t}`),
  ];

  const composed = await composeMessage({
    mode: "visit_offer",
    buyerMessage: input.message,
    history: input.history,
    optionCount: 0,
    facts,
    assumption: "",
  });

  let content = composed.text;
  if (!composed.ok || !slotTexts.every((t) => content.includes(t))) {
    content = `I can schedule your site visit at: ${slotTexts.join(" | ")}. Which one works best for you?`;
  }

  const createdAt = await saveAiMessage(db, lead.id, input.channel, content, []);

  // agents is unused here, but loaded so a future "preferred agent" feature can use it
  void agents;
  void upcoming;

  return { kind: "offered", slots: offerSlots, createdAt };
}