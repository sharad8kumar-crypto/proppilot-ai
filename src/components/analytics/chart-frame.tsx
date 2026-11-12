"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

// false while the server renders, true in the browser.
// Charts need a measured container, so we only draw them in the browser.
function useIsClient(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}

export function ChartFrame({
  height = 280,
  label,
  children,
}: {
  height?: number;
  label: string;
  children: React.ReactNode;
}) {
  const isClient = useIsClient();

  return (
    <div role="img" aria-label={label} style={{ height }} className="w-full">
      {isClient ? (
        children
      ) : (
        <div className="size-full animate-pulse rounded-xl bg-surface-2" />
      )}
    </div>
  );
}