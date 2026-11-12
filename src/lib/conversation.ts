import type { MessageRow } from "@/types/db";

// Average seconds the lead takes to answer our (AI/agent) message.
// Returns null if the lead has not replied to us yet.
export function avgReplySeconds(
  messages: Pick<MessageRow, "sender" | "created_at">[]
): number | null {
  const gaps: number[] = [];

  for (let i = 1; i < messages.length; i++) {
    const prev = messages[i - 1];
    const current = messages[i];
    if (current.sender === "lead" && (prev.sender === "ai" || prev.sender === "agent")) {
      const gap =
        (new Date(current.created_at).getTime() -
          new Date(prev.created_at).getTime()) /
        1000;
      if (gap >= 0) gaps.push(gap);
    }
  }

  if (gaps.length === 0) return null;
  return gaps.reduce((sum, g) => sum + g, 0) / gaps.length;
}