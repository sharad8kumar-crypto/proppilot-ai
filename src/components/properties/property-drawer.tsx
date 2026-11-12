"use client";

import { useMemo, useState } from "react";
import { ExternalLink, MapPin } from "lucide-react";
import { SourceBadge, TemperatureBadge } from "@/components/shared/badges";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { EMI_DEFAULTS, emiForPrice, formatEmiAmount } from "@/lib/emi";
import { formatBudget, formatInr, leadDisplayName } from "@/lib/format";
import { matchLeads, type MatchLead } from "@/lib/matching";
import type { PropertyRow } from "@/types/db";
import { StatusBadge } from "./property-card";
import { PropertyImage } from "./property-image";

function budgetText(min: number | null, max: number | null): string {
  if (min !== null && max !== null) return formatBudget(min, max);
  if (max !== null) return `Up to ${formatInr(max)}`;
  if (min !== null) return `From ${formatInr(min)}`;
  return "Budget not shared";
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted p-3">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold">{value}</dd>
    </div>
  );
}

function DrawerBody({
  property,
  leads,
}: {
  property: PropertyRow;
  leads: MatchLead[];
}) {
  // Adjustable EMI inputs (state resets for each property because of the key)
  const [rate, setRate] = useState<number>(EMI_DEFAULTS.annualRatePct);
  const [years, setYears] = useState<number>(EMI_DEFAULTS.years);

  const emi = emiForPrice(property.price_inr, { annualRatePct: rate, years });
  const matched = useMemo(() => matchLeads(property, leads, 6), [property, leads]);

  const perSqft =
    property.area_sqft !== null && property.area_sqft > 0
      ? `₹${Math.round(property.price_inr / property.area_sqft).toLocaleString("en-IN")} / sq ft`
      : "Not available";

  const mapLink =
    property.lat !== null && property.lng !== null
      ? `https://www.openstreetmap.org/?mlat=${property.lat}&mlon=${property.lng}#map=15/${property.lat}/${property.lng}`
      : null;

  return (
    <div className="pb-8">
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-secondary">
        <PropertyImage
          src={property.image_url}
          alt={`${property.title}, ${property.locality}`}
          className="absolute inset-0 size-full"
        />
      </div>

      <div className="space-y-6 p-5">
        <header>
          <div className="flex items-start justify-between gap-3">
            <p className="font-serif text-3xl">{formatInr(property.price_inr)}</p>
            <StatusBadge status={property.status} />
          </div>
          <h2 className="mt-1 text-base font-semibold">{property.title}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            by {property.builder} (demo builder)
          </p>
        </header>

        <dl className="grid grid-cols-2 gap-2">
          <Stat label="Bedrooms" value={`${property.bhk} BHK`} />
          <Stat
            label="Area"
            value={
              property.area_sqft !== null
                ? `${property.area_sqft.toLocaleString("en-IN")} sq ft`
                : "Not available"
            }
          />
          <Stat label="Price per sq ft" value={perSqft} />
          <Stat label="Possession" value={property.possession ?? "Not available"} />
        </dl>

        {/* Location */}
        <section>
          <h3 className="font-serif text-base">Location</h3>
          <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="size-4 shrink-0" aria-hidden />
            {property.locality}, {property.city}
          </p>
          {mapLink && (
            <a
              href={mapLink}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium underline-offset-2 hover:underline"
            >
              Open in OpenStreetMap <ExternalLink className="size-3" aria-hidden />
            </a>
          )}
        </section>

        {/* Amenities */}
        <section>
          <h3 className="font-serif text-base">Amenities</h3>
          {property.amenities.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No amenities listed.</p>
          ) : (
            <ul className="mt-2 flex flex-wrap gap-2">
              {property.amenities.map((a) => (
                <li key={a} className="rounded-full bg-secondary px-3 py-1 text-xs font-medium">
                  {a}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* EMI */}
        <section className="rounded-2xl border border-border bg-muted p-4">
          <h3 className="font-serif text-base">EMI estimate</h3>
          <p className="mt-2 font-serif text-3xl">
            {formatEmiAmount(emi.emi)}
            <span className="text-sm font-normal text-muted-foreground"> / month</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Loan {formatInr(emi.loan)} ({Math.round(EMI_DEFAULTS.ltv * 100)}% of price). Down
            payment {formatInr(emi.downPayment)}. Total interest {formatInr(emi.totalInterest)}.
          </p>

          <div className="mt-4 space-y-3">
            <div>
              <label htmlFor="emi-rate" className="flex justify-between text-xs">
                <span className="text-muted-foreground">Interest rate</span>
                <span className="font-medium">{rate.toFixed(1)}%</span>
              </label>
              <input
                id="emi-rate"
                type="range"
                min={6}
                max={12}
                step={0.1}
                value={rate}
                onChange={(e) => setRate(Number(e.target.value))}
                className="mt-1 w-full accent-primary"
              />
            </div>
            <div>
              <label htmlFor="emi-years" className="flex justify-between text-xs">
                <span className="text-muted-foreground">Tenure</span>
                <span className="font-medium">{years} years</span>
              </label>
              <input
                id="emi-years"
                type="range"
                min={5}
                max={30}
                step={1}
                value={years}
                onChange={(e) => setYears(Number(e.target.value))}
                className="mt-1 w-full accent-primary"
              />
            </div>
          </div>
        </section>

        {/* Matched leads */}
        <section>
          <h3 className="font-serif text-base">Matched leads</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Active leads whose BHK, budget and area fit this property.
          </p>

          {property.status === "sold" ? (
            <p className="mt-3 rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
              This property is sold, so no leads are matched.
            </p>
          ) : matched.length === 0 ? (
            <p className="mt-3 rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
              No matching leads right now.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-border rounded-2xl border border-border bg-surface">
              {matched.map(({ lead, score, reasons }) => (
                <li key={lead.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      {leadDisplayName(lead)}
                      <SourceBadge source={lead.source} />
                      <TemperatureBadge temperature={lead.temperature} />
                    </p>
                    <span className="shrink-0 text-xs font-semibold tabular-nums">
                      {score}% match
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {budgetText(lead.budget_min, lead.budget_max)}
                    {reasons.length > 0 && ` · ${reasons.join(" · ")}`}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

type PropertyDrawerProps = {
  property: PropertyRow | null;
  leads: MatchLead[];
  onClose: () => void;
};

export function PropertyDrawer({ property, leads, onClose }: PropertyDrawerProps) {
  return (
    <Sheet
      open={property !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent side="right" className="w-full overflow-y-auto bg-background p-0 sm:max-w-md">
        <SheetTitle className="sr-only">{property?.title ?? "Property details"}</SheetTitle>
        {property && <DrawerBody key={property.id} property={property} leads={leads} />}
      </SheetContent>
    </Sheet>
  );
}