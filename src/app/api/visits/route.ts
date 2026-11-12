import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeProperty } from "@/lib/matching";
import { rateLimit } from "@/lib/rate-limit";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { bookVisit, loadFreeSlots } from "@/lib/visit-booking";
import type { LeadRow, PropertyRow } from "@/types/db";

const bodySchema = z.object({
  lead_id: z.uuid(),
  property_id: z.uuid().optional(),
  scheduled_at: z.iso.datetime(), // must be one of the free slots
});

// POST /api/visits: book a site visit for a lead (agent is auto-assigned)
export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    const limit = rateLimit(`visits:${ip}`, 30, 60_000);
    if (!limit.ok) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
      );
    }

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Send { lead_id, scheduled_at (ISO time of a free slot), property_id? }" },
        { status: 400 }
      );
    }
    const body = parsed.data;
    const db = getSupabaseAdmin();
    const now = Date.now();

    const { data: leadData, error: leadError } = await db
      .from("leads")
      .select("*")
      .eq("id", body.lead_id)
      .maybeSingle();
    if (leadError) throw leadError;
    if (!leadData) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }
    const lead = leadData as LeadRow;

    let property: PropertyRow | null = null;
    if (body.property_id) {
      const { data, error } = await db
        .from("properties")
        .select("*")
        .eq("id", body.property_id)
        .maybeSingle();
      if (error) throw error;
      property = data ? normalizeProperty(data as PropertyRow) : null;
    }

    const slot = new Date(body.scheduled_at);
    const { slots } = await loadFreeSlots(db, now);
    if (!slots.some((s) => s.start.getTime() === slot.getTime())) {
      return NextResponse.json(
        {
          error: "That slot is not available.",
          available: slots.map((s) => s.start.toISOString()),
        },
        { status: 409 }
      );
    }

    const booked = await bookVisit(db, {
      leadId: lead.id,
      leadName: lead.name,
      property,
      slot,
      now,
    });
    if (!booked) {
      return NextResponse.json({ error: "That slot was just taken." }, { status: 409 });
    }

    // Move the lead to "Site Visit" and assign the same agent
    const { error: updateError } = await db
      .from("leads")
      .update({
        stage: lead.stage === "new" || lead.stage === "qualified" ? "site_visit" : lead.stage,
        assigned_agent_id: booked.agent.id,
        visit_offer: null,
        last_contact_at: new Date().toISOString(),
      })
      .eq("id", lead.id);
    if (updateError) throw updateError;

    return NextResponse.json(
      {
        visit_id: booked.visitId,
        scheduled_at: booked.slot.toISOString(),
        when: booked.whenText,
        agent: booked.agent,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[api/visits] failed:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: "Something went wrong on our side. Please try again." },
      { status: 500 }
    );
  }
}