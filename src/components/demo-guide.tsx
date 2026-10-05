"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";

/** Floating walkthrough card for the clickable prototype: tells the reviewer who they are and what to click next. */
export function DemoGuide({ step, children, next }: { step: string; children: ReactNode; next?: { href: string; label: string } }) {
  const [open, setOpen] = useState(true);
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-40 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-lg"
      >
        Show walkthrough
      </button>
    );
  }
  return (
    <aside className="fixed inset-x-4 bottom-4 z-40 rounded-2xl bg-slate-900 p-4 text-sm text-slate-100 shadow-2xl sm:left-auto sm:w-96" aria-label="Prototype walkthrough">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-teal-300">Walkthrough · {step}</p>
        <button onClick={() => setOpen(false)} className="text-xs text-slate-400 hover:text-white" aria-label="Hide walkthrough">
          Hide
        </button>
      </div>
      <div className="mt-2 leading-relaxed">{children}</div>
      {next ? (
        <Link href={next.href} className="mt-3 inline-flex rounded-lg bg-teal-500 px-3 py-1.5 font-semibold text-slate-950 hover:bg-teal-400">
          {next.label} →
        </Link>
      ) : null}
    </aside>
  );
}
