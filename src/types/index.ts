export type LeadSource =
  | "99acres"
  | "magicbricks"
  | "housing"
  | "facebook"
  | "whatsapp"
  | "website";

export type Temperature = "hot" | "warm" | "cold";

// A lead as shown on the dashboard (built from database rows)
export type DashboardLead = {
  id: string;
  name: string;
  source: LeadSource;
  bhk: number | null;
  locality: string | null;
  budgetMin: number | null; // INR
  budgetMax: number | null; // INR
  score: number; // 0-100
  temperature: Temperature;
  stage: "new" | "qualified" | "site_visit" | "negotiation" | "booked" | "lost";
  untouchedHours: number; // hours since the last human touch
  dealValue: number; // estimated deal value in INR
};

export type ActivityType =
  | "lead_created"
  | "ai_qualified"
  | "property_matched"
  | "visit_booked"
  | "hot_alert"
  | "followup_sent"
  | "hot_untouched"
  | "stage_changed";

export type ActivityEvent = {
  id: string;
  type: ActivityType;
  title: string;
  detail: string;
  timeAgo: string;
};

export type FunnelStage = {
  label: string;
  count: number;
};