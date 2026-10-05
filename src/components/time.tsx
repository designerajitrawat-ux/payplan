"use client";

import { useSyncExternalStore } from "react";

// A shared one-second clock. The server renders a placeholder, so times never cause hydration mismatches.
let tick = 0;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!timer) {
    timer = setInterval(() => {
      tick = Date.now();
      listeners.forEach((l) => l());
    }, 1000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

function getSnapshot() {
  if (tick === 0) tick = Date.now();
  return tick;
}

export function useNow(): number | null {
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}

export function formatDuration(ms: number): string {
  if (ms <= 0) return "ended";
  const totalMinutes = Math.floor(ms / 60_000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  const seconds = Math.floor((ms % 60_000) / 1000);
  return `${minutes}m ${seconds}s`;
}

export function Countdown({ to }: { to?: string }) {
  const now = useNow();
  if (!to || now === null) return <span>…</span>;
  return <span className="tabular-nums">{formatDuration(Date.parse(to) - now)}</span>;
}

const dateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export function When({ at }: { at?: string }) {
  const now = useNow();
  if (!at || now === null) return <span>…</span>;
  return <time dateTime={at}>{dateFormat.format(new Date(at))}</time>;
}
