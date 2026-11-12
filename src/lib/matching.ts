import type { LeadSource, Temperature } from "@/types";
import type { PropertyRow } from "@/types/db";

// Pure, explainable matching. No AI. Used by the chat route (buyer -> properties)
// and by the Properties drawer (property -> matched leads).

export type MatchCriteria = {
  bhk: number | null;
  budgetMin: number | null;
  budgetMax: number | null;
  locations: string[];
};

export type MatchLead = {
  id: string;
  name: string | null;
  source: LeadSource;
  bhk: number | null;
  budget_min: number | null;
  budget_max: number | null;
  preferred_locations: string[];
  temperature: Temperature;
  score: number;
  stage: string;
};

export type MatchScore = { score: number; reasons: string[] };

// Names people use for the same area
const AREA_GROUPS: string[][] = [
  ["noida extension", "greater noida west", "gaur city", "noida ext"],
  ["sohna road", "sohna"],
  ["sector 150", "sec 150"],
];

const norm = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

function areaGroup(text: string): number {
  const n = norm(text);
  return AREA_GROUPS.findIndex((group) => group.some((alias) => n.includes(alias)));
}

// 2 = same area, 1 = same city, 0 = no match
function locationTier(
  locations: string[],
  p: Pick<PropertyRow, "locality" | "city">
): 0 | 1 | 2 {
  const pLocality = norm(p.locality);
  const pCity = norm(p.city);
  const pGroup = areaGroup(p.locality);
  let tier: 0 | 1 | 2 = 0;

  for (const raw of locations) {
    const loc = norm(raw);
    if (!loc) continue;
    if (loc === pLocality || pLocality.includes(loc) || loc.includes(pLocality)) return 2;
    const group = areaGroup(raw);
    if (group !== -1 && group === pGroup) return 2;
    if (loc.includes(pCity) || pCity.includes(loc)) tier = 1;
  }
  return tier;
}

// Returns null when the property is not a fit at all
export function scoreMatch(c: MatchCriteria, p: PropertyRow): MatchScore | null {
  if (p.status === "sold") return null;
  if (c.bhk !== null && Math.abs(p.bhk - c.bhk) > 1) return null;

  const ceiling = c.budgetMax ?? c.budgetMin;
  if (ceiling !== null && p.price_inr > ceiling * 1.1) return null;

  const reasons: string[] = [];
  let score = 0;

  // BHK (max 35)
  if (c.bhk === null) {
    score += 15;
  } else if (p.bhk === c.bhk) {
    score += 35;
    reasons.push(`Exact ${p.bhk} BHK`);
  } else {
    score += 5;
    reasons.push(`${p.bhk} BHK, close to ${c.bhk} BHK`);
  }

  // Price (max 30). Within budget is best; very cheap options score a bit less.
  if (ceiling === null) {
    score += 15;
  } else {
    const ratio = p.price_inr / ceiling;
    if (ratio <= 1) {
      score += 30 - Math.max(0, 0.6 - ratio) * 30;
      reasons.push("Within budget");
    } else {
      score += 12;
      reasons.push("Slightly above budget");
    }
  }

  // Location (max 30)
  if (c.locations.length === 0) {
    score += 10;
  } else {
    const tier = locationTier(c.locations, p);
    if (tier === 2) {
      score += 30;
      reasons.push(`In ${p.locality}`);
    } else if (tier === 1) {
      score += 12;
      reasons.push(`Nearby (${p.city})`);
    }
  }

  // Availability (max 5)
  if (p.status === "available") {
    score += 5;
  } else {
    score += 4;
    reasons.push("Few units left");
  }

  return { score: Math.round(score), reasons };
}

export function matchProperties(
  criteria: MatchCriteria,
  properties: PropertyRow[],
  limit = 3
): { property: PropertyRow; score: number; reasons: string[] }[] {
  const results: { property: PropertyRow; score: number; reasons: string[] }[] = [];

  for (const property of properties) {
    const res = scoreMatch(criteria, property);
    if (res) results.push({ property, ...res });
  }

  // best score first; for equal scores, the cheaper one first
  results.sort((a, b) => b.score - a.score || a.property.price_inr - b.property.price_inr);
  return results.slice(0, limit);
}

// Which active leads fit this property? (for the property drawer)
export function matchLeads(
  property: PropertyRow,
  leads: MatchLead[],
  limit = 6
): { lead: MatchLead; score: number; reasons: string[] }[] {
  const results: { lead: MatchLead; score: number; reasons: string[] }[] = [];

  for (const lead of leads) {
    if (lead.stage === "lost" || lead.stage === "booked") continue;

    const hasCriteria =
      lead.bhk !== null ||
      lead.budget_min !== null ||
      lead.budget_max !== null ||
      lead.preferred_locations.length > 0;
    if (!hasCriteria) continue;

    const res = scoreMatch(
      {
        bhk: lead.bhk,
        budgetMin: lead.budget_min,
        budgetMax: lead.budget_max,
        locations: lead.preferred_locations,
      },
      property
    );
    if (res) results.push({ lead, ...res });
  }

  results.sort((a, b) => b.score - a.score || b.lead.score - a.lead.score);
  return results.slice(0, limit);
}

// ---- Number cleanup (bigint columns can arrive as strings) ----
const toNum = (v: unknown): number | null => {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export function normalizeProperty(p: PropertyRow): PropertyRow {
  return {
    ...p,
    price_inr: Number(p.price_inr),
    lat: toNum(p.lat),
    lng: toNum(p.lng),
    area_sqft: toNum(p.area_sqft),
    amenities: p.amenities ?? [],
  };
}

export function normalizeMatchLead(l: MatchLead): MatchLead {
  return {
    ...l,
    budget_min: toNum(l.budget_min),
    budget_max: toNum(l.budget_max),
    preferred_locations: l.preferred_locations ?? [],
  };
}