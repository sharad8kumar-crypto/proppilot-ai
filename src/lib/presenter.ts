"use client";

import { useCallback } from "react";
import { useStoredValue } from "./use-stored-value";

// Presenter mode: hides the demo control panel for a cleaner screen while presenting
export function usePresenter() {
  const [value, setValue] = useStoredValue("proppilot:presenter");
  const setPresenter = useCallback((on: boolean) => setValue(on ? "1" : ""), [setValue]);
  return { presenter: value === "1", setPresenter };
}