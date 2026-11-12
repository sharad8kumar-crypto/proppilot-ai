import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SEQUENCES, rangeFor } from "@/lib/followups";
import type { Temperature } from "@/types";
import type { Stage } from "@/types/db";

const HOUR = 3_600_000;

type SequenceLead = { id: string; temperature: Temperature; stage: Stage };

// Keeps a lead's follow-up sequence in line with its temperature:
// - lost / booked leads: pending nurture steps are cancelled
// - a sequence from another temperature is cancelled
// - if the lead has no active sequence for its temperature, a new one is created
// (visit reminders, steps 90 and 91, are never touched here)
export async function syncSequence(
  db: SupabaseClient,
  lead: SequenceLead,
  now: number
): Promise<void> {
  const { data, error } = await db
    .from("followups")
    .select("id,step,status")
    .eq("lead_id", lead.id)
    .lt("step", 90);
  if (error) throw error;

  const rows = (data ?? []) as { id: string; step: number; status: string }[];

  if (lead.stage === "lost" || lead.stage === "booked") {
    const ids = rows.filter((r) => r.status === "pending").map((r) => r.id);
    if (ids.length > 0) {
      const { error: cancelError } = await db
        .from("followups")
        .update({ status: "cancelled" })
        .in("id", ids);
      if (cancelError) throw cancelError;
    }
    return;
  }

  const [min, max] = rangeFor(lead.temperature);

  const wrongPending = rows
    .filter((r) => r.status === "pending" && (r.step < min || r.step > max))
    .map((r) => r.id);
  if (wrongPending.length > 0) {
    const { error: cancelError } = await db
      .from("followups")
      .update({ status: "cancelled" })
      .in("id", wrongPending);
    if (cancelError) throw cancelError;
  }

  const active = rows.filter(
    (r) => r.step >= min && r.step <= max && r.status !== "cancelled"
  );
  if (active.length > 0) return;

  const { error: insertError } = await db.from("followups").insert(
    SEQUENCES[lead.temperature].map((def) => ({
      lead_id: lead.id,
      step: def.step,
      scheduled_for: new Date(now + def.offsetHours * HOUR).toISOString(),
      status: "pending",
      message: null,
    }))
  );
  if (insertError) throw insertError;
}