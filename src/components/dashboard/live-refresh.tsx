"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase/browser";

// Renders nothing. Listens for database changes and re-runs the server page
// (debounced), so the dashboard updates itself without a manual refresh.
export function LiveRefresh() {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const db = getSupabaseBrowser();

    const refresh = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), 800);
    };

    const channel = db
      .channel("dashboard-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, refresh)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "activity_events" },
        refresh
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "site_visits" },
        refresh
      )
      .subscribe();

    return () => {
      if (timer.current) clearTimeout(timer.current);
      void db.removeChannel(channel);
    };
  }, [router]);

  return null;
}