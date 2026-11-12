import "server-only";
import {
  normalizeMatchLead,
  normalizeProperty,
  type MatchLead,
} from "@/lib/matching";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { PropertyRow } from "@/types/db";

export async function getPropertiesData() {
  const db = getSupabaseAdmin();

  const [propsRes, leadsRes] = await Promise.all([
    db.from("properties").select("*").order("price_inr", { ascending: true }),
    db
      .from("leads")
      .select(
        "id,name,source,bhk,budget_min,budget_max,preferred_locations,temperature,score,stage"
      )
      .limit(1000),
  ]);

  for (const res of [propsRes, leadsRes]) {
    if (res.error) throw new Error(res.error.message);
  }

  return {
    properties: ((propsRes.data ?? []) as PropertyRow[]).map(normalizeProperty),
    leads: ((leadsRes.data ?? []) as MatchLead[]).map(normalizeMatchLead),
  };
}