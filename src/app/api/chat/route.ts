import { NextResponse } from "next/server";
import { z } from "zod";
import { composeMessage } from "@/lib/ai/compose";
import { qualify } from "@/lib/ai/qualify";
import { avgReplySeconds } from "@/lib/conversation";
import { EMI_DEFAULTS, emiForPrice, formatEmiAmount } from "@/lib/emi";
import { formatInr } from "@/lib/format";
import { mergeProfile, nextStage } from "@/lib/lead-merge";
import { matchProperties, normalizeProperty } from "@/lib/matching";
import { rateLimit } from "@/lib/rate-limit";
import { computeScore, estimateDealValue, temperatureFor } from "@/lib/scoring";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { runVisitFlow, type VisitFlowResult } from "@/lib/visit-flow";
import type { LeadRow, MessageRow, PropertyRow } from "@/types/db";
import { syncSequence } from "@/lib/followup-engine";

const bodySchema = z.object({
  lead_id: z.uuid().optional(), // omit to create a brand-new lead
  message: z.string().trim().min(1).max(500), // max message length
  source: z
    .enum(["99acres", "magicbricks", "housing", "facebook", "whatsapp", "website"])
    .optional(),
  channel: z.string().max(30).optional(),
  name: z.string().trim().max(80).optional(),
});

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return String(err);
}

type Suggestion = {
  mode: "options" | "emi";
  properties: PropertyRow[]; // cards attached to the message (empty for EMI-only replies)
  createdAt: string;
};

export async function POST(request: Request) {
  try {
    // ---- Rate limit (protects the free AI quota) ----
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    const limit = rateLimit(`chat:${ip}`, 20, 60_000);
    if (!limit.ok) {
      return NextResponse.json(
        { error: "Too many messages. Please wait a few seconds and try again." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
      );
    }

    // ---- Validate input ----
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            "Invalid request. Send { message: string (1 to 500 chars), lead_id?: uuid, source?: string }",
        },
        { status: 400 }
      );
    }
    const body = parsed.data;
    const db = getSupabaseAdmin();

    // ---- 1. Load the lead, or create a new one ----
    let lead: LeadRow;
    let isNewLead = false;

    if (body.lead_id) {
      const { data, error } = await db
        .from("leads")
        .select("*")
        .eq("id", body.lead_id)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        return NextResponse.json({ error: "Lead not found" }, { status: 404 });
      }
      lead = data as LeadRow;
    } else {
      // created_at comes from this server's clock so first_response_ms is measured consistently
      const { data, error } = await db
        .from("leads")
        .insert({
          name: body.name ?? null,
          source: body.source ?? "website",
          created_at: new Date().toISOString(),
        })
        .select("*")
        .single();
      if (error) throw error;
      lead = data as LeadRow;
      isNewLead = true;
    }

    // ---- 2. Recent history (last 30 messages, oldest first) ----
    const { data: historyData, error: historyError } = await db
      .from("messages")
      .select("*")
      .eq("lead_id", lead.id)
      .order("created_at", { ascending: false })
      .limit(30);
    if (historyError) throw historyError;
    const history = ((historyData ?? []) as MessageRow[]).reverse();

    // ---- 3. Save the lead's message ----
    const channel = body.channel ?? (lead.source === "whatsapp" ? "whatsapp" : "chat");
    const leadMessageAt = new Date().toISOString();
    const { error: leadMsgError } = await db.from("messages").insert({
      lead_id: lead.id,
      sender: "lead",
      channel,
      content: body.message,
      created_at: leadMessageAt,
    });
    if (leadMsgError) throw leadMsgError;

    // ---- 4. Ask the AI (never throws: falls back to a friendly reply) ----
    const ai = await qualify({ lead, history, message: body.message });
    const extracted = ai.result.extracted;

    // first_response_ms: lead creation -> first AI reply
    const hadAiReply = history.some((m) => m.sender === "ai");
    const firstResponseMs =
      !hadAiReply && lead.first_response_ms === null
        ? Date.now() - new Date(lead.created_at).getTime()
        : null;

    // ---- 5. Save the AI reply ----
    const aiReplyAt = new Date().toISOString();
    const { error: aiMsgError } = await db.from("messages").insert({
      lead_id: lead.id,
      sender: "ai",
      channel,
      content: ai.result.reply,
      created_at: aiReplyAt,
    });
    if (aiMsgError) throw aiMsgError;

    // ---- 6. Merge the profile (needed for matching and scoring) ----
    const merged = mergeProfile(lead, extracted);

    // ---- 7. Decide what else is needed this turn ----
    const hasProfile =
      merged.bhk !== null ||
      merged.budget_min !== null ||
      merged.budget_max !== null ||
      merged.preferred_locations.length > 0;
    // Send options once per conversation, so the chat does not get spammed
    const alreadyShown = history.some((m) => (m.property_ids ?? []).length > 0);
    const wantsOptions = ai.result.wants_property_suggestions && !alreadyShown && hasProfile;
    const wantsEmi = ai.result.asked_emi;
    const aiWantsVisit = ai.result.wants_site_visit;
    const hasOpenOffer = (lead.visit_offer ?? []).some((s) => new Date(s).getTime() > Date.now());

    const needsProps = wantsOptions || wantsEmi || aiWantsVisit || hasOpenOffer;

    let allProps: PropertyRow[] = [];
    if (needsProps) {
      const { data: propData, error: propError } = await db.from("properties").select("*");
      if (propError) throw propError;
      allProps = ((propData ?? []) as PropertyRow[]).map(normalizeProperty);
    }

    const matches = needsProps
      ? matchProperties(
          {
            bhk: merged.bhk,
            budgetMin: merged.budget_min,
            budgetMax: merged.budget_max,
            locations: merged.preferred_locations,
          },
          allProps,
          3
        ).map((m) => m.property)
      : [];

    // Properties already shown earlier in this chat (EMI and visits refer to those)
    const lastShown = [...history].reverse().find((m) => (m.property_ids ?? []).length > 0);
    const shown = (lastShown?.property_ids ?? [])
      .map((id) => allProps.find((p) => p.id === id))
      .filter((p): p is PropertyRow => p !== undefined);

    // ---- 8. Property cards and EMI: facts from the database, math from code ----
    let suggestion: Suggestion | null = null;

    if (wantsOptions || wantsEmi) {
      const mode: "options" | "emi" = wantsEmi ? "emi" : "options";
      const reuseShown = wantsEmi && shown.length > 0;
      const targets = reuseShown ? shown : matches;

      if (targets.length > 0) {
        const rows = targets.map((p) => ({ p, ...emiForPrice(p.price_inr) }));
        const assumption = `${Math.round(EMI_DEFAULTS.ltv * 100)}% loan amount, ${EMI_DEFAULTS.annualRatePct}% yearly interest, ${EMI_DEFAULTS.years} years`;
        const emiFacts = rows.map(
          (r) =>
            `${r.p.title} in ${r.p.locality}: price ${formatInr(r.p.price_inr)}, loan ${formatInr(r.loan)}, EMI ${formatEmiAmount(r.emi)} per month`
        );
        const requiredAmounts = mode === "emi" ? rows.map((r) => formatEmiAmount(r.emi)) : [];

        const composed = await composeMessage({
          mode,
          buyerMessage: body.message,
          history,
          optionCount: targets.length,
          facts: mode === "emi" ? emiFacts : [],
          assumption,
        });

        // If the AI changed or dropped an EMI number, use our own correct line instead
        let content = composed.text;
        const numbersOk = requiredAmounts.every((amount) => content.includes(amount));
        if (!composed.ok || !numbersOk) {
          content =
            mode === "emi"
              ? `Estimated EMI (${assumption}): ${rows
                  .map((r) => `${r.p.title} ${formatEmiAmount(r.emi)}/month`)
                  .join("; ")}.`
              : `I picked ${targets.length} option${targets.length > 1 ? "s" : ""} that match what you are looking for. Full details are in the cards below.`;
        }

        const createdAt = new Date().toISOString();
        const attached = reuseShown ? [] : targets;
        const { error: suggestionError } = await db.from("messages").insert({
          lead_id: lead.id,
          sender: "ai",
          channel,
          content,
          property_ids: attached.map((p) => p.id),
          created_at: createdAt,
        });
        if (suggestionError) throw suggestionError;

        suggestion = { mode, properties: attached, createdAt };
      }
    }

    // ---- 9. Site visit: offer slots or book (a failure here never breaks the chat) ----
    let visit: VisitFlowResult = { kind: "none" };
    if (aiWantsVisit || hasOpenOffer) {
      try {
        const visitProperties =
          suggestion && suggestion.properties.length > 0
            ? suggestion.properties
            : shown.length > 0
              ? shown
              : matches;

        visit = await runVisitFlow({
          db,
          lead,
          message: body.message,
          requestedTime: ai.result.requested_visit_time,
          wantsVisit: aiWantsVisit,
          history,
          channel,
          visitProperties,
          now: Date.now(),
        });
      } catch (err) {
        console.error("[chat] visit flow failed:", errorMessage(err));
      }
    }

    // ---- 10. Score (deterministic code) ----
    const allMessages = [
      ...history,
      { sender: "lead" as const, created_at: leadMessageAt },
    ];
    const leadMessageCount = allMessages.filter((m) => m.sender === "lead").length;

    const breakdown = computeScore({
      timeline: merged.timeline,
      budgetMin: merged.budget_min,
      budgetMax: merged.budget_max,
      bhk: merged.bhk,
      preferredLocations: merged.preferred_locations,
      needsLoan: merged.needs_loan,
      purpose: merged.purpose,
      intent: ai.result.intent,
      // visit intent stays once the lead has shown it
      wantsSiteVisit:
        aiWantsVisit ||
        visit.kind === "booked" ||
        (lead.score_breakdown?.visit_intent ?? 0) > 0,
      leadMessageCount,
      avgReplySeconds: avgReplySeconds(allMessages),
    });

    const temperature = temperatureFor(breakdown.total);
    const baseStage = nextStage(lead.stage, merged);
    // a booked visit moves the lead to "Site Visit" (never backwards from later stages)
    const stage =
      visit.kind === "booked" && (baseStage === "new" || baseStage === "qualified")
        ? "site_visit"
        : baseStage;
    const dealValue = estimateDealValue(merged.budget_min, merged.budget_max);
    const lastMessageAt = visit.kind !== "none"
      ? visit.createdAt
      : (suggestion?.createdAt ?? aiReplyAt);

    // What the visit flow changes on the lead row
    const visitPatch: Record<string, unknown> =
      visit.kind === "offered"
        ? { visit_offer: visit.slots.map((s) => s.toISOString()) }
        : visit.kind === "booked"
          ? { visit_offer: null, assigned_agent_id: visit.booked.agent.id }
          : {};

    // ---- 11. Update the lead ----
    const { error: updateError } = await db
      .from("leads")
      .update({
        ...merged,
        intent: ai.result.intent,
        summary: ai.result.summary || lead.summary,
        score: breakdown.total,
        score_breakdown: breakdown,
        temperature,
        stage,
        deal_value_estimate: dealValue,
        last_contact_at: lastMessageAt,
        ...(firstResponseMs !== null ? { first_response_ms: firstResponseMs } : {}),
        ...visitPatch,
      })
      .eq("id", lead.id);
    if (updateError) throw updateError;

        // ---- 11b. The follow-up sequence follows the lead's temperature ----
    try {
      await syncSequence(db, { id: lead.id, temperature, stage }, Date.now());
    } catch (err) {
      console.error("[chat] follow-up sequence failed:", errorMessage(err));
    }

    // ---- 12. Activity events (feed). visit_booked is written by bookVisit(). ----
    const events: { lead_id: string; type: string; payload: Record<string, unknown> }[] = [];
    if (isNewLead) {
      events.push({ lead_id: lead.id, type: "lead_created", payload: { source: lead.source } });
    }
    if (isNewLead || lead.score === 0) {
      events.push({
        lead_id: lead.id,
        type: "ai_qualified",
        payload: { name: merged.name, score: breakdown.total },
      });
    }
    if (suggestion?.mode === "options") {
      events.push({
        lead_id: lead.id,
        type: "property_matched",
        payload: { name: merged.name, count: suggestion.properties.length },
      });
    }
    if (temperature === "hot" && lead.temperature !== "hot") {
      events.push({
        lead_id: lead.id,
        type: "hot_lead",
        payload: {
          name: merged.name,
          score: breakdown.total,
          budget_max: merged.budget_max,
          bhk: merged.bhk,
        },
      });
    }
    if (events.length > 0) {
      const { error: eventError } = await db.from("activity_events").insert(events);
      if (eventError) console.error("[chat] activity event failed:", eventError.message);
    }

    // ---- 13. Response ----
    return NextResponse.json({
      lead_id: lead.id,
      reply: ai.result.reply,
      extracted,
      profile: merged,
      intent: ai.result.intent,
      score: breakdown.total,
      score_breakdown: breakdown,
      temperature,
      stage,
      deal_value_estimate: dealValue,
      wants_property_suggestions: ai.result.wants_property_suggestions,
      wants_site_visit: ai.result.wants_site_visit,
      requested_visit_time: ai.result.requested_visit_time,
      asked_emi: ai.result.asked_emi,
      summary: ai.result.summary,
      property_ids: suggestion?.properties.map((p) => p.id) ?? [],
      suggestion_mode: suggestion?.mode ?? null,
      visit:
        visit.kind === "booked"
          ? {
              status: "booked",
              visit_id: visit.booked.visitId,
              when: visit.booked.whenText,
              agent: visit.booked.agent.name,
            }
          : visit.kind === "offered"
            ? { status: "offered", slots: visit.slots.map((s) => s.toISOString()) }
            : null,
      first_response_ms: firstResponseMs ?? lead.first_response_ms,
      ai_ok: ai.ok,
      ai_latency_ms: ai.latencyMs,
      // helpful while developing; never sent in production
      ...(process.env.NODE_ENV !== "production" && ai.error ? { ai_error: ai.error } : {}),
    });
  } catch (err) {
    console.error("[api/chat] failed:", errorMessage(err));
    return NextResponse.json(
      { error: "Something went wrong on our side. Please try again." },
      { status: 500 }
    );
  }
}