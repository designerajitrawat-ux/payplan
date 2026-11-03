"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useId, useState, type ReactNode } from "react";
import { NumberTicker, trackSpotlight } from "@/components/motion";
import { Arrow } from "@/components/ui";

const ctaStyles = {
  primary: "volt-fill bg-brand text-white [--lip-color:#0f249e] hover:bg-[#3557ff]",
  secondary: "border border-white/12 bg-panel-2 text-ink [--lip-color:#000000] hover:bg-[#222739]",
  light: "bg-white text-paper-ink [--lip-color:#0b1a7a] hover:bg-paper",
  ink: "border border-white/10 bg-paper-ink text-white [--lip-color:#000000] hover:bg-[#1b1d26]",
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
  { title: "Page is live over HTTPS", kind: "Test", pass: true, sure: 99, how: "Opens the delivered URL", evidence: "HTTP 200 over TLS, loaded in 0.4 s" },
  { title: "Hero uses the approved headline", kind: "AI", pass: true, sure: 93, how: "The AI reads the page", evidence: "Hero reads “Know where every rupee goes”" },
  { title: "No sideways scroll at 375 px", kind: "Test", pass: true, sure: 97, how: "Renders it on a phone screen", evidence: "Content fits a 375 px screen" },
  { title: "Contact form sends a message", kind: "Test", pass: false, sure: 98, how: "Sends a test message", evidence: "The test message got HTTP 500" },
  { title: "Colours follow the style guide", kind: "AI", pass: true, sure: 88, how: "The AI compares it with the guide", evidence: "Teal #0F766E and amber #F59E0B found" },
];

const STEP_MS = 800;
const SHARE = 200;

type RowState = "idle" | "checking" | "pass" | "fail";

const rowState = (i: number, step: number): RowState => (step > i ? (demoChecks[i].pass ? "pass" : "fail") : step === i ? "checking" : "idle");

function StatusMark({ state, sure }: { state: RowState; sure: number }) {
  if (state === "checking") return <span className="block size-4 animate-spin rounded-full border-2 border-nova/30 border-t-nova" aria-label="Checking" />;
  if (state === "idle") return <span className="font-mono text-xs text-dim">waiting</span>;
  const pass = state === "pass";
  return (
    <span className={`inline-flex items-center gap-1.5 font-mono text-xs font-semibold ${pass ? "text-mint" : "text-flare"}`}>
      <span className={`grid size-5 place-items-center rounded-full text-void ${pass ? "bg-mint" : "bg-flare"}`}>
        <svg viewBox="0 0 16 16" className="size-3" aria-hidden>
          {pass ? (
            <motion.path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.3 }} />
          ) : (
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
          )}
        </svg>
      </span>
      {pass ? `${sure}%` : "not met"}
    </span>
  );
}

function CheckRow({ i, state }: { i: number; state: RowState }) {
  const c = demoChecks[i];
  return (
    <motion.li
      // Springs take only two keyframes, so the shake runs as a tween.
      animate={state === "fail" ? { x: [0, -4, 4, -2, 0] } : { x: 0 }}
      transition={{ type: "tween", duration: 0.4, ease: "easeInOut" }}
      className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 rounded-2xl sm:grid-cols-[1.75rem_minmax(0,1fr)_auto] border px-3.5 py-3 transition-colors duration-500 ${
        state === "fail" ? "border-flare/30 bg-flare/[0.06]" : state === "pass" ? "border-mint/20 bg-mint/[0.04]" : state === "checking" ? "beam border-nova/40 bg-nova/[0.07]" : "border-white/[0.07] bg-white/[0.02]"
      }`}
    >
      <span className="hidden font-mono text-xs text-dim sm:block">{String(i + 1).padStart(2, "0")}</span>
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 text-sm leading-snug text-ink">
          {c.title}
          <span className={`rounded-md px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${c.kind === "AI" ? "bg-nova/15 text-nova" : "bg-white/[0.06] text-mute"}`}>{c.kind}</span>
        </p>
        {/* One line that always holds its place, so the card never changes height: how it is checked, then what was found. */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={state === "pass" || state === "fail" ? "found" : "how"}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
            className={`truncate pt-1 font-mono text-[11px] ${state === "pass" || state === "fail" ? "text-mute" : "text-dim"}`}
          >
            {state === "pass" || state === "fail" ? c.evidence : c.how}
          </motion.p>
        </AnimatePresence>
      </div>
      <span>
        <StatusMark state={state} sure={c.sure} />
      </span>
    </motion.li>
  );
}

/**
 * The money shot: an AI check run in front of you. Each criterion is a $200 slice of the hold; a passed slice
 * turns mint and its money moves to the freelancer, a failed one stays on hold.
 */
export function MiniVerifier() {
  const [step, setStep] = useState(-1);
  const running = step >= 0 && step < demoChecks.length;
  const done = step >= demoChecks.length;

  useEffect(() => {
    if (!running) return;
    const t = setTimeout(() => setStep((s) => s + 1), STEP_MS);
    return () => clearTimeout(t);
  }, [step, running]);

  const states = demoChecks.map((_, i) => rowState(i, step));
  const released = states.filter((x) => x === "pass").length * SHARE;
  const held = states.filter((x) => x === "fail").length * SHARE;

  return (
    <div onMouseMove={trackSpotlight} className="spotlight glass rounded-[28px] p-5 shadow-[0_40px_80px_-30px_rgba(5,10,40,0.8)] sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-nova">
            <span className={`size-1.5 rounded-full bg-nova glow-dot ${running ? "pulse-soft" : ""}`} />
            AI checker · live demo
          </p>
          <p className="mt-1 font-display text-lg font-semibold text-ink">Landing page for Northwind</p>
        </div>
        <button
          type="button"
          onClick={() => setStep(0)}
          disabled={running}
          className="press inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-paper-ink transition duration-150 [--lip-color:#0b1a7a] hover:bg-paper disabled:opacity-70"
        >
          {running ? (
            <>
              <span className="size-3.5 animate-spin rounded-full border-2 border-paper-ink/20 border-t-paper-ink" aria-hidden />
              Checking {step + 1} of {demoChecks.length}
            </>
          ) : done ? (
            "Run it again"
          ) : (
            <>
              <svg viewBox="0 0 16 16" className="size-4 text-brand" aria-hidden>
                <path d="M8 1.5l1.6 4.2 4.4 1.3-4.4 1.3L8 12.5 6.4 8.3 2 7l4.4-1.3z" fill="currentColor" />
              </svg>
              Run the AI check
            </>
          )}
        </button>
      </div>

      <div className="mt-6 rounded-2xl border border-white/[0.07] bg-void/50 p-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs text-dim">Held on Sam&apos;s PayPal</p>
            <p className="font-sans text-2xl font-semibold text-ice sm:text-3xl">
              <NumberTicker value={1000 - released} duration={600} />
            </p>
          </div>
          <div className="relative text-right">
            <AnimatePresence>
              {released > 0 && running ? (
                <motion.span
                  key={released}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: -18 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.6 }}
                  className="absolute -top-2 right-0 font-mono text-xs font-semibold text-mint"
                  aria-hidden
                >
                  +$200
                </motion.span>
              ) : null}
            </AnimatePresence>
            <p className="text-xs text-dim">Released to Riya</p>
            <p className="font-sans text-2xl font-semibold text-mint sm:text-3xl">
              <NumberTicker value={released} duration={600} />
            </p>
          </div>
        </div>
        <div className="mt-4 flex gap-1.5" role="img" aria-label={`${released / SHARE} of ${demoChecks.length} shares released`}>
          {states.map((st, i) => (
            <span
              key={i}
              className={`grid h-7 flex-1 place-items-center rounded-lg font-mono text-[10px] transition-all duration-500 ${
                st === "pass"
                  ? "bg-mint text-void shadow-[0_0_18px_rgba(34,227,160,0.45)]"
                  : st === "fail"
                    ? "bg-flare text-void"
                    : st === "checking"
                      ? "pulse-soft bg-nova/70 text-void"
                      : "bg-[repeating-linear-gradient(135deg,rgba(79,200,255,0.35)_0_4px,rgba(79,200,255,0.15)_4px_8px)] text-ice"
              }`}
            >
              $200
            </span>
          ))}
        </div>
      </div>

      <ol className="mt-4 space-y-2">
        {demoChecks.map((_, i) => (
          <CheckRow key={i} i={i} state={states[i]} />
        ))}
      </ol>

      <p role="status" className="mt-4 min-h-5 text-sm text-mute">
        {done ? (
          <>
            <span className="font-semibold text-mint">${released} released</span> · ${held} stays on hold until the form is fixed.
          </>
        ) : running ? (
          "The checker opens the page, runs the tests and asks the AI about the rest."
        ) : (
          "Five criteria, $200 each. Press run and watch which shares unlock."
        )}
      </p>
    </div>
  );
}
