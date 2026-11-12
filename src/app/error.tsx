"use client";

import { useEffect } from "react";
import { GlassCard } from "@/components/shell/glass-card";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <GlassCard className="mx-auto mt-10 max-w-lg p-8 text-center" role="alert">
      <h1 className="font-serif text-2xl">Something went wrong</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This page hit an unexpected problem. Your data is safe. Try again, and if it keeps
        happening, reload the page.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-5 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-gold-hover"
      >
        Try again
      </button>
    </GlassCard>
  );
}