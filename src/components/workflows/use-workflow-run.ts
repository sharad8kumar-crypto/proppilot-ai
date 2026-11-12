"use client";

import { useCallback, useRef, useState } from "react";
import { rangeFor } from "@/lib/followups";
import { formatInr } from "@/lib/format";
import { SCORE_MAX } from "@/lib/scoring";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { CORE_NODES, NODE_IDS, SCENARIOS, SCORE_LABELS, type Scenario } from "@/lib/workflow";
import type { Temperature } from "@/types";
import type { LeadRow, ScoreBreakdown } from "@/types/db";

export type RunStatus = "idle" | "running" | "success" | "skipped" | "failed";

export type NodeRun = {
  status: RunStatus;
  detail: string;
  durationMs: number | null;
  startedAt: string | null;
  output: [string, string][];
};

export type EdgeRunState = "active" | "done";

export type LogRow = {
  step: number;
  nodeId: string;
  title: string;
  status: RunStatus;
  durationMs: number | null;
  startedAt: string;
  detail: string;
};

export type TestLead = {
  id: string;
  name: string;
  temperature: Temperature;
  score: number;
};

type ChatResponse = {
  lead_id: string;
  score: number;
  score_breakdown: ScoreBreakdown;
  temperature: Temperature;
  property_ids: string[];
  visit:
    | null
    | { status: "booked"; when: string; agent: string }
    | { status: "offered"; slots: string[] };
  ai_latency_ms: number;
  ai_ok: boolean;
  profile: {
    budget_min: number | null;
    budget_max: number | null;
    bhk: number | null;
    preferred_locations: string[];
    timeline: string;
    needs_loan: boolean | null;
    purpose: string;
  };
  error?: string;
};

type StepResult = {
  status: RunStatus;
  detail: string;
  durationMs?: number | null;
  output?: [string, string][];
};

const STEP_DELAY = 700; // so people can watch each node light up

const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));
const nowIso = () => new Date().toISOString();
const titleOf = (id: string) => CORE_NODES.find((n) => n.id === id)?.title ?? id;

const EMPTY_RUN: NodeRun = {
  status: "idle",
  detail: "",
  durationMs: null,
  startedAt: null,
  output: [],
};

function budgetOutput(p: ChatResponse["profile"]): string {
  if (p.budget_min !== null && p.budget_max !== null) {
    return `${formatInr(p.budget_min)} to ${formatInr(p.budget_max)}`;
  }
  const one = p.budget_max ?? p.budget_min;
  return one !== null ? `About ${formatInr(one)}` : "Not shared";
}

export function useWorkflowRun() {
  const [runs, setRuns] = useState<Record<string, NodeRun>>({});
  const [edgeStates, setEdgeStates] = useState<Record<string, EdgeRunState>>({});
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testLead, setTestLead] = useState<TestLead | null>(null);

  const runningRef = useRef(false);
  const stepRef = useRef(0);

  const reset = useCallback(() => {
    setRuns({});
    setEdgeStates({});
    setLogs([]);
    setError(null);
    setTestLead(null);
  }, []);

  const run = useCallback(async (scenario: Scenario) => {
    if (runningRef.current) return;
    runningRef.current = true;
    setRunning(true);
    setRuns({});
    setEdgeStates({});
    setLogs([]);
    setError(null);
    setTestLead(null);
    stepRef.current = 0;

    const cfg = SCENARIOS[scenario];
    let current: string = NODE_IDS.trigger;

    const setNode = (id: string, patch: Partial<NodeRun>) =>
      setRuns((prev) => ({ ...prev, [id]: { ...EMPTY_RUN, ...prev[id], ...patch } }));
    const setEdge = (id: string, state: EdgeRunState) =>
      setEdgeStates((prev) => ({ ...prev, [id]: state }));
    const addLog = (
      nodeId: string,
      status: RunStatus,
      detail: string,
      durationMs: number | null,
      startedAt: string
    ) => {
      stepRef.current += 1;
      const step = stepRef.current;
      setLogs((prev) => [
        ...prev,
        { step, nodeId, title: titleOf(nodeId), status, durationMs, startedAt, detail },
      ]);
    };

    // Lights up a node, waits a moment, then shows the real result
    const runStep = async (
      nodeId: string,
      edgeId: string | null,
      result: () => StepResult,
      startedAtOverride?: string
    ) => {
      current = nodeId;
      const startedAt = startedAtOverride ?? nowIso();
      if (edgeId) setEdge(edgeId, "active");
      setNode(nodeId, { status: "running", startedAt });
      await sleep(STEP_DELAY);
      const r = result();
      setNode(nodeId, {
        status: r.status,
        detail: r.detail,
        durationMs: r.durationMs ?? null,
        startedAt,
        output: r.output ?? [],
      });
      if (edgeId) setEdge(edgeId, "done");
      addLog(nodeId, r.status, r.detail, r.durationMs ?? null, startedAt);
    };

    try {
      // ---------- 1. A real conversation through /api/chat ----------
      const triggerStarted = nowIso();
      setNode(NODE_IDS.trigger, { status: "running", startedAt: triggerStarted });

      let leadId: string | undefined;
      let last: ChatResponse | null = null;
      let aiMs = 0;
      let aiReplies = 0;
      let propertiesSent = 0;
      let visit: ChatResponse["visit"] = null;
      let aiStarted = triggerStarted;

      for (let i = 0; i < cfg.messages.length; i++) {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: cfg.messages[i],
            ...(leadId ? { lead_id: leadId } : { source: cfg.source, name: cfg.leadName }),
          }),
        });
        const data = (await res.json().catch(() => null)) as ChatResponse | null;
        if (!res.ok || !data?.lead_id) {
          throw new Error(data?.error ?? "The test lead could not be created.");
        }

        leadId = data.lead_id;
        last = data;
        aiMs += data.ai_latency_ms ?? 0;
        aiReplies += 1;
        propertiesSent += data.property_ids?.length ?? 0;
        if (data.visit) visit = data.visit;

        if (i === 0) {
          // The lead exists now: the trigger fired
          setNode(NODE_IDS.trigger, {
            status: "success",
            detail: `Lead created from ${cfg.source}`,
            startedAt: triggerStarted,
            output: [
              ["Lead name", cfg.leadName],
              ["Source", cfg.source],
              ["First message", cfg.messages[0]],
            ],
          });
          addLog(NODE_IDS.trigger, "success", `Lead created from ${cfg.source}`, null, triggerStarted);

          aiStarted = nowIso();
          setEdge("e-trigger-ai", "active");
          current = NODE_IDS.ai;
          setNode(NODE_IDS.ai, { status: "running", startedAt: aiStarted });
        }
      }

      if (!leadId || !last) throw new Error("The test lead could not be created.");
      const finalChat = last;
      const finalLeadId = leadId;

      // ---------- 2. Read back what the pipeline really did ----------
      const db = getSupabaseBrowser();
      const [leadRes, followRes, eventRes, agentsRes] = await Promise.all([
        db.from("leads").select("*").eq("id", finalLeadId).maybeSingle(),
        db.from("followups").select("step,status").eq("lead_id", finalLeadId).lt("step", 90),
        db
          .from("activity_events")
          .select("type")
          .eq("lead_id", finalLeadId)
          .in("type", ["hot_lead", "property_matched"]),
        db.from("agents").select("id,name"),
      ]);

      const lead = (leadRes.data ?? null) as LeadRow | null;
      const followups = (followRes.data ?? []) as { step: number; status: string }[];
      const eventTypes = new Set(((eventRes.data ?? []) as { type: string }[]).map((e) => e.type));
      const agentName =
        ((agentsRes.data ?? []) as { id: string; name: string }[]).find(
          (a) => a.id === lead?.assigned_agent_id
        )?.name ?? null;

      const temperature = finalChat.temperature;
      const profile = finalChat.profile;
      const activeFollowups = (temp: "hot" | "warm" | "cold") => {
        const [min, max] = rangeFor(temp);
        return followups.filter((f) => f.step >= min && f.step <= max && f.status !== "cancelled")
          .length;
      };

      // ---------- 3. Walk the nodes in order ----------
      await runStep(
        NODE_IDS.ai,
        "e-trigger-ai",
        () => ({
          status: finalChat.ai_ok || aiReplies > 0 ? "success" : "failed",
          detail: `${aiReplies} message${aiReplies === 1 ? "" : "s"} understood, AI replied in ${Math.round(aiMs / aiReplies)} ms on average`,
          durationMs: aiMs,
          output: [
            ["Messages", String(aiReplies)],
            ["Budget", budgetOutput(profile)],
            ["BHK", profile.bhk !== null ? `${profile.bhk} BHK` : "Not shared"],
            [
              "Areas",
              profile.preferred_locations.length > 0
                ? profile.preferred_locations.join(", ")
                : "Not shared",
            ],
            ["Timeline", profile.timeline],
            [
              "Home loan",
              profile.needs_loan === null ? "Unknown" : profile.needs_loan ? "Yes" : "No",
            ],
          ],
        }),
        aiStarted
      );

      await runStep(NODE_IDS.score, "e-ai-score", () => ({
        status: "success",
        detail: `Score ${finalChat.score} out of 100`,
        output: (Object.keys(SCORE_MAX) as (keyof typeof SCORE_MAX)[]).map(
          (key) =>
            [
              SCORE_LABELS[key],
              `${finalChat.score_breakdown[key]} / ${SCORE_MAX[key]}`,
            ] as [string, string]
        ),
      }));

      await runStep(NODE_IDS.branch, "e-score-branch", () => ({
        status: "success",
        detail: `${temperature.charAt(0).toUpperCase()}${temperature.slice(1)} lead (score ${finalChat.score})`,
        output: [
          ["Score", String(finalChat.score)],
          ["Temperature", temperature],
        ],
      }));

      // Nodes on the branches that are not taken
      const hotNodes = [NODE_IDS.alert, NODE_IDS.assign, NODE_IDS.visit];
      const warmNodes = [NODE_IDS.matches, NODE_IDS.followup];
      const coldNodes = [NODE_IDS.nurture];
      const notTaken =
        temperature === "hot"
          ? [...warmNodes, ...coldNodes]
          : temperature === "warm"
            ? [...hotNodes, ...coldNodes]
            : [...hotNodes, ...warmNodes];
      for (const id of notTaken) {
        setNode(id, { status: "skipped", detail: `Not taken: this lead is ${temperature}` });
      }

      if (temperature === "hot") {
        await runStep(NODE_IDS.alert, "e-branch-alert", () =>
          eventTypes.has("hot_lead")
            ? {
                status: "success",
                detail: "Hot lead alert sent to the bell and the activity feed",
                output: [["Alert", `Hot lead: ${cfg.leadName}`]],
              }
            : { status: "skipped", detail: "No alert was recorded for this lead" }
        );

        await runStep(NODE_IDS.assign, "e-alert-assign", () =>
          agentName
            ? {
                status: "success",
                detail: `Assigned to ${agentName}`,
                output: [["Agent", agentName]],
              }
            : {
                status: "skipped",
                detail: "No agent yet. One is assigned when a visit is booked.",
              }
        );

        await runStep(NODE_IDS.visit, "e-assign-visit", () => {
          if (visit?.status === "booked") {
            return {
              status: "success",
              detail: `Visit booked: ${visit.when} with ${visit.agent}`,
              output: [
                ["When", visit.when],
                ["Agent", visit.agent],
              ],
            };
          }
          if (visit?.status === "offered") {
            return {
              status: "success",
              detail: `${visit.slots.length} slots offered to the buyer`,
              output: [["Slots offered", String(visit.slots.length)]],
            };
          }
          return { status: "skipped", detail: "The buyer has not asked for a visit yet" };
        });
      } else if (temperature === "warm") {
        await runStep(NODE_IDS.matches, "e-branch-matches", () =>
          propertiesSent > 0
            ? {
                status: "success",
                detail: `${propertiesSent} propert${propertiesSent === 1 ? "y" : "ies"} sent as cards`,
                output: [["Properties sent", String(propertiesSent)]],
              }
            : {
                status: "skipped",
                detail: "Waiting for BHK, budget and area before sending options",
              }
        );

        await runStep(NODE_IDS.followup, "e-matches-followup", () => {
          const count = activeFollowups("warm");
          return count > 0
            ? {
                status: "success",
                detail: `${count} follow-ups scheduled (Day 1, Day 3, Day 7)`,
                output: [["Follow-ups", String(count)]],
              }
            : { status: "skipped", detail: "No follow-up sequence was created" };
        });
      } else {
        await runStep(NODE_IDS.nurture, "e-branch-nurture", () => {
          const count = activeFollowups("cold");
          return count > 0
            ? {
                status: "success",
                detail: `${count} nurture messages scheduled (Day 2, Day 7, Day 14)`,
                output: [["Messages", String(count)]],
              }
            : { status: "skipped", detail: "No nurture sequence was created" };
        });
      }

      setTestLead({
        id: finalLeadId,
        name: lead?.name ?? cfg.leadName,
        temperature,
        score: finalChat.score,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "The test run failed.";
      setError(message);
      setNode(current, { status: "failed", detail: message });
      addLog(current, "failed", message, null, nowIso());
    } finally {
      runningRef.current = false;
      setRunning(false);
    }
  }, []);

  return { runs, edgeStates, logs, running, error, testLead, run, reset };
}