import type { LeadSource } from "@/types";

// Demo assumptions: what one lead costs from each source (INR).
// A real client replaces these with their own ad-spend numbers.
export const COST_PER_LEAD: Record<LeadSource, number> = {
  "99acres": 650,
  magicbricks: 580,
  housing: 520,
  facebook: 310,
  whatsapp: 150,
  website: 90,
};

export const SOURCE_LABEL: Record<LeadSource, string> = {
  "99acres": "99acres",
  magicbricks: "MagicBricks",
  housing: "Housing",
  facebook: "Facebook",
  whatsapp: "WhatsApp",
  website: "Website",
};

export const SOURCE_ORDER: LeadSource[] = [
  "99acres",
  "magicbricks",
  "housing",
  "facebook",
  "whatsapp",
  "website",
];