"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  FastForward,
  Loader2,
  Presentation,
  RotateCcw,
  SlidersHorizontal,
  UserPlus,
  X,
} from "lucide-react";
import { SOURCE_LABEL, SOURCE_ORDER } from "@/lib/analytics-config";
import {
  DEMO_SCENARIOS,
  DEMO_SCENARIO_ORDER,
  isDemoScenario,
  type DemoScenario,
} from "@/lib/demo-scenarios";
import { usePresenter } from "@/lib/presenter";
import { useStoredValue } from "@/lib/use-stored-value";
import { cn } from "@/lib/utils";
import type { LeadSource } from "@/types";

type Notice = { kind: "ok" | "error"; text: string };

const FIELD =
  "h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus-visible:border-primary";
const ACTION =
  "flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-gold-hover disabled:cursor-not-allowed disabled:opacity-50";
const SECONDARY =
  "flex items-center justify-center gap-2 rounded-full bg-secondary px-4 py-2.5 text-sm font-medium transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50";

export function DemoControlPanel() {
  const router = useRouter();
  const { setPresenter } = usePresenter();
  const [adminKey, setAdminKey] = useStoredValue("proppilot:admin-key", "session");

  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<LeadSource>("99acres");
  const [scenario, setScenario] = useState<DemoScenario>("serious");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  async function postJson(url: string, body?: unknown, admin = false) {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(admin && adminKey ? { "x-admin-key": adminKey } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!res.ok) {
      throw new Error(
        typeof data?.error === "string" ? data.error : "Something went wrong. Please try again."
      );
    }
    return data ?? {};
  }

  // Runs one action: shows progress, then the result, then refreshes the open page
  async function act(name: string, fn: () => Promise<string>) {
    setBusy(name);
    setNotice(null);
    try {
      const text = await fn();
      setNotice({ kind: "ok", text });
      router.refresh();
    } catch (err) {
      setNotice({
        kind: "error",
        text: err instanceof Error ? err.message : "Something went wrong.",
      });
    } finally {
      setBusy(null);
    }
  }

  const simulate = () =>
    act("simulate", async () => {
      const data = await postJson("/api/demo/simulate-lead", { source, scenario }, true);
      return `Lead created: ${String(data.name)} (${String(data.temperature)}, score ${String(data.score)}). Open the Inbox to see the chat.`;
    });

  const fastForward = (days: number) =>
    act(`ff-${days}`, async () => {
      const data = await postJson(`/api/followups/fast-forward?days=${days}`);
      const sent = Array.isArray(data.processed) ? data.processed.length : 0;
      const alerts = Array.isArray(data.alerts) ? data.alerts.length : 0;
      return `+${days} day${days === 1 ? "" : "s"}: ${sent} follow-up${sent === 1 ? "" : "s"} sent${alerts > 0 ? `, ${alerts} Hot lead alert${alerts === 1 ? "" : "s"}` : ""}.`;
    });

  const hotAlert = () =>
    act("alert", async () => {
      const data = await postJson("/api/demo/hot-untouched", undefined, true);
      return `Alert raised: ${String(data.lead_name)} untouched for ${String(data.hours)}h.`;
    });

  const reset = () => {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    setConfirmReset(false);
    void act("reset", async () => {
      const data = await postJson("/api/demo/reset", undefined, true);
      return `Demo data reset: ${String(data.leads)} leads, ${String(data.properties)} properties, ${String(data.agents)} agents.`;
    });
  };

  const disabled = busy !== null;

  return (
    <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-3">
      <AnimatePresence>
        {open && (
          <motion.div
            id="demo-control-panel"
            role="dialog"
            aria-label="Demo control panel"
            initial={{ opacity: 0, y: 10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97 }}
            transition={{ duration: 0.18 }}
            className="glass-card max-h-[calc(100dvh-8rem)] w-[min(22rem,calc(100vw-2.5rem))] overflow-y-auto p-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <p className="font-serif text-lg">Demo Control</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close demo control panel"
                className="rounded-md p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Admin key */}
            <div className="mt-3">
              <label htmlFor="admin-key" className="text-xs font-medium">
                Admin key
              </label>
              <input
                id="admin-key"
                type="password"
                autoComplete="off"
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                placeholder="DEMO_ADMIN_KEY"
                className={cn(FIELD, "mt-1")}
              />
              <p className="mt-1 text-[11px] text-faint">
                Needed for Simulate, Alert and Reset. Kept in this tab only.
              </p>
            </div>

            {/* Simulate */}
            <section className="mt-4 space-y-2.5 border-t border-border pt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Simulate new lead
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-[11px] text-muted-foreground">
                  Source
                  <select
                    value={source}
                    onChange={(e) => setSource(e.target.value as LeadSource)}
                    className={cn(FIELD, "mt-1")}
                  >
                    {SOURCE_ORDER.map((s) => (
                      <option key={s} value={s}>
                        {SOURCE_LABEL[s]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-[11px] text-muted-foreground">
                  Scenario
                  <select
                    value={scenario}
                    onChange={(e) => {
                      if (isDemoScenario(e.target.value)) setScenario(e.target.value);
                    }}
                    className={cn(FIELD, "mt-1")}
                  >
                    {DEMO_SCENARIO_ORDER.map((s) => (
                      <option key={s} value={s}>
                        {DEMO_SCENARIOS[s].label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <p className="text-[11px] text-faint">
                Usually turns out {DEMO_SCENARIOS[scenario].expect}.
              </p>
              <button type="button" onClick={simulate} disabled={disabled} className={ACTION}>
                {busy === "simulate" ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <UserPlus className="size-4" aria-hidden />
                )}
                {busy === "simulate" ? "Creating lead..." : "Simulate lead"}
              </button>
            </section>

            {/* Time */}
            <section className="mt-4 space-y-2.5 border-t border-border pt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Fast-forward time
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {[1, 3, 7].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => fastForward(d)}
                    disabled={disabled}
                    className={SECONDARY}
                  >
                    {busy === `ff-${d}` ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : (
                      <FastForward className="size-4" aria-hidden />
                    )}
                    +{d}d
                  </button>
                ))}
              </div>
              <button type="button" onClick={hotAlert} disabled={disabled} className={cn(SECONDARY, "w-full")}>
                {busy === "alert" ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <AlertTriangle className="size-4" aria-hidden />
                )}
                Hot lead untouched 48h alert
              </button>
            </section>

            {/* Reset + presenter */}
            <section className="mt-4 space-y-2.5 border-t border-border pt-4">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={reset}
                  disabled={disabled}
                  className={cn(
                    SECONDARY,
                    "flex-1",
                    confirmReset && "bg-danger text-white hover:bg-danger/90"
                  )}
                >
                  {busy === "reset" ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <RotateCcw className="size-4" aria-hidden />
                  )}
                  {confirmReset ? "Click again to confirm" : "Reset demo data"}
                </button>
                {confirmReset && (
                  <button
                    type="button"
                    onClick={() => setConfirmReset(false)}
                    className="rounded-full px-3 text-sm text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setPresenter(true);
                }}
                className={cn(SECONDARY, "w-full")}
              >
                <Presentation className="size-4" aria-hidden />
                Presenter mode
              </button>
              <p className="text-[11px] text-faint">
                Presenter mode hides this panel. Press Alt + Shift + P to bring it back.
              </p>
            </section>

            {notice && (
              <p
                role={notice.kind === "error" ? "alert" : "status"}
                className={cn(
                  "mt-4 rounded-xl px-3 py-2 text-xs leading-relaxed",
                  notice.kind === "error" ? "bg-danger/10 text-danger" : "bg-success/10 text-success"
                )}
              >
                {notice.text}
              </p>
            )}

            <p className="mt-3 text-[11px] text-faint">Demo environment.</p>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="demo-control-panel"
        aria-label="Toggle demo control panel"
        className="grid size-12 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-black/20 transition-colors hover:bg-gold-hover"
      >
        <SlidersHorizontal className="size-5" />
      </button>
    </div>
  );
}