"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Bot, PanelRight, SendHorizontal } from "lucide-react";
import { SourceBadge, TemperatureBadge } from "@/components/shared/badges";
import { PropertyCard } from "@/components/properties/property-card";
import { formatClock, initialsOf, leadDisplayName } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { LeadRow, MessageRow, PropertyRow } from "@/types/db";
import type { PendingMessage } from "./use-inbox";
import { TypingIndicator } from "./typing-indicator";

type BubbleMessage = Pick<MessageRow, "sender" | "content" | "created_at"> & {
  property_ids?: string[];
};

const SENDER_LABEL = { lead: "Buyer", ai: "PropPilot AI", agent: "Agent", system: "System" } as const;

function MessageBubble({
  message,
  propertiesById,
  pending = false,
}: {
  message: BubbleMessage;
  propertiesById: Record<string, PropertyRow>;
  pending?: boolean;
}) {
  if (message.sender === "system") {
    return (
      <div className="flex justify-center">
        <span className="rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">
          {message.content}
        </span>
      </div>
    );
  }

  const fromLead = message.sender === "lead";
  const isAi = message.sender === "ai";

  // Property cards attached to this message (facts come from the database)
  const cards = (message.property_ids ?? [])
    .map((id) => propertiesById[id])
    .filter((p): p is PropertyRow => p !== undefined);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: pending ? 0.65 : 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn("flex flex-col", fromLead ? "items-start" : "items-end")}
    >
      <div
        className={cn(
          "max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-sm leading-relaxed sm:max-w-[75%]",
          fromLead && "rounded-bl-md bg-secondary",
          isAi && "rounded-br-md bg-primary text-primary-foreground",
          message.sender === "agent" && "rounded-br-md border border-violet/30 bg-violet/10"
        )}
      >
        {message.content}
      </div>

      {cards.length > 0 && (
        <div className="mt-2 w-full max-w-[85%] space-y-2 sm:max-w-[75%]">
          {cards.map((p) => (
            <PropertyCard key={p.id} property={p} variant="compact" />
          ))}
        </div>
      )}

      <span className="mt-1 flex items-center gap-1 px-1 text-[11px] text-faint">
        {isAi && <Bot className="size-3" aria-hidden />}
        {SENDER_LABEL[message.sender]} · {formatClock(message.created_at)}
      </span>
    </motion.div>
  );
}

type ChatThreadProps = {
  lead: LeadRow;
  messages: MessageRow[];
  pending: PendingMessage[];
  propertiesById: Record<string, PropertyRow>;
  loading: boolean;
  aiTyping: boolean;
  sendError: string | null;
  onSend: (content: string, as: "buyer" | "agent") => void;
  onBack: () => void;
  onOpenInsights: () => void;
};

export function ChatThread({
  lead,
  messages,
  pending,
  propertiesById,
  loading,
  aiTyping,
  sendError,
  onSend,
  onBack,
  onOpenInsights,
}: ChatThreadProps) {
  const [text, setText] = useState("");
  const [as, setAs] = useState<"buyer" | "agent">("buyer");
  const scrollRef = useRef<HTMLDivElement>(null);
  const busy = aiTyping || pending.length > 0;

  // Keep the newest message in view (scrolls inside the thread, not the page)
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, pending.length, aiTyping, lead.id]);

  function submit() {
    const content = text.trim();
    if (!content || busy) return;
    onSend(content, as);
    setText("");
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-border p-4">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to conversations"
          className="grid size-9 place-items-center rounded-full bg-secondary lg:hidden"
        >
          <ArrowLeft className="size-4" />
        </button>
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
          {initialsOf(lead.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{leadDisplayName(lead)}</p>
          <p className="mt-0.5 flex items-center gap-1.5">
            <SourceBadge source={lead.source} />
            <TemperatureBadge temperature={lead.temperature} />
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenInsights}
          className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-2 text-xs font-medium xl:hidden"
        >
          <PanelRight className="size-4" aria-hidden />
          Insights
        </button>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {loading && (
          <div className="space-y-3">
            <div className="h-10 w-2/3 animate-pulse rounded-2xl bg-surface-2" />
            <div className="ml-auto h-10 w-1/2 animate-pulse rounded-2xl bg-surface-2" />
          </div>
        )}

        {!loading && messages.length === 0 && pending.length === 0 && (
          <div className="grid h-full place-items-center text-center">
            <div className="max-w-xs">
              <p className="font-serif text-lg">No messages yet</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Type as the Buyer to start the conversation. The AI will reply and fill in the
                insights.
              </p>
            </div>
          </div>
        )}

        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} propertiesById={propertiesById} />
        ))}
        {pending.map((p) => (
          <MessageBubble key={p.id} message={p} propertiesById={propertiesById} pending />
        ))}
        {aiTyping && <TypingIndicator />}
      </div>

      {/* Composer */}
      <div className="border-t border-border p-4">
        {sendError && (
          <p role="alert" className="mb-3 rounded-xl bg-danger/10 px-3 py-2 text-xs text-danger">
            {sendError}
          </p>
        )}

        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span id="reply-as-label" className="text-xs text-muted-foreground">
              Reply as
            </span>
            <div
              role="radiogroup"
              aria-labelledby="reply-as-label"
              className="inline-flex rounded-full bg-secondary p-1 text-xs"
            >
              {(["buyer", "agent"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={as === option}
                  onClick={() => setAs(option)}
                  className={cn(
                    "rounded-full px-3 py-1.5 font-medium transition-colors",
                    as === option
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {option === "buyer" ? "Buyer" : "Agent"}
                </button>
              ))}
            </div>
          </div>
          {text.length > 400 && (
            <span className="text-[11px] text-faint">{text.length}/500</span>
          )}
        </div>

        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 500))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={1}
            aria-label="Message"
            placeholder={
              as === "buyer"
                ? "Type as the buyer (demo)..."
                : "Reply as the sales agent..."
            }
            className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none placeholder:text-faint focus-visible:border-primary"
          />
          <button
            type="button"
            onClick={submit}
            disabled={busy || text.trim().length === 0}
            aria-label="Send message"
            className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-gold-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            <SendHorizontal className="size-4" />
          </button>
        </div>
        <p className="mt-2 text-[11px] text-faint">
          {as === "buyer"
            ? "You are playing the buyer. The AI will reply automatically."
            : "Agent replies are sent without an AI response."}
        </p>
      </div>
    </div>
  );
}