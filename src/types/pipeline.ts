import type { LeadSource, Temperature } from "@/types";
import type { Stage } from "@/types/db";

export type PipelineLead = {
  id: string;
  name: string;
  source: LeadSource;
  bhk: number | null;
  budgetMin: number | null;
  budgetMax: number | null;
  score: number;
  temperature: Temperature;
  stage: Stage;
  dealValue: number; // INR
  agent: { id: string; name: string; color: string } | null;
  daysInStage: number;
  summary: string | null;
};