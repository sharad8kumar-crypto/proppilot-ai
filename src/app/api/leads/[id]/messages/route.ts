import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const bodySchema = z.object({
  content: z.string().trim().min(1).max(500),
});

// POST /api/leads/:id/messages  -> a human agent sends a message to the lead
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!z.uuid().safeParse(id).success) {
      return NextResponse.json({ error: "Invalid lead id" }, { status: 400 });
    }

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    const limit = rateLimit(`agent:${ip}`, 30, 60_000);
    if (!limit.ok) {
      return NextResponse.json(
        { error: "Too many messages. Please wait a moment." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
      );
    }

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Send { content: string (1 to 500 chars) }" },
        { status: 400 }
      );
    }

    const db = getSupabaseAdmin();

    const { data: lead, error: leadError } = await db
      .from("leads")
      .select("id, source")
      .eq("id", id)
      .maybeSingle();
    if (leadError) throw leadError;
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const now = new Date().toISOString();
    const { error: insertError } = await db.from("messages").insert({
      lead_id: id,
      sender: "agent",
      channel: lead.source === "whatsapp" ? "whatsapp" : "chat",
      content: parsed.data.content,
      created_at: now,
    });
    if (insertError) throw insertError;

    // A human touched this lead
    const { error: updateError } = await db
      .from("leads")
      .update({ last_contact_at: now })
      .eq("id", id);
    if (updateError) throw updateError;

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(
      "[api/leads/messages] failed:",
      err instanceof Error ? err.message : err
    );
    return NextResponse.json(
      { error: "Something went wrong on our side. Please try again." },
      { status: 500 }
    );
  }
}