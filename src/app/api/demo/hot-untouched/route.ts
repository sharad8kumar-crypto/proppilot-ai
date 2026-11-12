import { NextResponse } from "next/server";
import { checkAdmin } from "@/lib/admin-auth";
import { rateLimit } from "@/lib/rate-limit";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const HOUR = 3_600_000;
const HOURS_UNTOUCHED = 50;

// POST /api/demo/hot-untouched   (header: x-admin-key)
// Makes the newest Hot lead (still in New/Qualified) look untouched for 50 hours and
// raises the in-app alert. The lead really counts as "revenue at risk" afterwards.
export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    const limit = rateLimit(`untouched:${ip}`, 10, 60_000);
    if (!limit.ok) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
      );
    }

    const denied = checkAdmin(request);
    if (denied) return denied;

    const db = getSupabaseAdmin();
    const { data, error } = await db
      .from("leads")
      .select("id,name")
      .eq("temperature", "hot")
      .in("stage", ["new", "qualified"])
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) throw error;

    const lead = (data ?? [])[0] as { id: string; name: string | null } | undefined;
    if (!lead) {
      return NextResponse.json(
        { error: "No Hot lead in the New or Qualified stage. Simulate a Hot lead first." },
        { status: 404 }
      );
    }

    const { error: updateError } = await db
      .from("leads")
      .update({ last_contact_at: new Date(Date.now() - HOURS_UNTOUCHED * HOUR).toISOString() })
      .eq("id", lead.id);
    if (updateError) throw updateError;

    const { error: eventError } = await db.from("activity_events").insert({
      lead_id: lead.id,
      type: "hot_untouched",
      payload: { name: lead.name, hours: HOURS_UNTOUCHED },
    });
    if (eventError) throw eventError;

    return NextResponse.json({
      lead_id: lead.id,
      lead_name: lead.name ?? "New lead",
      hours: HOURS_UNTOUCHED,
    });
  } catch (err) {
    console.error("[api/demo/hot-untouched] failed:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: "Something went wrong on our side. Please try again." },
      { status: 500 }
    );
  }
}