"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { LeadSource } from "@/types";

const SOURCES: { value: LeadSource; label: string }[] = [
  { value: "99acres", label: "99acres" },
  { value: "magicbricks", label: "MagicBricks" },
  { value: "housing", label: "Housing" },
  { value: "facebook", label: "Facebook" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "website", label: "Website" },
];

// Quick starters for the demo (from the brief's scenario list)
const PRESETS = [
  { label: "Serious buyer", text: "Hi, mujhe Noida Extension mein 2BHK flat chahiye, 3 mahine ke andar lena hai." },
  { label: "Investor", text: "Hello, looking for an investment property in Greater Noida West with good rental yield." },
  { label: "Budget shopper", text: "Sasta 1BHK batao Ghaziabad mein, kitne ka milega?" },
  { label: "Urgent relocation", text: "Mera transfer Gurgaon ho gaya hai, jaldi se jaldi 3BHK chahiye Sohna Road pe." },
];

type NewLeadFormProps = {
  onSubmit: (source: LeadSource, message: string) => Promise<string | null>;
  onCancel: () => void;
};

export function NewLeadForm({ onSubmit, onCancel }: NewLeadFormProps) {
  const [source, setSource] = useState<LeadSource>("99acres");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = message.trim();
    if (!text || submitting) return;
    setSubmitting(true);
    setError(null);
    const result = await onSubmit(source, text);
    if (result) {
      setError(result);
      setSubmitting(false);
    }
    // on success the parent selects the new lead and this form unmounts
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <h2 className="font-serif text-2xl">New demo lead</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Simulate a buyer's first message. The AI replies in seconds and the lead appears in your
        list.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 max-w-lg space-y-5">
        <div>
          <label htmlFor="lead-source" className="mb-1.5 block text-sm font-medium">
            Lead source
          </label>
          <select
            id="lead-source"
            value={source}
            onChange={(e) => setSource(e.target.value as LeadSource)}
            className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus-visible:border-primary"
          >
            {SOURCES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <p className="mb-1.5 text-sm font-medium">Quick scenario</p>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => setMessage(p.text)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                  message === p.text
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="lead-message" className="mb-1.5 block text-sm font-medium">
            First message from the buyer
          </label>
          <textarea
            id="lead-message"
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, 500))}
            rows={4}
            placeholder="Hi, mujhe 2BHK chahiye..."
            className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none placeholder:text-faint focus-visible:border-primary"
          />
        </div>

        {error && (
          <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-xs text-danger">
            {error}
          </p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={submitting || message.trim().length === 0}
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-gold-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? "Starting..." : "Start conversation"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}