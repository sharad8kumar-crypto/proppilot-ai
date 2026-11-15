import { SEQUENCES, formatOffset } from "@/lib/followups";
import { SCORE_MAX } from "@/lib/scoring";
import type { LeadSource } from "@/types";

export type NodeKind =
  | "trigger"
  | "manual"
  | "ai"
  | "score"
  | "branch"
  | "alert"
  | "assign"
  | "visit"
  | "matches"
  | "followup"
  | "nurture"
  | "delay"
  | "logger";

export const NODE_IDS = {
  trigger: "trigger",
  ai: "ai",
  score: "score",
  branch: "branch",
  alert: "alert",
  assign: "assign",
  visit: "visit",
  matches: "matches",
  followup: "followup",
  nurture: "nurture",
} as const;

export const KIND_LABEL: Record<NodeKind, string> = {
  trigger: "Trigger node",
  manual: "Trigger node",
  ai: "AI Processor node",
  score: "Scoring node",
  branch: "Condition node",
  alert: "Action node",
  assign: "Action node",
  visit: "Action node",
  matches: "Action node",
  followup: "Action node",
  nurture: "Action node",
  delay: "Utility node",
  logger: "Utility node",
};

export const KIND_DESCRIPTION: Record<NodeKind, string> = {
  trigger: "Starts the workflow whenever a new lead arrives from a portal, an ad, WhatsApp or the website.",
  manual: "Starts the workflow when you press Run.",
  ai: "Chats with the buyer in English and extracts budget, BHK, area, timeline and loan need.",
  score: "Scores the lead out of 100 with fixed rules in code, so every point can be explained.",
  branch: "Routes the lead to the Hot, Warm or Cold path using its score.",
  alert: "Tells your team about a Hot lead through the notification bell and the activity feed.",
  assign: "Assigns the lead to the agent with the fewest upcoming visits.",
  visit: "Offers free slots and books the site visit the buyer chooses.",
  matches: "Picks the best matching properties from the database and sends them as cards.",
  followup: "Schedules automatic follow-up messages for a Warm lead.",
  nurture: "Schedules gentle long-term messages for a Cold lead.",
  delay: "Waits for a set time before the next step. Demo node, not part of the live test.",
  logger: "Records a message in the activity log. Demo node, not part of the live test.",
};

export type CoreNode = {
  id: string;
  kind: NodeKind;
  title: string;
  subtitle: string;
  x: number;
  y: number;
};

// The ready-made flow (top to bottom)
export const CORE_NODES: CoreNode[] = [
  { id: NODE_IDS.trigger, kind: "trigger", title: "New Lead", subtitle: "Portal, ad, WhatsApp, website", x: 240, y: 0 },
  { id: NODE_IDS.ai, kind: "ai", title: "AI Qualify", subtitle: "Chat, extract, understand", x: 240, y: 100 },
  { id: NODE_IDS.score, kind: "score", title: "Lead Score", subtitle: "Rule-based, out of 100", x: 240, y: 200 },
  { id: NODE_IDS.branch, kind: "branch", title: "Temperature", subtitle: "Hot, Warm or Cold?", x: 240, y: 300 },
  { id: NODE_IDS.alert, kind: "alert", title: "In-app Alert", subtitle: "Bell and activity feed", x: 0, y: 430 },
  { id: NODE_IDS.assign, kind: "assign", title: "Assign Agent", subtitle: "Fewest visits first", x: 0, y: 530 },
  { id: NODE_IDS.visit, kind: "visit", title: "Offer Site Visit", subtitle: "Free slots, IST", x: 0, y: 630 },
  { id: NODE_IDS.matches, kind: "matches", title: "Send Properties", subtitle: "Top 3 matches", x: 240, y: 430 },
  { id: NODE_IDS.followup, kind: "followup", title: "3-day Follow-up", subtitle: "Day 1, 3 and 7", x: 240, y: 530 },
  { id: NODE_IDS.nurture, kind: "nurture", title: "Nurture Sequence", subtitle: "Day 2, 7 and 14", x: 480, y: 430 },
];

export type EdgeLabel = "Hot" | "Warm" | "Cold";

export type CoreEdge = { id: string; source: string; target: string; label?: EdgeLabel };

export const CORE_EDGES: CoreEdge[] = [
  { id: "e-trigger-ai", source: NODE_IDS.trigger, target: NODE_IDS.ai },
  { id: "e-ai-score", source: NODE_IDS.ai, target: NODE_IDS.score },
  { id: "e-score-branch", source: NODE_IDS.score, target: NODE_IDS.branch },
  { id: "e-branch-alert", source: NODE_IDS.branch, target: NODE_IDS.alert, label: "Hot" },
  { id: "e-alert-assign", source: NODE_IDS.alert, target: NODE_IDS.assign },
  { id: "e-assign-visit", source: NODE_IDS.assign, target: NODE_IDS.visit },
  { id: "e-branch-matches", source: NODE_IDS.branch, target: NODE_IDS.matches, label: "Warm" },
  { id: "e-matches-followup", source: NODE_IDS.matches, target: NODE_IDS.followup },
  { id: "e-branch-nurture", source: NODE_IDS.branch, target: NODE_IDS.nurture, label: "Cold" },
];

// ---------------- Node library (left panel) ----------------

export type LibraryItem = { kind: NodeKind; title: string; subtitle: string };

export const LIBRARY: { category: string; items: LibraryItem[] }[] = [
  {
    category: "Triggers",
    items: [
      { kind: "trigger", title: "New Lead", subtitle: "Runs when a lead arrives" },
      { kind: "manual", title: "Manual Trigger", subtitle: "Run manually" },
    ],
  },
  {
    category: "Actions",
    items: [
      { kind: "ai", title: "AI Qualify", subtitle: "Process with AI" },
      { kind: "matches", title: "Send Properties", subtitle: "Share matching homes" },
      { kind: "visit", title: "Book Site Visit", subtitle: "Offer and confirm slots" },
      { kind: "followup", title: "Send Follow-up", subtitle: "Timed messages" },
      { kind: "alert", title: "In-app Alert", subtitle: "Notify your team" },
      { kind: "assign", title: "Assign Agent", subtitle: "Round robin by load" },
    ],
  },
  {
    category: "Conditions",
    items: [
      { kind: "branch", title: "Temperature Branch", subtitle: "Hot, Warm or Cold" },
      { kind: "score", title: "Score Check", subtitle: "Score out of 100" },
    ],
  },
  {
    category: "Utilities",
    items: [
      { kind: "delay", title: "Delay", subtitle: "Add time delay" },
      { kind: "logger", title: "Logger", subtitle: "Log information" },
    ],
  },
];

// ---------------- Settings shown in the right panel (read from real code constants) ----------------

export const SCORE_LABELS: Record<keyof typeof SCORE_MAX, string> = {
  timeline: "Timeline urgency",
  budget: "Budget clarity",
  specificity: "Location + BHK",
  loan_purpose: "Loan + purpose",
  engagement: "Engagement",
  visit_intent: "Site visit intent",
};

export type SettingRow = { label: string; value: string };

function sequenceRows(temperature: "warm" | "cold"): SettingRow[] {
  return SEQUENCES[temperature].map((d) => ({
    label: d.label,
    value: `${formatOffset(d.offsetHours)} after the sequence starts`,
  }));
}

export function settingsFor(kind: NodeKind): SettingRow[] {
  switch (kind) {
    case "trigger":
      return [
        { label: "Sources", value: "99acres, MagicBricks, Housing, Facebook, WhatsApp, Website" },
        { label: "Demo note", value: "Portal and WhatsApp feeds are simulated" },
      ];
    case "manual":
      return [{ label: "Starts when", value: "You press Run test" }];
    case "ai":
      return [
        { label: "Provider", value: "Groq (model set by GROQ_MODEL)" },
        { label: "Output", value: "Strict JSON, one question at a time" },
        { label: "Language", value: "Clear, simple English" },
        { label: "Reasoning effort", value: "Low, for fast replies" },
      ];
    case "score":
      return [
        ...(Object.keys(SCORE_MAX) as (keyof typeof SCORE_MAX)[]).map((key) => ({
          label: SCORE_LABELS[key],
          value: `Up to ${SCORE_MAX[key]} points`,
        })),
        { label: "Total", value: "100 points, calculated in code (not by AI)" },
      ];
    case "branch":
      return [
        { label: "Hot", value: "Score 70 or more" },
        { label: "Warm", value: "Score 40 to 69" },
        { label: "Cold", value: "Score below 40" },
      ];
    case "alert":
      return [
        { label: "Channel", value: "Notification bell and activity feed" },
        { label: "Fires when", value: "A lead becomes Hot (score 70+)" },
        { label: "Also", value: "Hot lead untouched for 48h+" },
      ];
    case "assign":
      return [
        { label: "Strategy", value: "Agent with the fewest upcoming visits" },
        { label: "Ties", value: "Broken alphabetically" },
        { label: "Runs", value: "When a site visit is booked" },
      ];
    case "visit":
      return [
        { label: "Slots", value: "11:00 AM, 2:00 PM, 5:00 PM (IST)" },
        { label: "Window", value: "Next 3 days, at least 2 hours ahead" },
        { label: "Reminders", value: "24 hours and 2 hours before" },
      ];
    case "matches":
      return [
        { label: "Options sent", value: "Top 3 properties" },
        { label: "BHK", value: "Exact match first, plus or minus 1" },
        { label: "Budget", value: "Up to 110% of the buyer's budget" },
        { label: "Location", value: "Same area boosts the rank" },
        { label: "Facts", value: "Always from the database" },
      ];
    case "followup":
      return sequenceRows("warm");
    case "nurture":
      return sequenceRows("cold");
    case "delay":
      return [{ label: "Duration", value: "Configurable (demo node)" }];
    case "logger":
      return [{ label: "Writes to", value: "Activity log (demo node)" }];
  }
}

// ---------------- Run test scenarios ----------------

export type Scenario = "hot" | "warm" | "cold";

export const SCENARIOS: Record<
  Scenario,
  { label: string; leadName: string; source: LeadSource; messages: string[] }
> = {
  hot: {
    label: "Hot lead",
    leadName: "Test Lead (Hot)",
    source: "99acres",
    messages: [
      "Hi, I need a 2 BHK in Noida Extension. My budget is 80 lakh and I want to buy within 2 months.",
      "Yes, I will take a home loan. It is for my own use.",
      "I would like to visit tomorrow at 11 AM.",
    ],
  },
  warm: {
    label: "Warm lead",
    leadName: "Test Lead (Warm)",
    source: "facebook",
    messages: [
      "Hi, I am looking for a 2 BHK in Greater Noida West. My budget is around 70 lakh.",
      "I want to buy in 4 to 5 months. I am still comparing options.",
    ],
  },
  cold: {
    label: "Cold lead",
    leadName: "Test Lead (Cold)",
    source: "website",
    messages: ["Hi, I am just browsing. I have not decided anything yet."],
  },
};