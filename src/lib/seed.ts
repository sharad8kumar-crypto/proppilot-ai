import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LeadSource } from "../types";
import type { Intent, Purpose, Stage, Timeline } from "../types/db";
import { computeScore, estimateDealValue, temperatureFor } from "./scoring";

// Wipes the demo tables and loads fresh demo data. Used by `npm run seed` and by the
// Reset button. All builders and projects are FICTIONAL. Lead phone numbers are left
// empty on purpose so no real person's number is ever stored.

const LAKH = 100_000;
const CR = 10_000_000;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export type SeedSummary = {
  agents: number;
  properties: number;
  leads: number;
  messages: number;
  site_visits: number;
  activity_events: number;
};

// ---------- seeded random helpers (same data every run) ----------
function createRng(seed: number) {
  let s = seed;

  function rand(): number {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function pick<T>(items: T[]): T {
    return items[Math.floor(rand() * items.length)];
  }
  function between(a: number, b: number): number {
    return a + rand() * (b - a);
  }
  function weighted<T>(items: ReadonlyArray<readonly [T, number]>): T {
    const total = items.reduce((sum, [, w]) => sum + w, 0);
    let r = rand() * total;
    for (const [value, w] of items) {
      r -= w;
      if (r <= 0) return value;
    }
    return items[items.length - 1][0];
  }
  function shuffle<T>(items: T[]): T[] {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  return { rand, pick, between, weighted, shuffle };
}

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

function formatBudget(value: number): string {
  return value >= CR
    ? `${Number((value / CR).toFixed(2))} crore`
    : `${Math.round(value / LAKH)} lakh`;
}

// ---------- static demo data ----------
const IMAGES = [
  "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1200&q=80",
  "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200&q=80",
  "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=1200&q=80",
  "https://images.unsplash.com/photo-1460317442991-0ec209397118?w=1200&q=80",
  "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1200&q=80",
  "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200&q=80",
  "https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=1200&q=80",
  "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=80",
];

const AMENITIES = [
  "Clubhouse",
  "Swimming pool",
  "Gym",
  "Kids play area",
  "24x7 security",
  "Power backup",
  "Landscaped garden",
  "Covered parking",
  "Jogging track",
  "EV charging",
  "Indoor games",
  "Co-working lounge",
];

type PropertySeed = {
  project: string;
  builder: string;
  locality: string;
  city: string;
  lat: number;
  lng: number;
  bhk: number;
  area: number;
  price: number;
  status: "available" | "few_left" | "sold";
  possession: string;
};

const PROPERTY_SEEDS: PropertySeed[] = [
  { project: "Aurum Greens", builder: "Aurum Homes", locality: "Noida Extension", city: "Greater Noida", lat: 28.602, lng: 77.429, bhk: 2, area: 1085, price: 68 * LAKH, status: "available", possession: "Dec 2027" },
  { project: "Aurum Greens", builder: "Aurum Homes", locality: "Noida Extension", city: "Greater Noida", lat: 28.604, lng: 77.431, bhk: 3, area: 1450, price: 94 * LAKH, status: "few_left", possession: "Dec 2027" },
  { project: "Skyline Heights", builder: "Skyline Realty", locality: "Greater Noida West", city: "Greater Noida", lat: 28.585, lng: 77.44, bhk: 1, area: 640, price: 35 * LAKH, status: "available", possession: "Ready to move" },
  { project: "Skyline Heights", builder: "Skyline Realty", locality: "Greater Noida West", city: "Greater Noida", lat: 28.587, lng: 77.442, bhk: 2, area: 980, price: 56 * LAKH, status: "available", possession: "Mar 2027" },
  { project: "Orchid Residency", builder: "Orchid Developers", locality: "Noida Sector 150", city: "Noida", lat: 28.444, lng: 77.498, bhk: 2, area: 1220, price: 115 * LAKH, status: "available", possession: "Jun 2027" },
  { project: "Orchid Residency", builder: "Orchid Developers", locality: "Noida Sector 150", city: "Noida", lat: 28.446, lng: 77.5, bhk: 3, area: 1780, price: 185 * LAKH, status: "few_left", possession: "Jun 2027" },
  { project: "Orchid Residency", builder: "Orchid Developers", locality: "Noida Sector 150", city: "Noida", lat: 28.442, lng: 77.496, bhk: 4, area: 2450, price: 295 * LAKH, status: "available", possession: "Jun 2027" },
  { project: "Banyan Court", builder: "Banyan Group", locality: "Gurgaon Sohna Road", city: "Gurgaon", lat: 28.41, lng: 77.04, bhk: 3, area: 1620, price: 178 * LAKH, status: "available", possession: "Sep 2027" },
  { project: "Banyan Court", builder: "Banyan Group", locality: "Gurgaon Sohna Road", city: "Gurgaon", lat: 28.412, lng: 77.042, bhk: 4, area: 2280, price: 265 * LAKH, status: "few_left", possession: "Sep 2027" },
  { project: "Meridian Skies", builder: "Meridian Estates", locality: "Gurgaon Sohna Road", city: "Gurgaon", lat: 28.39, lng: 77.05, bhk: 4, area: 2850, price: 350 * LAKH, status: "available", possession: "Mar 2028" },
  { project: "Meridian Skies", builder: "Meridian Estates", locality: "Gurgaon Sohna Road", city: "Gurgaon", lat: 28.392, lng: 77.052, bhk: 2, area: 1150, price: 129 * LAKH, status: "sold", possession: "Ready to move" },
  { project: "Aurum Gardens", builder: "Aurum Homes", locality: "Ghaziabad", city: "Ghaziabad", lat: 28.67, lng: 77.44, bhk: 1, area: 590, price: 39 * LAKH, status: "available", possession: "Ready to move" },
  { project: "Aurum Gardens", builder: "Aurum Homes", locality: "Ghaziabad", city: "Ghaziabad", lat: 28.672, lng: 77.442, bhk: 2, area: 1040, price: 62 * LAKH, status: "available", possession: "Dec 2026" },
  { project: "Skyline Crest", builder: "Skyline Realty", locality: "Ghaziabad", city: "Ghaziabad", lat: 28.64, lng: 77.37, bhk: 3, area: 1380, price: 99 * LAKH, status: "few_left", possession: "Aug 2027" },
];

const FIRST_NAMES = ["Aarav", "Vivaan", "Aditya", "Arjun", "Rohan", "Kabir", "Ishaan", "Vikram", "Rahul", "Amit", "Karan", "Siddharth", "Priya", "Ananya", "Neha", "Pooja", "Sneha", "Anjali", "Kavya", "Riya", "Meera", "Divya", "Nikhil", "Manish", "Sanjay", "Deepak", "Swati", "Isha", "Tanvi", "Harsh"];
const LAST_NAMES = ["Sharma", "Verma", "Gupta", "Singh", "Kapoor", "Malhotra", "Chauhan", "Mehta", "Agarwal", "Jain", "Yadav", "Tiwari", "Bansal", "Saxena", "Joshi", "Mishra", "Pandey", "Rastogi", "Goel", "Arora"];
const LOCALITIES = ["Noida Extension", "Greater Noida West", "Noida Sector 150", "Gurgaon Sohna Road", "Ghaziabad"];

const BUDGET_BAND: Record<number, [number, number]> = {
  1: [35 * LAKH, 55 * LAKH],
  2: [55 * LAKH, 110 * LAKH],
  3: [100 * LAKH, 200 * LAKH],
  4: [200 * LAKH, 350 * LAKH],
};

const TIMELINE_TEXT: Record<Timeline, string> = {
  immediate: "As soon as possible, this month",
  "1-3 months": "In 2 to 3 months",
  "3-6 months": "In 4 to 5 months",
  "6+ months": "Within a year",
  unknown: "I have not decided yet",
};

type SeedLead = {
  row: Record<string, unknown>;
  id: string;
  name: string;
  createdMs: number;
  firstResponseMs: number;
  temperature: "hot" | "warm" | "cold";
  stage: Stage;
  bhk: number;
  locality: string;
  budgetMax: number;
  timeline: Timeline;
  agentId: string | null;
};

export async function seedDatabase(db: SupabaseClient): Promise<SeedSummary> {
  const { rand, pick, between, weighted, shuffle } = createRng(20261106);
  const NOW = Date.now();

  async function wipe() {
    const tables = [
      "followups",
      "site_visits",
      "messages",
      "activity_events",
      "leads",
      "properties",
      "agents",
    ];
    for (const table of tables) {
      const { error } = await db
        .from(table)
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) throw new Error(`wipe ${table}: ${error.message}`);
    }
  }

  async function insertRows(table: string, rows: object[], chunk = 200) {
    for (let i = 0; i < rows.length; i += chunk) {
      const { error } = await db.from(table).insert(rows.slice(i, i + chunk));
      if (error) throw new Error(`${table}: ${error.message}`);
    }
  }

  function stageFor(temperature: "hot" | "warm" | "cold"): Stage {
    if (temperature === "hot") {
      return weighted<Stage>([["qualified", 25], ["site_visit", 30], ["negotiation", 20], ["booked", 15], ["new", 10]]);
    }
    if (temperature === "warm") {
      return weighted<Stage>([["new", 25], ["qualified", 40], ["site_visit", 20], ["lost", 15]]);
    }
    return weighted<Stage>([["new", 35], ["qualified", 25], ["lost", 40]]);
  }

  // ---------- 1. Agents ----------
  const agents = [
    { name: "Rohit Sharma", color: "#6d4ae0" },
    { name: "Neha Verma", color: "#ea7b1e" },
    { name: "Aman Singh", color: "#15803d" },
    { name: "Pooja Gupta", color: "#1d4ed8" },
    { name: "Imran Khan", color: "#d6333a" },
  ].map((a) => ({ id: randomUUID(), ...a, phone: null, avatar_url: null, active: true }));

  // ---------- 2. Properties ----------
  const properties = PROPERTY_SEEDS.map((p, i) => ({
    id: randomUUID(),
    title: `${p.bhk} BHK at ${p.project}`,
    project_name: p.project,
    builder: p.builder,
    locality: p.locality,
    city: p.city,
    lat: p.lat,
    lng: p.lng,
    bhk: p.bhk,
    area_sqft: p.area,
    price_inr: p.price,
    status: p.status,
    possession: p.possession,
    amenities: shuffle(AMENITIES).slice(0, 5),
    image_url: IMAGES[i % IMAGES.length],
  }));

  // ---------- 3. Leads (72 over the last 30 days) ----------
  const seedLeads: SeedLead[] = [];

  for (let i = 0; i < 72; i++) {
    const id = randomUUID();
    const name = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
    const source = weighted<LeadSource>([
      ["99acres", 24], ["magicbricks", 20], ["housing", 14], ["facebook", 18], ["whatsapp", 12], ["website", 12],
    ]);
    const bhk = weighted<number>([[1, 15], [2, 40], [3, 32], [4, 13]]);
    const locality = pick(LOCALITIES);
    const [lo, hi] = BUDGET_BAND[bhk];
    const budgetMax = Math.max(35 * LAKH, roundTo(between(lo, hi), 5 * LAKH));
    let budgetMin: number | null =
      rand() < 0.7 ? Math.max(30 * LAKH, roundTo(budgetMax * 0.85, 5 * LAKH)) : null;
    if (budgetMin !== null && budgetMin >= budgetMax) budgetMin = null;

    const timeline = weighted<Timeline>([["immediate", 12], ["1-3 months", 28], ["3-6 months", 28], ["6+ months", 20], ["unknown", 12]]);
    const needsLoan = weighted<boolean | null>([[true, 55], [false, 25], [null, 20]]);
    const purpose = weighted<Purpose>([["self-use", 55], ["investment", 25], ["unknown", 20]]);
    const intent = weighted<Intent>([["browsing", 20], ["interested", 40], ["ready_to_visit", 18], ["price_negotiation", 8], ["emergency_urgent", 4], ["not_interested", 10]]);
    const preferred = [...new Set(rand() < 0.25 ? [locality, pick(LOCALITIES)] : [locality])];

    const breakdown = computeScore({
      timeline,
      budgetMin,
      budgetMax,
      bhk,
      preferredLocations: preferred,
      needsLoan,
      purpose,
      intent,
      wantsSiteVisit: intent === "ready_to_visit" || rand() < 0.1,
      leadMessageCount: 1 + Math.floor(rand() * 8),
      avgReplySeconds: weighted<number | null>([[90, 30], [600, 35], [5400, 25], [null, 10]]),
    });
    const temperature = temperatureFor(breakdown.total);
    const stage = stageFor(temperature);

    // First 6 leads arrive "today"; the rest spread over 30 days
    const createdMs =
      i < 6 ? NOW - between(40 * 60_000, 8 * HOUR) : NOW - between(0.3 * DAY, 30 * DAY);

    // Hot leads still in early stages are left untouched for a long time (feeds "revenue at risk")
    let lastContactMs: number;
    if (temperature === "hot" && (stage === "new" || stage === "qualified")) {
      lastContactMs = Math.max(createdMs + 10 * 60_000, NOW - between(2 * HOUR, 80 * HOUR));
    } else {
      lastContactMs = Math.min(NOW, createdMs + between(2 * 60_000, 6 * HOUR));
    }

    const agentId = stage === "new" ? null : pick(agents).id;

    // AI usually replies in 5-15 seconds; about 1 in 9 is slower (busy hours)
    const firstResponseMs =
      rand() < 0.11 ? Math.round(between(70_000, 400_000)) : Math.round(between(5000, 15000));

    seedLeads.push({
      id,
      name,
      createdMs,
      firstResponseMs,
      temperature,
      stage,
      bhk,
      locality,
      budgetMax,
      timeline,
      agentId,
      row: {
        id,
        name,
        phone: null,
        email: null,
        source,
        budget_min: budgetMin,
        budget_max: budgetMax,
        bhk,
        preferred_locations: preferred,
        timeline,
        needs_loan: needsLoan,
        purpose,
        intent,
        summary: `${bhk} BHK in ${locality}, budget about ${formatBudget(budgetMax)}, timeline ${timeline}.`,
        score: breakdown.total,
        score_breakdown: breakdown,
        temperature,
        stage,
        assigned_agent_id: agentId,
        deal_value_estimate: estimateDealValue(budgetMin, budgetMax),
        first_response_ms: firstResponseMs,
        human_baseline_ms: Math.round(between(2 * HOUR, 6 * HOUR)), // typical human team
        last_contact_at: new Date(lastContactMs).toISOString(),
        stage_changed_at: new Date(createdMs + rand() * (NOW - createdMs)).toISOString(),
        created_at: new Date(createdMs).toISOString(),
      },
    });
  }

  // ---------- 4. Sample conversations (5 newest Hot/Warm leads) ----------
  const sampleLeads = [...seedLeads]
    .sort((a, b) => b.createdMs - a.createdMs)
    .filter((l) => l.temperature !== "cold")
    .slice(0, 5);

  const messages: object[] = [];
  for (const l of sampleLeads) {
    const first = l.name.split(" ")[0];
      const script: { sender: "lead" | "ai"; content: string; afterMs: number }[] = [
      { sender: "lead", content: `Hi, I would like to know more about a ${l.bhk} BHK in ${l.locality}.`, afterMs: 0 },
      { sender: "ai", content: `Hello ${first}! I am the PropPilot assistant. I can help you find a ${l.bhk} BHK in ${l.locality}. What is your budget?`, afterMs: l.firstResponseMs },
      { sender: "lead", content: `Around ${formatBudget(l.budgetMax)}`, afterMs: l.firstResponseMs + 4 * 60_000 },
      { sender: "ai", content: "That works well. When are you planning to move?", afterMs: l.firstResponseMs + 4 * 60_000 + 6000 },
      { sender: "lead", content: TIMELINE_TEXT[l.timeline], afterMs: l.firstResponseMs + 9 * 60_000 },
      { sender: "ai", content: "Got it. Are you planning to take a home loan?", afterMs: l.firstResponseMs + 9 * 60_000 + 6000 },
    ];
    for (const m of script) {
      messages.push({
        lead_id: l.id,
        sender: m.sender,
        channel: "chat",
        content: m.content,
        created_at: new Date(l.createdMs + m.afterMs).toISOString(),
      });
    }
  }

  // ---------- 5. Site visits (slots: 11:00, 14:00, 17:00 IST = 05:30, 08:30, 11:30 UTC) ----------
  const usedSlots = new Set<string>();
  function pickSlot(agentId: string, startDay: number, endDay: number): Date {
    let d = new Date();
    for (let attempt = 0; attempt < 30; attempt++) {
      const day = Math.floor(between(startDay, endDay + 1));
      d = new Date();
      d.setUTCDate(d.getUTCDate() + day);
      d.setUTCHours(pick([5, 8, 11]), 30, 0, 0);
      if (startDay >= 0 && d.getTime() < NOW) d.setUTCDate(d.getUTCDate() + 1);
      const k = `${agentId}-${d.toISOString()}`;
      if (!usedSlots.has(k)) {
        usedSlots.add(k);
        return d;
      }
    }
    return d;
  }

  const bookable = properties.filter((p) => p.status !== "sold");
  const visits: object[] = [];
  for (const l of seedLeads) {
    if (!l.agentId) continue;
    if (l.stage !== "site_visit" && l.stage !== "negotiation" && l.stage !== "booked") continue;

    const matching = bookable.filter((p) => p.bhk === l.bhk);
    const property = matching.length > 0 ? pick(matching) : pick(bookable);
    const upcoming = l.stage === "site_visit";
    const when = upcoming ? pickSlot(l.agentId, 0, 3) : pickSlot(l.agentId, -12, -1);

    visits.push({
      lead_id: l.id,
      property_id: property.id,
      agent_id: l.agentId,
      scheduled_at: when.toISOString(),
      status: upcoming
        ? "scheduled"
        : weighted<string>([["completed", 85], ["no_show", 10], ["rescheduled", 5]]),
    });
  }

  // ---------- 6. Activity events (newest 10 leads) ----------
  const activity: object[] = [];
  for (const l of [...seedLeads].sort((a, b) => b.createdMs - a.createdMs).slice(0, 10)) {
    const row = l.row as { source: string; score: number };
    activity.push({
      lead_id: l.id,
      type: "lead_created",
      payload: { name: l.name, source: row.source },
      created_at: new Date(l.createdMs).toISOString(),
    });
    activity.push({
      lead_id: l.id,
      type: "ai_qualified",
      payload: { name: l.name, score: row.score },
      created_at: new Date(l.createdMs + l.firstResponseMs).toISOString(),
    });
    if (l.temperature === "hot") {
      activity.push({
        lead_id: l.id,
        type: "hot_lead",
        payload: { name: l.name, score: row.score },
        created_at: new Date(l.createdMs + l.firstResponseMs + 1000).toISOString(),
      });
    }
  }

  // ---------- write everything ----------
  await wipe();
  await insertRows("agents", agents);
  await insertRows("properties", properties);
  await insertRows("leads", seedLeads.map((l) => l.row));
  await insertRows("messages", messages);
  await insertRows("site_visits", visits);
  await insertRows("activity_events", activity);

  return {
    agents: agents.length,
    properties: properties.length,
    leads: seedLeads.length,
    messages: messages.length,
    site_visits: visits.length,
    activity_events: activity.length,
  };
}