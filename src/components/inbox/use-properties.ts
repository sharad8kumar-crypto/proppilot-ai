"use client";

import { useEffect, useState } from "react";
import { normalizeProperty } from "@/lib/matching";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import type { PropertyRow } from "@/types/db";

// Loads the (small) property list once so chat messages can show property cards by id
export function useProperties(): Record<string, PropertyRow> {
  const [byId, setById] = useState<Record<string, PropertyRow>>({});

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const db = getSupabaseBrowser();
      const { data, error } = await db.from("properties").select("*");
      if (error || !data || cancelled) return;

      const map: Record<string, PropertyRow> = {};
      for (const row of data as PropertyRow[]) {
        const property = normalizeProperty(row);
        map[property.id] = property;
      }
      setById(map);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return byId;
}