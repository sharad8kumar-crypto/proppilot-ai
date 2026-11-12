import { cn } from "@/lib/utils";
import type { RunStatus } from "./use-workflow-run";

const STYLE: Record<RunStatus, { label: string; dot: string; text: string }> = {
  idle: { label: "Not run", dot: "bg-faint", text: "text-muted-foreground" },
  running: { label: "Running", dot: "bg-info animate-pulse", text: "text-info" },
  success: { label: "Success", dot: "bg-success", text: "text-success" },
  skipped: { label: "Skipped", dot: "bg-faint", text: "text-muted-foreground" },
  failed: { label: "Failed", dot: "bg-danger", text: "text-danger" },
};

export function RunStatusChip({ status }: { status: RunStatus }) {
  const s = STYLE[status];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium">
      <span className={cn("size-1.5 rounded-full", s.dot)} aria-hidden />
      <span className={s.text}>{s.label}</span>
    </span>
  );
}

// null -> "instant", 640 -> "640 ms", 2400 -> "2.4 s"
export function durationText(ms: number | null): string {
  if (ms === null) return "instant";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

// "10:30:01 AM"
export function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}