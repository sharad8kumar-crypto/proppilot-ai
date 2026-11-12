import type { Stage } from "@/types/db";

export const STAGES: { id: Stage; label: string }[] = [
  { id: "new", label: "New" },
  { id: "qualified", label: "Qualified" },
  { id: "site_visit", label: "Site Visit" },
  { id: "negotiation", label: "Negotiation" },
  { id: "booked", label: "Booked" },
  { id: "lost", label: "Lost" },
];

export function stageLabel(stage: Stage): string {
  return STAGES.find((s) => s.id === stage)?.label ?? stage;
}

export function isStage(value: string): value is Stage {
  return STAGES.some((s) => s.id === value);
}