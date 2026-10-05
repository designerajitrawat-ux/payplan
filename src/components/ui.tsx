import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { ledgerTotals } from "@/lib/decision";
import { money } from "@/lib/format";
import type { LedgerEntry, MilestoneStatus, Verdict } from "@/lib/types";

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 disabled:cursor-not-allowed disabled:opacity-50";

const buttonVariants = {
  primary: "bg-teal-700 text-white hover:bg-teal-800",
  secondary: "border border-slate-300 bg-white text-slate-900 hover:bg-slate-50",
  ghost: "text-slate-700 hover:bg-slate-100",
  danger: "border border-rose-300 bg-white text-rose-700 hover:bg-rose-50",
};

const buttonSizes = { md: "px-4 py-2.5 text-sm", lg: "px-5 py-3 text-base" };

type ButtonStyle = { variant?: keyof typeof buttonVariants; size?: keyof typeof buttonSizes };

export function Button({ variant = "primary", size = "md", className = "", ...props }: ComponentProps<"button"> & ButtonStyle) {
  return <button className={`${buttonBase} ${buttonVariants[variant]} ${buttonSizes[size]} ${className}`} {...props} />;
}

export function ButtonLink({ variant = "primary", size = "md", className = "", ...props }: ComponentProps<typeof Link> & ButtonStyle) {
  return <Link className={`${buttonBase} ${buttonVariants[variant]} ${buttonSizes[size]} ${className}`} {...props} />;
}

export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return <section className={`rounded-2xl border border-slate-200 bg-white p-6 shadow-sm ${className}`}>{children}</section>;
}

const tones = {
  neutral: "bg-slate-100 text-slate-700 ring-slate-200",
  good: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  warn: "bg-amber-50 text-amber-800 ring-amber-200",
  bad: "bg-rose-50 text-rose-800 ring-rose-200",
  info: "bg-sky-50 text-sky-800 ring-sky-200",
  brand: "bg-teal-50 text-teal-800 ring-teal-200",
};

export type Tone = keyof typeof tones;

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${tones[tone]}`}>{children}</span>;
}

const statusInfo: Record<MilestoneStatus, { label: string; tone: Tone }> = {
  awaiting_funding: { label: "Waiting for funding", tone: "neutral" },
  funded: { label: "Locked, waiting for work", tone: "info" },
  verifying: { label: "Verifying", tone: "brand" },
  awaiting_decision: { label: "Report ready", tone: "brand" },
  fix_window: { label: "Fix window open", tone: "warn" },
  appealed: { label: "Under appeal", tone: "bad" },
  released: { label: "Paid in full", tone: "good" },
  closed: { label: "Closed", tone: "neutral" },
};

export function StatusBadge({ status }: { status: MilestoneStatus }) {
  const info = statusInfo[status];
  return <Badge tone={info.tone}>{info.label}</Badge>;
}

export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  if (verdict === "pass") return <Badge tone="good">Passed</Badge>;
  if (verdict === "fail") return <Badge tone="bad">Not met</Badge>;
  return <Badge tone="warn">Needs a person</Badge>;
}

/** Captured, held and returned money as one bar, so the money state is always visible. */
export function MoneyBar({ ledger, amount }: { ledger: LedgerEntry[]; amount: number }) {
  const t = ledgerTotals(ledger);
  const total = t.authorized || amount;
  const pct = (v: number) => `${(v / total) * 100}%`;
  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`${money(t.captured)} released, ${money(t.held)} held, ${money(t.voided)} returned`}>
        <div className="bg-emerald-500" style={{ width: pct(t.captured) }} />
        <div className="bg-amber-400" style={{ width: pct(t.held) }} />
        <div className="bg-slate-300" style={{ width: pct(t.voided) }} />
      </div>
      <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <div>
          <dt className="flex items-center gap-1.5 text-slate-500"><span className="size-2 shrink-0 rounded-full bg-emerald-500" />Released</dt>
          <dd className="font-semibold tabular-nums">{money(t.captured)}</dd>
        </div>
        <div>
          <dt className="flex items-center gap-1.5 text-slate-500"><span className="size-2 shrink-0 rounded-full bg-amber-400" />Held on client&apos;s PayPal</dt>
          <dd className="font-semibold tabular-nums">{money(t.held)}</dd>
        </div>
        <div>
          <dt className="flex items-center gap-1.5 text-slate-500"><span className="size-2 shrink-0 rounded-full bg-slate-300" />Returned</dt>
          <dd className="font-semibold tabular-nums">{money(t.voided)}</dd>
        </div>
      </dl>
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-800">{label}</span>
      {hint ? <span className="mt-0.5 block text-xs text-slate-500">{hint}</span> : null}
      <span className="mt-1.5 block">{children}</span>
    </label>
  );
}

export const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20";

export function RoleChip({ role }: { role: "client" | "freelancer" | "both" | "agent" }) {
  const label = { client: "Viewing as the client", freelancer: "Viewing as the freelancer", both: "Both sides see this page", agent: "Viewing as the buyer agent" }[role];
  return <Badge tone="info">{label}</Badge>;
}
