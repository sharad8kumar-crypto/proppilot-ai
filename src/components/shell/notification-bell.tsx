"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Bell, CalendarCheck, Flame, type LucideIcon } from "lucide-react";
import { timeAgo } from "@/lib/format";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

// Events that deserve a notification (the rest stay in the activity feed only)
const TYPES = ["hot_lead", "hot_untouched", "visit_booked"];
const STORAGE_KEY = "proppilot:notifications:lastSeen";
const MAX_ITEMS = 15;

type EventRow = {
  id: string;
  type: string;
  payload: Record<string, unknown> | null;
  created_at: string;
};

type Notice = {
  id: string;
  type: string;
  title: string;
  detail: string;
  href: string;
  createdAt: string;
};

const ICONS: Record<string, { icon: LucideIcon; tone: string }> = {
  hot_lead: { icon: Flame, tone: "bg-danger/10 text-danger" },
  hot_untouched: { icon: AlertTriangle, tone: "bg-warning/10 text-warning" },
  visit_booked: { icon: CalendarCheck, tone: "bg-success/10 text-success" },
};

const asText = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);

function toNotice(row: EventRow): Notice | null {
  const name = asText(row.payload?.name) ?? "A lead";

  switch (row.type) {
    case "hot_lead": {
      const score = row.payload?.score;
      return {
        id: row.id,
        type: row.type,
        title: `Hot lead: ${name}${typeof score === "number" ? ` (score ${score})` : ""}`,
        detail: "Follow up now to keep the momentum.",
        href: "/inbox",
        createdAt: row.created_at,
      };
    }
    case "hot_untouched": {
      const hours = row.payload?.hours;
      return {
        id: row.id,
        type: row.type,
        title: `${name} is untouched`,
        detail:
          typeof hours === "number"
            ? `No human touch for ${hours}h. Revenue at risk.`
            : "No human touch for 48h or more.",
        href: "/pipeline",
        createdAt: row.created_at,
      };
    }
    case "visit_booked": {
      const when = asText(row.payload?.when);
      const agent = asText(row.payload?.agent);
      return {
        id: row.id,
        type: row.type,
        title: `Site visit booked: ${name}`,
        detail: [when, agent ? `Agent ${agent}` : null].filter(Boolean).join(" · ") || "See the calendar.",
        href: "/calendar",
        createdAt: row.created_at,
      };
    }
    default:
      return null;
  }
}

// Remembers (in this browser) when you last looked. First visit starts at "now",
// so old seeded events do not show up as unread.
function readLastSeen(): number {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const n = Number(stored);
      if (Number.isFinite(n)) return n;
    }
    const now = Date.now();
    window.localStorage.setItem(STORAGE_KEY, String(now));
    return now;
  } catch {
    return Date.now();
  }
}

function writeLastSeen(value: number) {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(value));
  } catch {
    // storage can be blocked; the bell still works for this session
  }
}

export function NotificationBell() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [lastSeen, setLastSeen] = useState<number | null>(null);
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const markRead = useCallback(() => {
    const now = Date.now();
    writeLastSeen(now);
    setLastSeen(now);
    setFreshIds(new Set());
  }, []);

  // Load the latest notifications
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const db = getSupabaseBrowser();
        const { data, error } = await db
          .from("activity_events")
          .select("id,type,payload,created_at")
          .in("type", TYPES)
          .order("created_at", { ascending: false })
          .limit(MAX_ITEMS);
        if (error || cancelled) return;

        const items = ((data ?? []) as EventRow[])
          .map(toNotice)
          .filter((n): n is Notice => n !== null);
        setNotices(items);
        setLastSeen(readLastSeen());
      } catch {
        // the bell stays empty if the database is unreachable
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

    // New alerts arrive live (optional: if Supabase is not configured, the bell just stays quiet)
  useEffect(() => {
    let cleanup: (() => void) | undefined;

    try {
      const db = getSupabaseBrowser();

      const channel = db
        .channel("notifications-bell")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "activity_events" },
          (payload) => {
            const notice = toNotice(payload.new as EventRow);
            if (!notice) return;
            setNotices((prev) =>
              prev.some((n) => n.id === notice.id) ? prev : [notice, ...prev].slice(0, MAX_ITEMS)
            );
            setFreshIds((prev) => new Set(prev).add(notice.id));
          }
        )
        .subscribe();

      cleanup = () => {
        void db.removeChannel(channel);
      };
    } catch {
      // Realtime is a bonus feature, so a missing key must never crash the whole app
    }

    return () => cleanup?.();
  }, []);

  // Close on outside click or Escape (and mark everything as read)
  useEffect(() => {
    if (!open) return;

    const close = () => {
      setOpen(false);
      markRead();
    };
    const onPointerDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) close();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, markRead]);

  const isUnread = (n: Notice) =>
    freshIds.has(n.id) || (lastSeen !== null && new Date(n.createdAt).getTime() > lastSeen);
  const unread = notices.filter(isUnread).length;

  function toggle() {
    if (open) {
      setOpen(false);
      markRead();
    } else {
      setOpen(true);
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
        aria-controls="notification-panel"
        className="relative grid size-10 place-items-center rounded-full bg-secondary text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <Bell className="size-[18px]" />
        {unread > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-danger px-1 text-[10px] font-semibold leading-5 text-white ring-2 ring-background"
            aria-hidden
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          id="notification-panel"
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 top-12 z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="font-serif text-base">Notifications</h2>
            {unread > 0 && (
              <button
                type="button"
                onClick={markRead}
                className="text-xs font-medium underline-offset-2 hover:underline"
              >
                Mark all as read
              </button>
            )}
          </div>

          {notices.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              No alerts yet. Hot leads, untouched leads and booked visits will appear here.
            </p>
          ) : (
            <ul className="max-h-96 divide-y divide-border overflow-y-auto">
              {notices.map((n) => {
                const meta = ICONS[n.type] ?? ICONS.hot_lead;
                const Icon = meta.icon;
                const ago = timeAgo(n.createdAt);

                return (
                  <li key={n.id}>
                    <Link
                      href={n.href}
                      onClick={() => {
                        setOpen(false);
                        markRead();
                      }}
                      className={cn(
                        "flex gap-3 px-4 py-3 transition-colors hover:bg-secondary",
                        isUnread(n) && "bg-secondary/60"
                      )}
                    >
                      <span
                        className={cn(
                          "grid size-8 shrink-0 place-items-center rounded-full",
                          meta.tone
                        )}
                      >
                        <Icon className="size-4" aria-hidden />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium leading-snug">{n.title}</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {n.detail}
                        </span>
                        <span className="mt-1 block text-[11px] text-faint">
                          {ago === "now" ? "just now" : `${ago} ago`}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}