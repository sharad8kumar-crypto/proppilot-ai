import type { LeadSource } from "@/types";

export type SourceRow = {
  source: LeadSource;
  label: string;
  leads: number;
  qualified: number;
  qualifiedPct: number;
  visits: number;
  bookings: number;
  costPerLead: number; // demo assumption, INR
  totalCost: number;
  costPerBooking: number | null; // null when there are no bookings yet
};

export type AgentStats = {
  id: string;
  name: string;
  color: string;
  leadsHandled: number;
  visits: number;
  conversions: number;
  conversionPct: number;
  avgResponseMs: number | null;
};

export type DailyResponsePoint = {
  day: string;
  label: string;
  aiMinutes: number | null;
  humanMinutes: number | null;
};

export type DailyPipelinePoint = {
  day: string;
  label: string;
  addedCr: number;
  cumulativeCr: number;
};