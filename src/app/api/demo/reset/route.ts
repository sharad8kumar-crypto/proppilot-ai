import { NextResponse } from "next/server";
import { checkAdmin } from "@/lib/admin-auth";
import { rateLimit } from "@/lib/rate-limit";
import { seedDatabase } from "@/lib/seed";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

// POST /api/demo/reset   (header: x-admin-key)
// Wipes all demo data and loads the fresh seed again.
export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    const limit = rateLimit(`reset:${ip}`, 5, 60_000);
    if (!limit.ok) {
      return NextResponse.json(
        { error: "Too many attempts. Please wait a minute." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
      );
    }

    const denied = checkAdmin(request);
    if (denied) return denied;

    const summary = await seedDatabase(getSupabaseAdmin());
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    console.error("[api/demo/reset] failed:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: "Reset failed. Check the server log for details." },
      { status: 500 }
    );
  }
}