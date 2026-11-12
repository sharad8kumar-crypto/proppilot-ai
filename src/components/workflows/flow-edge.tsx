"use client";

import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type Edge,
  type EdgeProps,
} from "@xyflow/react";
import { useReducedMotion } from "framer-motion";
import type { EdgeLabel } from "@/lib/workflow";

export type FlowEdgeData = {
  state: "idle" | "active" | "done";
  label?: EdgeLabel;
};

export type FlowEdgeType = Edge<FlowEdgeData, "flow">;

const LABEL_STYLE: Record<EdgeLabel, string> = {
  Hot: "text-danger",
  Warm: "text-orange",
  Cold: "text-info",
};

export function FlowEdgeView({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps<FlowEdgeType>) {
  const reduceMotion = useReducedMotion();
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 14,
  });

  const state = data?.state ?? "idle";
  const label = data?.label;

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={{
          stroke: state === "idle" ? "#c4c4cc" : "#0b0b0f",
          strokeWidth: state === "idle" ? 1.5 : 2.5,
        }}
      />

      {/* Dots flowing along the edge (skipped for people who prefer reduced motion) */}
      {!reduceMotion && state === "idle" && (
        <circle r="3" fill="#9a9aa3">
          <animateMotion dur="3s" repeatCount="indefinite" path={path} />
        </circle>
      )}
      {!reduceMotion && state === "active" && (
        <circle r="5" fill="#0b0b0f">
          <animateMotion dur="0.9s" repeatCount="indefinite" path={path} />
        </circle>
      )}

      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: "none",
            }}
            className={`rounded-full bg-background px-2 py-0.5 text-[10px] font-semibold ring-1 ring-border ${LABEL_STYLE[label]}`}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}