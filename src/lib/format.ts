const LAKH = 100_000;
const CRORE = 10_000_000;

// 1.35 -> "1.35", 1.5 -> "1.5", 85 -> "85" (no trailing zeros)
const trim = (n: number) => Number(n.toFixed(2)).toString();

// 8_500_000 -> "₹85 L", 13_500_000 -> "₹1.35 Cr"
export function formatInr(value: number): string {
  if (value >= CRORE) return `₹${trim(value / CRORE)} Cr`;
  if (value >= LAKH) return `₹${trim(value / LAKH)} L`;
  return `₹${value.toLocaleString("en-IN")}`;
}

export function formatBudget(min: number, max: number): string {
  return `${formatInr(min)} - ${formatInr(max)}`;
}

// 15120 -> "4h 12m", 8 -> "8s", 125 -> "2m 5s"
export function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// 61 -> "2d 13h", 6 -> "6h", 0.2 -> "just now"
export function formatHours(hours: number): string {
  if (hours < 1) return "just now";
  if (hours < 48) return `${Math.floor(hours)}h`;
  const d = Math.floor(hours / 24);
  const h = Math.floor(hours % 24);
  return `${d}d ${h}h`;
}

// "2026-11-07T10:00:00Z" -> "now", "5m", "3h", "2d"
export function timeAgo(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

// "3:45 PM"
export function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });
}

// "Priya Sharma" -> "PS"
export function initialsOf(name: string | null): string {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function leadDisplayName(lead: { name: string | null }): string {
  return lead.name ?? "New lead";
}

// "price_negotiation" -> "Price negotiation"
export function titleCase(value: string): string {
  return value.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}