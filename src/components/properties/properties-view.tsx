"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { LayoutGrid, List, Map as MapIcon } from "lucide-react";
import { GlassCard } from "@/components/shell/glass-card";
import { formatInr } from "@/lib/format";
import type { MatchLead } from "@/lib/matching";
import { cn } from "@/lib/utils";
import type { PropertyRow, PropertyStatus } from "@/types/db";
import { PropertyCard } from "./property-card";
import { PropertyDrawer } from "./property-drawer";

// Leaflet needs the browser (window), so the map is loaded only on the client
const PropertyMap = dynamic(() => import("./property-map").then((m) => m.PropertyMap), {
  ssr: false,
  loading: () => <div className="h-[560px] animate-pulse rounded-2xl bg-muted" />,
});

type ViewMode = "grid" | "list" | "map";

const VIEWS: { value: ViewMode; label: string; icon: typeof LayoutGrid }[] = [
  { value: "grid", label: "Grid", icon: LayoutGrid },
  { value: "list", label: "List", icon: List },
  { value: "map", label: "Map", icon: MapIcon },
];

const SELECT_CLASS =
  "h-10 rounded-full border border-border bg-background px-3 text-sm outline-none focus-visible:border-primary";

const STEP = 5 * 100_000; // budget slider moves in 5 lakh steps

type PropertiesViewProps = {
  properties: PropertyRow[];
  leads: MatchLead[];
};

export function PropertiesView({ properties, leads }: PropertiesViewProps) {
  const [view, setView] = useState<ViewMode>("grid");
  const [city, setCity] = useState("all");
  const [bhk, setBhk] = useState<number | null>(null);
  const [status, setStatus] = useState<"all" | PropertyStatus>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const bounds = useMemo(() => {
    if (properties.length === 0) return { min: 0, max: STEP };
    const prices = properties.map((p) => p.price_inr);
    return {
      min: Math.floor(Math.min(...prices) / STEP) * STEP,
      max: Math.ceil(Math.max(...prices) / STEP) * STEP,
    };
  }, [properties]);

  const [maxPrice, setMaxPrice] = useState(bounds.max);

  const cities = useMemo(
    () => [...new Set(properties.map((p) => p.city))].sort(),
    [properties]
  );

  const filtered = useMemo(
    () =>
      properties.filter(
        (p) =>
          (city === "all" || p.city === city) &&
          (bhk === null || p.bhk === bhk) &&
          (status === "all" || p.status === status) &&
          p.price_inr <= maxPrice
      ),
    [properties, city, bhk, status, maxPrice]
  );

  const selected = properties.find((p) => p.id === selectedId) ?? null;
  const filtersActive =
    city !== "all" || bhk !== null || status !== "all" || maxPrice < bounds.max;

  function resetFilters() {
    setCity("all");
    setBhk(null);
    setStatus("all");
    setMaxPrice(bounds.max);
  }

  if (properties.length === 0) {
    return (
      <GlassCard className="p-8 text-center">
        <h2 className="font-serif text-xl">No properties yet</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Run <code>npm run seed</code> to load the demo inventory.
        </p>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-5">
      {/* Filters */}
      <GlassCard className="space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div
            role="radiogroup"
            aria-label="View mode"
            className="inline-flex rounded-full bg-secondary p-1"
          >
            {VIEWS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={view === value}
                onClick={() => setView(value)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
                  view === value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="size-3.5" aria-hidden />
                {label}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            City
            <select value={city} onChange={(e) => setCity(e.target.value)} className={SELECT_CLASS}>
              <option value="all">All cities</option>
              {cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Status
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as "all" | PropertyStatus)}
              className={SELECT_CLASS}
            >
              <option value="all">All</option>
              <option value="available">Available</option>
              <option value="few_left">Few left</option>
              <option value="sold">Sold</option>
            </select>
          </label>

          <div role="group" aria-label="Filter by BHK" className="flex items-center gap-1.5">
            <span className="mr-1 text-xs text-muted-foreground">BHK</span>
            {[null, 1, 2, 3, 4].map((value) => (
              <button
                key={value ?? "any"}
                type="button"
                aria-pressed={bhk === value}
                onClick={() => setBhk(value)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                  bhk === value
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                )}
              >
                {value === null ? "Any" : value}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="min-w-60 flex-1">
            <label htmlFor="budget-slider" className="flex justify-between text-xs">
              <span className="text-muted-foreground">Max budget</span>
              <span className="font-semibold">{formatInr(maxPrice)}</span>
            </label>
            <input
              id="budget-slider"
              type="range"
              min={bounds.min}
              max={bounds.max}
              step={STEP}
              value={maxPrice}
              onChange={(e) => setMaxPrice(Number(e.target.value))}
              className="mt-1 w-full accent-primary"
            />
          </div>

          <div className="flex items-center gap-3">
            <p className="text-xs text-muted-foreground" aria-live="polite">
              Showing {filtered.length} of {properties.length}
            </p>
            {filtersActive && (
              <button
                type="button"
                onClick={resetFilters}
                className="rounded-full bg-secondary px-3 py-1.5 text-xs font-medium hover:bg-accent"
              >
                Reset filters
              </button>
            )}
          </div>
        </div>
      </GlassCard>

      {/* Results */}
      {filtered.length === 0 ? (
        <GlassCard className="p-8 text-center">
          <h2 className="font-serif text-xl">No properties match these filters</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Try a higher budget or a different BHK.
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="mt-4 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-gold-hover"
          >
            Reset filters
          </button>
        </GlassCard>
      ) : view === "map" ? (
        <PropertyMap
          properties={filtered}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      ) : (
        <ul
          className={cn(
            view === "grid"
              ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
              : "flex flex-col gap-3"
          )}
        >
          {filtered.map((p) => (
            <li key={p.id} className="flex">
              <PropertyCard
                property={p}
                variant={view === "grid" ? "grid" : "list"}
                selected={p.id === selectedId}
                onSelect={(prop) => setSelectedId(prop.id)}
              />
            </li>
          ))}
        </ul>
      )}

      <PropertyDrawer
        property={selected}
        leads={leads}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}