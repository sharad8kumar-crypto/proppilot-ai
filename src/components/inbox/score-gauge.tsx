"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { Temperature } from "@/types";

const RADIUS = 52;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const COLOR: Record<Temperature, string> = {
  hot: "text-danger",
  warm: "text-warning",
  cold: "text-info",
};

export function ScoreGauge({
  score,
  temperature,
}: {
  score: number;
  temperature: Temperature;
}) {
  const clamped = Math.min(100, Math.max(0, score));
  const offset = CIRCUMFERENCE * (1 - clamped / 100);

  return (
    <div
      className="relative size-36"
      role="img"
      aria-label={`Lead score ${clamped} out of 100`}
    >
      <svg viewBox="0 0 120 120" className="size-full -rotate-90">
        <circle
          cx="60"
          cy="60"
          r={RADIUS}
          fill="none"
          strokeWidth="10"
          className="stroke-surface-2"
        />
        <motion.circle
          cx="60"
          cy="60"
          r={RADIUS}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          className={cn("stroke-current", COLOR[temperature])}
          initial={{ strokeDashoffset: CIRCUMFERENCE }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="font-serif text-4xl leading-none">{clamped}</p>
          <p className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">
            out of 100
          </p>
        </div>
      </div>
    </div>
  );
}