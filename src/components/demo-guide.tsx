"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Arrow } from "./ui";

const TOTAL = 7;

/** Floating walkthrough card for the clickable prototype: tells the reviewer who they are and what to click next. */
export function DemoGuide({ step, children, next }: { step: number | "tour"; children: ReactNode; next?: { href: string; label: string } }) {
  const [open, setOpen] = useState(true);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="glass fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium text-ink">
        <span className="size-1.5 rounded-full bg-sun glow-dot pulse-soft" />
        Show walkthrough
      </button>
    );
  }
  return (
    <aside className="toast-in glass fixed inset-x-4 bottom-4 z-40 rounded-3xl p-5 text-sm sm:left-auto sm:w-[400px]" aria-label="Prototype walkthrough">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-sun">{step === "tour" ? "Tour" : `Step ${step} of ${TOTAL}`}</p>
          {step === "tour" ? null : (
            <span className="flex gap-1" aria-hidden>
              {Array.from({ length: TOTAL }, (_, i) => (
                <span key={i} className={`h-1 rounded-full transition-all duration-500 ${i < step ? "w-4 bg-sun" : "w-1.5 bg-white/15"}`} />
              ))}
            </span>
          )}
        </div>
        <button type="button" onClick={() => setOpen(false)} className="rounded-md px-1.5 py-0.5 text-xs text-dim transition hover:bg-white/5 hover:text-ink" aria-label="Hide walkthrough">
          Hide
        </button>
      </div>
      <div className="mt-3 leading-relaxed text-mute [&_strong]:font-semibold [&_strong]:text-ink">{children}</div>
      {next ? (
        <Link href={next.href} className="group mt-4 inline-flex items-center gap-2 rounded-full bg-sun px-4 py-2 text-[13px] font-semibold text-void transition hover:brightness-110 active:scale-[0.97]">
          {next.label}
          <Arrow className="size-3.5" />
        </Link>
      ) : null}
    </aside>
  );
}
