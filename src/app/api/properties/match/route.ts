import { NextResponse } from "next/server";
import { z } from "zod";
import { emiForPrice } from "@/lib/emi";
import { matchProperties, normalizeProperty, type MatchCriteria } from "@/lib/matching";
import { rateLimit } from "@/lib/rate-limit";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { LeadRow, PropertyRow } from "@/types/db";

const bodySchema = z.object({
  lead_id: z.uuid().optional(),
  bhk: z.number().int().min(1).max(6).nullable().optional(),
  budget_min: z.number().positive().nullable().optional(),
  budget_max: z.number().positive().nullable().optional(),
  locations: z.array(z.string().max(80)).max(5).optional(),
});

// POST /api/properties/match
// Body: { lead_id } OR { bhk, budget_min, budget_max, locations }
export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    const limit = rateLimit(`match:${ip}`, 60, 60_000);
    if (!limit.ok) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
      );
    }

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Send { lead_id } or { bhk, budget_min, budget_max, locations }" },
        { status: 400 }
      );
    }
    const body = parsed.data;
    const db = getSupabaseAdmin();

    let criteria: MatchCriteria;
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
      const lead = data as LeadRow;
      criteria = {
        bhk: lead.bhk,
        budgetMin: lead.budget_min,
        budgetMax: lead.budget_max,
        locations: lead.preferred_locations,
      };
    } else {
      criteria = {
        bhk: body.bhk ?? null,
        budgetMin: body.budget_min ?? null,
        budgetMax: body.budget_max ?? null,
        locations: body.locations ?? [],
      };
    }

    const { data: propData, error: propError } = await db.from("properties").select("*");
    if (propError) throw propError;
    const properties = ((propData ?? []) as PropertyRow[]).map(normalizeProperty);

    const matches = matchProperties(criteria, properties, 3).map((m) => ({
      property: m.property,
      score: m.score,
      reasons: m.reasons,
      emi: emiForPrice(m.property.price_inr),
    }));

    return NextResponse.json({ criteria, matches });
  } catch (err) {
    console.error("[api/properties/match] failed:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: "Something went wrong on our side. Please try again." },
      { status: 500 }
    );
  }
}