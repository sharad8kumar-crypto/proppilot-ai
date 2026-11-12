"use client";

import "@xyflow/react/dist/style.css";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
} from "@xyflow/react";
import { Loader2, Play, RotateCcw } from "lucide-react";
import { useIsClient } from "@/lib/use-is-client";
import { cn } from "@/lib/utils";
import {
  CORE_EDGES,
  CORE_NODES,
  SCENARIOS,
  type LibraryItem,
  type Scenario,
} from "@/lib/workflow";
import { ExecutionLogs } from "./execution-logs";
import { FlowEdgeView, type FlowEdgeType } from "./flow-edge";
import { NodeLibrary } from "./node-library";
import { NodeSettings } from "./node-settings";
import { StepNodeView, type StepNodeType } from "./step-node";
import { useWorkflowRun } from "./use-workflow-run";

// Defined outside the component so React Flow does not re-create them on every render
const nodeTypes = { step: StepNodeView };
const edgeTypes = { flow: FlowEdgeView };

const initialNodes: StepNodeType[] = CORE_NODES.map((n) => ({
  id: n.id,
  type: "step",
  position: { x: n.x, y: n.y },
  deletable: false,
  data: { title: n.title, subtitle: n.subtitle, kind: n.kind, core: true },
}));

const initialEdges: FlowEdgeType[] = CORE_EDGES.map((e) => ({
  id: e.id,
  source: e.source,
  target: e.target,
  type: "flow",
  deletable: false,
  data: { state: "idle", label: e.label },
}));

const SCENARIO_ORDER: Scenario[] = ["hot", "warm", "cold"];

function Builder() {
  const { fitView } = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState<StepNodeType>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdgeType>(initialEdges);
  const [selectedId, setSelectedId] = useState<string | null>(CORE_NODES[1].id);
  const [scenario, setScenario] = useState<Scenario>("hot");
  const customCount = useRef(0);

  const { runs, edgeStates, logs, running, error, testLead, run, reset } = useWorkflowRun();

  // Nodes and edges show the live run state without touching their saved positions
  const displayNodes = useMemo(
    () => nodes.map((n) => ({ ...n, data: { ...n.data, run: runs[n.id] } })),
    [nodes, runs]
  );
  const displayEdges = useMemo(
    () =>
      edges.map((e) => ({
        ...e,
        data: { label: e.data?.label, state: edgeStates[e.id] ?? "idle" },
      })) as FlowEdgeType[],
    [edges, edgeStates]
  );

  const selectedNode = nodes.find((n) => n.id === selectedId) ?? null;

  const onConnect = useCallback(
    (c: Connection) => {
      if (!c.source || !c.target) return;
      setEdges((eds) => {
        if (eds.some((e) => e.source === c.source && e.target === c.target)) return eds;
        const edge: FlowEdgeType = {
          id: `e-${c.source}-${c.target}-${eds.length}`,
          source: c.source,
          target: c.target,
          type: "flow",
          data: { state: "idle" },
        };
        return [...eds, edge];
      });
    },
    [setEdges]
  );

  function addNode(item: LibraryItem) {
    const n = customCount.current;
    customCount.current += 1;
    const id = `custom-${n}`;
    const node: StepNodeType = {
      id,
      type: "step",
      position: { x: -260 - Math.floor(n / 5) * 230, y: 40 + (n % 5) * 110 },
      data: { title: item.title, subtitle: item.subtitle, kind: item.kind, core: false },
    };
    setNodes((ns) => [...ns, node]);
    setSelectedId(id);
    window.requestAnimationFrame(() => fitView({ duration: 300, padding: 0.15 }));
  }

  function renameNode(id: string, title: string) {
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, title } } : n)));
  }

  function deleteNode(id: string) {
    setNodes((ns) => ns.filter((n) => n.id !== id));
    setEdges((es) => es.filter((e) => e.source !== id && e.target !== id));
    setSelectedId(null);
  }

  function resetLayout() {
    setNodes(initialNodes);
    setEdges(initialEdges);
    setSelectedId(CORE_NODES[1].id);
    customCount.current = 0;
    reset();
    window.requestAnimationFrame(() => fitView({ duration: 300, padding: 0.15 }));
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-muted p-4">
        <div className="mr-auto flex flex-wrap items-center gap-3">
          <h2 className="font-serif text-xl">Lead Automation Workflow</h2>
          <span className="rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success ring-1 ring-success/25">
            Published
          </span>
        </div>

        <div role="radiogroup" aria-label="Test scenario" className="inline-flex rounded-full bg-secondary p-1">
          {SCENARIO_ORDER.map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={scenario === s}
              disabled={running}
              onClick={() => setScenario(s)}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed",
                scenario === s
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {SCENARIOS[s].label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => run(scenario)}
          disabled={running}
          className="flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-gold-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {running ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Play className="size-4" aria-hidden />
          )}
          {running ? "Running..." : "Run test"}
        </button>

        <button
          type="button"
          onClick={resetLayout}
          disabled={running}
          className="flex items-center gap-2 rounded-full bg-secondary px-4 py-2.5 text-sm font-medium transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RotateCcw className="size-4" aria-hidden />
          Reset
        </button>
      </div>

      {/* Library | Canvas | Settings */}
      <div className="grid gap-4 xl:grid-cols-[250px_minmax(0,1fr)_300px]">
        <div className="order-3 xl:order-1">
          <NodeLibrary disabled={running} onAdd={addNode} />
        </div>

        <section
          aria-label="Workflow canvas"
          className="order-1 h-[640px] overflow-hidden rounded-2xl border border-border bg-muted xl:order-2"
        >
          <ReactFlow
            nodes={displayNodes}
            edges={displayEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, node) => setSelectedId(node.id)}
            onPaneClick={() => setSelectedId(null)}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            fitViewOptions={{ padding: 0.15 }}
            minZoom={0.3}
            maxZoom={1.5}
            zoomOnScroll={false}
            preventScrolling={false}
          >
            <Background variant={BackgroundVariant.Dots} gap={18} size={1.2} color="#d4d4da" />
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable nodeStrokeWidth={2} style={{ width: 120, height: 80 }} />
          </ReactFlow>
        </section>

        <div className="order-2 xl:order-3">
          <NodeSettings
            node={selectedNode}
            run={selectedNode ? runs[selectedNode.id] : undefined}
            disabled={running}
            onRename={renameNode}
            onDelete={deleteNode}
          />
        </div>
      </div>

      <ExecutionLogs logs={logs} running={running} error={error} testLead={testLead} />
    </div>
  );
}

export function WorkflowBuilder() {
  const isClient = useIsClient();

  // The canvas needs the browser to measure itself
  if (!isClient) {
    return <div className="h-[640px] animate-pulse rounded-2xl bg-muted" aria-busy="true" />;
  }

  return (
    <ReactFlowProvider>
      <Builder />
    </ReactFlowProvider>
  );
}