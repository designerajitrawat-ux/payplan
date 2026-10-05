"use client";

import { AnimatePresence, motion, useScroll, useSpring, useTransform } from "motion/react";
import { useRef, useState, type ReactNode } from "react";
import { ConfidenceRing, MoneyOrbit, type MoonState } from "@/components/cosmos";
import { HoldButton, NumberTicker, trackSpotlight } from "@/components/motion";

const spring = { type: "spring", bounce: 0.2, duration: 0.8 } as const;

/** Headline that arrives word by word, each word sharpening from a blur. */
export function WordReveal({ text, className = "", wordClassName = "", delay = 0 }: { text: string; className?: string; wordClassName?: string; delay?: number }) {
  const words = text.split(" ");
  return (
    <span className={className}>
      <span className="sr-only">{text}</span>
      {words.map((w, i) => (
        <motion.span
          key={`${w}-${i}`}
          aria-hidden
          className={`inline-block whitespace-pre ${wordClassName}`}
          initial={{ opacity: 0, y: "0.35em", filter: "blur(10px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ ...spring, delay: delay + i * 0.05 }}
        >
          {w}
          {i < words.length - 1 ? " " : ""}
        </motion.span>
      ))}
    </span>
  );
}

/** Fades and lifts children in once they scroll into view. */
export function InView({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 28, filter: "blur(8px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ ...spring, delay }}
    >
      {children}
    </motion.div>
  );
}

const shotRows = [
  { title: "Page is live and loads over HTTPS", c: 0.99, pass: true },
  { title: "Hero uses the approved headline", c: 0.93, pass: true },
  { title: "Contact form sends a message", c: 0.98, pass: false },
];

const shotSegments: { weight: number; state: MoonState }[] = [
  { weight: 20, state: "verified" },
  { weight: 20, state: "verified" },
  { weight: 20, state: "verified" },
  { weight: 20, state: "failed" },
  { weight: 20, state: "verified" },
];

/** The product itself, in a window that tilts back and flattens as you scroll to it. */
export function ProductWindow() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "start 0.25"] });
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.4 });
  const rotateX = useTransform(progress, [0, 1], [28, 0]);
  const scale = useTransform(progress, [0, 1], [0.86, 1]);
  const y = useTransform(progress, [0, 1], [60, 0]);
  const glow = useTransform(progress, [0, 1], [0.2, 0.7]);

  return (
    <div ref={ref} className="relative mx-auto max-w-6xl px-4 [perspective:1400px] sm:px-6">
      <motion.div aria-hidden className="absolute inset-x-[10%] -top-10 bottom-0 rounded-full bg-nova/30 blur-[120px]" style={{ opacity: glow }} />
      <motion.div style={{ rotateX, scale, y }} className="glass relative origin-top overflow-hidden rounded-[28px] p-2 shadow-[0_60px_120px_-40px_rgba(0,0,0,0.9)]">
        <div className="flex items-center gap-2 px-3 py-2">
          <span className="size-2.5 rounded-full bg-white/15" />
          <span className="size-2.5 rounded-full bg-white/15" />
          <span className="size-2.5 rounded-full bg-white/15" />
          <span className="mx-auto hidden rounded-full bg-white/[0.04] px-4 py-1 font-mono text-xs text-dim sm:block">payplan.app/m/m-1051/report</span>
        </div>
        <div className="grid gap-4 rounded-[22px] bg-void/80 p-4 sm:p-6 lg:grid-cols-[180px_minmax(0,1fr)]">
          <div className="hidden flex-col gap-1.5 text-[13px] lg:flex">
            {["Milestones", "New milestone", "Agents"].map((n, i) => (
              <span key={n} className={`rounded-xl px-3 py-2 ${i === 0 ? "bg-white/[0.07] text-ink" : "text-dim"}`}>
                {n}
              </span>
            ))}
          </div>
          <div className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-dim">Acceptance report · attempt 1</p>
                <p className="mt-1 font-display text-xl font-semibold text-ink sm:text-2xl">Landing page for Northwind</p>
              </div>
              <span className="rounded-full bg-nova/10 px-2.5 py-1 text-xs text-nova ring-1 ring-inset ring-nova/25">Report ready</span>
            </div>
            <div className="grid gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:items-center">
              <div>
                <p className="font-sans text-4xl font-semibold tracking-tight text-ink font-stretch-semi-expanded sm:text-5xl">$800.00</p>
                <p className="mt-1 text-sm text-mute">can be released to Riya</p>
                <p className="mt-3 text-xs text-dim">4 of 5 criteria passed · $200.00 waits for a fix</p>
              </div>
              <MoneyOrbit amountLabel="$1,000" segments={shotSegments} holding releasing={false} agent />
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {shotRows.map((r) => (
                <div key={r.title} className={`flex items-center gap-3 rounded-2xl border p-3 ${r.pass ? "border-white/[0.06] bg-white/[0.02]" : "border-flare/25 bg-flare/[0.05]"}`}>
                  <ConfidenceRing value={r.c} tone={r.pass ? "mint" : "flare"} />
                  <span className="min-w-0 text-xs text-ink">{r.title}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/** An endless strip of the platform pieces the product actually calls. */
export function Marquee({ items }: { items: string[] }) {
  const row = [...items, ...items];
  return (
    <div className="relative overflow-hidden py-2 [mask-image:linear-gradient(90deg,transparent,black_12%,black_88%,transparent)]">
      <motion.div className="flex w-max gap-3" animate={{ x: ["0%", "-50%"] }} transition={{ duration: 38, ease: "linear", repeat: Infinity }}>
        {row.map((item, i) => (
          <span key={i} className="whitespace-nowrap rounded-full border border-white/[0.08] bg-white/[0.02] px-4 py-2 font-mono text-xs text-mute">
            {item}
          </span>
        ))}
      </motion.div>
    </div>
  );
}

type Chapter = {
  eyebrow: string;
  title: string;
  body: string;
  caption: string;
  tone: string;
  orbit: { segments: MoonState[]; holding: boolean; releasing: boolean; agent: boolean; held: number; released: number };
};

const chapters: Chapter[] = [
  {
    eyebrow: "01 · Agree",
    title: "Done is defined before money moves.",
    body: "Freelancer and client agree five criteria and a weight for each. The spec is frozen and hashed, so nobody can move the goalposts later.",
    caption: "5 criteria · 20% each · spec hashed",
    tone: "text-mute",
    orbit: { segments: ["pending", "pending", "pending", "pending", "pending"], holding: false, releasing: false, agent: false, held: 0, released: 0 },
  },
  {
    eyebrow: "02 · Lock",
    title: "The money waits on the client's own PayPal.",
    body: "One PayPal authorization holds the full amount. Nothing is charged, and PayPlan never holds a cent.",
    caption: "$1,000 authorized · nothing charged",
    tone: "text-ice",
    orbit: { segments: ["pending", "pending", "pending", "pending", "pending"], holding: true, releasing: false, agent: false, held: 1000, released: 0 },
  },
  {
    eyebrow: "03 · Verify",
    title: "An AI checker tests every criterion.",
    body: "It opens the live work, runs tests, takes screenshots and scores what a test cannot. Both sides see the same evidence.",
    caption: "4 of 5 passed · contact form failed",
    tone: "text-nova",
    orbit: { segments: ["verified", "verified", "verified", "failed", "verified"], holding: true, releasing: false, agent: false, held: 1000, released: 0 },
  },
  {
    eyebrow: "04 · Release",
    title: "Only the share that passed is paid.",
    body: "PayPal captures $800 for the four passed criteria. The last $200 stays a hold until the fix passes, or goes back.",
    caption: "+$800 captured · $200 still held",
    tone: "text-mint",
    orbit: { segments: ["released", "released", "released", "failed", "released"], holding: true, releasing: true, agent: false, held: 200, released: 800 },
  },
  {
    eyebrow: "05 · Agent",
    title: "Or let your agent say yes, within limits.",
    body: "The client's AI agent reads the signed report, checks its mandate and releases the verified share. Anything uncertain goes back to a person.",
    caption: "Agent: GO · within its $1,000 limit",
    tone: "text-nova",
    orbit: { segments: ["released", "released", "released", "failed", "released"], holding: true, releasing: true, agent: true, held: 200, released: 800 },
  },
];

function ChapterOrbit({ c }: { c: Chapter }) {
  return (
    <div>
      <MoneyOrbit amountLabel="$1,000" segments={c.orbit.segments.map((state) => ({ weight: 20, state }))} holding={c.orbit.holding} releasing={c.orbit.releasing} agent={c.orbit.agent} />
      <div className="mt-2 grid grid-cols-3 text-center text-xs">
        <span className="text-dim">
          Client · <span className="text-ice">${c.orbit.held}</span>
        </span>
        <span className="text-dim">Authorization</span>
        <span className="text-dim">
          Freelancer · <span className="text-mint">${c.orbit.released}</span>
        </span>
      </div>
    </div>
  );
}

/** Scroll-driven story: the visual stays put while each chapter scrolls past and updates it. */
export function StoryScroll() {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.5", "end 0.5"] });
  const bar = useSpring(scrollYProgress, { stiffness: 140, damping: 30 });
  const c = chapters[active];

  return (
    <div ref={ref} className="relative mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16">
      <div className="hidden lg:block">
        <div className="sticky top-24 flex h-[calc(100svh-8rem)] flex-col justify-center">
          <div className="glass rounded-[28px] p-8">
            <ChapterOrbit c={c} />
            <div className="mt-6 flex h-8 items-center justify-center">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.p
                  key={c.caption}
                  initial={{ opacity: 0, y: 12, filter: "blur(6px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -12, filter: "blur(6px)" }}
                  transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                  className={`rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 font-mono text-xs ${c.tone}`}
                >
                  {c.caption}
                </motion.p>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      <div className="relative">
        <div aria-hidden className="absolute bottom-0 left-0 top-0 hidden w-px bg-white/[0.08] lg:block">
          <motion.div className="h-full w-full origin-top bg-gradient-to-b from-nova via-ice to-mint" style={{ scaleY: bar }} />
        </div>
        <ol className="space-y-10 lg:space-y-0">
          {chapters.map((ch, i) => (
            <motion.li
              key={ch.eyebrow}
              onViewportEnter={() => setActive(i)}
              viewport={{ margin: "-50% 0px -50% 0px" }}
              className="flex flex-col justify-center lg:min-h-[78svh] lg:pl-12"
            >
              <motion.div animate={{ opacity: i === active ? 1 : 0.32 }} transition={{ duration: 0.4 }} className="max-lg:opacity-100!">
                <p className={`font-mono text-xs uppercase tracking-[0.16em] ${ch.tone}`}>{ch.eyebrow}</p>
                <h3 className="mt-3 font-display text-3xl font-semibold tracking-tight text-balance text-ink font-stretch-semi-expanded sm:text-4xl">{ch.title}</h3>
                <p className="mt-4 max-w-md text-[17px] leading-relaxed text-mute">{ch.body}</p>
                <div className="glass mt-6 rounded-3xl p-5 lg:hidden">
                  <ChapterOrbit c={ch} />
                  <p className={`mt-3 text-center font-mono text-xs ${ch.tone}`}>{ch.caption}</p>
                </div>
              </motion.div>
            </motion.li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function Tile({ className = "", eyebrow, title, children }: { className?: string; eyebrow: string; title: string; children: ReactNode }) {
  return (
    <motion.article
      onMouseMove={trackSpotlight}
      whileHover={{ y: -4 }}
      transition={{ type: "spring", bounce: 0.3, duration: 0.5 }}
      className={`spotlight glass flex h-full flex-col overflow-hidden rounded-[28px] p-6 ${className}`}
    >
      <p className="font-mono text-xs uppercase tracking-[0.16em] text-dim">{eyebrow}</p>
      <h3 className="mt-2 font-display text-xl font-semibold text-ink">{title}</h3>
      <div className="mt-6 flex flex-1 flex-col justify-end">{children}</div>
    </motion.article>
  );
}

const goChecks = ["Release permission", "Within spending limit", "Must-pass criteria", "AI confidence 88% ≥ 85%"];

/** Product promises as small working demos rather than claims. */
export function Bento() {
  const [released, setReleased] = useState(false);
  return (
    <div className="mx-auto grid max-w-7xl gap-4 px-4 sm:px-6 md:grid-cols-6">
      <InView className="h-full md:col-span-4">
        <Tile eyebrow="Try it" title="Money moves only when you mean it.">
          <div className="flex flex-wrap items-center gap-6">
            <HoldButton onComplete={() => setReleased(true)}>{released ? "Released" : "Hold to release $800"}</HoldButton>
            <div>
              <p className="font-sans text-3xl font-semibold text-mint font-stretch-semi-expanded">
                <NumberTicker value={released ? 800 : 0} duration={900} />
              </p>
              <p className="text-xs text-dim">{released ? "Captured on PayPal" : "Released to Riya"}</p>
            </div>
            {released ? (
              <button type="button" onClick={() => setReleased(false)} className="text-xs text-dim underline-offset-4 hover:text-ink hover:underline">
                Reset
              </button>
            ) : null}
          </div>
        </Tile>
      </InView>
      <InView className="h-full md:col-span-2" delay={0.08}>
        <Tile eyebrow="Silence" title="A quiet client can't stall payment.">
          <div className="flex items-center gap-4">
            <svg viewBox="0 0 44 44" className="size-16 -rotate-90" aria-hidden>
              <circle cx="22" cy="22" r="18" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
              <motion.circle cx="22" cy="22" r="18" fill="none" stroke="var(--color-sun)" strokeWidth="4" strokeLinecap="round" initial={{ pathLength: 1 }} whileInView={{ pathLength: 0.15 }} viewport={{ once: true }} transition={{ duration: 2.4, ease: "easeInOut" }} />
            </svg>
            <p className="text-sm text-mute">When the review window ends, the verified share is released automatically.</p>
          </div>
        </Tile>
      </InView>
      <InView className="h-full md:col-span-2" delay={0.04}>
        <Tile eyebrow="Evidence" title="Proof, not opinions.">
          <div className="space-y-2">
            {shotRows.map((r) => (
              <div key={r.title} className="flex items-center gap-3 text-xs text-mute">
                <span className={`size-2 rounded-full ${r.pass ? "bg-mint" : "bg-flare"}`} />
                <span className="truncate">{r.title}</span>
                <span className={`ml-auto font-mono ${r.pass ? "text-mint" : "text-flare"}`}>{Math.round(r.c * 100)}%</span>
              </div>
            ))}
          </div>
        </Tile>
      </InView>
      <InView className="h-full md:col-span-2" delay={0.08}>
        <Tile eyebrow="Disputes" title="A signed report, ready for PayPal.">
          <p className="font-mono text-sm text-ink">
            report <span className="text-nova">2bdef7…225a</span>
          </p>
          <p className="mt-1 text-xs text-dim">Becomes the evidence file if a dispute opens.</p>
        </Tile>
      </InView>
      <InView className="h-full md:col-span-2" delay={0.12}>
        <Tile eyebrow="Agents" title="Your agent pays within limits.">
          <ul className="space-y-1.5">
            {goChecks.map((g, i) => (
              <motion.li
                key={g}
                initial={{ opacity: 0, x: -8 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ ...spring, delay: 0.2 + i * 0.12 }}
                className="flex items-center justify-between gap-3 text-xs"
              >
                <span className="text-mute">{g}</span>
                <span className="font-mono text-mint">GO</span>
              </motion.li>
            ))}
          </ul>
        </Tile>
      </InView>
    </div>
  );
}
