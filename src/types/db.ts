import type { LeadSource, Temperature } from "@/types";

export type Stage =
  | "new"
  | "qualified"
  | "site_visit"
  | "negotiation"
  | "booked"
  | "lost";

export type Timeline =
  | "immediate"
  | "1-3 months"
  | "3-6 months"
  | "6+ months"
  | "unknown";

export type Purpose = "self-use" | "investment" | "unknown";

export type Intent =
  | "browsing"
  | "interested"
  | "ready_to_visit"
  | "price_negotiation"
  | "emergency_urgent"
  | "not_interested"
  | "other";

export type Sender = "lead" | "ai" | "agent" | "system";

// Each field is points earned; total is out of 100
export type ScoreBreakdown = {
  timeline: number; // max 25
  budget: number; // max 20
  specificity: number; // max 15
  loan_purpose: number; // max 15
  engagement: number; // max 15
  visit_intent: number; // max 10
  total: number;
};

export type LeadRow = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  source: LeadSource;
  budget_min: number | null;
  budget_max: number | null;
  bhk: number | null;
  preferred_locations: string[];
  timeline: Timeline;
  needs_loan: boolean | null;
  purpose: Purpose;
  intent: Intent | null;
  summary: string | null;
  score: number;
  score_breakdown: ScoreBreakdown | null;
  temperature: Temperature;
  stage: Stage;
  assigned_agent_id: string | null;
  deal_value_estimate: number | null;
  first_response_ms: number | null;
  human_baseline_ms: number | null;
  last_contact_at: string | null;
  visit_offer: string[] | null; // slots (ISO) offered to the buyer, waiting for their choice
  stage_changed_at: string | null;
  created_at: string;

};

export type MessageRow = {
  id: string;
  lead_id: string;
  sender: Sender;
  channel: string;
  content: string;
  property_ids: string[];
  created_at: string;
};
export type PropertyStatus = "available" | "few_left" | "sold";

export type PropertyRow = {
  id: string;
  title: string;
  project_name: string;
  builder: string;
  locality: string;
  city: string;
  lat: number | null;
  lng: number | null;
  bhk: number;
  area_sqft: number | null;
  price_inr: number;
  status: PropertyStatus;
  possession: string | null;
  amenities: string[];
  image_url: string | null;
  created_at: string;
};
export type FollowupStatus = "pending" | "sent" | "cancelled";

export type FollowupRow = {
  id: string;
  lead_id: string;
  step: number;
  scheduled_for: string;
  message: string | null;
  status: FollowupStatus;
  sent_at: string | null;
};