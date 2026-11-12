"use client";

import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { SourceBadge, TemperatureBadge } from "@/components/shared/badges";
import { initialsOf, leadDisplayName, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Temperature } from "@/types";
import type { LeadRow, MessageRow } from "@/types/db";

type Filter = "all" | Temperature;

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "hot", label: "Hot" },
  { value: "warm", label: "Warm" },
  { value: "cold", label: "Cold" },
];

type ConversationListProps = {
  leads: LeadRow[];
  latest: Record<string, MessageRow>;
  unread: Set<string>;
  selectedId: string | null;
  loading: boolean;
  live: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
  className?: string;
};

export function ConversationList({
  leads,
  latest,
  unread,
  selectedId,
  loading,
  live,
  onSelect,
  onNew,
  className,
}: ConversationListProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads.filter((lead) => {
      if (filter !== "all" && lead.temperature !== filter) return false;
      if (!q) return true;
      const haystack = [
        lead.name ?? "new lead",
        lead.summary ?? "",
        lead.preferred_locations.join(" "),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [leads, query, filter]);

  return (
    <section
      aria-label="Conversations"
      className={cn(
        "min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-muted",
        className
      )}
    >
      <div className="space-y-3 border-b border-border p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-lg">Conversations</h2>
          <div className="flex items-center gap-2">
            <span
              className="flex items-center gap-1.5 text-xs text-muted-foreground"
              title={live ? "Realtime connected" : "Realtime not connected"}
            >
              <span
                className={cn("size-1.5 rounded-full", live ? "bg-success" : "bg-faint")}
                aria-hidden
              />
              {live ? "Live" : "Offline"}
            </span>
            <button
              type="button"
              onClick={onNew}
              aria-label="Start a new demo lead"
              className="grid size-8 place-items-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-gold-hover"
            >
              <Plus className="size-4" />
            </button>
          </div>
        </div>

        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search conversations"
            placeholder="Search leads..."
            className="h-10 w-full rounded-full border border-border bg-background pl-9 pr-3 text-sm outline-none placeholder:text-faint focus-visible:border-primary"
          />
        </div>

        <div role="group" aria-label="Filter by temperature" className="flex gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              aria-pressed={filter === f.value}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                filter === f.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground hover:text-foreground"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <ul className="min-h-0 flex-1 divide-y divide-border overflow-y-auto">
        {loading &&
          Array.from({ length: 6 }).map((_, i) => (
            <li key={i} className="flex gap-3 px-4 py-3">
              <span className="size-10 animate-pulse rounded-full bg-surface-2" />
              <span className="flex-1 space-y-2">
                <span className="block h-3 w-1/2 animate-pulse rounded bg-surface-2" />
                <span className="block h-3 w-3/4 animate-pulse rounded bg-surface-2" />
              </span>
            </li>
          ))}

        {!loading && visible.length === 0 && (
          <li className="p-6 text-center text-sm text-muted-foreground">
            No conversations match.
          </li>
        )}

        {!loading &&
          visible.map((lead) => {
            const last = latest[lead.id];
            const active = lead.id === selectedId;
            const preview = last
              ? `${last.sender === "ai" ? "AI: " : last.sender === "agent" ? "You: " : ""}${last.content}`
              : (lead.summary ?? "No messages yet");

            return (
              <li key={lead.id}>
                <button
                  type="button"
                  onClick={() => onSelect(lead.id)}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "flex w-full gap-3 px-4 py-3 text-left transition-colors",
                    active ? "bg-background" : "hover:bg-background/60"
                  )}
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold">
                    {initialsOf(lead.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold">
                        {leadDisplayName(lead)}
                      </span>
                      <span className="shrink-0 text-[11px] text-faint">
                        {timeAgo(last?.created_at ?? lead.created_at)}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {preview}
                    </span>
                    <span className="mt-1.5 flex items-center gap-1.5">
                      <SourceBadge source={lead.source} />
                      <TemperatureBadge temperature={lead.temperature} />
                      {unread.has(lead.id) && (
                        <>
                          <span
                            className="ml-auto size-2 rounded-full bg-info"
                            aria-hidden
                          />
                          <span className="sr-only">Unread messages</span>
                        </>
                      )}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
      </ul>
    </section>
  );
}