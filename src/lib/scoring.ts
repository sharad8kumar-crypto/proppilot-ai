import type { Temperature } from "../types";
import type { Intent, Purpose, ScoreBreakdown, Timeline } from "../types/db";

// Pure code, no AI: every point can be explained to a client.
// Total = 100. No server-only import, so UI can reuse these constants.

export const SCORE_MAX = {
  timeline: 25,
  budget: 20,
  specificity: 15,
  loan_purpose: 15,
  engagement: 15,
  visit_intent: 10,
} as const;

const TIMELINE_POINTS: Record<Timeline, number> = {
  immediate: 25,
  "1-3 months": 20,
  "3-6 months": 10,
  "6+ months": 4,
  unknown: 0,
};

export type ScoreInput = {
  timeline: Timeline;
  budgetMin: number | null;
  budgetMax: number | null;
  bhk: number | null;
  preferredLocations: string[];
  needsLoan: boolean | null;
  purpose: Purpose;
  intent: Intent | null;
  wantsSiteVisit: boolean;
  leadMessageCount: number;
  avgReplySeconds: number | null; // how fast the lead replies to us
};

export function computeScore(input: ScoreInput): ScoreBreakdown {
  // 1. Timeline urgency
  const timeline = TIMELINE_POINTS[input.timeline];

  // 2. Budget clarity: both ends known = 20, one = 12
  const hasMin = input.budgetMin !== null;
  const hasMax = input.budgetMax !== null;
  const budget = hasMin && hasMax ? 20 : hasMin || hasMax ? 12 : 0;

  // 3. Location + BHK specificity
  const hasBhk = input.bhk !== null;
  const hasLocation = input.preferredLocations.length > 0;
  const specificity = hasBhk && hasLocation ? 15 : hasBhk || hasLocation ? 8 : 0;

  // 4. Loan readiness (10) + purpose clarity (5)
  const loan_purpose =
    (input.needsLoan !== null ? 10 : 0) + (input.purpose !== "unknown" ? 5 : 0);

  // 5. Engagement: message count (max 10) + reply speed (max 5), capped at 15
  const messagePoints = Math.min(10, input.leadMessageCount * 2);
  const speedPoints =
    input.avgReplySeconds === null
      ? 0
      : input.avgReplySeconds <= 120
        ? 5
        : input.avgReplySeconds <= 3600
          ? 3
          : 1;
  const engagement = Math.min(15, messagePoints + speedPoints);

  // 6. Site visit intent
  const visit_intent =
    input.intent === "ready_to_visit" || input.wantsSiteVisit ? 10 : 0;

  const total = Math.min(
    100,
    timeline + budget + specificity + loan_purpose + engagement + visit_intent
  );

  return { timeline, budget, specificity, loan_purpose, engagement, visit_intent, total };
}

// Hot >= 70, Warm 40-69, Cold < 40
export function temperatureFor(score: number): Temperature {
  if (score >= 70) return "hot";
  if (score >= 40) return "warm";
  return "cold";
}

// Estimated deal value = midpoint of the budget range (or the one known figure)
export function estimateDealValue(
  min: number | null,
  max: number | null
): number | null {
  if (min !== null && max !== null) return Math.round((min + max) / 2);
  return max ?? min ?? null;
}