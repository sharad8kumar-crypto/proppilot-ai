import type { LeadSource, Temperature } from "@/types";

export type VisitStatus = "scheduled" | "completed" | "no_show" | "rescheduled";

export type CalendarAgent = { id: string; name: string; color: string };

export type CalendarVisit = {
  id: string;
  scheduledAt: string; // ISO instant
  status: VisitStatus;
  lead: {
    id: string;
    name: string;
    source: LeadSource;
    temperature: Temperature;
    score: number;
  } | null;
  property: { title: string; locality: string; city: string; price: number } | null;
  agent: CalendarAgent | null;
};