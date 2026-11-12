import type { Temperature } from "@/types";

// Which follow-up sequence each lead gets, based on temperature.
// Step numbers identify the sequence: Hot 1-3, Warm 11-13, Cold 21-23.
// Steps 90 and 91 are site-visit reminders (created when a visit is booked).

export type StepDef = {
  step: number;
  offsetHours: number; // after the sequence starts
  label: string;
  goal: string; // instruction for the AI that writes the message
  attach: "none" | "recap" | "new_property";
};

export const SEQUENCES: Record<Temperature, StepDef[]> = {
  hot: [
    {
      step: 1,
      offsetHours: 2,
      label: "2-hour check-in",
      goal: "Check in politely a couple of hours after the last chat. Ask if they have any questions or want to book a site visit.",
      attach: "none",
    },
    {
      step: 2,
      offsetHours: 24,
      label: "Next-day nudge",
      goal: "Send a gentle next-day nudge. Ask if they are still looking and offer to answer any questions.",
      attach: "none",
    },
    {
      step: 3,
      offsetHours: 48,
      label: "Site visit invitation",
      goal: "Invite them to book a site visit and say you can share the available slots.",
      attach: "none",
    },
  ],
  warm: [
    {
      step: 11,
      offsetHours: 24,
      label: "Day 1 property recap",
      goal: "Recap the options you picked for them and ask which one they liked. Mention the property names from the facts only.",
      attach: "recap",
    },
    {
      step: 12,
      offsetHours: 72,
      label: "Day 3 new matching property",
      goal: "Tell them a new property matching their needs is available (use the property in the facts) and invite them to take a look.",
      attach: "new_property",
    },
    {
      step: 13,
      offsetHours: 168,
      label: "Day 7 check-in",
      goal: "Send a friendly check-in after a week. Ask if their plans have changed or if you can help with anything.",
      attach: "none",
    },
  ],
  cold: [
    {
      step: 21,
      offsetHours: 48,
      label: "Day 2 soft check-in",
      goal: "Soft check-in. Ask if they are still searching for a home, with no pressure.",
      attach: "none",
    },
    {
      step: 22,
      offsetHours: 168,
      label: "Day 7 value message",
      goal: "Share one useful home-buying tip: always check the RERA registration and the possession date before booking. Do not mention any prices or offers.",
      attach: "none",
    },
    {
      step: 23,
      offsetHours: 336,
      label: "Day 14 final nudge",
      goal: "Send a final polite nudge. Say you will not disturb them again and they can message anytime when ready.",
      attach: "none",
    },
  ],
};

const RANGES: Record<Temperature, [number, number]> = {
  hot: [1, 3],
  warm: [11, 13],
  cold: [21, 23],
};

export function rangeFor(temperature: Temperature): [number, number] {
  return RANGES[temperature];
}

export function stepDefFor(step: number): StepDef | null {
  for (const defs of Object.values(SEQUENCES)) {
    const found = defs.find((d) => d.step === step);
    if (found) return found;
  }
  return null;
}

export function stepLabel(step: number): string {
  if (step === 90) return "Visit reminder (24h before)";
  if (step === 91) return "Visit reminder (2h before)";
  return stepDefFor(step)?.label ?? `Step ${step}`;
}

// 1.5 -> "+2h", 72 -> "Day 3"
export function formatOffset(hours: number): string {
  if (hours < 24) return `+${Math.max(1, Math.round(hours))}h`;
  return `Day ${Math.round(hours / 24)}`;
}