import { formatBudget, formatInr } from "@/lib/format";

export function budgetText(min: number | null, max: number | null): string {
  if (min !== null && max !== null) return formatBudget(min, max);
  if (max !== null) return `Up to ${formatInr(max)}`;
  if (min !== null) return `From ${formatInr(min)}`;
  return "Budget not shared";
}