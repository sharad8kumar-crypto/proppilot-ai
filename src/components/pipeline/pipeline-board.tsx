"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { motion } from "framer-motion";
import { Clock } from "lucide-react";
import { SourceBadge } from "@/components/shared/badges";
import { budgetText } from "@/lib/budget";
import { formatInr, initialsOf } from "@/lib/format";
import { STAGES, isStage } from "@/lib/stages";
import { cn } from "@/lib/utils";
import type { Stage } from "@/types/db";
import type { PipelineLead } from "@/types/pipeline";
import { LeadDrawer } from "./lead-drawer";

const SCORE_STYLE = {
  hot: "bg-danger/10 text-danger ring-danger/25",
  warm: "bg-warning/10 text-warning ring-warning/25",
  cold: "bg-info/10 text-info ring-info/25",
} as const;

// pointerWithin feels natural for wide columns; rectIntersection is the fallback
const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length > 0 ? hits : rectIntersection(args);
};

const stop = (e: React.SyntheticEvent) => e.stopPropagation();

function CardBody({
  lead,
  onMove,
  onOpen,
}: {
  lead: PipelineLead;
  onMove?: (id: string, stage: Stage) => void;
  onOpen?: (id: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-3.5 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{lead.name}</p>
          <div className="mt-1">
            <SourceBadge source={lead.source} />
          </div>
        </div>
        <span
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-full bg-background font-serif text-sm ring-1",
            SCORE_STYLE[lead.temperature]
          )}
          title={`Lead score ${lead.score} out of 100`}
        >
          {lead.score}
        </span>
      </div>

      <p className="mt-2.5 text-xs text-muted-foreground">
        {lead.bhk ? `${lead.bhk} BHK` : "BHK not set"} · {budgetText(lead.budgetMin, lead.budgetMax)}
      </p>

      <div className="mt-2.5 flex items-center justify-between">
        <p className="font-serif text-base">{lead.dealValue > 0 ? formatInr(lead.dealValue) : "Value n/a"}</p>
        {lead.agent ? (
          <span
            className="grid size-7 place-items-center rounded-full text-[10px] font-semibold text-white"
            style={{ backgroundColor: lead.agent.color }}
            title={`Agent: ${lead.agent.name}`}
          >
            {initialsOf(lead.agent.name)}
          </span>
        ) : (
          <span className="text-[11px] text-faint">Unassigned</span>
        )}
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-border pt-2.5">
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Clock className="size-3" aria-hidden />
          {lead.daysInStage === 0 ? "Today" : `${lead.daysInStage}d in stage`}
        </span>

        {onMove && onOpen && (
          // Controls stop pointer events so they never start a drag
          <div
            className="flex items-center gap-1.5"
            onMouseDown={stop}
            onTouchStart={stop}
            onClick={stop}
          >
            <button
              type="button"
              onClick={() => onOpen(lead.id)}
              className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium hover:bg-accent"
            >
              Details
            </button>
            <select
              value={lead.stage}
              onChange={(e) => {
                if (isStage(e.target.value)) onMove(lead.id, e.target.value);
              }}
              aria-label={`Move ${lead.name} to another stage`}
              className="max-w-24 rounded-full border border-border bg-background px-2 py-1 text-[11px] outline-none focus-visible:border-primary"
            >
              {STAGES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}

function KanbanCard({
  lead,
  onMove,
  onOpen,
}: {
  lead: PipelineLead;
  onMove: (id: string, stage: Stage) => void;
  onOpen: (id: string) => void;
}) {
  const { setNodeRef, listeners, isDragging } = useDraggable({ id: lead.id });

  return (
    <li
      ref={setNodeRef}
      {...listeners}
      onClick={() => onOpen(lead.id)}
      className={cn("cursor-grab touch-manipulation active:cursor-grabbing", isDragging && "opacity-30")}
    >
      <CardBody lead={lead} onMove={onMove} onOpen={onOpen} />
    </li>
  );
}

function KanbanColumn({
  stage,
  label,
  leads,
  onMove,
  onOpen,
}: {
  stage: Stage;
  label: string;
  leads: PipelineLead[];
  onMove: (id: string, stage: Stage) => void;
  onOpen: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const total = leads.reduce((sum, l) => sum + l.dealValue, 0);

  return (
    <section
      ref={setNodeRef}
      aria-label={`${label} column`}
      className={cn(
        "flex w-72 shrink-0 flex-col rounded-2xl border bg-muted p-3 transition-colors",
        isOver ? "border-primary bg-secondary" : "border-border"
      )}
    >
      <header className="mb-3 px-1">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">{label}</h2>
          <span className="rounded-full bg-background px-2 py-0.5 text-xs font-medium tabular-nums">
            {leads.length}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{formatInr(total)} total</p>
      </header>

      <ul className="flex min-h-24 flex-1 flex-col gap-2.5">
        {leads.map((lead) => (
          <KanbanCard key={lead.id} lead={lead} onMove={onMove} onOpen={onOpen} />
        ))}
        {leads.length === 0 && (
          <li className="grid flex-1 place-items-center rounded-xl border border-dashed border-border p-4 text-center text-xs text-faint">
            Drop a lead here
          </li>
        )}
      </ul>
    </section>
  );
}

type Override = { from: Stage; to: Stage };

export function PipelineBoard({ leads }: { leads: PipelineLead[] }) {
  const router = useRouter();
  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  );

  // A moved card shows its new stage instantly. The override only applies while the
  // server still reports the old stage, so later server-side changes always win.
  const effective = useMemo(
    () =>
      leads.map((l) => {
        const o = overrides[l.id];
        return o && l.stage === o.from ? { ...l, stage: o.to, daysInStage: 0 } : l;
      }),
    [leads, overrides]
  );

  const byStage = useMemo(() => {
    const map = new Map<Stage, PipelineLead[]>();
    for (const s of STAGES) map.set(s.id, []);
    for (const l of effective) map.get(l.stage)?.push(l);
    return map;
  }, [effective]);

  const activeLead = effective.find((l) => l.id === activeId) ?? null;
  const openLead = effective.find((l) => l.id === openId) ?? null;

  async function moveLead(id: string, to: Stage) {
    const original = leads.find((l) => l.id === id);
    const current = effective.find((l) => l.id === id);
    if (!original || !current || current.stage === to) return;

    setError(null);
    setOverrides((prev) => ({ ...prev, [id]: { from: original.stage, to } }));

    try {
      const res = await fetch(`/api/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: to }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Could not move the lead.");
      }
      router.refresh();
      // the server data has caught up by now, so the instant override is no longer needed
      window.setTimeout(() => {
        setOverrides((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }, 5000);
    } catch (err) {
      setOverrides((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setError(err instanceof Error ? err.message : "Could not move the lead.");
    }
  }

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const target = e.over ? String(e.over.id) : null;
    if (target && isStage(target)) void moveLead(String(e.active.id), target);
  }

  return (
    <div className="space-y-3">
      {error && (
        <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      <DndContext
        id="pipeline-dnd"
        sensors={sensors}
        collisionDetection={collision}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <div className="-mx-4 overflow-x-auto px-4 pb-4 md:-mx-8 md:px-8">
          <div className="flex items-start gap-4">
            {STAGES.map((s) => (
              <KanbanColumn
                key={s.id}
                stage={s.id}
                label={s.label}
                leads={byStage.get(s.id) ?? []}
                onMove={moveLead}
                onOpen={setOpenId}
              />
            ))}
          </div>
        </div>

        {/* The card that follows your finger: springy lift, bouncy drop */}
        <DragOverlay dropAnimation={{ duration: 240, easing: "cubic-bezier(0.18, 0.89, 0.32, 1.28)" }}>
          {activeLead ? (
            <motion.div
              initial={{ scale: 1, rotate: 0 }}
              animate={{ scale: 1.04, rotate: 1.5 }}
              transition={{ type: "spring", stiffness: 400, damping: 22 }}
              className="w-72 cursor-grabbing shadow-2xl"
            >
              <CardBody lead={activeLead} />
            </motion.div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <LeadDrawer lead={openLead} onClose={() => setOpenId(null)} onMove={moveLead} />
    </div>
  );
}