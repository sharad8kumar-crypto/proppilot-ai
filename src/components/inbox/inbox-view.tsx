"use client";

import { useState } from "react";
import { MessageSquareText } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { ChatThread } from "./chat-thread";
import { ConversationList } from "./conversation-list";
import { InsightsPanel } from "./insights-panel";
import { NewLeadForm } from "./new-lead-form";
import { useProperties } from "./use-properties";
import { NEW_LEAD, useInbox } from "./use-inbox";

export function InboxView() {
  const inbox = useInbox();
  const propertiesById = useProperties();
  const [insightsOpen, setInsightsOpen] = useState(false);

  const showThread = inbox.selectedId !== null; // on mobile: thread replaces the list

  return (
    <div className="space-y-3">
      {inbox.error && (
        <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
          Could not load the inbox: {inbox.error}. Check your .env.local keys and make sure you ran
          the SQL schema and <code>npm run seed</code>.
        </p>
      )}

      <div className="grid h-[calc(100dvh-13rem)] min-h-[520px] gap-4 lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)_340px]">
        {/* Left: conversation list */}
        <ConversationList
          className={cn(showThread ? "hidden lg:flex" : "flex")}
          leads={inbox.leads}
          latest={inbox.latest}
          unread={inbox.unread}
          selectedId={inbox.selectedId}
          loading={inbox.loading}
          live={inbox.live}
          onSelect={inbox.select}
          onNew={() => inbox.select(NEW_LEAD)}
        />

        {/* Center: chat thread / new lead form / empty state */}
        <section
          aria-label="Chat"
          className={cn(
            "min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-background",
            showThread ? "flex" : "hidden lg:flex"
          )}
        >
          {inbox.selectedId === NEW_LEAD ? (
            <NewLeadForm
              onSubmit={inbox.startNewLead}
              onCancel={() => inbox.select(null)}
            />
          ) : inbox.selectedLead ? (
            <ChatThread
              key={inbox.selectedLead.id}
              lead={inbox.selectedLead}
              messages={inbox.messages}
              pending={inbox.pending}
              propertiesById={propertiesById}
              loading={inbox.messagesLoading}
              aiTyping={inbox.aiTyping}
              sendError={inbox.sendError}
              onSend={(content, as) => inbox.send(inbox.selectedLead!.id, content, as)}
              onBack={() => inbox.select(null)}
              onOpenInsights={() => setInsightsOpen(true)}
            />
          ) : (
            <div className="grid flex-1 place-items-center p-8 text-center">
              <div>
                <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-secondary">
                  <MessageSquareText className="size-6" aria-hidden />
                </span>
                <p className="mt-4 font-serif text-xl">Select a conversation</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Pick a lead on the left, or press + to simulate a new one.
                </p>
              </div>
            </div>
          )}
        </section>

        {/* Right: AI insights (wide screens) */}
        <aside aria-label="AI insights" className="hidden min-h-0 overflow-y-auto xl:block">
          {inbox.selectedLead && (
            <InsightsPanel lead={inbox.selectedLead} agents={inbox.agents} />
          )}
        </aside>
      </div>

      {/* Insights drawer for smaller screens */}
      <Sheet open={insightsOpen} onOpenChange={setInsightsOpen}>
        <SheetContent side="right" className="w-[22rem] max-w-full overflow-y-auto bg-background p-4">
          <SheetTitle className="sr-only">Lead insights</SheetTitle>
          {inbox.selectedLead && (
            <InsightsPanel lead={inbox.selectedLead} agents={inbox.agents} />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}