"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Bot, RotateCcw, Users } from "lucide-react";
import { GlassCard } from "@/components/shell/glass-card";
import { SourceBadge } from "@/components/shared/badges";
import { formatDuration } from "@/lib/format";
import type { LeadSource } from "@/types";

type SpeedToLeadProps = {
  aiSeconds: number;
  teamSeconds: number;
  latestLead: { name: string; source: LeadSource };
};

// Live timer counting up to the AI response time.
// Remounted with a new `key` to replay, so we never reset state inside an effect.
function LiveTimer({ aiSeconds }: { aiSeconds: number }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = performance.now();
    const id = window.setInterval(() => {
      const seconds = (performance.now() - start) / 1000;
      if (seconds >= aiSeconds) {
        setElapsed(aiSeconds);
        window.clearInterval(id);
      } else {
        setElapsed(seconds);
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [aiSeconds]);

  const done = elapsed >= aiSeconds;

  return (
    <div className="flex items-center gap-3">
      <p className="font-serif text-4xl tabular-nums">{elapsed.toFixed(1)}s</p>
      <span
        className={
          done
            ? "rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success ring-1 ring-success/25"
            : "rounded-full bg-gold/10 px-2.5 py-1 text-xs font-medium text-gold ring-1 ring-gold/25"
        }
      >
        {done ? "AI replied" : "AI is typing..."}
      </span>
    </div>
  );
}

export function SpeedToLead({
  aiSeconds,
  teamSeconds,
  latestLead,
}: SpeedToLeadProps) {
  const [run, setRun] = useState(0);
  const aiPct = Math.max((aiSeconds / teamSeconds) * 100, 2); // keep the bar visible
  const multiplier = Math.round(teamSeconds / aiSeconds);

  return (
    <GlassCard className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-serif text-xl">Speed-to-Lead</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Buyers go cold fast. The first reply wins the lead.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setRun((r) => r + 1)}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-gold/30 hover:text-foreground"
        >
          <RotateCcw className="size-3.5" aria-hidden />
          Replay
        </button>
      </div>

      {/* Hero comparison */}
      <p className="mt-6 font-serif text-2xl md:text-3xl">
        AI first response:{" "}
        <span className="text-gold">{formatDuration(aiSeconds)}</span>{" "}
        <span className="text-muted-foreground">vs team average: </span>
        <span>{formatDuration(teamSeconds)}</span>
      </p>

      {/* Bars */}
      <div className="mt-6 space-y-4">
        <div>
          <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Bot className="size-3.5 text-gold" aria-hidden />
              PropPilot AI
            </span>
            <span>{formatDuration(aiSeconds)}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-surface-2">
            <motion.div
              className="h-full rounded-full bg-gold"
              initial={{ width: 0 }}
              animate={{ width: `${aiPct}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
          </div>
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Users className="size-3.5" aria-hidden />
              Sales team average
            </span>
            <span>{formatDuration(teamSeconds)}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-surface-2">
            <motion.div
              className="h-full rounded-full bg-danger/70"
              initial={{ width: 0 }}
              animate={{ width: "100%" }}
              transition={{ duration: 0.9, ease: "easeOut" }}
            />
          </div>
        </div>
      </div>

      {/* Live timer on the latest lead */}
      <div className="mt-6 flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Latest lead
          </p>
          <p className="mt-1 flex items-center gap-2 text-sm font-medium">
            {latestLead.name}
            <SourceBadge source={latestLead.source} />
          </p>
        </div>
        <LiveTimer key={run} aiSeconds={aiSeconds} />
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        AI replies about {multiplier.toLocaleString("en-IN")}x faster than the
        average sales team.
      </p>
    </GlassCard>
  );
}