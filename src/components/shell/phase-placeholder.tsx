import type { LucideIcon } from "lucide-react";
import { GlassCard } from "./glass-card";

type PhasePlaceholderProps = {
  icon: LucideIcon;
  title: string;
  phase: string;
  points: string[];
};

// Temporary "coming soon" panel. Each page will replace this in its own phase.
export function PhasePlaceholder({
  icon: Icon,
  title,
  phase,
  points,
}: PhasePlaceholderProps) {
  return (
    <GlassCard className="flex flex-col items-center px-6 py-16 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-gold/10 ring-1 ring-gold/30">
        <Icon className="size-6 text-gold" aria-hidden />
      </span>
      <p className="mt-6 text-xs uppercase tracking-[0.2em] text-gold">
        {phase}
      </p>
      <h2 className="mt-2 font-serif text-2xl">{title}</h2>
      <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
        {points.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
    </GlassCard>
  );
}