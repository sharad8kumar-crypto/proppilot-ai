// PropPilot AI: automated checks for every pure function (no database, no AI, no network).
// Run with:  npx tsx scripts/qa.ts
import assert from "node:assert/strict";
import { budgetText } from "../src/lib/budget";
import { avgReplySeconds } from "../src/lib/conversation";
import { calcEmi, emiForPrice, formatEmiAmount } from "../src/lib/emi";
import { formatOffset, rangeFor, stepDefFor, stepLabel, SEQUENCES } from "../src/lib/followups";
import { formatBudget, formatDuration, formatHours, formatInr, initialsOf, leadDisplayName, titleCase } from "../src/lib/format";
import { mergeProfile, nextStage } from "../src/lib/lead-merge";
import { matchLeads, matchProperties, scoreMatch, type MatchLead } from "../src/lib/matching";
import { computeScore, estimateDealValue, temperatureFor, type ScoreInput } from "../src/lib/scoring";
import { isStage, stageLabel, STAGES } from "../src/lib/stages";
import {
  candidateSlots, daysFromToday, formatSlot, formatSlotAbsolute, formatTimeIST, istDateKey,
  parseDayOffset, parseTime, pickOfferSlots, resolveVisitChoice, slotInstant,
} from "../src/lib/visits";
import type { LeadRow, PropertyRow } from "../src/types/db";

let passed = 0;
const failures: string[] = [];
let group = "";
function section(name: string) { group = name; console.log(`\n== ${name}`); }
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  PASS  ${name}`); }
  catch (err) {
    const msg = err instanceof Error ? err.message.split("\n")[0] : String(err);
    failures.push(`[${group}] ${name}: ${msg}`);
    console.log(`  FAIL  ${name}\n        ${msg}`);
  }
}

const LAKH = 100_000;
const CR = 10_000_000;
// A fixed "now": Friday 13 Nov 2026, 10:00 AM IST
const NOW = Date.parse("2026-11-13T10:00:00+05:30");

// ---------------------------------------------------------------- format
section("format.ts");
test("formatInr", () => {
  assert.equal(formatInr(8_500_000), "₹85 L");
  assert.equal(formatInr(13_500_000), "₹1.35 Cr");
  assert.equal(formatInr(650), "₹650");
  assert.equal(formatInr(100_000), "₹1 L");
  assert.equal(formatInr(10_000_000), "₹1 Cr");
  assert.equal(formatInr(350 * LAKH), "₹3.5 Cr");
});
test("formatBudget / budgetText", () => {
  assert.equal(formatBudget(75 * LAKH, 85 * LAKH), "₹75 L - ₹85 L");
  assert.equal(budgetText(75 * LAKH, 85 * LAKH), "₹75 L - ₹85 L");
  assert.equal(budgetText(null, 80 * LAKH), "Up to ₹80 L");
  assert.equal(budgetText(50 * LAKH, null), "From ₹50 L");
  assert.equal(budgetText(null, null), "Budget not shared");
});
test("formatDuration", () => {
  assert.equal(formatDuration(8), "8s");
  assert.equal(formatDuration(125), "2m 5s");
  assert.equal(formatDuration(15_120), "4h 12m");
  assert.equal(formatDuration(0), "0s");
});
test("formatHours", () => {
  assert.equal(formatHours(0.2), "just now");
  assert.equal(formatHours(6), "6h");
  assert.equal(formatHours(47.9), "47h");
  assert.equal(formatHours(61), "2d 13h");
});
test("initialsOf / leadDisplayName / titleCase", () => {
  assert.equal(initialsOf("Priya Sharma"), "PS");
  assert.equal(initialsOf("Madonna"), "M");
  assert.equal(initialsOf(null), "?");
  assert.equal(leadDisplayName({ name: null }), "New lead");
  assert.equal(leadDisplayName({ name: "Aarav" }), "Aarav");
  assert.equal(titleCase("price_negotiation"), "Price negotiation");
});

// ---------------------------------------------------------------- emi
section("emi.ts");
test("calcEmi standard figure (1 lakh, 8.5%, 20y = about 868)", () => {
  assert.equal(Math.round(calcEmi(100_000, 8.5, 20)), 868);
});
test("calcEmi edge cases", () => {
  assert.equal(calcEmi(0, 8.5, 20), 0);
  assert.equal(calcEmi(100_000, 8.5, 0), 0);
  assert.equal(calcEmi(1_200_000, 0, 10), 10_000);
});
test("emiForPrice for an 80 lakh flat", () => {
  const e = emiForPrice(80 * LAKH);
  assert.equal(e.loan, 6_400_000);
  assert.equal(e.downPayment, 1_600_000);
  assert.ok(Math.abs(e.emi - 55_540) <= 10, `emi was ${e.emi}`);
  assert.equal(e.totalPayable, e.emi * 240);
  assert.equal(e.totalInterest, e.totalPayable - e.loan);
});
test("emiForPrice honours custom rate and tenure", () => {
  const a = emiForPrice(80 * LAKH, { annualRatePct: 10, years: 15 });
  const b = emiForPrice(80 * LAKH);
  assert.ok(a.emi > b.emi);
});
test("formatEmiAmount", () => { assert.equal(formatEmiAmount(55_540), "₹55,540"); assert.equal(formatEmiAmount(1_234_567), "₹12,34,567"); });

// ---------------------------------------------------------------- scoring
section("scoring.ts");
const base: ScoreInput = {
  timeline: "unknown", budgetMin: null, budgetMax: null, bhk: null, preferredLocations: [],
  needsLoan: null, purpose: "unknown", intent: null, wantsSiteVisit: false, leadMessageCount: 1, avgReplySeconds: null,
};
test("a blank lead only earns engagement points", () => {
  const s = computeScore(base);
  assert.deepEqual(s, { timeline: 0, budget: 0, specificity: 0, loan_purpose: 0, engagement: 2, visit_intent: 0, total: 2 });
});
test("a perfect lead scores exactly 100", () => {
  const s = computeScore({ ...base, timeline: "immediate", budgetMin: 1, budgetMax: 2, bhk: 2, preferredLocations: ["x"], needsLoan: true, purpose: "self-use", intent: "ready_to_visit", leadMessageCount: 8, avgReplySeconds: 60 });
  assert.equal(s.total, 100);
});
test("timeline points", () => {
  const pts = (t: ScoreInput["timeline"]) => computeScore({ ...base, timeline: t }).timeline;
  assert.deepEqual([pts("immediate"), pts("1-3 months"), pts("3-6 months"), pts("6+ months"), pts("unknown")], [25, 20, 10, 4, 0]);
});
test("budget points: both 20, one 12, none 0", () => {
  assert.equal(computeScore({ ...base, budgetMin: 1, budgetMax: 2 }).budget, 20);
  assert.equal(computeScore({ ...base, budgetMax: 2 }).budget, 12);
  assert.equal(computeScore({ ...base, budgetMin: 1 }).budget, 12);
});
test("specificity points", () => {
  assert.equal(computeScore({ ...base, bhk: 2, preferredLocations: ["a"] }).specificity, 15);
  assert.equal(computeScore({ ...base, bhk: 2 }).specificity, 8);
  assert.equal(computeScore({ ...base, preferredLocations: ["a"] }).specificity, 8);
});
test("loan + purpose points", () => {
  assert.equal(computeScore({ ...base, needsLoan: false }).loan_purpose, 10);
  assert.equal(computeScore({ ...base, purpose: "investment" }).loan_purpose, 5);
  assert.equal(computeScore({ ...base, needsLoan: true, purpose: "self-use" }).loan_purpose, 15);
});
test("engagement: message points cap at 10 and total at 15", () => {
  assert.equal(computeScore({ ...base, leadMessageCount: 20 }).engagement, 10);
  assert.equal(computeScore({ ...base, leadMessageCount: 20, avgReplySeconds: 10 }).engagement, 15);
});
test("reply speed tiers (120s, 3600s boundaries)", () => {
  const sp = (s: number | null) => computeScore({ ...base, leadMessageCount: 0, avgReplySeconds: s }).engagement;
  assert.deepEqual([sp(120), sp(121), sp(3600), sp(3601), sp(null)], [5, 3, 3, 1, 0]);
});
test("visit intent from intent or flag", () => {
  assert.equal(computeScore({ ...base, intent: "ready_to_visit" }).visit_intent, 10);
  assert.equal(computeScore({ ...base, wantsSiteVisit: true }).visit_intent, 10);
  assert.equal(computeScore({ ...base, intent: "browsing" }).visit_intent, 0);
});
test("demo script, message 2 lands in Warm (56)", () => {
  const s = computeScore({ ...base, timeline: "1-3 months", budgetMax: 80 * LAKH, bhk: 2, preferredLocations: ["Noida Extension"], leadMessageCount: 2, avgReplySeconds: 30 });
  assert.equal(s.total, 56);
  assert.equal(temperatureFor(s.total), "warm");
});
test("temperature boundaries", () => {
  assert.deepEqual([temperatureFor(70), temperatureFor(69), temperatureFor(40), temperatureFor(39), temperatureFor(0), temperatureFor(100)], ["hot", "warm", "warm", "cold", "cold", "hot"]);
});
test("estimateDealValue", () => {
  assert.equal(estimateDealValue(75 * LAKH, 85 * LAKH), 80 * LAKH);
  assert.equal(estimateDealValue(null, 80 * LAKH), 80 * LAKH);
  assert.equal(estimateDealValue(50 * LAKH, null), 50 * LAKH);
  assert.equal(estimateDealValue(null, null), null);
});

// ---------------------------------------------------------------- matching
section("matching.ts");
const prop = (id: string, bhk: number, lakh: number, locality: string, city: string, status: PropertyRow["status"] = "available"): PropertyRow => ({
  id, title: `${bhk} BHK ${id}`, project_name: id, builder: "Demo", locality, city, lat: null, lng: null, bhk,
  area_sqft: 1000, price_inr: lakh * LAKH, status, possession: null, amenities: [], image_url: null, created_at: "",
});
const A = prop("A", 2, 68, "Noida Extension", "Greater Noida");
const B = prop("B", 2, 56, "Greater Noida West", "Greater Noida");
const C = prop("C", 2, 62, "Ghaziabad", "Ghaziabad");
const D = prop("D", 1, 35, "Greater Noida West", "Greater Noida");
const E = prop("E", 3, 94, "Noida Extension", "Greater Noida");
const F = prop("F", 2, 115, "Noida Sector 150", "Noida");
const G = prop("G", 2, 129, "Gurgaon Sohna Road", "Gurgaon", "sold");
const ALL = [A, B, C, D, E, F, G];
const crit = { bhk: 2, budgetMin: null, budgetMax: 80 * LAKH, locations: ["Noida Extension"] };

test("top 3 for '2 BHK, 80 lakh, Noida Extension' is B, A, C", () => {
  assert.deepEqual(matchProperties(crit, ALL, 3).map((m) => m.property.id), ["B", "A", "C"]);
});
test("sold, over-budget and too-different BHK are excluded", () => {
  const ids = matchProperties(crit, ALL, 10).map((m) => m.property.id);
  for (const gone of ["E", "F", "G"]) assert.ok(!ids.includes(gone), `${gone} should be excluded`);
  assert.equal(scoreMatch({ ...crit, bhk: 4 }, A), null);
});
test("price up to 110% of budget is allowed, above is not", () => {
  assert.ok(scoreMatch({ ...crit, budgetMax: 62 * LAKH }, A) !== null); // 68 <= 68.2
  assert.equal(scoreMatch({ ...crit, budgetMax: 61 * LAKH }, A), null); // 68 > 67.1
});
test("Noida Extension and Greater Noida West count as the same area", () => {
  assert.ok(scoreMatch(crit, B)!.reasons.includes("In Greater Noida West"));
});
test("scores: exact fit = 100; wrong city gets no location points", () => {
  assert.equal(scoreMatch(crit, A)!.score, 100);
  assert.equal(scoreMatch(crit, C)!.score, 70);
});
test("nothing known = neutral score 45", () => {
  assert.equal(scoreMatch({ bhk: null, budgetMin: null, budgetMax: null, locations: [] }, A)!.score, 45);
});
test("a 'few left' property is still offered, with a reason", () => {
  const r = scoreMatch(crit, prop("H", 2, 60, "Noida Extension", "Greater Noida", "few_left"))!;
  assert.ok(r.reasons.includes("Few units left"));
});
test("a broad 'Noida' preference matches Noida localities", () => {
  assert.ok(scoreMatch({ ...crit, budgetMax: 120 * LAKH, locations: ["Noida"] }, F)!.reasons.includes("In Noida Sector 150"));
});
test("matchProperties respects the limit and ties go to the cheaper one", () => {
  assert.equal(matchProperties(crit, ALL, 1).length, 1);
  assert.equal(matchProperties(crit, ALL, 1)[0].property.id, "B");
});
const lead = (id: string, over: Partial<MatchLead>): MatchLead => ({
  id, name: id, source: "99acres", bhk: 2, budget_min: null, budget_max: 80 * LAKH, preferred_locations: ["Noida Extension"], temperature: "hot", score: 80, stage: "qualified", ...over,
});
test("matchLeads skips lost, booked and criteria-less leads", () => {
  const leads = [lead("ok", {}), lead("lost", { stage: "lost" }), lead("booked", { stage: "booked" }),
    lead("empty", { bhk: null, budget_max: null, preferred_locations: [] })];
  assert.deepEqual(matchLeads(A, leads).map((m) => m.lead.id), ["ok"]);
});
test("matchLeads ranks by match score, then lead score", () => {
  const leads = [lead("far", { preferred_locations: ["Ghaziabad"], score: 99 }), lead("near", { score: 10 })];
  assert.equal(matchLeads(A, leads)[0].lead.id, "near");
});
test("sold property matches no leads", () => { assert.equal(matchLeads(G, [lead("x", {})]).length, 0); });

// ---------------------------------------------------------------- lead-merge
section("lead-merge.ts");
const L: LeadRow = {
  id: "1", name: null, phone: null, email: null, source: "99acres", budget_min: null, budget_max: null, bhk: null,
  preferred_locations: [], timeline: "unknown", needs_loan: null, purpose: "unknown", intent: null, summary: null, score: 0,
  score_breakdown: null, temperature: "cold", stage: "new", assigned_agent_id: null, deal_value_estimate: null,
  first_response_ms: null, human_baseline_ms: null, last_contact_at: null, visit_offer: null, stage_changed_at: null, created_at: "",
};
const X = { name: null, budget_min: null, budget_max: null, bhk: null, preferred_locations: [] as string[], timeline: "unknown" as const, needs_loan: null, purpose: "unknown" as const };
test("known values are never overwritten with nulls", () => {
  const lead2 = { ...L, budget_max: 80 * LAKH, bhk: 2, timeline: "1-3 months" as const, needs_loan: true, purpose: "self-use" as const, name: "Aarav" };
  const m = mergeProfile(lead2, X);
  assert.equal(m.budget_max, 80 * LAKH); assert.equal(m.bhk, 2); assert.equal(m.timeline, "1-3 months");
  assert.equal(m.needs_loan, true); assert.equal(m.purpose, "self-use"); assert.equal(m.name, "Aarav");
});
test("new facts are added", () => {
  const m = mergeProfile(L, { ...X, name: "  Priya  ", budget_max: 80 * LAKH, bhk: 2, timeline: "immediate", needs_loan: false, purpose: "investment" });
  assert.equal(m.name, "Priya"); assert.equal(m.budget_max, 80 * LAKH); assert.equal(m.bhk, 2);
  assert.equal(m.timeline, "immediate"); assert.equal(m.needs_loan, false); assert.equal(m.purpose, "investment");
});
test("nonsense money and BHK values from the AI are ignored", () => {
  const lead2 = { ...L, budget_max: 80 * LAKH, bhk: 3 };
  const m = mergeProfile(lead2, { ...X, budget_max: 80, budget_min: 1e12, bhk: 9 });
  assert.equal(m.budget_max, 80 * LAKH); assert.equal(m.budget_min, null); assert.equal(m.bhk, 3);
});
test("a reversed budget range is swapped", () => {
  const m = mergeProfile(L, { ...X, budget_min: 90 * LAKH, budget_max: 70 * LAKH });
  assert.deepEqual([m.budget_min, m.budget_max], [70 * LAKH, 90 * LAKH]);
});
test("locations are merged without case-insensitive duplicates", () => {
  const m = mergeProfile({ ...L, preferred_locations: ["Noida Extension"] }, { ...X, preferred_locations: ["noida extension", " Gurgaon ", ""] });
  assert.deepEqual(m.preferred_locations, ["Noida Extension", "Gurgaon"]);
});
test("nextStage: new -> qualified only with budget, need and timeline", () => {
  const full = { ...mergeProfile(L, { ...X, budget_max: 80 * LAKH, bhk: 2, timeline: "1-3 months" }) };
  assert.equal(nextStage("new", full), "qualified");
  assert.equal(nextStage("new", { ...full, timeline: "unknown" }), "new");
  assert.equal(nextStage("new", { ...full, budget_max: null, budget_min: null }), "new");
  assert.equal(nextStage("site_visit", full), "site_visit");
  assert.equal(nextStage("qualified", full), "qualified");
});

// ---------------------------------------------------------------- conversation
section("conversation.ts");
const msg = (sender: "lead" | "ai" | "agent", sec: number) => ({ sender, created_at: new Date(sec * 1000).toISOString() });
test("average time the buyer takes to answer", () => {
  assert.equal(avgReplySeconds([msg("lead", 0), msg("ai", 5), msg("lead", 35), msg("ai", 40), msg("lead", 100)]), 45);
});
test("no replies yet gives null", () => {
  assert.equal(avgReplySeconds([msg("lead", 0), msg("ai", 5)]), null);
  assert.equal(avgReplySeconds([]), null);
  assert.equal(avgReplySeconds([msg("lead", 0), msg("lead", 10)]), null);
});
test("agent messages count like AI messages", () => { assert.equal(avgReplySeconds([msg("agent", 0), msg("lead", 20)]), 20); });

// ---------------------------------------------------------------- stages + followups
section("stages.ts and followups.ts");
test("stages", () => {
  assert.equal(STAGES.length, 6);
  assert.equal(stageLabel("site_visit"), "Site Visit");
  assert.ok(isStage("booked")); assert.ok(!isStage("nope"));
});
test("sequence ranges and definitions", () => {
  assert.deepEqual([rangeFor("hot"), rangeFor("warm"), rangeFor("cold")], [[1, 3], [11, 13], [21, 23]]);
  for (const [temp, defs] of Object.entries(SEQUENCES)) {
    const [lo, hi] = rangeFor(temp as "hot");
    for (const d of defs) assert.ok(d.step >= lo && d.step <= hi, `${temp} step ${d.step} outside range`);
  }
  assert.equal(stepDefFor(90), null);
  assert.equal(stepDefFor(12)?.attach, "new_property");
});
test("step labels and offsets", () => {
  assert.equal(stepLabel(1), "2-hour check-in"); assert.equal(stepLabel(90), "Visit reminder (24h before)");
  assert.equal(stepLabel(91), "Visit reminder (2h before)"); assert.equal(stepLabel(999), "Step 999");
  assert.deepEqual([formatOffset(2), formatOffset(0.2), formatOffset(24), formatOffset(72), formatOffset(168)], ["+2h", "+1h", "Day 1", "Day 3", "Day 7"]);
});

// ---------------------------------------------------------------- visits: dates
section("visits.ts (dates and slots)");
test("India date keys", () => {
  assert.equal(istDateKey(Date.parse("2026-11-12T20:00:00Z")), "2026-11-13");
  assert.equal(istDateKey(Date.parse("2026-11-13T18:00:00Z")), "2026-11-13");
  assert.equal(istDateKey(Date.parse("2026-11-13T18:30:00Z")), "2026-11-14");
});
test("daysFromToday", () => {
  assert.equal(daysFromToday(NOW, slotInstant(NOW, 0, 17)), 0);
  assert.equal(daysFromToday(NOW, slotInstant(NOW, 1, 11)), 1);
  assert.equal(daysFromToday(NOW, slotInstant(NOW, 2, 11)), 2);
});
test("slotInstant is the right moment (11:00 IST = 05:30 UTC)", () => {
  assert.equal(slotInstant(NOW, 0, 11).toISOString(), "2026-11-13T05:30:00.000Z");
  assert.equal(slotInstant(NOW, 1, 17).toISOString(), "2026-11-14T11:30:00.000Z");
});
test("time formatting", () => {
  assert.equal(formatTimeIST(slotInstant(NOW, 0, 11)), "11:00 AM");
  assert.equal(formatTimeIST(slotInstant(NOW, 0, 14)), "2:00 PM");
  assert.equal(formatTimeIST(slotInstant(NOW, 0, 17)), "5:00 PM");
  assert.equal(formatTimeIST(slotInstant(NOW, 0, 0)), "12:00 AM");
  assert.equal(formatTimeIST(slotInstant(NOW, 0, 12)), "12:00 PM");
});
test("slot labels", () => {
  assert.equal(formatSlotAbsolute(slotInstant(NOW, 1, 11)), "Sat 14 Nov, 11:00 AM");
  assert.equal(formatSlot(slotInstant(NOW, 0, 14), NOW), "Today, Fri 13 Nov, 2:00 PM");
  assert.equal(formatSlot(slotInstant(NOW, 1, 11), NOW), "Tomorrow, Sat 14 Nov, 11:00 AM");
  assert.equal(formatSlot(slotInstant(NOW, 2, 11), NOW), "Sun 15 Nov, 11:00 AM");
});
test("candidate slots at 10:00 AM: today's 11:00 is too soon (needs 2 hours)", () => {
  const s = candidateSlots(NOW);
  assert.equal(s.length, 8);
  assert.equal(formatSlotAbsolute(s[0]), "Fri 13 Nov, 2:00 PM");
});
test("candidate slots at 9:00 AM keep today's 11:00 (exactly 2 hours away)", () => {
  assert.equal(candidateSlots(Date.parse("2026-11-13T09:00:00+05:30")).length, 9);
});
test("candidate slots in the evening skip today completely", () => {
  const s = candidateSlots(Date.parse("2026-11-13T18:30:00+05:30"));
  assert.equal(s.length, 6);
  assert.equal(formatSlotAbsolute(s[0]), "Sat 14 Nov, 11:00 AM");
});
test("offered slots are 3, sorted and spread over days", () => {
  const o = pickOfferSlots(candidateSlots(NOW), 3);
  assert.deepEqual(o.map((d) => formatSlotAbsolute(d)), ["Fri 13 Nov, 2:00 PM", "Sat 14 Nov, 11:00 AM", "Sun 15 Nov, 11:00 AM"]);
  assert.equal(pickOfferSlots([], 3).length, 0);
  assert.equal(pickOfferSlots(candidateSlots(NOW).slice(0, 2), 3).length, 2);
});

// ---------------------------------------------------------------- visits: understanding the buyer
section("visits.ts (reading what the buyer typed)");
test("day words (English and Hindi)", () => {
  assert.equal(parseDayOffset("kal 11 baje visit", NOW), 1);
  assert.equal(parseDayOffset("tomorrow please", NOW), 1);
  assert.equal(parseDayOffset("parso shaam", NOW), 2);
  assert.equal(parseDayOffset("day after tomorrow", NOW), 2);
  assert.equal(parseDayOffset("aaj", NOW), 0);
  assert.equal(parseDayOffset("friday", NOW), 0);
  assert.equal(parseDayOffset("monday", NOW), 3);
  assert.equal(parseDayOffset("I want to visit", NOW), null);
  assert.equal(parseDayOffset("I need it in 3 months", NOW), null);
});
test("clock times", () => {
  const h = (t: string) => parseTime(t).hour;
  assert.equal(h("11 baje"), 11); assert.equal(h("2 pm"), 14); assert.equal(h("2 baje"), 14);
  assert.equal(h("5 baje"), 17); assert.equal(h("11am"), 11); assert.equal(h("14:00"), 14);
  assert.equal(h("11:30am"), 11); assert.equal(h("5:00 pm"), 17);
});
test("parts of the day", () => {
  assert.equal(parseTime("morning").hour, 11); assert.equal(parseTime("dopahar").hour, 14);
  assert.equal(parseTime("shaam ko").hour, 17); assert.equal(parseTime("evening").hour, 17);
});
test("times we do not offer are reported as present but unavailable", () => {
  assert.deepEqual(parseTime("8 baje"), { present: true, hour: null });
  assert.deepEqual(parseTime("3 pm"), { present: true, hour: null });
  assert.deepEqual(parseTime("hello"), { present: false, hour: null });
});
test("12 noon is NOT silently booked as 11 AM", () => {
  assert.equal(parseTime("12 pm").hour, null);
});
const free = candidateSlots(NOW);
const offered = pickOfferSlots(free, 3);
const pick = (message: string, o: Date[] = [], requestedTime: string | null = null) => {
  const r = resolveVisitChoice({ message, requestedTime, now: NOW, offered: o, free });
  return { slot: r.slot ? formatSlotAbsolute(r.slot) : null, specified: r.specified };
};
test("'Kal 11 baje visit karna hai' books tomorrow 11:00", () => {
  assert.deepEqual(pick("Kal 11 baje visit karna hai"), { slot: "Sat 14 Nov, 11:00 AM", specified: true });
});
test("'tomorrow at 11 AM' books tomorrow 11:00", () => {
  assert.deepEqual(pick("I would like to visit tomorrow at 11 AM."), { slot: "Sat 14 Nov, 11:00 AM", specified: true });
});
test("'aaj 2 pm' books today 2:00 PM; 'aaj 11 baje' is too soon", () => {
  assert.deepEqual(pick("aaj 2 pm chalega"), { slot: "Fri 13 Nov, 2:00 PM", specified: true });
  assert.deepEqual(pick("aaj 11 baje"), { slot: null, specified: true });
});
test("'parso shaam' books day-after 5:00 PM", () => {
  assert.deepEqual(pick("parso shaam ko aa jaunga"), { slot: "Sun 15 Nov, 5:00 PM", specified: true });
});
test("only a time: earliest day that has it", () => {
  assert.deepEqual(pick("11 baje"), { slot: "Sat 14 Nov, 11:00 AM", specified: true });
});
test("a time we do not have: nothing booked, flagged as 'asked for a time'", () => {
  assert.deepEqual(pick("kal 8 baje"), { slot: null, specified: true });
});
test("only a day: several slots fit, so nothing is booked yet", () => {
  assert.deepEqual(pick("kal chalte hain"), { slot: null, specified: true });
});
test("the AI's requested_visit_time is used when the message alone is vague", () => {
  assert.deepEqual(pick("yes please", [], "kal 2 pm"), { slot: "Sat 14 Nov, 2:00 PM", specified: true });
});
test("after we offered slots: 'haan' takes the first, ordinals pick the rest", () => {
  assert.equal(pick("haan theek hai", offered).slot, "Fri 13 Nov, 2:00 PM");
  assert.equal(pick("ok", offered).slot, "Fri 13 Nov, 2:00 PM");
  assert.equal(pick("doosra wala", offered).slot, "Sat 14 Nov, 11:00 AM");
  assert.equal(pick("option 3", offered).slot, "Sun 15 Nov, 11:00 AM");
  assert.equal(pick("the last one", offered).slot, "Sun 15 Nov, 11:00 AM");
  assert.equal(pick("2", offered).slot, "Sat 14 Nov, 11:00 AM");
});
test("no offer was made: 'haan' alone books nothing", () => {
  assert.deepEqual(pick("haan"), { slot: null, specified: false });
});
test("BUG CHECK: '2 bhk ...' after an offer must not pick slot number 2", () => {
  assert.equal(pick("2 bhk mein aur options dikhao", offered).slot, null);
  assert.equal(pick("1 lakh kam ho sakta hai?", offered).slot, null);
  assert.equal(pick("2 bhk?", offered).slot, null);
});
test("BUG CHECK: a long message that merely contains 'ok' or 'haan' books nothing", () => {
  assert.equal(pick("ok but what is the price of the 3 bhk", offered).slot, null);
  assert.equal(pick("haan lekin pehle price kam karo", offered).slot, null);
});
test("BUG CHECK: negatives never book", () => {
  assert.equal(pick("not ok", offered).slot, null);
  assert.equal(pick("no thanks", offered).slot, null);
  assert.equal(pick("nahi, baad mein", offered).slot, null);
});
test("a slot that is no longer free is not booked from an ordinal", () => {
  const taken = resolveVisitChoice({ message: "doosra wala", requestedTime: null, now: NOW, offered, free: free.filter((s) => s.getTime() !== offered[1].getTime()) });
  assert.equal(taken.slot, null);
  assert.equal(taken.specified, true);
});

// ---------------------------------------------------------------- summary
console.log(`\n${"=".repeat(50)}\n${passed} passed, ${failures.length} failed`);
if (failures.length > 0) { console.log("\nFAILED:"); for (const f of failures) console.log(" - " + f); process.exit(1); }