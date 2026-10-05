"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { OrbitHero } from "@/components/cosmos";
import { NumberTicker, trackSpotlight, useMagnetic } from "@/components/motion";
import { Arrow } from "@/components/ui";

export function MagneticLink({ href, children, variant = "primary" }: { href: string; children: ReactNode; variant?: "primary" | "secondary" }) {
  const magnetic = useMagnetic<HTMLAnchorElement>(0.22);
  const style =
    variant === "primary"
      ? "sheen bg-star text-void shadow-[0_0_0_1px_rgba(255,255,255,0.4),0_14px_40px_-12px_rgba(185,162,255,0.8)]"
      : "border border-white/12 bg-white/[0.04] text-ink hover:bg-white/[0.08]";
  return (
    <Link
      href={href}
      {...magnetic}
      className={`group inline-flex h-13 items-center gap-2 rounded-full px-6 text-[15px] font-semibold transition-[transform,background-color,box-shadow] duration-300 ease-out-expo focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nova ${style}`}
    >
      {children}
      <Arrow />
    </Link>
  );
}

export function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-[560px]">
      <OrbitHero />
      <span className="float glass absolute left-[2%] top-[14%] rounded-full px-3 py-1.5 text-xs font-medium text-nova" style={{ animationDelay: "0s" }}>
        AI checked 5 criteria
      </span>
      <span className="float glass absolute right-[0%] top-[46%] rounded-full px-3 py-1.5 text-xs font-medium text-mint" style={{ animationDelay: "1.2s" }}>
        +$800.00 released
      </span>
      <span className="float glass absolute bottom-[10%] left-[8%] rounded-full px-3 py-1.5 text-xs font-medium text-ice" style={{ animationDelay: "2.4s" }}>
        $200.00 held for a fix
      </span>
    </div>
  );
}

const demoChecks = [
  { title: "Page is live over HTTPS", kind: "Test", pass: true },
  { title: "Hero uses the approved headline", kind: "AI", pass: true },
  { title: "No sideways scroll at 375 px", kind: "Test", pass: true },
  { title: "Contact form sends a message", kind: "Test", pass: false },
  { title: "Colours follow the style guide", kind: "AI", pass: true },
];

/** A tiny live demo of the verifier on the landing page: run it and watch money become releasable. */
export function MiniVerifier() {
  const [step, setStep] = useState(-1);
  const running = step >= 0 && step < demoChecks.length;

  useEffect(() => {
    if (step < 0 || step >= demoChecks.length) return;
    const t = setTimeout(() => setStep((s) => s + 1), 650);
    return () => clearTimeout(t);
  }, [step]);

  const released = demoChecks.slice(0, Math.max(0, step)).filter((c) => c.pass).length * 200;

  return (
    <div onMouseMove={trackSpotlight} className="spotlight glass rounded-3xl p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-dim">Landing page for Northwind · $1,000</p>
          <p className="mt-2 font-display text-4xl font-semibold text-ink font-stretch-semi-expanded">
            <NumberTicker value={released} duration={600} />
          </p>
          <p className="text-sm text-mute">releasable so far</p>
        </div>
        <button
          type="button"
          onClick={() => setStep(0)}
          disabled={running}
          className="sheen inline-flex h-11 items-center gap-2 rounded-full bg-star px-5 text-sm font-semibold text-void transition active:scale-[0.97] disabled:opacity-60"
        >
          {running ? (
            <>
              <span className="size-3.5 animate-spin rounded-full border-2 border-void/25 border-t-void" aria-hidden />
              Checking…
            </>
          ) : step >= demoChecks.length ? (
            "Run it again"
          ) : (
            "Run the AI check"
          )}
        </button>
      </div>
      <ul className="mt-6 divide-y divide-white/[0.06]">
        {demoChecks.map((c, i) => {
          const done = step > i;
          const active = step === i;
          return (
            <li key={c.title} className="flex items-center gap-3 py-3 text-sm">
              <span
                className={`size-2.5 shrink-0 rounded-full transition-all duration-500 ${done ? (c.pass ? "bg-mint shadow-[0_0_12px_var(--color-mint)]" : "bg-flare shadow-[0_0_12px_var(--color-flare)]") : active ? "bg-nova pulse-soft" : "bg-white/15"}`}
              />
              <span className={`min-w-0 flex-1 transition-colors ${done || active ? "text-ink" : "text-dim"}`}>{c.title}</span>
              <span className="font-mono text-[11px] text-dim">{c.kind}</span>
              <span className={`w-20 text-right font-mono text-xs transition-opacity duration-500 ${done ? "opacity-100" : "opacity-0"} ${c.pass ? "text-mint" : "text-flare"}`}>{c.pass ? "+$200" : "held"}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
