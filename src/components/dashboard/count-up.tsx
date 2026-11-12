"use client";

import { useEffect, useRef } from "react";
import { animate, useReducedMotion } from "framer-motion";

type CountUpProps = {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
};

// Animates a number towards `value`. When live data changes, it counts from the
// previous number (not from 0). Skips animation if the user prefers reduced motion.
export function CountUp({
  value,
  decimals = 0,
  prefix = "",
  suffix = "",
  duration = 1.2,
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const from = useRef(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const format = (v: number) => `${prefix}${v.toFixed(decimals)}${suffix}`;

    if (reduceMotion) {
      node.textContent = format(value);
      from.current = value;
      return;
    }

    const controls = animate(from.current, value, {
      duration,
      ease: "easeOut",
      onUpdate: (v) => {
        from.current = v;
        node.textContent = format(v);
      },
    });

    return () => controls.stop();
  }, [value, decimals, prefix, suffix, duration, reduceMotion]);

  return (
    <span ref={ref} className="tabular-nums">
      {`${prefix}${(0).toFixed(decimals)}${suffix}`}
    </span>
  );
}