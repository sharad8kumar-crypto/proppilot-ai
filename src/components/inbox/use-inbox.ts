"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import type { LeadSource } from "@/types";
import type { LeadRow, MessageRow } from "@/types/db";

export type AgentRow = { id: string; name: string; color: string };

// A message the user just typed, shown instantly before the server confirms it
export type PendingMessage = {
  id: string;
  sender: "lead" | "agent";
  content: string;
  created_at: string;
};

export const NEW_LEAD = "new"; // special selection: show the "new lead" form

function errorText(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return String(err);
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// Realtime can deliver bigint columns as strings; make sure they are numbers
function normalizeLead(row: LeadRow): LeadRow {
  return {
    ...row,
    budget_min: toNumber(row.budget_min),
    budget_max: toNumber(row.budget_max),
    deal_value_estimate: toNumber(row.deal_value_estimate),
  };
}

export function useInbox() {
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [latest, setLatest] = useState<Record<string, MessageRow>>({});
  const [unread, setUnread] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [pending, setPending] = useState<PendingMessage[]>([]);
  const [aiTyping, setAiTyping] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  // Ref so realtime callbacks always see the current selection
  const selectedRef = useRef<string | null>(null);

  const upsertLead = useCallback((row: LeadRow) => {
    const lead = normalizeLead(row);
    setLeads((prev) => {
      const index = prev.findIndex((l) => l.id === lead.id);
      if (index === -1) return [lead, ...prev];
      const copy = [...prev];
      copy[index] = lead;
      return copy;
    });
  }, []);

  const loadThread = useCallback(async (leadId: string) => {
    const db = getSupabaseBrowser();
    const { data, error: loadError } = await db
      .from("messages")
      .select("*")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: true })
      .limit(200);
    if (loadError) throw loadError;
    // ignore the result if the user already switched to another lead
    if (selectedRef.current === leadId) {
      setMessages((data ?? []) as MessageRow[]);
    }
  }, []);

  const select = useCallback(
    (id: string | null) => {
      selectedRef.current = id;
      setSelectedId(id);
      setMessages([]);
      setSendError(null);
      if (id && id !== NEW_LEAD) {
        setUnread((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        setMessagesLoading(true);
        loadThread(id)
          .catch((e) => setError(errorText(e)))
          .finally(() => setMessagesLoading(false));
      }
    },
    [loadThread]
  );

  // Re-read one lead + its thread from the database (used after sending)
  const refreshLead = useCallback(
    async (leadId: string) => {
      const db = getSupabaseBrowser();
      const [leadRes, msgRes] = await Promise.all([
        db.from("leads").select("*").eq("id", leadId).maybeSingle(),
        db
          .from("messages")
          .select("*")
          .eq("lead_id", leadId)
          .order("created_at", { ascending: true })
          .limit(200),
      ]);
      if (leadRes.data) upsertLead(leadRes.data as LeadRow);
      if (msgRes.data) {
        const rows = msgRes.data as MessageRow[];
        if (rows.length > 0) {
          setLatest((prev) => ({ ...prev, [leadId]: rows[rows.length - 1] }));
        }
        if (selectedRef.current === leadId) setMessages(rows);
      }
    },
    [upsertLead]
  );

  // ---- Initial load ----
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const db = getSupabaseBrowser();
        const [leadsRes, agentsRes, msgsRes] = await Promise.all([
          db.from("leads").select("*").order("created_at", { ascending: false }).limit(150),
          db.from("agents").select("id, name, color"),
          db.from("messages").select("*").order("created_at", { ascending: false }).limit(300),
        ]);
        for (const res of [leadsRes, agentsRes, msgsRes]) {
          if (res.error) throw res.error;
        }
        if (cancelled) return;

        const leadRows = ((leadsRes.data ?? []) as LeadRow[]).map(normalizeLead);
        const latestMap: Record<string, MessageRow> = {};
        for (const m of (msgsRes.data ?? []) as MessageRow[]) {
          if (!latestMap[m.lead_id]) latestMap[m.lead_id] = m; // newest first
        }

        setLeads(leadRows);
        setAgents((agentsRes.data ?? []) as AgentRow[]);
        setLatest(latestMap);
        setLoading(false);

        // On desktop, open the most recently active conversation straight away
        if (window.matchMedia("(min-width: 1024px)").matches) {
          const withChat = leadRows
            .filter((l) => latestMap[l.id])
            .sort(
              (a, b) =>
                new Date(latestMap[b.id].created_at).getTime() -
                new Date(latestMap[a.id].created_at).getTime()
            );
          select((withChat[0] ?? leadRows[0])?.id ?? null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(errorText(e));
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [select]);

  // ---- Realtime: new/updated leads and new messages ----
  useEffect(() => {
    const db = getSupabaseBrowser();

    const channel = db
      .channel("inbox-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leads" },
        (payload) => {
          if (payload.eventType === "DELETE") return;
          upsertLead(payload.new as LeadRow);
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const msg = payload.new as MessageRow;
          setLatest((prev) => ({ ...prev, [msg.lead_id]: msg }));

          if (msg.lead_id === selectedRef.current) {
            setMessages((prev) =>
              prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]
            );
            // the server confirmed this message, so drop the instant copy
            setPending((prev) =>
              prev.filter((p) => !(p.sender === msg.sender && p.content === msg.content))
            );
          } else if (msg.sender === "lead") {
            setUnread((prev) => new Set(prev).add(msg.lead_id));
          }
        }
      )
      .subscribe((status) => setLive(status === "SUBSCRIBED"));

    return () => {
      void db.removeChannel(channel);
    };
  }, [upsertLead]);

  // ---- Sending ----
  const send = useCallback(
    async (leadId: string, content: string, as: "buyer" | "agent") => {
      const tempId = `tmp-${Date.now()}`;
      setSendError(null);
      setPending((prev) => [
        ...prev,
        {
          id: tempId,
          sender: as === "buyer" ? "lead" : "agent",
          content,
          created_at: new Date().toISOString(),
        },
      ]);
      if (as === "buyer") setAiTyping(true);

      try {
        const res =
          as === "buyer"
            ? await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ lead_id: leadId, message: content }),
              })
            : await fetch(`/api/leads/${leadId}/messages`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content }),
              });

        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          setSendError(data?.error ?? "Could not send the message. Please try again.");
        }
      } catch {
        setSendError("Network error. Please check your connection and try again.");
      } finally {
        await refreshLead(leadId).catch(() => undefined);
        setPending((prev) => prev.filter((p) => p.id !== tempId));
        setAiTyping(false);
      }
    },
    [refreshLead]
  );

  // Creates a brand-new lead from a first message. Returns an error text, or null on success.
  const startNewLead = useCallback(
    async (source: LeadSource, message: string): Promise<string | null> => {
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source, message }),
        });
        const data = (await res.json().catch(() => null)) as
          | { lead_id?: string; error?: string }
          | null;
        if (!res.ok || !data?.lead_id) {
          return data?.error ?? "Could not start the conversation.";
        }
        await refreshLead(data.lead_id);
        select(data.lead_id);
        return null;
      } catch {
        return "Network error. Please try again.";
      }
    },
    [refreshLead, select]
  );

  const selectedLead = useMemo(
    () => leads.find((l) => l.id === selectedId) ?? null,
    [leads, selectedId]
  );

  // Most recently active conversations first
  const sortedLeads = useMemo(() => {
    const activity = (l: LeadRow) =>
      new Date(latest[l.id]?.created_at ?? l.created_at).getTime();
    return [...leads].sort((a, b) => activity(b) - activity(a));
  }, [leads, latest]);

  return {
    leads: sortedLeads,
    agents,
    latest,
    unread,
    loading,
    error,
    live,
    selectedId,
    selectedLead,
    messages,
    messagesLoading,
    pending,
    aiTyping,
    sendError,
    select,
    send,
    startNewLead,
  };
}