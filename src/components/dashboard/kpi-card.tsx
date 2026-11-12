"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { GlassCard } from "@/components/shell/glass-card";
import { cn } from "@/lib/utils";
import { CountUp } from "./count-up";

export type KpiTone = "gold" | "success" | "danger" | "info" | "warning";

const toneStyles: Record<KpiTone, string> = {
  gold: "bg-gold/10 text-gold",
  success: "bg-success/10 text-success",
  danger: "bg-danger/10 text-danger",
  info: "bg-info/10 text-info",
  warning: "bg-warning/10 text-warning",
};

type KpiCardProps = {
  label: string;
  icon: LucideIcon;
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  hint: string;
  tone?: KpiTone;
  index: number; // used for the staggered entrance
};

export function KpiCard({
  label,
  icon: Icon,
  value,
  decimals,
  prefix,
  suffix,
  hint,
  tone = "gold",
  index,
}: KpiCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.05, ease: "easeOut" }}
    >
      <GlassCard className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{label}</p>
          <span
            className={cn(
              "grid size-8 place-items-center rounded-lg",
              toneStyles[tone]
            )}
          >
            <Icon className="size-4" aria-hidden />
          </span>
        </div>
        <p className="mt-4 font-serif text-4xl">
          <CountUp
            value={value}
            decimals={decimals}
            prefix={prefix}
            suffix={suffix}
          />
        </p>
        <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
      </GlassCard>
    </motion.div>
  );
}