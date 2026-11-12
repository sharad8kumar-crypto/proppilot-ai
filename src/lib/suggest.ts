import type { LeadRow } from "@/types/db";

export type NextAction = { title: string; detail: string };

// Simple, explainable rules (no AI) so clients can see why an action is suggested.
export function suggestNextAction(lead: LeadRow): NextAction {
  if (lead.stage === "booked") {
    return {
      title: "Share booking documents",
      detail: "This lead has booked. Send the agreement checklist and payment schedule.",
    };
  }

  if (lead.stage === "lost" || lead.intent === "not_interested") {
    return {
      title: "Move to nurture",
      detail: "Add to a long-term nurture sequence and revisit in 2 to 4 weeks.",
    };
  }

  if (lead.temperature === "hot") {
    if (lead.stage === "site_visit") {
      return {
        title: "Confirm the site visit",
        detail: "Send a reminder with the location and the agent's name.",
      };
    }
    if (lead.stage === "negotiation") {
      return {
        title: "Follow up on the offer",
        detail: "Check objections and share the best available payment plan.",
      };
    }
    return {
      title: "Call now and offer a site visit",
      detail: "Hot leads convert best when a human follows up within the hour.",
    };
  }

  // Ask for whatever is still missing, in the same order the AI asks
  if (lead.budget_min === null && lead.budget_max === null) {
    return { title: "Find out the budget", detail: "Budget is still unknown. Ask for a comfortable range." };
  }
  if (lead.bhk === null) {
    return { title: "Confirm BHK size", detail: "Ask how many bedrooms the buyer needs." };
  }
  if (lead.preferred_locations.length === 0) {
    return { title: "Ask for preferred areas", detail: "No location shared yet. Ask which localities they like." };
  }
  if (lead.timeline === "unknown") {
    return { title: "Ask about the timeline", detail: "Find out when the buyer wants to move or buy." };
  }
  if (lead.needs_loan === null) {
    return { title: "Ask about home loan", detail: "Knowing loan need helps plan EMI-friendly options." };
  }

  if (lead.temperature === "warm") {
    return {
      title: "Send 3 matching properties",
      detail: "Profile is clear. Share options and suggest a site visit.",
    };
  }
  return {
    title: "Keep nurturing",
    detail: "Send a soft check-in and a useful market update in a few days.",
  };
}