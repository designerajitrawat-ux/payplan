"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { resetDemo, useMilestones } from "@/lib/store";
import { Starfield } from "./cosmos";
import { toast, Toaster } from "./toast";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="group flex items-center gap-2.5">
      <svg viewBox="0 0 32 32" className="size-8 transition-transform duration-700 ease-out-expo group-hover:rotate-[120deg]" aria-hidden>
        <circle cx="16" cy="16" r="13" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="1.2" />
        <circle cx="16" cy="16" r="5.5" fill="var(--color-star)" />
        <circle cx="27.3" cy="9.5" r="2.6" fill="var(--color-mint)" />
        <circle cx="5.5" cy="21.5" r="1.6" fill="var(--color-nova)" />
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

function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const milestones = useMilestones();
  const waiting = milestones.filter((m) => m.status === "awaiting_decision" || m.status === "fix_window" || m.status === "funded").length;

  return (
    <nav aria-label="Main" className="flex flex-col gap-6 border-b border-white/[0.06] bg-deep/70 px-4 py-4 backdrop-blur-xl lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r lg:py-6">
      <div className="flex items-center justify-between gap-3 px-2">
        <Link href="/" aria-label="PayPlan home">
          <Logo />
        </Link>
        <span className="rounded-full bg-sun/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-sun ring-1 ring-inset ring-sun/25 lg:hidden">Prototype</span>
      </div>
      <ul className="-mx-1 flex gap-1 overflow-x-auto px-1 lg:flex-col">
        {nav.map((item) => {
          const active = item.match(pathname);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`group relative flex items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm transition ${active ? "bg-white/[0.07] text-ink" : "text-mute hover:bg-white/[0.04] hover:text-ink"}`}
              >
                {active ? <span className="absolute inset-y-2 left-0 hidden w-0.5 rounded-full bg-nova shadow-[0_0_12px_var(--color-nova)] lg:block" /> : null}
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
                {item.href === "/dashboard" && waiting > 0 ? <span className="ml-auto rounded-full bg-nova/15 px-1.5 text-[11px] font-semibold text-nova">{waiting}</span> : null}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="mt-auto hidden flex-col gap-3 lg:flex">
        <div className="rounded-2xl border border-sun/20 bg-sun/[0.06] p-3.5 text-xs leading-relaxed text-mute">
          <p className="flex items-center gap-2 font-semibold text-sun">
            <span className="size-1.5 rounded-full bg-sun glow-dot pulse-soft" />
            Prototype · dummy data
          </p>
          <p className="mt-1">No real money moves. Phase 1 switches every payment to the PayPal sandbox.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            resetDemo();
            toast("Demo reset", "Example milestones are back to their first state.", "info");
            router.push("/");
          }}
          className="rounded-xl px-3 py-2 text-left text-xs font-medium text-dim transition hover:bg-white/[0.04] hover:text-ink"
        >
          Reset demo
        </button>
      </div>
    </nav>
  );
}

function MarketingHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-void/60 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
        <Link href="/" aria-label="PayPlan home">
          <Logo />
        </Link>
        <nav className="flex items-center gap-1 text-sm text-mute">
          <a href="#how" className="hidden rounded-full px-3 py-1.5 transition hover:text-ink sm:inline">
            How it works
          </a>
          <a href="#agents" className="hidden rounded-full px-3 py-1.5 transition hover:text-ink sm:inline">
            Agents
          </a>
          <Link href="/dashboard" className="rounded-full border border-white/10 px-3.5 py-1.5 text-ink transition hover:border-white/25 hover:bg-white/5">
            Open the app
          </Link>
        </nav>
      </div>
    </header>
  );
}

const disclaimer = "Prototype with dummy data. No real payments are made. PayPal is a trademark of PayPal, Inc.; this project is not affiliated with PayPal.";

/** Page frame: a marketing header on the landing page, a sidebar app everywhere else. */
export function Chrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const landing = pathname === "/";
  return (
    <div className="grain relative isolate min-h-screen">
      <Starfield />
      {landing ? (
        <>
          <MarketingHeader />
          <main>{children}</main>
          <footer className="border-t border-white/[0.06]">
            <p className="mx-auto max-w-7xl px-4 py-8 text-xs text-dim sm:px-6">{disclaimer}</p>
          </footer>
        </>
      ) : (
        <div className="lg:flex">
          <Sidebar />
          <div className="min-w-0 flex-1">
            <main key={pathname} className="rise mx-auto w-full max-w-6xl px-4 pb-44 pt-6 sm:px-8 lg:pt-10">
              {children}
            </main>
            <footer className="mx-auto max-w-6xl px-4 pb-8 text-xs text-dim sm:px-8">{disclaimer}</footer>
          </div>
        </div>
      )}
      <Toaster />
    </div>
  );
}
