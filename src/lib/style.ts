import type { CSSProperties } from "react";

/** Style for the `rise` class: the nth item enters a little after the one before it. */
export const stagger = (i: number) => ({ "--i": i }) as CSSProperties;
