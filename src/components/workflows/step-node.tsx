"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { Check, Loader2, Minus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NodeKind } from "@/lib/workflow";
import { KIND_META } from "./node-meta";
import type { NodeRun } from "./use-workflow-run";

export type StepData = {
  title: string;
  subtitle: string;
  kind: NodeKind;
  core: boolean; // part of the ready-made flow
  run?: NodeRun;
};

export type StepNodeType = Node<StepData, "step">;

const handleStyle = { width: 8, height: 8, background: "#9a9aa3", border: "none" };

export function StepNodeView({ data, selected }: NodeProps<StepNodeType>) {
  const meta = KIND_META[data.kind];
  const Icon = meta.icon;
  const status = data.run?.status ?? "idle";

  return (
    <div
      className={cn(
        "w-52 rounded-xl border bg-surface px-3 py-2.5 shadow-sm transition-all",
        selected ? "border-primary ring-2 ring-primary/20" : "border-border",
        status === "running" && "border-primary ring-4 ring-primary/15",
        status === "success" && "border-success",
        status === "failed" && "border-danger",
        status === "skipped" && "opacity-45"
      )}
    >
      <Handle type="target" position={Position.Top} style={handleStyle} />

      <div className="flex items-center gap-2.5">
        <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", meta.tone)}>
          <Icon className="size-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold leading-tight">
            {data.title}
          </span>
          <span className="block truncate text-[11px] text-muted-foreground">
            {data.core ? data.subtitle : `Custom · ${data.subtitle}`}
          </span>
        </span>

        {status === "running" && <Loader2 className="size-4 shrink-0 animate-spin" aria-label="Running" />}
        {status === "success" && (
          <span className="grid size-5 shrink-0 place-items-center rounded-full bg-success text-white">
            <Check className="size-3" aria-label="Success" />
          </span>
        )}
        {status === "failed" && (
          <span className="grid size-5 shrink-0 place-items-center rounded-full bg-danger text-white">
            <X className="size-3" aria-label="Failed" />
          </span>
        )}
        {status === "skipped" && <Minus className="size-4 shrink-0 text-faint" aria-label="Skipped" />}
      </div>

      <Handle type="source" position={Position.Bottom} style={handleStyle} />
    </div>
  );
}