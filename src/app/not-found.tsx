import Link from "next/link";
import { GlassCard } from "@/components/shell/glass-card";

export default function NotFound() {
  return (
    <GlassCard className="mx-auto mt-10 max-w-lg p-8 text-center">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">404</p>
      <h1 className="mt-2 font-serif text-2xl">Page not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        The page you are looking for does not exist or has moved.
      </p>
      <Link
        href="/"
        className="mt-5 inline-block rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-gold-hover"
      >
        Back to Command Center
      </Link>
    </GlassCard>
  );
}