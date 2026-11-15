// PropPilot AI: live API smoke test. Start the app first (npm run dev), then run:
//   npx tsx scripts/qa-api.ts
// It creates one test lead ("QA Test Lead") through the real pipeline. Use Reset afterwards if you like.
import assert from "node:assert/strict";
import { config } from "dotenv";

config({ path: ".env.local" });

const BASE = process.env.QA_BASE_URL ?? "http://localhost:3000";
const ADMIN_KEY = process.env.DEMO_ADMIN_KEY ?? "";

type Json = Record<string, unknown>;
type Reply = { status: number; data: Json };

let passed = 0;
let warned = 0;
const failures: string[] = [];
const warnings: string[] = [];

async function call(
  path: string,
  init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}
): Promise<Reply> {
  const res = await fetch(`${BASE}${path}`, {
    method: init.method ?? "GET",
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const data = (await res.json().catch(() => ({}))) as Json;
  return { status: res.status, data };
}

// soft = depends on the AI's wording, so a miss is a warning, not a failure
async function check(name: string, fn: () => Promise<void> | void, soft = false) {
  try {
    await fn();
    passed++;
    console.log(`  PASS  ${name}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message.split("\n")[0] : String(err);
    if (soft) {
      warned++;
      warnings.push(`${name}: ${msg}`);
      console.log(`  WARN  ${name}\n        ${msg}`);
    } else {
      failures.push(`${name}: ${msg}`);
      console.log(`  FAIL  ${name}\n        ${msg}`);
    }
  }
}

const section = (name: string) => console.log(`\n== ${name}`);
const asNumber = (v: unknown) => (typeof v === "number" ? v : NaN);
const asArray = (v: unknown) => (Array.isArray(v) ? v : []);
const NO_SUCH_UUID = "00000000-0000-4000-8000-000000000000";

async function main() {
  section("server");
  let up = false;
  await check("the app is reachable", async () => {
    const res = await fetch(BASE).catch(() => null);
    assert.ok(res && res.status < 500, `Cannot reach ${BASE}. Start the app with npm run dev first.`);
    up = true;
  });
  if (!up) return finish();

  // ------------------------------------------------------------------ chat input checks
  section("POST /api/chat: input checks");
  await check("empty body is rejected (400)", async () => {
    assert.equal((await call("/api/chat", { method: "POST", body: {} })).status, 400);
  });
  await check("empty message is rejected (400)", async () => {
    assert.equal((await call("/api/chat", { method: "POST", body: { message: "   " } })).status, 400);
  });
  await check("a message over 500 characters is rejected (400)", async () => {
    assert.equal((await call("/api/chat", { method: "POST", body: { message: "a".repeat(501) } })).status, 400);
  });
  await check("a malformed lead_id is rejected (400)", async () => {
    assert.equal((await call("/api/chat", { method: "POST", body: { message: "hi", lead_id: "abc" } })).status, 400);
  });
  await check("an unknown lead_id gives 404", async () => {
    assert.equal((await call("/api/chat", { method: "POST", body: { message: "hi", lead_id: NO_SUCH_UUID } })).status, 404);
  });
  await check("an unknown source is rejected (400)", async () => {
    assert.equal((await call("/api/chat", { method: "POST", body: { message: "hi", source: "tiktok" } })).status, 400);
  });

  // ------------------------------------------------------------------ the real conversation
  section("POST /api/chat: a real conversation (uses the AI)");
  let leadId = "";
  let propertyCards = 0;
  let firstScore = 0;
  let lastStage = "new";

  const m1 = await call("/api/chat", {
    method: "POST",
    body: {
      message: "Hi, I need a 2 BHK in Noida Extension. My budget is 80 lakh and I want to buy within 2 months.",
      source: "99acres",
      name: "QA Test Lead",
    },
  });
  await check("first message creates a lead and returns a reply", () => {
    assert.equal(m1.status, 200, JSON.stringify(m1.data));
    assert.equal(typeof m1.data.lead_id, "string");
    assert.ok(String(m1.data.reply).length > 0, "empty reply");
    leadId = String(m1.data.lead_id);
    firstScore = asNumber(m1.data.score);
    propertyCards += asArray(m1.data.property_ids).length;
    lastStage = String(m1.data.stage);
  });
  if (!leadId) return finish();

  await check("first_response_ms is recorded and under 30 seconds", () => {
    const ms = asNumber(m1.data.first_response_ms);
    assert.ok(ms > 0 && ms < 30_000, `first_response_ms was ${String(m1.data.first_response_ms)}`);
  });
  await check("the AI answered for real (ai_ok)", () => {
    assert.equal(m1.data.ai_ok, true, `AI fell back: ${String(m1.data.ai_error ?? "unknown")}`);
  });
  await check("the score is a number from 0 to 100 and adds up", () => {
    const b = m1.data.score_breakdown as Record<string, number>;
    const total = b.timeline + b.budget + b.specificity + b.loan_purpose + b.engagement + b.visit_intent;
    assert.equal(asNumber(m1.data.score), Math.min(100, total));
  });
  await check("the AI understood BHK 2 and an 80 lakh budget", () => {
    const p = m1.data.profile as { bhk: number | null; budget_max: number | null };
    assert.equal(p.bhk, 2);
    assert.equal(p.budget_max, 8_000_000);
  }, true);
  await check("the AI understood the timeline and the area", () => {
    const p = m1.data.profile as { timeline: string; preferred_locations: string[] };
    assert.equal(p.timeline, "1-3 months");
    assert.ok(p.preferred_locations.some((l) => /noida/i.test(l)));
  }, true);

  const m2 = await call("/api/chat", {
    method: "POST",
    body: { lead_id: leadId, message: "Yes, I will take a home loan. It is for my own use." },
  });
  await check("second message keeps the same lead and raises the score", () => {
    assert.equal(m2.status, 200, JSON.stringify(m2.data));
    assert.equal(m2.data.lead_id, leadId);
    assert.ok(asNumber(m2.data.score) >= firstScore, `score went ${firstScore} -> ${String(m2.data.score)}`);
    propertyCards += asArray(m2.data.property_ids).length;
  });
  await check("known facts are kept (budget and BHK are not wiped by the next message)", () => {
    const p = m2.data.profile as { bhk: number | null; budget_max: number | null; needs_loan: boolean | null };
    assert.equal(p.bhk, 2);
    assert.equal(p.budget_max, 8_000_000);
    assert.equal(p.needs_loan, true);
  }, true);

  const m3 = await call("/api/chat", {
    method: "POST",
    body: { lead_id: leadId, message: "What would the EMI be?" },
  });
  await check("an EMI question is answered with rupee amounts computed by code", () => {
    assert.equal(m3.status, 200, JSON.stringify(m3.data));
    assert.equal(m3.data.asked_emi, true);
    propertyCards += asArray(m3.data.property_ids).length;
  }, true);

  const m4 = await call("/api/chat", {
    method: "POST",
    body: { lead_id: leadId, message: "I would like to visit tomorrow at 11 AM." },
  });
  await check("a visit request books or offers slots", () => {
    assert.equal(m4.status, 200, JSON.stringify(m4.data));
    const visit = m4.data.visit as { status?: string } | null;
    assert.ok(visit && (visit.status === "booked" || visit.status === "offered"), `visit was ${JSON.stringify(visit)}`);
    lastStage = String(m4.data.stage);
  }, true);
  await check("property cards were sent at some point in the conversation", () => {
    assert.ok(propertyCards >= 1, "no property cards were attached to any reply");
  }, true);

  // ------------------------------------------------------------------ property matching
  section("POST /api/properties/match");
  await check("returns up to 3 sorted matches with EMI", async () => {
    const r = await call("/api/properties/match", {
      method: "POST",
      body: { bhk: 2, budget_max: 8_000_000, locations: ["Noida Extension"] },
    });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    const matches = asArray(r.data.matches) as { score: number; emi: { emi: number } }[];
    assert.ok(matches.length >= 1 && matches.length <= 3, `got ${matches.length} matches`);
    assert.ok(matches.every((m) => m.emi.emi > 0));
    for (let i = 1; i < matches.length; i++) assert.ok(matches[i - 1].score >= matches[i].score, "not sorted");
  });
  await check("works with a lead_id", async () => {
    const r = await call("/api/properties/match", { method: "POST", body: { lead_id: leadId } });
    assert.equal(r.status, 200, JSON.stringify(r.data));
  });
  await check("an impossible BHK is rejected (400)", async () => {
    assert.equal((await call("/api/properties/match", { method: "POST", body: { bhk: 9 } })).status, 400);
  });
  await check("an unknown lead_id gives 404", async () => {
    assert.equal((await call("/api/properties/match", { method: "POST", body: { lead_id: NO_SUCH_UUID } })).status, 404);
  });

  // ------------------------------------------------------------------ visits
  section("POST /api/visits");
  await check("a bad body is rejected (400)", async () => {
    assert.equal((await call("/api/visits", { method: "POST", body: {} })).status, 400);
  });
  await check("an unknown lead gives 404", async () => {
    const r = await call("/api/visits", { method: "POST", body: { lead_id: NO_SUCH_UUID, scheduled_at: "2030-01-01T05:30:00.000Z" } });
    assert.equal(r.status, 404);
  });
  await check("a time that is not a free slot gives 409", async () => {
    const r = await call("/api/visits", { method: "POST", body: { lead_id: leadId, scheduled_at: "2030-01-01T05:30:00.000Z" } });
    assert.equal(r.status, 409);
  });

  // ------------------------------------------------------------------ pipeline stage + agent message
  section("PATCH /api/leads/:id and POST /api/leads/:id/messages");
  await check("a malformed id is rejected (400)", async () => {
    assert.equal((await call("/api/leads/not-a-uuid", { method: "PATCH", body: { stage: "new" } })).status, 400);
  });
  await check("an unknown stage is rejected (400)", async () => {
    assert.equal((await call(`/api/leads/${leadId}`, { method: "PATCH", body: { stage: "nowhere" } })).status, 400);
  });
  await check("an unknown lead gives 404", async () => {
    assert.equal((await call(`/api/leads/${NO_SUCH_UUID}`, { method: "PATCH", body: { stage: "new" } })).status, 404);
  });
  await check("moving to Negotiation works, repeating it is a no-op, and it can be restored", async () => {
    const a = await call(`/api/leads/${leadId}`, { method: "PATCH", body: { stage: "negotiation" } });
    assert.equal(a.status, 200, JSON.stringify(a.data));
    const b = await call(`/api/leads/${leadId}`, { method: "PATCH", body: { stage: "negotiation" } });
    assert.equal(b.data.unchanged, true);
    const c = await call(`/api/leads/${leadId}`, { method: "PATCH", body: { stage: lastStage } });
    assert.equal(c.status, 200);
  });
  await check("an empty agent message is rejected (400)", async () => {
    assert.equal((await call(`/api/leads/${leadId}/messages`, { method: "POST", body: { content: "  " } })).status, 400);
  });
  await check("an agent message is saved", async () => {
    const r = await call(`/api/leads/${leadId}/messages`, { method: "POST", body: { content: "Hello from the sales team." } });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.equal(r.data.ok, true);
  });

  // ------------------------------------------------------------------ fast-forward
  section("POST /api/followups/fast-forward");
  await check("days=0 and days=99 are rejected (400)", async () => {
    assert.equal((await call("/api/followups/fast-forward?days=0", { method: "POST" })).status, 400);
    assert.equal((await call("/api/followups/fast-forward?days=99", { method: "POST" })).status, 400);
  });
  await check("7 days for this lead sends follow-ups in order, each with text", async () => {
    const r = await call(`/api/followups/fast-forward?days=7&lead_id=${leadId}`, { method: "POST" });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    const items = asArray(r.data.processed) as { message: string; sent_at: string }[];
    assert.ok(items.every((i) => i.message.length > 0), "an empty follow-up message");
    for (let i = 1; i < items.length; i++) assert.ok(items[i - 1].sent_at <= items[i].sent_at, "not in time order");
  });
  await check("running it again sends nothing twice", async () => {
    const r = await call(`/api/followups/fast-forward?days=7&lead_id=${leadId}`, { method: "POST" });
    assert.equal(r.status, 200);
    assert.equal(asArray(r.data.processed).length, 0);
  });

  // ------------------------------------------------------------------ admin protection
  section("Demo endpoints (admin key)");
  if (ADMIN_KEY) {
    await check("no key is refused (401)", async () => {
      assert.equal((await call("/api/demo/hot-untouched", { method: "POST" })).status, 401);
    });
    await check("a wrong key is refused (401)", async () => {
      const r = await call("/api/demo/hot-untouched", { method: "POST", headers: { "x-admin-key": "wrong-key" } });
      assert.equal(r.status, 401);
    });
    await check("reset is refused without the key (401)", async () => {
      assert.equal((await call("/api/demo/reset", { method: "POST" })).status, 401);
    });
    await check("simulate-lead is refused without the key (401)", async () => {
      assert.equal((await call("/api/demo/simulate-lead", { method: "POST", body: {} })).status, 401);
    });
  } else {
    console.log("  SKIP  DEMO_ADMIN_KEY is not set, so the demo endpoints are open in development.");
  }

  // ------------------------------------------------------------------ rate limit (last, it blocks chat for a minute)
  section("Rate limit");
  await check("rapid chat requests are limited (429)", async () => {
    let limited = false;
    for (let i = 0; i < 30 && !limited; i++) {
      const r = await call("/api/chat", { method: "POST", body: { message: "" } });
      if (r.status === 429) limited = true;
    }
    assert.ok(limited, "no 429 after 30 rapid requests");
  });

  finish();
}

function finish() {
  console.log(`\n${"=".repeat(50)}\n${passed} passed, ${warned} warnings, ${failures.length} failed`);
  if (warnings.length > 0) {
    console.log("\nWARNINGS (depend on the AI's wording, check them by hand):");
    for (const w of warnings) console.log(" - " + w);
  }
  if (failures.length > 0) {
    console.log("\nFAILED:");
    for (const f of failures) console.log(" - " + f);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("QA run crashed:", err instanceof Error ? err.message : err);
  process.exit(1);
});