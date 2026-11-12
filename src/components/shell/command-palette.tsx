"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Presentation, Tag } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { navItems } from "@/lib/nav";
import { usePresenter } from "@/lib/presenter";

type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const { presenter, setPresenter } = usePresenter();

  // Ctrl+K (Windows/Linux) or Cmd+K (Mac) toggles the palette
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  const go = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Jump to a screen or run an action..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Go to">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <CommandItem
                key={item.href}
                value={`${item.label} ${item.description}`}
                onSelect={() => go(item.href)}
              >
                <Icon aria-hidden />
                <span>{item.label}</span>
                <span className="ml-auto hidden text-xs text-muted-foreground sm:block">
                  {item.description}
                </span>
              </CommandItem>
            );
          })}
          <CommandItem value="Pricing plans quote" onSelect={() => go("/pricing")}>
            <Tag aria-hidden />
            <span>Pricing</span>
            <span className="ml-auto hidden text-xs text-muted-foreground sm:block">
              Starter, Pro and Premium plans
            </span>
          </CommandItem>
        </CommandGroup>

        <CommandGroup heading="Actions">
          <CommandItem
            value="Toggle presenter mode hide control panel"
            onSelect={() => {
              onOpenChange(false);
              setPresenter(!presenter);
            }}
          >
            <Presentation aria-hidden />
            <span>{presenter ? "Exit presenter mode" : "Presenter mode"}</span>
            <span className="ml-auto hidden text-xs text-muted-foreground sm:block">
              Alt + Shift + P
            </span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}