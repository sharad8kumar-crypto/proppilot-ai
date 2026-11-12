// Pure helpers for site-visit slots. All times are India Standard Time (IST, UTC+5:30).
// No server-only import: the calendar UI uses these too.

export const IST_OFFSET_MS = 5.5 * 3_600_000;
export const SLOT_HOURS = [11, 14, 17] as const; // 11:00 AM, 2:00 PM, 5:00 PM IST

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
export const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

function istParts(ms: number) {
  const d = new Date(ms + IST_OFFSET_MS);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth(),
    day: d.getUTCDate(),
    weekday: d.getUTCDay(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
  };
}

// "2026-11-09": the IST calendar date of an instant
export function istDateKey(date: Date | number): string {
  const ms = typeof date === "number" ? date : date.getTime();
  return new Date(ms + IST_OFFSET_MS).toISOString().slice(0, 10);
}

// How many IST calendar days from "now" to "date" (0 = same day, 1 = next day)
export function daysFromToday(now: number, date: Date): number {
  return Math.round((Date.parse(istDateKey(date)) - Date.parse(istDateKey(now))) / DAY_MS);
}

// "11:00 AM"
export function formatTimeIST(date: Date): string {
  const p = istParts(date.getTime());
  const hour12 = p.hour % 12 === 0 ? 12 : p.hour % 12;
  return `${hour12}:${String(p.minute).padStart(2, "0")} ${p.hour >= 12 ? "PM" : "AM"}`;
}

// "Thu 12 Nov, 11:00 AM" (written by hand, so the text never changes between systems)
export function formatSlotAbsolute(date: Date): string {
  const p = istParts(date.getTime());
  return `${WEEKDAYS[p.weekday]} ${p.day} ${MONTHS[p.month]}, ${formatTimeIST(date)}`;
}

// "Tomorrow, Thu 12 Nov, 11:00 AM"
export function formatSlot(date: Date, now: number): string {
  const diff = daysFromToday(now, date);
  const relative = diff === 0 ? "Today, " : diff === 1 ? "Tomorrow, " : "";
  return `${relative}${formatSlotAbsolute(date)}`;
}

// The real instant of hh:00 IST on the IST date that is `dayOffset` days after now
export function slotInstant(now: number, dayOffset: number, hourIst: number): Date {
  const p = istParts(now);
  const utcMs = Date.UTC(p.year, p.month, p.day + dayOffset, hourIst, 0, 0, 0);
  return new Date(utcMs - IST_OFFSET_MS);
}

// Slots for the next `days` days, at least `minLeadHours` from now
export function candidateSlots(now: number, days = 3, minLeadHours = 2): Date[] {
  const slots: Date[] = [];
  for (let d = 0; d < days; d++) {
    for (const hour of SLOT_HOURS) {
      const slot = slotInstant(now, d, hour);
      if (slot.getTime() >= now + minLeadHours * HOUR_MS) slots.push(slot);
    }
  }
  return slots;
}

// Offer up to `count` slots, spread over different days
export function pickOfferSlots(free: Date[], count = 3): Date[] {
  const byDay = new Map<string, Date[]>();
  for (const slot of free) {
    const key = istDateKey(slot);
    byDay.set(key, [...(byDay.get(key) ?? []), slot]);
  }

  const picked: Date[] = [];
  for (const group of byDay.values()) {
    if (picked.length < count) picked.push(group[0]);
  }
  for (const slot of free) {
    if (picked.length >= count) break;
    if (!picked.includes(slot)) picked.push(slot);
  }
  return picked.sort((a, b) => a.getTime() - b.getTime());
}

// ---------------- Understanding what the buyer typed ----------------

const WEEKDAY_WORDS: [RegExp, number][] = [
  [/\b(sunday|sun|ravivar|itwar)\b/, 0],
  [/\b(monday|mon|somvar|somwar)\b/, 1],
  [/\b(tuesday|tue|tues|mangalvar|mangalwar)\b/, 2],
  [/\b(wednesday|wed|budhvar|budhwar)\b/, 3],
  [/\b(thursday|thu|thur|thurs|guruvar|brihaspativar|veervar)\b/, 4],
  [/\b(friday|fri|shukravar|shukrawar)\b/, 5],
  [/\b(saturday|sat|shanivar|shaniwar)\b/, 6],
];

// Days from today: 0 = today, 1 = tomorrow ("kal"), 2 = day after ("parso"). null = no day said.
export function parseDayOffset(text: string, now: number): number | null {
  if (/\bday after\b|\b(parso|parson|parsoon)\b/.test(text)) return 2;
  if (/\b(kal|tomorrow|tmrw|tomorow)\b/.test(text)) return 1;
  if (/\b(aaj|today)\b/.test(text)) return 0;

  const today = istParts(now).weekday;
  for (const [pattern, weekday] of WEEKDAY_WORDS) {
    if (pattern.test(text)) return (weekday - today + 7) % 7;
  }
  return null;
}

// Closest slot hour, only if within 1 hour of it (so 10 to 12 -> 11, 13 to 15 -> 14, 16 to 18 -> 17)
function snapToSlot(hour: number): number | null {
  let best: number | null = null;
  let bestDiff = Infinity;
  for (const slot of SLOT_HOURS) {
    const diff = Math.abs(slot - hour);
    if (diff < bestDiff) {
      best = slot;
      bestDiff = diff;
    }
  }
  return bestDiff <= 1 ? best : null;
}

const PART_OF_DAY: [RegExp, number][] = [
  [/\b(subah|subha|morning)\b/, 11],
  [/\b(dopahar|dophar|afternoon)\b/, 14],
  [/\b(shaam|sham|evening)\b/, 17],
];

// present = the buyer mentioned a time; hour = matching slot hour, or null if we have no such slot
export function parseTime(text: string): { present: boolean; hour: number | null } {
  // "2 pm", "11:30am"
  let m = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
  if (m) {
    let hour = Number(m[1]) % 12;
    if (m[3] === "pm") hour += 12;
    return { present: true, hour: snapToSlot(hour + Number(m[2] ?? 0) / 60) };
  }

  // "11 baje", "2 baje" (1 to 6 baje means afternoon/evening)
  m = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(?:baje|bje|o'?clock)\b/);
  if (m) {
    let hour = Number(m[1]);
    if (hour >= 1 && hour <= 6) hour += 12;
    return { present: true, hour: snapToSlot(hour + Number(m[2] ?? 0) / 60) };
  }

  // "14:00"
  m = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (m) {
    return { present: true, hour: snapToSlot(Number(m[1]) + Number(m[2]) / 60) };
  }

  for (const [pattern, hour] of PART_OF_DAY) {
    if (pattern.test(text)) return { present: true, hour };
  }
  return { present: false, hour: null };
}

function parseOrdinal(text: string): number | "last" | null {
  const t = text.trim();
  if (/\b(pehla|pehle|pahla|pahle|first|1st)\b/.test(t) || /^(?:option|number|no\.?)?\s*1\b/.test(t)) return 0;
  if (/\b(doosra|dusra|dusri|doosri|second|2nd)\b/.test(t) || /^(?:option|number|no\.?)?\s*2\b/.test(t)) return 1;
  if (/\b(teesra|tisra|teesri|third|3rd)\b/.test(t) || /^(?:option|number|no\.?)?\s*3\b/.test(t)) return 2;
  if (/\b(last|aakhri|akhri)\b/.test(t)) return "last";
  return null;
}

function isAffirmation(text: string): boolean {
  return /\b(haan|haanji|han|ha|yes|yep|ok|okay|theek|thik|sahi|done|confirm|confirmed|chalega|chalegi|book)\b/.test(
    text
  );
}

// Decides which slot the buyer chose.
// slot = null with specified = true means "they asked for something we cannot offer"
export function resolveVisitChoice(input: {
  message: string;
  requestedTime: string | null;
  now: number;
  offered: Date[]; // slots we offered earlier (in the order offered)
  free: Date[]; // slots that are free right now
}): { slot: Date | null; specified: boolean } {
  const { now, offered, free } = input;
  const message = input.message.toLowerCase();
  const combined = `${input.requestedTime ?? ""} ${message}`.toLowerCase();
  const freeSet = new Set(free.map((d) => d.getTime()));
  const hasOffer = offered.length > 0;

  const messageTime = parseTime(message);
  const messageDay = parseDayOffset(message, now);

  // "doosra wala", "option 3" (only when we offered slots and no explicit time was typed)
  if (hasOffer && !messageTime.present && messageDay === null) {
    const ordinal = parseOrdinal(message);
    if (ordinal !== null) {
      const slot = ordinal === "last" ? offered[offered.length - 1] : offered[ordinal];
      return { slot: slot && freeSet.has(slot.getTime()) ? slot : null, specified: true };
    }
  }

  const day = parseDayOffset(combined, now);
  const time = parseTime(combined);

  if (day === null && !time.present) {
    // plain "haan" / "ok" after an offer -> the first offered slot that is still free
    if (hasOffer && isAffirmation(message)) {
      const firstFree = offered.find((s) => freeSet.has(s.getTime()));
      if (firstFree) return { slot: firstFree, specified: false };
    }
    return { slot: null, specified: false };
  }

  let matches = free;
  if (day !== null) matches = matches.filter((s) => daysFromToday(now, s) === day);
  if (time.present) {
    matches =
      time.hour === null ? [] : matches.filter((s) => istParts(s.getTime()).hour === time.hour);
  }

  if (matches.length === 1) return { slot: matches[0], specified: true };
  // only a time was given ("11 baje"): take the earliest day that has it
  if (matches.length > 1 && time.present && day === null) {
    return { slot: matches[0], specified: true };
  }
  return { slot: null, specified: true };
}