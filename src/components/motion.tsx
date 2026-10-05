"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type MouseEvent, type ReactNode } from "react";
import { money } from "@/lib/format";

// Small motion helpers. Every effect respects the visitor's reduced-motion setting.

function subscribeMotion(listener: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

/** Counts smoothly to `value` whenever it changes; `from` sets where the first count starts. */
export function NumberTicker({ value, from, format = money, duration = 900, className = "" }: { value: number; from?: number; format?: (n: number) => string; duration?: number; className?: string }) {
  const start = useRef(from ?? value);
  const [shown, setShown] = useState(from ?? value);
  const reduced = useReducedMotion();

  useEffect(() => {
    const begin = start.current;
    const length = reduced ? 0 : duration;
    const t0 = performance.now();
    let frame = 0;
    const step = (t: number) => {
      const p = length === 0 ? 1 : Math.min(1, (t - t0) / length);
      const eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
      setShown(begin + (value - begin) * eased);
      if (p < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
      start.current = value;
    };
  }, [value, duration, reduced]);

  // Amounts use the body face: its zero is plain, where the display face draws a dotted zero.
  return <span className={`font-sans font-stretch-semi-expanded ${className}`}>{format(shown)}</span>;
}

/** Moves a soft light under the cursor. Pair with the `spotlight` class. */
export function trackSpotlight(event: MouseEvent<HTMLElement>) {
  const el = event.currentTarget;
  const box = el.getBoundingClientRect();
  el.style.setProperty("--mx", `${event.clientX - box.left}px`);
  el.style.setProperty("--my", `${event.clientY - box.top}px`);
}

/** Pulls an element a little towards the cursor, then lets it spring back. */
export function useMagnetic<T extends HTMLElement>(strength = 0.25) {
  const reduced = useReducedMotion();
  return {
    onMouseMove: (event: MouseEvent<T>) => {
      if (reduced) return;
      const el = event.currentTarget;
      const box = el.getBoundingClientRect();
      const x = (event.clientX - box.left - box.width / 2) * strength;
      const y = (event.clientY - box.top - box.height / 2) * strength;
      el.style.transform = `translate(${x}px, ${y}px)`;
    },
    onMouseLeave: (event: MouseEvent<T>) => {
      event.currentTarget.style.transform = "";
    },
  };
}

const GLYPHS = "0123456789abcdef";

/** Resolves text from random characters, left to right. Used for hashes being signed. */
export function TextScramble({ text, className = "", duration = 700 }: { text: string; className?: string; duration?: number }) {
  const [shown, setShown] = useState(text);
  const reduced = useReducedMotion();

  useEffect(() => {
    const t0 = performance.now();
    let frame = 0;
    const step = (t: number) => {
      const p = reduced ? 1 : Math.min(1, (t - t0) / duration);
      const fixed = Math.floor(p * text.length);
      setShown(
        text
          .split("")
          .map((ch, i) => (i < fixed || ch === "…" ? ch : GLYPHS[Math.floor(Math.random() * GLYPHS.length)]))
          .join(""),
      );
      if (p < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [text, duration, reduced]);

  return <span className={`font-mono ${className}`}>{shown}</span>;
}

/** Copies a value and confirms it in place for a moment. */
export function CopyButton({ value, label = "Copy", className = "" }: { value: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-dim transition hover:bg-white/5 hover:text-ink ${className}`}
      aria-label={copied ? "Copied" : `${label} ${value}`}
    >
      {copied ? (
        <svg viewBox="0 0 16 16" className="size-3.5 text-mint" aria-hidden>
          <path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden>
          <rect x="5" y="5" width="8" height="8" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <path d="M3 10.5V4a1 1 0 011-1h6.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      )}
      <span className={copied ? "text-mint" : ""}>{copied ? "Copied" : label}</span>
    </button>
  );
}

/** Press and hold to confirm a money action; letting go early cancels it. Works with Space or Enter too. */
export function HoldButton({ onComplete, children, duration = 1200, className = "" }: { onComplete: () => void; children: ReactNode; duration?: number; className?: string }) {
  const [progress, setProgress] = useState(0);
  const frame = useRef(0);
  const finished = useRef(false);

  function start() {
    finished.current = false;
    const t0 = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      setProgress(p);
      if (p < 1) frame.current = requestAnimationFrame(step);
      else {
        finished.current = true;
        onComplete();
      }
    };
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(step);
  }

  function cancel() {
    cancelAnimationFrame(frame.current);
    if (!finished.current) setProgress(0);
  }

  const holding = progress > 0 && progress < 1;
  return (
    <button
      type="button"
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onKeyDown={(e) => {
        if ((e.key === " " || e.key === "Enter") && !e.repeat) {
          e.preventDefault();
          start();
        }
      }}
      onKeyUp={(e) => {
        if (e.key === " " || e.key === "Enter") cancel();
      }}
      className={`relative inline-flex h-13 select-none items-center justify-center overflow-hidden rounded-full bg-sun px-6 text-[15px] font-semibold text-void shadow-[0_0_0_1px_rgba(255,181,71,0.5),0_12px_34px_-10px_rgba(255,181,71,0.7)] transition active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nova ${className}`}
    >
      <span aria-hidden className="absolute inset-0 origin-left bg-white/45" style={{ transform: `scaleX(${progress})` }} />
      <span className="relative flex items-center gap-2">
        <svg viewBox="0 0 20 20" className="size-5 -rotate-90" aria-hidden>
          <circle cx="10" cy="10" r="7.5" fill="none" stroke="rgba(10,14,28,0.25)" strokeWidth="2.2" />
          <circle cx="10" cy="10" r="7.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeDasharray={`${progress * 47.1} 47.1`} strokeLinecap="round" />
        </svg>
        {holding ? "Keep holding…" : children}
      </span>
    </button>
  );
}
