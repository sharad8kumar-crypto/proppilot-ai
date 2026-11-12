"use client";

import { motion } from "framer-motion";
import { GlassCard } from "@/components/shell/glass-card";
import type { FunnelStage } from "@/types";

export function FunnelChart({ stages }: { stages: FunnelStage[] }) {
  const max = stages[0]?.count ?? 1;
  const overall = stages.length
    ? ((stages[stages.length - 1].count / max) * 100).toFixed(1)
    : "0";

  return (
    <GlassCard className="p-6">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="font-serif text-xl">Lead funnel</h2>
          <p className="mt-1 text-sm text-muted-foreground">Last 30 days</p>
        </div>
        <p className="text-right text-xs text-muted-foreground">
          Lead to booking
          <span className="block font-serif text-2xl text-gold">{overall}%</span>
        </p>
      </div>

      <ul className="mt-6 space-y-3">
        {stages.map((stage, i) => {
          const widthPct = (stage.count / max) * 100;
          const prev = i > 0 ? stages[i - 1].count : null;
          const stepPct = prev ? Math.round((stage.count / prev) * 100) : null;

          return (
            <li key={stage.label}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{stage.label}</span>
                <span>
                  <span className="font-medium tabular-nums">{stage.count}</span>
                  {stepPct !== null && (
                    <span className="ml-2 text-faint">{stepPct}% of previous</span>
                  )}
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-surface-2">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-gold to-gold-hover"
                  style={{ opacity: 1 - i * 0.12 }}
                  initial={{ width: 0 }}
                  animate={{ width: `${widthPct}%` }}
                  transition={{ duration: 0.6, delay: i * 0.08, ease: "easeOut" }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </GlassCard>
  );
}