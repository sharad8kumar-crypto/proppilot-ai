import { NextResponse } from "next/server";
import { z } from "zod";
import { composeFollowup, fallbackFollowup } from "@/lib/ai/followup";
import { syncSequence } from "@/lib/followup-engine";
import { formatOffset, stepDefFor, stepLabel } from "@/lib/followups";
import { formatBudget, formatInr } from "@/lib/format";
import { matchProperties, normalizeProperty } from "@/lib/matching";
import { rateLimit } from "@/lib/rate-limit";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { FollowupRow, LeadRow, MessageRow, PropertyRow } from "@/types/db";

const DAY = 86_400_000;
const HOUR = 3_600_000;
const MAX_LEADS = 5; // newest active leads considered per click (protects the free AI quota)
const MAX_MESSAGES = 8; // follow-ups sent per click

const querySchema = z.object({
  days: z.coerce.number().int().min(1).max(30),
  lead_id: z.uuid().optional(),
});

type Job = {
  row: FollowupRow;
  lead: LeadRow;
  skip: boolean;
  needsAi: boolean;
  goal: string;
  propertyIds: string[];
  propertyFacts: string[];
  text: string;
};

function profileText(lead: LeadRow): string {
  const parts = [
    lead.bhk ? `${lead.bhk} BHK` : "home",
    lead.preferred_locations.length > 0
      ? `in ${lead.preferred_locations.join(", ")}`
      : "(area not shared)",
  ];
  const min = lead.budget_min;
  const max = lead.budget_max;
  if (min !== null && max !== null) parts.push(`budget ${formatBudget(min, max)}`);
  else if (max !== null || min !== null) parts.push(`budget about ${formatInr((max ?? min) as number)}`);
  if (lead.timeline !== "unknown") parts.push(`timeline ${lead.timeline}`);
  return parts.join(", ");
}

// POST /api/followups/fast-forward?days=7[&lead_id=...]
// Simulates time passing: sends every follow-up that would be due within N days.
export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    const limit = rateLimit(`ff:${ip}`, 10, 60_000);
    if (!limit.ok) {
      return NextResponse.json(
        { error: "Too many fast-forwards. Please wait a moment." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
      );
    }

    const query = querySchema.safeParse(
      Object.fromEntries(new URL(request.url).searchParams)
    );
    if (!query.success) {
      return NextResponse.json(
        { error: "Use ?days=1 to 30 (and optionally &lead_id=...)" },
        { status: 400 }
      );
    }
    const { days, lead_id } = query.data;

    const db = getSupabaseAdmin();
    const now = Date.now();
    const horizon = now + days * DAY;

    // ---- 1. Which leads? Newest active ones (or the one asked for) ----
    const base = db.from("leads").select("*").not("stage", "in", "(lost,booked)");
    const { data: leadData, error: leadError } = lead_id
      ? await base.eq("id", lead_id)
      : await base.order("last_contact_at", { ascending: false, nullsFirst: false }).limit(MAX_LEADS);
    if (leadError) throw leadError;

    const leads = (leadData ?? []) as LeadRow[];
    const empty = {
      days,
      leads_considered: 0,
      processed: [],
      skipped: 0,
      remaining: 0,
      alerts: [],
    };
    if (leads.length === 0) return NextResponse.json(empty);

    const ids = leads.map((l) => l.id);
    const leadById = new Map(leads.map((l) => [l.id, l]));

    // ---- 2. Make sure each lead has a sequence for its temperature ----
    await Promise.all(leads.map((l) => syncSequence(db, l, now)));

    // ---- 3. Follow-ups due within the window, oldest first ----
    const { data: dueData, error: dueError } = await db
      .from("followups")
      .select("*")
      .in("lead_id", ids)
      .eq("status", "pending")
      .lte("scheduled_for", new Date(horizon).toISOString())
      .order("scheduled_for", { ascending: true });
    if (dueError) throw dueError;

    const due = (dueData ?? []) as FollowupRow[];
    const batch = due.slice(0, MAX_MESSAGES);
    const remaining = due.length - batch.length;

    // ---- 4. Context: recent messages, upcoming visits, properties ----
    const [msgRes, visitRes] = await Promise.all([
      db
        .from("messages")
        .select("*")
        .in("lead_id", ids)
        .order("created_at", { ascending: false })
        .limit(100),
      db
        .from("site_visits")
        .select("lead_id")
        .in("lead_id", ids)
        .eq("status", "scheduled")
        .gt("scheduled_at", new Date(now).toISOString()),
    ]);
    if (msgRes.error) throw msgRes.error;
    if (visitRes.error) throw visitRes.error;

    const messages = (msgRes.data ?? []) as MessageRow[];
    const leadsWithVisit = new Set(
      ((visitRes.data ?? []) as { lead_id: string }[]).map((v) => v.lead_id)
    );

    const needsProperties = batch.some((r) => (stepDefFor(r.step)?.attach ?? "none") !== "none");
    let allProps: PropertyRow[] = [];
    if (needsProperties) {
      const { data, error } = await db.from("properties").select("*");
      if (error) throw error;
      allProps = ((data ?? []) as PropertyRow[]).map(normalizeProperty);
    }

    // ---- 5. Build one job per follow-up ----
    const jobs: Job[] = batch.map((row) => {
      const lead = leadById.get(row.lead_id) as LeadRow;
      const def = stepDefFor(row.step);

      const job: Job = {
        row,
        lead,
        skip: false,
        needsAi: true,
        goal: def?.goal ?? "Send a short friendly check-in.",
        propertyIds: [],
        propertyFacts: [],
        text: "",
      };

      // Visit reminders already have their text
      if (row.step >= 90) {
        job.needsAi = false;
        job.text = row.message ?? "Reminder: you have a site visit coming up.";
        return job;
      }

      // No point inviting someone who already has a visit booked
      if (row.step === 3 && leadsWithVisit.has(lead.id)) {
        job.skip = true;
        return job;
      }

      if (def && def.attach !== "none") {
        const shownIds = new Set(
          messages
            .filter((m) => m.lead_id === lead.id)
            .flatMap((m) => m.property_ids ?? [])
        );
        const matches = matchProperties(
          {
            bhk: lead.bhk,
            budgetMin: lead.budget_min,
            budgetMax: lead.budget_max,
            locations: lead.preferred_locations,
          },
          allProps,
          3
        ).map((m) => m.property);

        let chosen: PropertyRow[] = [];
        if (def.attach === "recap") {
          const shown = allProps.filter((p) => shownIds.has(p.id)).slice(0, 3);
          chosen = shown.length > 0 ? shown : matches;
        } else {
          chosen = matches.filter((p) => !shownIds.has(p.id)).slice(0, 1);
          if (chosen.length === 0) {
            job.goal =
              "Send a friendly check-in. Ask if they are still searching and offer to share more options.";
          }
        }
        job.propertyIds = chosen.map((p) => p.id);
        job.propertyFacts = chosen.map((p) => `${p.title} in ${p.locality}`);
      }
      return job;
    });

    // ---- 6. Write the messages with the AI (in parallel) ----
    await Promise.all(
      jobs
        .filter((j) => !j.skip && j.needsAi)
        .map(async (job) => {
          const firstName = job.lead.name?.split(" ")[0] ?? null;
          const samples = messages
            .filter((m) => m.lead_id === job.lead.id && m.sender === "lead")
            .slice(0, 3)
            .map((m) => m.content);

          const composed = await composeFollowup({
            goal: job.goal,
            firstName,
            profileText: profileText(job.lead),
            buyerSamples: samples,
            propertyFacts: job.propertyFacts,
          });
          job.text = composed.ok ? composed.text : fallbackFollowup(job.row.step, firstName);
        })
    );

    // ---- 7. Save: chat messages, follow-up rows, activity events ----
    const sendable = jobs.filter((j) => !j.skip);
    const skipped = jobs.filter((j) => j.skip);

    if (sendable.length > 0) {
      const { error: msgError } = await db.from("messages").insert(
        sendable.map((j) => ({
          lead_id: j.lead.id,
          sender: "ai",
          channel: j.lead.source === "whatsapp" ? "whatsapp" : "chat",
          content: j.text,
          property_ids: j.propertyIds,
          created_at: j.row.scheduled_for, // shifted in time, as if it was sent then
        }))
      );
      if (msgError) throw msgError;

      await Promise.all(
        sendable.map(async (j) => {
          const { error } = await db
            .from("followups")
            .update({ status: "sent", sent_at: j.row.scheduled_for, message: j.text })
            .eq("id", j.row.id);
          if (error) throw error;
        })
      );

      const { error: eventError } = await db.from("activity_events").insert(
        sendable.map((j) => ({
          lead_id: j.lead.id,
          type: "followup_sent",
          payload: { name: j.lead.name, label: stepLabel(j.row.step), step: j.row.step },
        }))
      );
      if (eventError) console.error("[ff] activity events failed:", eventError.message);
    }

    if (skipped.length > 0) {
      const { error } = await db
        .from("followups")
        .update({ status: "cancelled" })
        .in("id", skipped.map((j) => j.row.id));
      if (error) console.error("[ff] cancel skipped failed:", error.message);
    }

    // ---- 8. In-app alert: Hot lead untouched for 48h+ (once per lead) ----
    const candidates = leads.filter(
      (l) =>
        l.temperature === "hot" &&
        (l.stage === "new" || l.stage === "qualified") &&
        horizon - new Date(l.last_contact_at ?? l.created_at).getTime() >= 48 * HOUR
    );

    const alerts: { lead_id: string; lead_name: string }[] = [];
    if (candidates.length > 0) {
      const { data: existing, error } = await db
        .from("activity_events")
        .select("lead_id")
        .eq("type", "hot_untouched")
        .in("lead_id", ids);
      if (error) throw error;

      const already = new Set(((existing ?? []) as { lead_id: string }[]).map((e) => e.lead_id));
      const fresh = candidates.filter((l) => !already.has(l.id));

      if (fresh.length > 0) {
        const { error: alertError } = await db.from("activity_events").insert(
          fresh.map((l) => ({
            lead_id: l.id,
            type: "hot_untouched",
            payload: {
              name: l.name,
              hours: Math.round(
                (horizon - new Date(l.last_contact_at ?? l.created_at).getTime()) / HOUR
              ),
            },
          }))
        );
        if (alertError) throw alertError;
        for (const l of fresh) alerts.push({ lead_id: l.id, lead_name: l.name ?? "New lead" });
      }
    }

    // ---- 9. Response (powers the animated timeline) ----
    return NextResponse.json({
      days,
      leads_considered: leads.length,
      processed: sendable.map((j) => ({
        followup_id: j.row.id,
        lead_id: j.lead.id,
        lead_name: j.lead.name ?? "New lead",
        step: j.row.step,
        label: stepLabel(j.row.step),
        when: formatOffset((new Date(j.row.scheduled_for).getTime() - now) / HOUR),
        sent_at: j.row.scheduled_for,
        message: j.text,
        property_count: j.propertyIds.length,
      })),
      skipped: skipped.length,
      remaining,
      alerts,
    });
  } catch (err) {
    console.error("[api/followups/fast-forward] failed:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: "Something went wrong on our side. Please try again." },
      { status: 500 }
    );
  }
}