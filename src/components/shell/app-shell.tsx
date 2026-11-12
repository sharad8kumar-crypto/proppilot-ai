"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MotionConfig } from "framer-motion";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { usePresenter } from "@/lib/presenter";
import { CommandPalette } from "./command-palette";
import { DemoControlPanel } from "./demo-control-panel";
import { MobileNav } from "./mobile-nav";
import { Topbar } from "./topbar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { presenter, setPresenter } = usePresenter();

  // Alt + Shift + P toggles presenter mode
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.shiftKey && e.code === "KeyP") {
        e.preventDefault();
        setPresenter(!presenter);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [presenter, setPresenter]);

  return (
    // reducedMotion="user": Framer Motion respects the OS "reduce motion" setting
    <MotionConfig reducedMotion="user">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>

      {/* Outer gray canvas + white rounded frame (frame look from lg screens) */}
      <div className="min-h-dvh lg:p-4">
        <div className="mx-auto min-h-dvh max-w-[1680px] bg-background lg:min-h-[calc(100dvh-2rem)] lg:rounded-[2rem] lg:shadow-sm lg:ring-1 lg:ring-black/5">
          <Topbar
            onOpenNav={() => setMobileNavOpen(true)}
            onOpenPalette={() => setPaletteOpen(true)}
          />

          <main id="main" className="px-4 pb-6 pt-2 md:px-8">
            {children}
          </main>

          <footer className="px-4 pb-8 text-center text-xs text-faint md:px-8">
            Demo environment · Portal and WhatsApp feeds are simulated · AI, scoring and alerts run
            for real
            {!presenter && (
              <>
                {" · "}
                <Link href="/pricing" className="underline-offset-2 hover:underline">
                  Pricing
                </Link>
              </>
            )}
          </footer>
        </div>
      </div>

      {/* Mobile drawer */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-72 bg-background p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <MobileNav onNavigate={() => setMobileNavOpen(false)} />
        </SheetContent>
      </Sheet>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />

      {presenter ? (
        <button
          type="button"
          onClick={() => setPresenter(false)}
          className="fixed bottom-4 right-4 z-40 rounded-full bg-secondary px-3 py-1.5 text-[11px] text-muted-foreground opacity-40 transition-opacity hover:opacity-100 focus-visible:opacity-100"
        >
          Exit presenter mode
        </button>
      ) : (
        <DemoControlPanel />
      )}
    </MotionConfig>
  );
}