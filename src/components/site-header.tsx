"use client";

import { MotionConfig, motion } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { resetDemo, resumeBackgroundWork, useMilestones, usePayPalMode } from "@/lib/store";
import { clearToasts, Toaster } from "./toast";

/** The drafting grid behind every page, fading out below the top of the screen. */
function Backdrop() {
  return <div aria-hidden className="blueprint pointer-events-none fixed inset-0 -z-10" />;
}

/** The mark: a padlock (the PayPal hold) with a tick (the verified work). On hover the shackle lifts, like a release. */
export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="group flex items-center gap-2.5">
      <svg viewBox="0 0 32 32" className="size-8" aria-hidden>
        <rect width="32" height="32" rx="9" fill="var(--color-brand)" />
        <path d="M11 14.5v-3a5 5 0 0 1 10 0v3" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" className="transition-transform duration-500 ease-out-expo group-hover:-translate-y-[2.5px]" />
        <rect x="7.5" y="14" width="17" height="12" rx="3" fill="#fff" />
        <path d="M11.8 20.2l2.7 2.6 5.6-5.6" fill="none" stroke="var(--color-brand)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {compact ? null : <span className="font-display text-[19px] font-semibold tracking-tight text-ink">PayPlan</span>}
    </span>
  );
}

const nav = [
  {
    href: "/dashboard",
    label: "Milestones",
    match: (p: string) => p === "/dashboard" || p.startsWith("/m/"),
    icon: <path d="M4 6h16M4 12h16M4 18h10" />,
  },
  {
    href: "/new",
    label: "New milestone",
    short: "New",
    match: (p: string) => p === "/new",
    icon: <path d="M12 5v14M5 12h14" />,
  },
  {
    href: "/agents",
    label: "Agents",
    match: (p: string) => p === "/agents",
    icon: (
      <>
        <rect x="5" y="8" width="14" height="11" rx="3.5" />
        <path d="M12 4v4M9.5 13.5h.01M14.5 13.5h.01" />
      </>
    ),
  },
];

/** Resetting wipes the demo, so it asks for a second click within three seconds. */
function ResetButton({ className }: { className: string }) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  return (
    <button
      type="button"
      onClick={() => {
        if (!armed) {
          setArmed(true);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => setArmed(false), 3000);
          return;
        }
        clearTimeout(timer.current);
        setArmed(false);
        void resetDemo().then(() => router.push("/"));
      }}
      className={`${className} ${armed ? "text-sun" : ""}`}
    >
      {armed ? "Click again to reset" : "Reset demo"}
    </button>
  );
}

const MODE_CARD = {
  prototype: { title: "Prototype · dummy data", body: "No real money moves. The app runs every payment on the PayPal sandbox." },
  simulated: { title: "Simulated PayPal", body: "This server has no PayPal sandbox keys, so PayPal is simulated. Nothing real moves." },
  sandbox: { title: "PayPal sandbox", body: "Real PayPal API calls with test accounts. No real money moves." },
  live: { title: "Live PayPal", body: "Real payments." },
} as const;

/** Says plainly what kind of money this deployment moves. */
function ModeCard() {
  const mode = usePayPalMode();
  if (!mode) return null;
  const card = MODE_CARD[mode];
  return (
    <div data-mode-card className="rounded-2xl border border-sun/20 bg-sun/[0.06] p-3.5 text-xs leading-relaxed text-mute">
      <p className="flex items-center gap-2 font-semibold text-sun">
        <span className="size-1.5 rounded-full bg-sun glow-dot pulse-soft" />
        {card.title}
      </p>
      <p className="mt-1">{card.body}</p>
    </div>
  );
}

const MODE_CHIP = { prototype: "Prototype", simulated: "Simulated", sandbox: "Sandbox", live: "Live" } as const;

function Sidebar() {
  const pathname = usePathname();
  const milestones = useMilestones();
  const mode = usePayPalMode();
  // Same rule as the dashboard's "Your turn" tab, so the two numbers always match.
  const waiting = milestones.filter((m) => m.status === "fix_window" || m.status === "funded").length;

  return (
    <nav aria-label="Main" className="flex flex-col gap-6 border-b border-brand-2/15 bg-deep/80 px-4 py-4 backdrop-blur-xl lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r lg:py-6">
      <div className="flex items-center justify-between gap-3 px-2">
        <Link href="/" aria-label="PayPlan home">
          <Logo />
        </Link>
        <span className="flex items-center gap-2 lg:hidden">
          {mode ? <span className="rounded-full bg-sun/10 px-2 py-0.5 font-mono text-[11px] uppercase tracking-widest text-sun ring-1 ring-inset ring-sun/25">{MODE_CHIP[mode]}</span> : null}
          <ResetButton className="inline-flex min-h-8 items-center rounded-lg px-2.5 text-xs font-medium text-dim transition hover:bg-white/[0.06] hover:text-ink" />
        </span>
      </div>
      <ul className="-mx-1 flex gap-1 overflow-x-auto px-1 lg:flex-col">
        {nav.map((item) => {
          const active = item.match(pathname);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`group relative isolate flex items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm transition-colors ${active ? "text-ink" : "text-mute hover:text-ink"}`}
              >
                {active ? (
                  <motion.span layoutId="nav-active" className="absolute inset-0 -z-10 rounded-xl bg-brand/[0.22] ring-1 ring-inset ring-brand-2/25" transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}>
                    <span className="absolute inset-y-2 left-0 hidden w-0.5 rounded-full bg-brand-2 shadow-[0_0_12px_var(--color-brand-2)] lg:block" />
                  </motion.span>
                ) : (
                  <span className="absolute inset-0 -z-10 rounded-xl transition-colors group-hover:bg-white/[0.04]" />
                )}
                <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  {item.icon}
                </svg>
                {"short" in item ? (
                  <>
                    <span className="lg:hidden">{item.short}</span>
                    <span className="hidden lg:inline">{item.label}</span>
                  </>
                ) : (
                  item.label
                )}
                {item.href === "/dashboard" && waiting > 0 ? (
                  <span className="ml-auto rounded-full bg-brand px-1.5 text-xs font-semibold text-white" aria-label={`${waiting} waiting on you`}>
                    {waiting}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="mt-auto hidden flex-col gap-3 lg:flex">
        <ModeCard />
        <ResetButton className="min-h-9 rounded-xl px-3 py-2 text-left text-xs font-medium text-dim transition hover:bg-white/[0.04] hover:text-ink" />
      </div>
    </nav>
  );
}

const sections = [
  { id: "problem", label: "Problem" },
  { id: "how", label: "How it works" },
  { id: "try", label: "Try it" },
  { id: "paypal", label: "PayPal" },
];

/** Which landing section is crossing the middle of the screen, for the tab bar. None while the hero is on screen. */
function useActiveSection() {
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    const crossing = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) crossing.add(e.target.id);
          else crossing.delete(e.target.id);
        }
        setActive(sections.find((s) => crossing.has(s.id))?.id ?? null);
      },
      { rootMargin: "-50% 0px -50% 0px" },
    );
    for (const s of sections) {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);
  return active;
}

/** A ruled tab bar: numbered sections in mono, the current one filled with volt blue. */
function MarketingHeader() {
  const active = useActiveSection();
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-void/85 backdrop-blur-xl">
      <div className="flex h-13 items-stretch">
        <Link href="/" aria-label="PayPlan home" className="flex items-center border-r border-white/10 px-4 sm:px-6">
          <Logo />
        </Link>
        <nav aria-label="Sections" className="flex flex-1 items-stretch font-mono text-xs uppercase tracking-[0.08em]">
          {sections.map((s, i) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              aria-current={active === s.id ? "true" : undefined}
              className={`items-center border-r border-white/10 px-5 transition-colors ${i === 1 ? "hidden sm:flex" : "hidden lg:flex"} ${active === s.id ? "bg-brand text-white" : "text-mute hover:bg-white/[0.04] hover:text-ink"}`}
            >
              <span className={active === s.id ? "text-white/70" : "text-dim"}>{String(i + 1).padStart(2, "0")}.</span>
              {s.label}
            </a>
          ))}
        </nav>
        <Link href="/dashboard" className="group flex items-center gap-2 bg-brand px-4 font-mono text-xs uppercase tracking-[0.08em] text-white transition-colors hover:bg-[#3557ff] sm:px-6">
          Open the app
          <svg viewBox="0 0 16 16" className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden>
            <path d="M3 8h9M8.5 4.5L12 8l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>
    </header>
  );
}

const MODE_LINE = {
  prototype: "Prototype with dummy data. No real payments are made.",
  simulated: "Simulated PayPal: this server has no sandbox keys. No real payments are made.",
  sandbox: "Runs on the PayPal sandbox with test accounts. No real money moves.",
  live: "",
} as const;

/** What kind of money this deployment moves, plus the trademark note. */
function Disclaimer() {
  const mode = usePayPalMode();
  return (
    <>
      {mode ? `${MODE_LINE[mode]} ` : null}PayPal is a trademark of PayPal, Inc.; this project is not affiliated with PayPal.
    </>
  );
}

/**
 * Keeps a running check going after a reload, so a milestone never stays "checking" forever.
 * In the app the checker runs on the server and this does nothing.
 */
function BackgroundChecks() {
  const milestones = useMilestones();
  useEffect(() => resumeBackgroundWork(milestones), [milestones]);
  return null;
}

function ClearToastsOnNavigate() {
  const pathname = usePathname();
  useEffect(() => clearToasts(), [pathname]);
  return null;
}

function SkipLink() {
  return (
    <button
      type="button"
      onClick={() => document.getElementById("content")?.focus()}
      className="sr-only rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[80]"
    >
      Skip to content
    </button>
  );
}

/** Page frame: a marketing header on the landing page, a sidebar app everywhere else. */
export function Chrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const landing = pathname === "/";
  // The sample client website that the checker opens is its own site, without PayPlan's frame.
  if (pathname.startsWith("/demo/")) return <>{children}</>;
  // Public report pages stand alone: the reader may not use PayPlan at all.
  if (pathname.startsWith("/r/")) {
    return (
      <div className="grain relative isolate min-h-screen">
        <Backdrop />
        <main id="content">{children}</main>
      </div>
    );
  }
  return (
    <MotionConfig reducedMotion="user" transition={{ type: "spring", bounce: 0.15, duration: 0.6 }}>
      <div className="grain relative isolate min-h-screen">
        <SkipLink />
        <BackgroundChecks />
        <ClearToastsOnNavigate />
        <Backdrop />
        {landing ? (
          <>
            <MarketingHeader />
            <main id="content" tabIndex={-1} className="outline-none">
              {children}
            </main>
            <footer className="border-t border-white/[0.06]">
              <p className="mx-auto max-w-7xl px-4 py-8 text-xs text-dim sm:px-6">
                <Disclaimer />
              </p>
            </footer>
          </>
        ) : (
          <div className="lg:flex">
            <Sidebar />
            <div className="min-w-0 flex-1">
              {/* Enter-only transition: exit animations fight the router, which swaps the page immediately. */}
              <motion.main
                key={pathname}
                id="content"
                tabIndex={-1}
                initial={{ opacity: 0, y: 14, filter: "blur(6px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)", transitionEnd: { filter: "none", transform: "none" } }}
                transition={{ type: "spring", bounce: 0, duration: 0.5 }}
                className="mx-auto w-full max-w-6xl px-4 pb-44 pt-6 outline-none sm:px-8 lg:pt-10"
              >
                {children}
              </motion.main>
              <footer className="mx-auto max-w-6xl px-4 pb-8 text-xs text-dim sm:px-8">
                <Disclaimer />
              </footer>
            </div>
          </div>
        )}
        <Toaster />
      </div>
    </MotionConfig>
  );
}
