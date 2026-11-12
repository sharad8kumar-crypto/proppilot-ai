import type { Extracted } from "@/lib/ai/schema";
import type { LeadRow, Purpose, Stage, Timeline } from "@/types/db";

export type MergedProfile = {
  name: string | null;
  budget_min: number | null;
  budget_max: number | null;
  bhk: number | null;
  preferred_locations: string[];
  timeline: Timeline;
  needs_loan: boolean | null;
  purpose: Purpose;
};

// Guards against model mistakes like returning "80" instead of 8000000
function sanitizeMoney(value: number | null): number | null {
  if (value === null) return null;
  if (!Number.isFinite(value)) return null;
  if (value < 500_000 || value > 5_000_000_000) return null;
  return Math.round(value);
}

function sanitizeBhk(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  const bhk = Math.round(value);
  return bhk >= 1 && bhk <= 6 ? bhk : null;
}

// Merge extracted fields into the lead WITHOUT overwriting known values with null.
export function mergeProfile(lead: LeadRow, extracted: Extracted): MergedProfile {
  let min = sanitizeMoney(extracted.budget_min) ?? lead.budget_min;
  let max = sanitizeMoney(extracted.budget_max) ?? lead.budget_max;
  if (min !== null && max !== null && min > max) {
    [min, max] = [max, min];
  }

  // Union of locations, case-insensitive, no duplicates
  const seen = new Set(lead.preferred_locations.map((l) => l.toLowerCase()));
  const locations = [...lead.preferred_locations];
  for (const raw of extracted.preferred_locations) {
    const clean = raw.trim();
    if (clean && !seen.has(clean.toLowerCase())) {
      seen.add(clean.toLowerCase());
      locations.push(clean);
    }
  }

  return {
    name: lead.name ?? (extracted.name?.trim().slice(0, 80) || null),
    budget_min: min,
    budget_max: max,
    bhk: sanitizeBhk(extracted.bhk) ?? lead.bhk,
    preferred_locations: locations,
    timeline: extracted.timeline !== "unknown" ? extracted.timeline : lead.timeline,
    needs_loan: extracted.needs_loan ?? lead.needs_loan,
    purpose: extracted.purpose !== "unknown" ? extracted.purpose : lead.purpose,
  };
}

// new -> qualified once we know budget, a need (BHK or location) and timeline.
// Never moves a lead backwards or out of a later stage.
export function nextStage(current: Stage, profile: MergedProfile): Stage {
  if (current !== "new") return current;

  const hasBudget = profile.budget_min !== null || profile.budget_max !== null;
  const hasNeed = profile.bhk !== null || profile.preferred_locations.length > 0;
  const hasTimeline = profile.timeline !== "unknown";

  return hasBudget && hasNeed && hasTimeline ? "qualified" : "new";
}