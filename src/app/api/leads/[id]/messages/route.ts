import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { stageLabel } from "@/lib/stages";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Stage } from "@/types/db";

const bodySchema = z.object({
  stage: z.enum(["new", "qualified", "site_visit", "negotiation", "booked", "lost"]),
});

// PATCH /api/leads/:id  { stage }
// Moves a lead between pipeline stages (stage_changed_at is set by a database trigger)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!z.uuid().safeParse(id).success) {
      return NextResponse.json({ error: "Invalid lead id" }, { status: 400 });
    }

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    const limit = rateLimit(`stage:${ip}`, 60, 60_000);
    if (!limit.ok) {
      return NextResponse.json(
        { error: "Too many changes. Please wait a moment." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
      );
    }

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Send { stage }" }, { status: 400 });
    }
    const to: Stage = parsed.data.stage;

    const db = getSupabaseAdmin();
    const { data: lead, error: leadError } = await db
      .from("leads")
      .select("id,name,stage")
      .eq("id", id)
      .maybeSingle();
    if (leadError) throw leadError;
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const from = lead.stage as Stage;
    if (from === to) {
      return NextResponse.json({ ok: true, from, to, unchanged: true });
    }

    const { error: updateError } = await db.from("leads").update({ stage: to }).eq("id", id);
    if (updateError) throw updateError;

    // Closed leads stop getting automatic follow-ups.
    // Lost: cancel everything pending (including visit reminders).
    // Booked: cancel the nurture steps but keep visit reminders.
    if (to === "lost" || to === "booked") {
      let cancel = db
        .from("followups")
        .update({ status: "cancelled" })
        .eq("lead_id", id)
        .eq("status", "pending");
      if (to === "booked") cancel = cancel.lt("step", 90);
      const { error: cancelError } = await cancel;
      if (cancelError) console.error("[leads] cancel follow-ups failed:", cancelError.message);
    }

    const { error: eventError } = await db.from("activity_events").insert({
      lead_id: id,
      type: "stage_changed",
      payload: {
        name: lead.name,
        from,
        to,
        from_label: stageLabel(from),
        to_label: stageLabel(to),
      },
    });
    if (eventError) console.error("[leads] activity event failed:", eventError.message);

    return NextResponse.json({ ok: true, from, to });
  } catch (err) {
    console.error("[api/leads] failed:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: "Something went wrong on our side. Please try again." },
      { status: 500 }
    );
  }
}