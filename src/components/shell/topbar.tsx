"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { CircleHelp, Compass, Menu, Search } from "lucide-react";
import { navItems } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { NotificationBell } from "./notification-bell";

type TopbarProps = {
  onOpenNav: () => void;
  onOpenPalette: () => void;
};

export function Topbar({ onOpenNav, onOpenPalette }: TopbarProps) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 flex h-20 items-center gap-3 bg-background/90 px-4 backdrop-blur-xl md:px-8 lg:rounded-t-[2rem]">
      {/* Mobile / tablet menu button (nav pills show from xl) */}
      <button
        type="button"
        onClick={onOpenNav}
        aria-label="Open navigation"
        className="grid size-10 place-items-center rounded-full bg-secondary transition-colors hover:bg-accent xl:hidden"
      >
        <Menu className="size-5" />
      </button>

      {/* Brand */}
      <Link href="/" className="flex items-center gap-2.5">
        <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
          <Compass className="size-5" aria-hidden />
        </span>
        <span className="text-xl font-extrabold tracking-tight">PropPilot</span>
      </Link>

      {/* Pill navigation (desktop) */}
      <nav
        aria-label="Main"
        className="mx-auto hidden items-center gap-2 xl:flex"
      >
        {navItems.map((item) => {
          const active =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              {active && (
                <motion.span
                  layoutId="top-nav-pill"
                  className="absolute inset-0 rounded-full bg-primary"
                  transition={{ type: "spring", stiffness: 500, damping: 40 }}
                />
              )}
              <Icon className="relative size-4" aria-hidden />
              <span className="relative">{item.shortLabel}</span>
            </Link>
          );
        })}
      </nav>

      {/* Right actions */}
      <div className="ml-auto flex items-center gap-2 xl:ml-0">
        <button
          type="button"
          onClick={onOpenPalette}
          aria-label="Open command palette"
          className="flex h-10 items-center gap-2 rounded-full bg-secondary px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:px-4"
        >
          <Search className="size-4" aria-hidden />
          <span className="hidden md:inline">Search</span>
          <kbd className="hidden rounded-md border border-border bg-background px-1.5 py-0.5 text-[11px] lg:block">
            Ctrl K
          </kbd>
        </button>

        <NotificationBell />

        <button
          type="button"
          aria-label="Help"
          className="hidden size-10 place-items-center rounded-full bg-secondary text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:grid"
        >
          <CircleHelp className="size-[18px]" />
        </button>

        <div
          className="grid size-10 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
          aria-label="Signed in agent"
        >
          SH
        </div>
      </div>
    </header>
  );
}