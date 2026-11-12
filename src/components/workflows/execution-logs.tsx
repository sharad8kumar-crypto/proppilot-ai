import Link from "next/link";
import { GlassCard } from "@/components/shell/glass-card";
import { TemperatureBadge } from "@/components/shared/badges";
import { RunStatusChip, clockTime, durationText } from "./run-status";
import type { LogRow, RunStatus, TestLead } from "./use-workflow-run";

type ExecutionLogsProps = {
  logs: LogRow[];
  running: boolean;
  error: string | null;
  testLead: TestLead | null;
};

const TH = "px-3 py-2.5 text-left text-xs font-medium text-muted-foreground";

export function ExecutionLogs({ logs, running, error, testLead }: ExecutionLogsProps) {
  const overall: RunStatus = running
    ? "running"
    : error
      ? "failed"
      : logs.length > 0
        ? "success"
        : "idle";

  return (
    <GlassCard className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-xl">Execution logs</h2>
        <RunStatusChip status={overall} />
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      {testLead && (
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-surface px-4 py-3 text-sm">
          <span>
            Test lead <span className="font-semibold">{testLead.name}</span> is{" "}
            <TemperatureBadge temperature={testLead.temperature} /> with score{" "}
            <span className="font-semibold">{testLead.score}</span>.
          </span>
          <span className="flex gap-3 text-xs font-medium">
            <Link href="/inbox" className="underline-offset-2 hover:underline">
              Open Inbox
            </Link>
            <Link href="/pipeline" className="underline-offset-2 hover:underline">
              Open Pipeline
            </Link>
            <Link href="/calendar" className="underline-offset-2 hover:underline">
              Open Calendar
            </Link>
          </span>
        </div>
      )}

      {logs.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          {running
            ? "Running the test. Steps will appear here as each node finishes..."
            : "Press Run test to send a real test lead through the workflow. Each step shows up here."}
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full min-w-[640px] text-sm">
            <caption className="sr-only">Steps of the latest workflow test run</caption>
            <thead className="border-b border-border">
              <tr>
                <th scope="col" className={TH}>Step</th>
                <th scope="col" className={TH}>Node</th>
                <th scope="col" className={TH}>Status</th>
                <th scope="col" className={TH}>Duration</th>
                <th scope="col" className={TH}>Started at</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {logs.map((row) => (
                <tr key={row.step}>
                  <td className="px-3 py-3 tabular-nums text-muted-foreground">
                    {String(row.step).padStart(2, "0")}
                  </td>
                  <th scope="row" className="px-3 py-3 text-left font-medium">
                    {row.title}
                    <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                      {row.detail}
                    </span>
                  </th>
                  <td className="px-3 py-3">
                    <RunStatusChip status={row.status} />
                  </td>
                  <td className="px-3 py-3 tabular-nums">{durationText(row.durationMs)}</td>
                  <td className="px-3 py-3 tabular-nums">{clockTime(row.startedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </GlassCard>
  );
}