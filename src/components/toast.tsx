"use client";

import { useSyncExternalStore } from "react";

// A tiny toast queue: `toast(...)` from anywhere, `<Toaster />` once in the layout.

type Tone = "good" | "warn" | "info";
type Toast = { id: number; title: string; body?: string; tone: Tone };

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const LIFETIME = 4200;

function emit() {
  listeners.forEach((l) => l());
}

export function toast(title: string, body?: string, tone: Tone = "good") {
  const id = nextId++;
  toasts = [...toasts, { id, title, body, tone }].slice(-3);
  emit();
  setTimeout(() => dismiss(id), LIFETIME);
}

function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const EMPTY: Toast[] = [];

const toneColor: Record<Tone, string> = { good: "bg-mint", warn: "bg-sun", info: "bg-ice" };

export function Toaster() {
  const list = useSyncExternalStore(
    subscribe,
    () => toasts,
    () => EMPTY,
  );
  return (
    <div className="pointer-events-none fixed bottom-4 left-4 z-[60] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2" role="status" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} className="toast-in glass pointer-events-auto relative overflow-hidden rounded-2xl p-4 pr-10">
          <div className="flex items-start gap-3">
            <span className={`mt-1.5 size-2 shrink-0 rounded-full ${toneColor[t.tone]} glow-dot`} />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">{t.title}</p>
              {t.body ? <p className="mt-0.5 text-[13px] text-mute">{t.body}</p> : null}
            </div>
          </div>
          <button onClick={() => dismiss(t.id)} className="absolute right-2 top-2 rounded-md p-1.5 text-dim hover:bg-white/5 hover:text-ink" aria-label="Dismiss">
            <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden>
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
          <span className={`toast-timer absolute bottom-0 left-0 h-0.5 ${toneColor[t.tone]}`} style={{ animationDuration: `${LIFETIME}ms` }} />
        </div>
      ))}
    </div>
  );
}
