"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

// false while the server renders, true in the browser
export function useIsClient(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}