"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

const noop = () => () => {};

/** Renders floating layers (dialogs, the walkthrough card) on <body>, so a parent's filter or blur cannot trap them. */
export function Portal({ children }: { children: ReactNode }) {
  const mounted = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  return mounted ? createPortal(children, document.body) : null;
}
