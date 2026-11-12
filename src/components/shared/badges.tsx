import { cn } from "@/lib/utils";
import type { LeadSource, Temperature } from "@/types";

const sourceLabel: Record<LeadSource, string> = {
  "99acres": "99acres",
  magicbricks: "MagicBricks",
  housing: "Housing",
  facebook: "Facebook",
  whatsapp: "WhatsApp",
  website: "Website",
};

export function SourceBadge({
  source,
  className,
}: {
  source: LeadSource;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border border-border bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-muted-foreground",
        className
      )}
    >
      {sourceLabel[source]}
    </span>
  );
}

// Full class names written out so Tailwind can detect them
const temperatureStyles: Record<Temperature, string> = {
  hot: "bg-danger/10 text-danger ring-danger/25",
  warm: "bg-warning/10 text-warning ring-warning/25",
  cold: "bg-info/10 text-info ring-info/25",
};

const temperatureLabel: Record<Temperature, string> = {
  hot: "Hot",
  warm: "Warm",
  cold: "Cold",
};

export function TemperatureBadge({
  temperature,
  className,
}: {
  temperature: Temperature;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1",
        temperatureStyles[temperature],
        className
      )}
    >
      {temperatureLabel[temperature]}
    </span>
  );
}