import { GlassCard } from "@/components/shell/glass-card";
import { formatDuration, initialsOf } from "@/lib/format";
import type { AgentStats } from "@/types/analytics";

const TH = "px-3 py-2.5 text-left text-xs font-medium text-muted-foreground";
const TD = "px-3 py-3 tabular-nums";

export function AgentLeaderboard({ agents }: { agents: AgentStats[] }) {
  return (
    <GlassCard className="p-6">
      <h2 className="font-serif text-xl">Agent leaderboard</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Last 30 days. Ranked by bookings. Response time is the seeded demo baseline; with live data it
        comes from the agent&apos;s first reply.
      </p>

      {agents.length === 0 ? (
        <p className="mt-5 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No agents yet. Run <code>npm run seed</code>.
        </p>
      ) : (
        <div className="mt-5 overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full min-w-[520px] text-sm">
            <caption className="sr-only">Agent performance for the last 30 days</caption>
            <thead className="border-b border-border">
              <tr>
                <th scope="col" className={TH}>Agent</th>
                <th scope="col" className={TH}>Leads</th>
                <th scope="col" className={TH}>Visits</th>
                <th scope="col" className={TH}>Booked</th>
                <th scope="col" className={TH}>Conv.</th>
                <th scope="col" className={TH}>Avg response</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {agents.map((a, i) => (
                <tr key={a.id}>
                  <th scope="row" className="px-3 py-3 text-left font-medium">
                    <span className="flex items-center gap-2.5">
                      <span className="w-4 text-xs text-faint tabular-nums">{i + 1}</span>
                      <span
                        className="grid size-7 place-items-center rounded-full text-[10px] font-semibold text-white"
                        style={{ backgroundColor: a.color }}
                        aria-hidden
                      >
                        {initialsOf(a.name)}
                      </span>
                      {a.name}
                    </span>
                  </th>
                  <td className={TD}>{a.leadsHandled}</td>
                  <td className={TD}>{a.visits}</td>
                  <td className={TD}>{a.conversions}</td>
                  <td className={TD}>{a.conversionPct}%</td>
                  <td className={TD}>
                    {a.avgResponseMs !== null ? (
                      formatDuration(a.avgResponseMs / 1000)
                    ) : (
                      <span className="text-faint">n/a</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </GlassCard>
  );
}