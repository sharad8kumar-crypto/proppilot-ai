"use client";

import { BedDouble, CalendarClock, MapPin, Ruler } from "lucide-react";
import { EMI_DEFAULTS, emiForPrice, formatEmiAmount } from "@/lib/emi";
import { formatInr } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PropertyRow, PropertyStatus } from "@/types/db";
import { PropertyImage } from "./property-image";

export type CardVariant = "grid" | "list" | "compact";

const STATUS_STYLE: Record<PropertyStatus, { label: string; className: string }> = {
  available: { label: "Available", className: "bg-success/10 text-success ring-success/25" },
  few_left: { label: "Few left", className: "bg-warning/10 text-warning ring-warning/25" },
  sold: { label: "Sold", className: "bg-secondary text-muted-foreground ring-border" },
};

export function StatusBadge({
  status,
  className,
}: {
  status: PropertyStatus;
  className?: string;
}) {
  const style = STATUS_STYLE[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-background px-2 py-0.5 text-[11px] font-semibold ring-1",
        style.className,
        className
      )}
    >
      {style.label}
    </span>
  );
}

const EMI_NOTE = `${Math.round(EMI_DEFAULTS.ltv * 100)}% loan, ${EMI_DEFAULTS.annualRatePct}% interest, ${EMI_DEFAULTS.years} years`;

type PropertyCardProps = {
  property: PropertyRow;
  variant?: CardVariant;
  selected?: boolean;
  onSelect?: (property: PropertyRow) => void; // omit for a non-clickable card (used in chat)
};

export function PropertyCard({
  property,
  variant = "grid",
  selected = false,
  onSelect,
}: PropertyCardProps) {
  const emi = emiForPrice(property.price_inr);
  const compact = variant === "compact";

  const cardClass = cn(
    "w-full overflow-hidden rounded-2xl border border-border bg-surface text-left transition-shadow",
    variant === "grid" ? "flex flex-col" : "flex",
    onSelect && "cursor-pointer hover:shadow-lg hover:shadow-black/5",
    selected && "ring-2 ring-primary"
  );

  const content = (
    <>
      <span
        className={cn(
          "relative block shrink-0 overflow-hidden bg-secondary",
          variant === "grid" && "aspect-[4/3] w-full",
          variant === "list" && "min-h-36 w-40 sm:w-60",
          compact && "min-h-24 w-24"
        )}
      >
        <PropertyImage
          src={property.image_url}
          alt={`${property.title}, ${property.locality}`}
          className="absolute inset-0 size-full"
        />
        {!compact && <StatusBadge status={property.status} className="absolute left-3 top-3" />}
      </span>

      <span className={cn("flex min-w-0 flex-1 flex-col", compact ? "gap-1 p-3" : "gap-2 p-4")}>
        <span className="flex items-start justify-between gap-2">
          <span className={cn("font-serif leading-tight", compact ? "text-base" : "text-xl")}>
            {formatInr(property.price_inr)}
          </span>
          {compact && <StatusBadge status={property.status} />}
        </span>

        <span className={cn("block truncate font-semibold", compact ? "text-xs" : "text-sm")}>
          {property.title}
        </span>

        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">
            {property.locality}, {property.city}
          </span>
        </span>

        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <BedDouble className="size-3.5" aria-hidden />
            {property.bhk} BHK
          </span>
          {property.area_sqft !== null && (
            <span className="flex items-center gap-1">
              <Ruler className="size-3.5" aria-hidden />
              {property.area_sqft.toLocaleString("en-IN")} sq ft
            </span>
          )}
          {!compact && property.possession && (
            <span className="flex items-center gap-1">
              <CalendarClock className="size-3.5" aria-hidden />
              {property.possession}
            </span>
          )}
        </span>

        <span
          title={EMI_NOTE}
          className="mt-1 inline-flex w-fit items-center rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium"
        >
          EMI {formatEmiAmount(emi.emi)}/mo
        </span>
      </span>
    </>
  );

  if (onSelect) {
    return (
      <button
        type="button"
        onClick={() => onSelect(property)}
        aria-label={`View details: ${property.title}, ${formatInr(property.price_inr)}`}
        className={cardClass}
      >
        {content}
      </button>
    );
  }

  return <div className={cardClass}>{content}</div>;
}