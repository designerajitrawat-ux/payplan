"use client";

import { LayoutGroup, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useId, useState, type ReactNode } from "react";
import { NumberTicker, trackSpotlight } from "@/components/motion";
import { Arrow } from "@/components/ui";

const ctaStyles = {
  primary: "bg-brand text-white [--lip-color:#0f249e] hover:bg-[#3557ff]",
  secondary: "border border-white/12 bg-panel-2 text-ink [--lip-color:#000000] hover:bg-[#222739]",
  light: "bg-white text-paper-ink [--lip-color:#0b1a7a] hover:bg-paper",
};

/** The big call to action: a tactile pill you press down into. */
export function CtaLink({ href, children, variant = "primary" }: { href: string; children: ReactNode; variant?: keyof typeof ctaStyles }) {
  return (
    <Link
      href={href}
      className={`press group inline-flex h-13 items-center gap-2 rounded-full px-6 text-[15px] font-semibold transition duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-2 ${ctaStyles[variant]}`}
    >
      {children}
      <Arrow />
    </Link>
  );
}

/** A round badge stuck on the hero; its words run around the rim and turn slowly. Position it with `className`. */
export function SpinSticker({ text, className = "relative" }: { text: string; className?: string }) {
  const rim = useId();
  return (
    <span aria-hidden className={`sticker grid size-28 rotate-[-10deg] place-items-center rounded-full bg-[linear-gradient(135deg,var(--color-mint),var(--color-ice))] text-paper-ink ${className}`}>
      <svg viewBox="0 0 100 100" className="spin-slower absolute inset-0 size-full">
        <defs>
          <path id={rim} d="M50 50m-36 0a36 36 0 1 1 72 0a36 36 0 1 1-72 0" />
        </defs>
        <text className="fill-current font-mono text-[8.5px] font-semibold uppercase">
          <textPath href={`#${rim}`} textLength="224" lengthAdjust="spacing">
            {text}
          </textPath>
        </text>
      </svg>
      <span className="grid size-9 place-items-center rounded-full border-2 border-paper-ink bg-white">
        <svg viewBox="0 0 16 16" className="size-4" aria-hidden>
          <path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </span>
  );
}

/** A small tilted tile with a tick, set inline in a headline like a sticker on paper. */
export function TickSticker() {
  return (
    <span aria-hidden className="sticker relative top-[-0.06em] mx-[0.12em] inline-grid size-[0.82em] rotate-[8deg] place-items-center rounded-[0.2em] bg-mint align-middle text-paper-ink">
      <svg viewBox="0 0 16 16" className="size-[0.5em]">
        <path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

const demoChecks = [
  { title: "Page is live over HTTPS", kind: "Test", pass: true },
  { title: "Hero uses the approved headline", kind: "AI", pass: true },
  { title: "No sideways scroll at 375 px", kind: "Test", pass: true },
  { title: "Contact form sends a message", kind: "Test", pass: false },
  { title: "Colours follow the style guide", kind: "AI", pass: true },
];

const STEP_MS = 750;

function Chip({ i, step }: { i: number; step: number }) {
  const c = demoChecks[i];
  const done = step > i;
  const checking = step === i;
  const failed = done && !c.pass;
  return (
    <motion.li
      layout
      layoutId={`demo-chip-${i}`}
      // Springs take only two keyframes, so the shake runs as a tween.
      transition={{ type: "spring", bounce: 0.2, duration: 0.7, x: { type: "tween", duration: 0.4, ease: "easeInOut" } }}
      animate={failed ? { x: [0, -4, 4, -2, 0] } : { x: 0 }}
      className={`flex items-center gap-3 rounded-2xl border px-3.5 py-3 text-sm ${
        failed ? "border-flare/30 bg-flare/[0.06]" : done ? "border-mint/25 bg-mint/[0.06]" : checking ? "beam border-nova/40 bg-nova/[0.06]" : "border-white/[0.07] bg-white/[0.02]"
      }`}
    >
      <span className={`grid size-5 shrink-0 place-items-center rounded-full ${failed ? "bg-flare text-void" : done ? "bg-mint text-void" : "border border-white/15"}`}>
        {done ? (
          <svg viewBox="0 0 16 16" className="size-3" aria-hidden>
            {c.pass ? (
              <motion.path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.3 }} />
            ) : (
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
            )}
          </svg>
        ) : checking ? (
          <span className="size-2.5 animate-spin rounded-full border-2 border-nova/30 border-t-nova" />
        ) : null}
      </span>
      <span className={`min-w-0 flex-1 leading-snug ${done || checking ? "text-ink" : "text-mute"}`}>{c.title}</span>
      <span className={`font-mono text-xs ${failed ? "text-flare" : done ? "text-mint" : "text-dim"}`}>{failed ? "fix" : "$200"}</span>
    </motion.li>
  );
}

/** The money shot: each criterion that passes carries its $200 from the client's hold to the freelancer. */
export function MiniVerifier() {
  const [step, setStep] = useState(-1);
  const running = step >= 0 && step < demoChecks.length;

  useEffect(() => {
    if (step < 0 || step >= demoChecks.length) return;
    const t = setTimeout(() => setStep((s) => s + 1), STEP_MS);
    return () => clearTimeout(t);
  }, [step]);

  const releasedIdx = demoChecks.map((c, i) => (step > i && c.pass ? i : -1)).filter((i) => i >= 0);
  const heldIdx = demoChecks.map((_, i) => i).filter((i) => !releasedIdx.includes(i));
  const released = releasedIdx.length * 200;

  return (
    <div onMouseMove={trackSpotlight} className="spotlight glass rounded-[28px] p-5 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-dim">Landing page for Northwind · $1,000</p>
        <motion.button
          type="button"
          onClick={() => setStep(0)}
          disabled={running}
          className="press inline-flex h-11 items-center gap-2 rounded-full bg-brand px-5 text-sm font-semibold text-white transition duration-150 [--lip-color:#0f249e] hover:bg-[#3557ff] disabled:opacity-60"
        >
          {running ? (
            <>
              <span className="size-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden />
              Checking…
            </>
          ) : step >= demoChecks.length ? (
            "Run it again"
          ) : (
            "Run the AI check"
          )}
        </motion.button>
      </div>
      <LayoutGroup>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="min-w-0 rounded-3xl border border-ice/15 bg-ice/[0.03] p-3.5">
            <div className="flex items-baseline justify-between gap-2 px-1">
              <span className="text-xs text-dim">Held on Sam&apos;s PayPal</span>
              <span className="text-lg font-semibold text-ice">
                <NumberTicker value={1000 - released} duration={600} />
              </span>
            </div>
            <ul className="mt-3 space-y-2">
              {heldIdx.map((i) => (
                <Chip key={i} i={i} step={step} />
              ))}
            </ul>
          </div>
          <div className="min-w-0 rounded-3xl border border-mint/15 bg-mint/[0.03] p-3.5">
            <div className="flex items-baseline justify-between gap-2 px-1">
              <span className="text-xs text-dim">Released to Riya</span>
              <span className="text-lg font-semibold text-mint">
                <NumberTicker value={released} duration={600} />
              </span>
            </div>
            <ul className="mt-3 space-y-2">
              {releasedIdx.map((i) => (
                <Chip key={i} i={i} step={step} />
              ))}
              {releasedIdx.length === 0 ? <li className="rounded-2xl border border-dashed border-white/10 px-3.5 py-6 text-center text-xs text-dim">Verified shares land here</li> : null}
            </ul>
          </div>
        </div>
      </LayoutGroup>
    </div>
  );
}
