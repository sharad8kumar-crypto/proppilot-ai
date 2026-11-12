"use client";

import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { LIBRARY, type LibraryItem } from "@/lib/workflow";
import { cn } from "@/lib/utils";
import { KIND_META } from "./node-meta";

type NodeLibraryProps = {
  disabled: boolean;
  onAdd: (item: LibraryItem) => void;
};

export function NodeLibrary({ disabled, onAdd }: NodeLibraryProps) {
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return LIBRARY.map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          q === "" ||
          item.title.toLowerCase().includes(q) ||
          item.subtitle.toLowerCase().includes(q)
      ),
    })).filter((group) => group.items.length > 0);
  }, [query]);

  return (
    <section
      aria-label="Node library"
      className="flex max-h-[680px] flex-col rounded-2xl border border-border bg-muted p-4"
    >
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Node library
      </h2>

      <div className="relative mt-3">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint"
          aria-hidden
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search nodes"
          placeholder="Search nodes..."
          className="h-10 w-full rounded-full border border-border bg-background pl-9 pr-3 text-sm outline-none placeholder:text-faint focus-visible:border-primary"
        />
      </div>

      <div className="mt-4 min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
        {groups.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">No nodes match.</p>
        )}

        {groups.map((group) => (
          <div key={group.category}>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-faint">
              {group.category}
            </h3>
            <ul className="space-y-2">
              {group.items.map((item) => {
                const meta = KIND_META[item.kind];
                const Icon = meta.icon;
                return (
                  <li key={`${item.kind}-${item.title}`}>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => onAdd(item)}
                      aria-label={`Add ${item.title} to the canvas`}
                      className="flex w-full items-center gap-2.5 rounded-xl border border-border bg-surface p-2.5 text-left transition-colors hover:border-primary disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span
                        className={cn(
                          "grid size-8 shrink-0 place-items-center rounded-lg",
                          meta.tone
                        )}
                      >
                        <Icon className="size-4" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold">
                          {item.title}
                        </span>
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {item.subtitle}
                        </span>
                      </span>
                      <Plus className="size-4 shrink-0 text-faint" aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-faint">
        Click a node to add it to the canvas. Added nodes are for design only; Run test uses the
        ready-made flow.
      </p>
    </section>
  );
}