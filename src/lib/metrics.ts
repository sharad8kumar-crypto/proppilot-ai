import type { DashboardLead } from "@/types";

// A Hot lead still in an early stage with no human touch for this many hours
// counts as "revenue at risk"
export const AT_RISK_HOURS = 48;

// Computed from data, never hardcoded.
export function getRevenueAtRisk(leads: DashboardLead[]) {
  const atRisk = leads
    .filter(
      (l) =>
        l.temperature === "hot" &&
        (l.stage === "new" || l.stage === "qualified") &&
        l.untouchedHours >= AT_RISK_HOURS
    )
    .map((l) => ({ ...l, value: l.dealValue }))
    .sort((a, b) => b.value - a.value);

  return {
    total: atRisk.reduce((sum, l) => sum + l.value, 0),
    count: atRisk.length,
    leads: atRisk,
  };
}