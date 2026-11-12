"use client";

import { useCallback, useSyncExternalStore } from "react";

const CHANGE_EVENT = "proppilot:storage-change";

function storageFor(kind: "local" | "session"): Storage | null {
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null; // storage can be blocked by browser settings
  }
}

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}

// A string kept in localStorage / sessionStorage. Every component that uses the same key
// updates together, and the server render always sees "" (so there is no hydration mismatch).
export function useStoredValue(
  key: string,
  kind: "local" | "session" = "local"
): [string, (value: string) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => storageFor(kind)?.getItem(key) ?? "",
    () => ""
  );

  const set = useCallback(
    (next: string) => {
      try {
        const storage = storageFor(kind);
        if (next === "") storage?.removeItem(key);
        else storage?.setItem(key, next);
      } catch {
        // ignore: the value just will not be remembered
      }
      window.dispatchEvent(new Event(CHANGE_EVENT));
    },
    [key, kind]
  );

  return [value, set];
}