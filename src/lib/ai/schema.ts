import { z } from "zod";

export const TIMELINES = [
  "immediate",
  "1-3 months",
  "3-6 months",
  "6+ months",
  "unknown",
] as const;

export const PURPOSES = ["self-use", "investment", "unknown"] as const;

export const INTENTS = [
  "browsing",
  "interested",
  "ready_to_visit",
  "price_negotiation",
  "emergency_urgent",
  "not_interested",
  "other",
] as const;

// ---- Zod: validates (and repairs) whatever the model returns ----
// .catch() gives safe defaults, so one bad field never crashes a live demo.
const extractedSchema = z.object({
  name: z.string().nullable().catch(null),
  budget_min: z.number().nullable().catch(null),
  budget_max: z.number().nullable().catch(null),
  bhk: z.number().nullable().catch(null),
  preferred_locations: z.array(z.string()).catch([]),
  timeline: z.enum(TIMELINES).catch("unknown"),
  needs_loan: z.boolean().nullable().catch(null),
  purpose: z.enum(PURPOSES).catch("unknown"),
});

export type Extracted = z.infer<typeof extractedSchema>;

export const EMPTY_EXTRACTED: Extracted = {
  name: null,
  budget_min: null,
  budget_max: null,
  bhk: null,
  preferred_locations: [],
  timeline: "unknown",
  needs_loan: null,
  purpose: "unknown",
};

export const qualifyResultSchema = z.object({
  reply: z.string().trim().min(1),
  extracted: extractedSchema.catch(EMPTY_EXTRACTED),
  intent: z.enum(INTENTS).catch("other"),
  wants_property_suggestions: z.boolean().catch(false),
  wants_site_visit: z.boolean().catch(false),
  requested_visit_time: z.string().nullable().catch(null),
  asked_emi: z.boolean().catch(false),
  summary: z.string().catch(""),
});

export type QualifyResult = z.infer<typeof qualifyResultSchema>;

// ---- JSON Schema sent to Groq (strict mode) ----
// Strict mode rules: every property is required, objects are closed,
// optional values use ["type", "null"].
export const QUALIFY_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    reply: { type: "string" },
    extracted: {
      type: "object",
      properties: {
        name: { type: ["string", "null"] },
        budget_min: { type: ["number", "null"] },
        budget_max: { type: ["number", "null"] },
        bhk: { type: ["number", "null"] },
        preferred_locations: { type: "array", items: { type: "string" } },
        timeline: { type: "string", enum: [...TIMELINES] },
        needs_loan: { type: ["boolean", "null"] },
        purpose: { type: "string", enum: [...PURPOSES] },
      },
      required: [
        "name",
        "budget_min",
        "budget_max",
        "bhk",
        "preferred_locations",
        "timeline",
        "needs_loan",
        "purpose",
      ],
      additionalProperties: false,
    },
    intent: { type: "string", enum: [...INTENTS] },
    wants_property_suggestions: { type: "boolean" },
    wants_site_visit: { type: "boolean" },
    requested_visit_time: { type: ["string", "null"] },
    asked_emi: { type: "boolean" },
    summary: { type: "string" },
  },
  required: [
    "reply",
    "extracted",
    "intent",
    "wants_property_suggestions",
    "wants_site_visit",
    "requested_visit_time",
    "asked_emi",
    "summary",
  ],
  additionalProperties: false,
};