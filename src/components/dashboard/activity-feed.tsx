"use client";

import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRightLeft,
  Building2,
  CalendarCheck,
  Flame,
  MessageSquare,
  Sparkles,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { GlassCard } from "@/components/shell/glass-card";
import type { ActivityEvent, ActivityType } from "@/types";

const config: Record<ActivityType, { icon: LucideIcon; tone: string }> = {
  lead_created: { icon: UserPlus, tone: "bg-info/10 text-info" },
  ai_qualified: { icon: Sparkles, tone: "bg-primary/10 text-foreground" },
  property_matched: { icon: Building2, tone: "bg-primary/10 text-foreground" },
  visit_booked: { icon: CalendarCheck, tone: "bg-success/10 text-success" },
  hot_alert: { icon: Flame, tone: "bg-danger/10 text-danger" },
  followup_sent: { icon: MessageSquare, tone: "bg-warning/10 text-warning" },
  hot_untouched: { icon: AlertTriangle, tone: "bg-danger/10 text-danger" },
  stage_changed: { icon: ArrowRightLeft, tone: "bg-secondary text-foreground" },
};

export function ActivityFeed({ events }: { events: ActivityEvent[] }) {
  return (
    <GlassCard className="flex h-full flex-col p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-xl">Live activity</h2>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="size-1.5 animate-pulse rounded-full bg-success" aria-hidden />
          Live
        </span>
      </div>

      {events.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No activity yet. New leads and AI actions will appear here.
        </p>
      ) : (
        <ul className="mt-5 space-y-4 lg:max-h-[640px] lg:overflow-y-auto lg:pr-1">
          {events.map((event, i) => {
            const { icon: Icon, tone } = config[event.type];
            return (
              <motion.li
                key={event.id}
                className="flex gap-3"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25, delay: 0.1 + i * 0.05, ease: "easeOut" }}
              >
                <span
                  className={`grid size-8 shrink-0 place-items-center rounded-full ${tone}`}
                >
                  <Icon className="size-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-snug">{event.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{event.detail}</p>
                  <p className="mt-1 text-[11px] text-faint">{event.timeAgo}</p>
                </div>
              </motion.li>
            );
          })}
        </ul>
      )}
    </GlassCard>
  );
}