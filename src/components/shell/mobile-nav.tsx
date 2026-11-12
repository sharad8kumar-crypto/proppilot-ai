"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass } from "lucide-react";
import { navItems } from "@/lib/nav";
import { cn } from "@/lib/utils";

// Content of the mobile drawer (screens below the xl breakpoint)
export function MobileNav({ onNavigate }: { onNavigate: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col px-5 py-6">
      <Link
        href="/"
        onClick={onNavigate}
        className="flex items-center gap-2.5"
      >
        <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
          <Compass className="size-5" aria-hidden />
        </span>
        <span className="text-xl font-extrabold tracking-tight">PropPilot</span>
      </Link>

      <nav aria-label="Main" className="mt-8 flex flex-col gap-2">
        {navItems.map((item) => {
          const active =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-full px-4 py-3 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <Icon className="size-4" aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto rounded-2xl border border-border bg-muted p-4">
        <div className="flex items-center gap-2 text-xs font-semibold">
          <span className="size-1.5 rounded-full bg-success" aria-hidden />
          Demo environment
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Portal and WhatsApp feeds are simulated. AI, scoring and alerts run
          for real.
        </p>
      </div>
    </div>
  );
}