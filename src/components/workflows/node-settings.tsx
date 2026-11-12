"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { KIND_DESCRIPTION, KIND_LABEL, settingsFor } from "@/lib/workflow";
import { cn } from "@/lib/utils";
import { KIND_META } from "./node-meta";
import { RunStatusChip, clockTime, durationText } from "./run-status";
import type { StepNodeType } from "./step-node";
import type { NodeRun } from "./use-workflow-run";

type NodeSettingsProps = {
  node: StepNodeType | null;
  run: NodeRun | undefined;
  disabled: boolean;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
};

function NodePanel({
  node,
  run,
  disabled,
  onRename,
  onDelete,
}: Omit<NodeSettingsProps, "node"> & { node: StepNodeType }) {
  const [tab, setTab] = useState<"setting" | "output">("setting");
  const { data } = node;
  const meta = KIND_META[data.kind];
  const Icon = meta.icon;
  const rows = settingsFor(data.kind);

  return (
    <div>
      <div role="tablist" aria-label="Node panel" className="grid grid-cols-2 rounded-full bg-secondary p-1 text-sm">
        {(["setting", "output"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              "rounded-full py-2 font-medium capitalize transition-colors",
              tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            )}
          >
            {t === "setting" ? "Setting" : "Output"}
          </button>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", meta.tone)}>
          <Icon className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{data.title}</p>
          <p className="text-xs text-muted-foreground">{KIND_LABEL[data.kind]}</p>
        </div>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        {KIND_DESCRIPTION[data.kind]}
      </p>

      {tab === "setting" ? (
        <div className="mt-5 space-y-4">
          <div>
            <label htmlFor="node-name" className="text-xs font-medium">
              Node name
            </label>
            <input
              id="node-name"
              value={data.title}
              maxLength={40}
              disabled={disabled}
              onChange={(e) => onRename(node.id, e.target.value)}
              className="mt-1.5 h-10 w-full rounded-full border border-border bg-background px-4 text-sm outline-none focus-visible:border-primary disabled:opacity-60"
            />
          </div>

          <dl className="space-y-3">
            {rows.map((row) => (
              <div key={row.label}>
                <dt className="text-xs font-medium">{row.label}</dt>
                <dd className="mt-1 rounded-2xl bg-secondary px-4 py-2 text-xs leading-relaxed text-muted-foreground">
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>

          <button
            type="button"
            disabled={data.core || disabled}
            onClick={() => onDelete(node.id)}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-danger/10 py-2.5 text-sm font-medium text-danger transition-colors hover:bg-danger/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Trash2 className="size-4" aria-hidden />
            Delete node
          </button>
          {data.core && (
            <p className="text-center text-[11px] text-faint">
              This is a core node of the live flow, so it cannot be deleted.
            </p>
          )}
        </div>
      ) : (
        <div className="mt-5">
          {!run || run.status === "idle" ? (
            <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
              Run a test to see this node&apos;s output.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <RunStatusChip status={run.status} />
                <span className="text-xs text-muted-foreground">
                  {durationText(run.durationMs)}
                  {run.startedAt && ` · ${clockTime(run.startedAt)}`}
                </span>
              </div>
              {run.detail && <p className="text-sm leading-relaxed">{run.detail}</p>}
              {run.output.length > 0 && (
                <dl className="divide-y divide-border rounded-xl border border-border bg-surface">
                  {run.output.map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-3 px-3 py-2 text-xs">
                      <dt className="text-muted-foreground">{label}</dt>
                      <dd className="text-right font-medium">{value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function NodeSettings(props: NodeSettingsProps) {
  const { node, ...rest } = props;

  return (
    <section
      aria-label="Node settings"
      className="max-h-[680px] overflow-y-auto rounded-2xl border border-border bg-muted p-4"
    >
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Node setting
      </h2>
      {node ? (
        // key resets the tab whenever another node is selected
        <NodePanel key={node.id} node={node} {...rest} />
      ) : (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Click a node on the canvas to see its settings.
        </p>
      )}
    </section>
  );
}