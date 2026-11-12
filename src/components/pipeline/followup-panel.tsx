"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { AlertTriangle, FastForward, Loader2 } from "lucide-react";
import { CountUp } from "@/components/dashboard/count-up";
import { GlassCard } from "@/components/shell/glass-card";
import { cn } from "@/lib/utils";

type Processed = {
  followup_id: string;
  lead_name: string;
  label: string;
  when: string;
  message: string;
  property_count: number;
};

type FastForwardResult = {
  days: number;
  leads_considered: number;
  processed: Processed[];
  skipped: number;
  remaining: number;
  alerts: { lead_id: string; lead_name: string }[];
};

const OPTIONS = [1, 3, 7] as const;

export function FollowupPanel({ pendingCount }: { pendingCount: number }) {
  const router = useRouter();
  const [running, setRunning] = useState<number | null>(null);
  const [result, setResult] = useState<FastForwardResult | null>(null);
  const [runId, setRunId] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function run(days: number) {
    setRunning(days);
    setError(null);
    try {
      const res = await fetch(`/api/followups/fast-forward?days=${days}`, { method: "POST" });
      const data = (await res.json().catch(() => null)) as
        | (FastForwardResult & { error?: string })
        | null;
      if (!res.ok || !data) {
        throw new Error(data?.error ?? "Fast-forward failed. Please try again.");
      }
      setResult(data);
      setRunId((n) => n + 1);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fast-forward failed. Please try again.");
    } finally {
      setRunning(null);
    }
  }

  return (
    <GlassCard className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-serif text-xl">Follow-up engine</h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Every lead gets an automatic follow-up sequence based on how hot it is. Fast-forward
            time to watch the AI send them. {pendingCount} follow-up{pendingCount === 1 ? "" : "s"}{" "}
            pending.
          </p>
        </div>

        <div className="flex items-center gap-2" role="group" aria-label="Fast-forward time">
          {OPTIONS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => run(d)}
              disabled={running !== null}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                "bg-primary text-primary-foreground hover:bg-gold-hover disabled:cursor-not-allowed disabled:opacity-50"
              )}
            >
              {running === d ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <FastForward className="size-4" aria-hidden />
              )}
              +{d} day{d === 1 ? "" : "s"}
            </button>
          ))}
        </div>
      </div>

      {running !== null && (
        <p role="status" className="mt-4 text-sm text-muted-foreground">
          Fast-forwarding {running} day{running === 1 ? "" : "s"}. The AI is writing the follow-ups...
        </p>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-danger/10 px-3 py-2 text-xs text-danger">
          {error}
        </p>
      )}

      {result && running === null && (
        <div className="mt-5 border-t border-border pt-5">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <p className="font-serif text-4xl">
              <CountUp key={runId} value={result.days} prefix="+" suffix={result.days === 1 ? " day" : " days"} />
            </p>
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {result.processed.length} follow-up{result.processed.length === 1 ? "" : "s"} sent
              across {result.leads_considered} lead{result.leads_considered === 1 ? "" : "s"}
              {result.remaining > 0 && ` · ${result.remaining} more waiting (run again)`}
              {result.skipped > 0 && ` · ${result.skipped} skipped (visit already booked)`}
            </p>
          </div>

          {result.alerts.length > 0 && (
            <ul className="mt-4 space-y-2">
              {result.alerts.map((a) => (
                <li
                  key={a.lead_id}
                  className="flex items-center gap-2 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger"
                >
                  <AlertTriangle className="size-4 shrink-0" aria-hidden />
                  Hot lead untouched for 48h+: {a.lead_name}. Alert added to the activity feed.
                </li>
              ))}
            </ul>
          )}

          {result.processed.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
              Nothing was due in this time window. Try a longer jump, or chat with a lead in the
              Inbox first so it gets a follow-up sequence.
            </p>
          ) : (
            <ol className="relative mt-5 ml-3 border-l border-border">
              {result.processed.map((item, i) => (
                <motion.li
                  key={`${runId}-${item.followup_id}`}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.25, delay: i * 0.18, ease: "easeOut" }}
                  className="relative pb-5 pl-6 last:pb-0"
                >
                  <span
                    className="absolute -left-[7px] top-1.5 size-3 rounded-full border-2 border-background bg-primary"
                    aria-hidden
                  />
                  <p className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full bg-primary px-2 py-0.5 font-semibold text-primary-foreground">
                      {item.when}
                    </span>
                    <span className="font-medium">{item.lead_name}</span>
                    <span className="text-muted-foreground">{item.label}</span>
                    {item.property_count > 0 && (
                      <span className="text-faint">
                        + {item.property_count} property card{item.property_count === 1 ? "" : "s"}
                      </span>
                    )}
                  </p>
                  <p className="mt-1.5 rounded-xl bg-background px-3 py-2 text-sm leading-relaxed">
                    {item.message}
                  </p>
                </motion.li>
              ))}
            </ol>
          )}
        </div>
      )}
    </GlassCard>
  );
}