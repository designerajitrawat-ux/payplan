"use client";

import { useCallback, useRef, useState } from "react";
import { toastError } from "./toast";

/** Runs one server action at a time for a button: tracks "pending" and turns failures into a toast. */
export function useAction() {
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const run = useCallback(async (fn: () => Promise<unknown>, failTitle?: string): Promise<boolean> => {
    if (busy.current) return false;
    busy.current = true;
    setPending(true);
    try {
      await fn();
      return true;
    } catch (error) {
      toastError(error, failTitle);
      return false;
    } finally {
      busy.current = false;
      setPending(false);
    }
  }, []);
  return { pending, run };
}
