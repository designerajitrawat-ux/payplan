"use client";

import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { ledgerTotals } from "@/lib/decision";
import type { LedgerEntry, MilestoneStatus, Verdict } from "@/lib/types";
import { NumberTicker, trackSpotlight } from "./motion";

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-2 disabled:pointer-events-none disabled:opacity-40";

// Filled buttons are tactile (a lip you press into); quiet ones shrink a little instead.
const buttonVariants = {
  primary: "press volt-fill bg-brand text-white [--lip-color:#0f249e] hover:bg-[#3557ff]",
  secondary: "press border border-white/12 bg-panel-2 text-ink [--lip-color:#000000] hover:bg-[#222739]",
  ghost: "text-mute hover:bg-white/5 hover:text-ink active:scale-[0.97]",
  danger: "border border-flare/40 bg-flare/5 text-flare hover:bg-flare/10 active:scale-[0.97]",
  agent: "press bg-nova text-void [--lip-color:#5a44c4] hover:brightness-110",
  money: "press bg-sun text-void [--lip-color:#a87400] hover:brightness-105",
};

const buttonSizes = { sm: "h-9 px-3.5 text-[13px]", md: "h-11 px-5 text-sm", lg: "h-13 px-6 text-[15px]" };

type ButtonStyle = { variant?: keyof typeof buttonVariants; size?: keyof typeof buttonSizes };

export function Button({ variant = "primary", size = "md", className = "", ...props }: ComponentProps<"button"> & ButtonStyle) {
  return <button type="button" className={`${buttonBase} ${buttonVariants[variant]} ${buttonSizes[size]} ${className}`} {...props} />;
}

export function ButtonLink({ variant = "primary", size = "md", className = "", ...props }: ComponentProps<typeof Link> & ButtonStyle) {
  return <Link className={`${buttonBase} ${buttonVariants[variant]} ${buttonSizes[size]} ${className}`} {...props} />;
}

export function Arrow({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={`${className} transition-transform duration-300 group-hover:translate-x-0.5`} aria-hidden>
      <path d="M3 8h9M8.5 4.5L12 8l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** The main surface. `interactive` adds the cursor spotlight for cards that are clickable or worth exploring. */
export function Panel({ className = "", interactive = false, as = "section", children }: { className?: string; interactive?: boolean; as?: "section" | "div" | "article" | "aside"; children: ReactNode }) {
  const Tag = as;
  return (
    <Tag onMouseMove={interactive ? trackSpotlight : undefined} className={`glass rounded-3xl p-6 ${interactive ? "spotlight" : ""} ${className}`}>
      {children}
    </Tag>
  );
}

export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`font-mono text-xs font-medium uppercase tracking-[0.16em] text-dim ${className}`}>{children}</p>;
}

const tones = {
  neutral: "bg-white/[0.05] text-mute ring-white/10",
  good: "bg-mint/10 text-mint ring-mint/25",
  warn: "bg-sun/10 text-sun ring-sun/25",
  bad: "bg-flare/10 text-flare ring-flare/30",
  info: "bg-ice/10 text-ice ring-ice/25",
  brand: "bg-nova/10 text-nova ring-nova/25",
};

export type Tone = keyof typeof tones;

export function Chip({ tone = "neutral", dot = false, pulse = false, children }: { tone?: Tone; dot?: boolean; pulse?: boolean; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${tones[tone]}`}>
      {dot ? <span className={`size-1.5 rounded-full bg-current glow-dot ${pulse ? "pulse-soft" : ""}`} /> : null}
      {children}
    </span>
  );
}

const statusInfo: Record<MilestoneStatus, { label: string; tone: Tone; pulse?: boolean }> = {
  awaiting_funding: { label: "Waiting for funding", tone: "neutral" },
  funded: { label: "Locked, waiting for work", tone: "info" },
  verifying: { label: "AI checking", tone: "info", pulse: true },
  awaiting_decision: { label: "Report ready", tone: "brand", pulse: true },
  fix_window: { label: "Fix window open", tone: "warn", pulse: true },
  appealed: { label: "Under appeal", tone: "bad" },
  released: { label: "Paid in full", tone: "good" },
  closed: { label: "Closed", tone: "neutral" },
};

export function StatusChip({ status }: { status: MilestoneStatus }) {
  const info = statusInfo[status];
  return (
    <Chip tone={info.tone} dot pulse={info.pulse}>
      {info.label}
    </Chip>
  );
}

export function VerdictChip({ verdict }: { verdict: Verdict }) {
  if (verdict === "pass") return <Chip tone="good" dot>Passed</Chip>;
  if (verdict === "fail") return <Chip tone="bad" dot>Not met</Chip>;
  return <Chip tone="warn" dot>Needs a person</Chip>;
}

/** Released, held and returned money as one bar with live numbers, so the money state is always visible. */
export function MoneyBar({ ledger, amount, labels = true }: { ledger: LedgerEntry[]; amount: number; labels?: boolean }) {
  const t = ledgerTotals(ledger);
  const total = t.authorized || amount;
  const parts = [
    { key: "Released", value: t.captured, color: "bg-mint", glow: "shadow-[0_0_16px_rgba(34,227,160,0.6)]" },
    { key: "Held on client's PayPal", value: t.held, color: "bg-[repeating-linear-gradient(135deg,var(--color-ice)_0_4px,rgba(79,200,255,0.35)_4px_8px)]", glow: "" },
    { key: "Returned", value: t.voided, color: "bg-white/25", glow: "" },
  ];
  return (
    <div>
      <div className="flex h-2.5 w-full gap-1" role="img" aria-label={parts.map((p) => `${p.key} $${p.value.toFixed(2)}`).join(", ")}>
        {t.authorized === 0 ? <div className="h-full flex-1 rounded-full bg-white/[0.06]" /> : null}
        {parts.map((p) =>
          p.value > 0 ? <div key={p.key} className={`h-full rounded-full ${p.color} ${p.glow} transition-[flex-grow] duration-700 ease-out-expo`} style={{ flexGrow: p.value / total, flexBasis: 0 }} /> : null,
        )}
      </div>
      {labels ? (
        <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-[13px]">
          {parts.map((p) => (
            <div key={p.key}>
              <dt className="flex items-center gap-1.5 text-dim">
                <span className={`size-2 shrink-0 rounded-full ${p.key === "Held on client's PayPal" ? "bg-ice" : p.color}`} />
                {p.key}
              </dt>
              <dd className="mt-0.5 font-medium text-ink">
                <NumberTicker value={p.value} />
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}

/** A labelled input. The hint goes under the input, so inputs side by side stay on one line. */
export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string | null; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-[13px] font-medium text-ink">{label}</span>
      <span className="mt-2 block">{children}</span>
      {hint ? <span className="mt-1.5 block text-xs leading-relaxed text-dim">{hint}</span> : null}
      {error ? (
        <span role="alert" className="mt-1.5 block text-xs font-medium text-flare">
          {error}
        </span>
      ) : null}
    </label>
  );
}

export const inputClass =
  "w-full rounded-xl border border-brand-2/20 bg-deep/60 px-3.5 py-2.5 text-sm text-ink placeholder:text-dim transition focus:border-brand-2/70 focus:bg-deep/80 focus:outline-none focus:ring-4 focus:ring-brand/25 aria-[invalid=true]:border-flare/70";

export function Toggle({ checked, onChange, label, tone = "nova" }: { checked: boolean; onChange: (v: boolean) => void; label: string; tone?: "nova" | "mint" }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-2 ${checked ? (tone === "nova" ? "bg-nova" : "bg-mint") : "bg-white/12"}`}
    >
      <span className={`inline-block size-5 rounded-full bg-star shadow transition-transform duration-300 ease-out-expo ${checked ? "translate-x-[22px]" : "translate-x-0.5"}`} />
    </button>
  );
}

const avatarTones = {
  freelancer: "from-[#ffc53d] to-[#ff5c7c] text-void",
  client: "from-[#a78bff] to-[#4fc8ff] text-void",
  agent: "from-[#4fc8ff] to-[#22e3a0] text-void",
};

export function Avatar({ name, kind, size = "md" }: { name: string; kind: keyof typeof avatarTones; size?: "sm" | "md" }) {
  const initials = kind === "agent" ? "AI" : name.split(" ").map((p) => p[0]).slice(0, 2).join("");
  return (
    <span className={`inline-grid shrink-0 place-items-center rounded-full bg-gradient-to-br font-semibold ${avatarTones[kind]} ${size === "sm" ? "size-6 text-[11px]" : "size-8 text-xs"}`} aria-hidden>
      {initials}
    </span>
  );
}

/** Who the visitor is pretending to be on this screen of the prototype. */
export function RoleChip({ role, name }: { role: "client" | "freelancer" | "both" | "agent"; name?: string }) {
  if (role === "both") return <Chip tone="brand">Both sides see this page</Chip>;
  const label = { client: "client", freelancer: "freelancer", agent: "client's agent" }[role];
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-white/[0.04] py-1 pl-1 pr-3 text-xs text-mute ring-1 ring-inset ring-white/10">
      <Avatar name={name ?? label} kind={role} size="sm" />
      Viewing as <span className="font-medium text-ink">{name ?? label}</span>
      {name ? <span className="text-dim">· {label}</span> : null}
    </span>
  );
}

/** A small "i" that explains a term on hover or keyboard focus. */
export function InfoTip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="group relative inline-flex align-middle">
      <button type="button" aria-label={`What is ${label}?`} className="inline-grid size-6 place-items-center rounded-full text-dim transition hover:text-ink focus-visible:text-ink">
        <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden>
          <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
          <path d="M8 7.2v3.6M8 5h.01" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
      <span
        role="tooltip"
        className="pointer-events-none invisible absolute bottom-full left-1/2 z-50 mb-2 w-64 -translate-x-1/2 translate-y-1 rounded-2xl border border-brand-2/25 bg-deep px-3.5 py-3 text-left text-xs font-normal normal-case leading-relaxed tracking-normal text-mute opacity-0 shadow-2xl transition duration-200 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100"
      >
        <span className="mb-1 block font-semibold text-ink">{label}</span>
        {children}
      </span>
    </span>
  );
}
