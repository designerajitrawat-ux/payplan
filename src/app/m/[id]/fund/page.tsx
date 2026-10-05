"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import { DemoGuide } from "@/components/demo-guide";
import { MilestoneOrbit } from "@/components/milestone-orbit";
import { MilestoneShell, partyNames } from "@/components/milestone-shell";
import { CopyButton } from "@/components/motion";
import { PayPalMockButton } from "@/components/paypal-mock";
import { When } from "@/components/time";
import { toast } from "@/components/toast";
import { Arrow, ButtonLink, Chip, Eyebrow, MoneyBar, Panel, RoleChip } from "@/components/ui";
import { money } from "@/lib/format";
import { fundMilestone, setApproval, useMandate } from "@/lib/store";
import type { ApprovalMode, Milestone } from "@/lib/types";

function ApprovalChoice({ value, onChange, locked }: { value: ApprovalMode; onChange: (v: ApprovalMode) => void; locked: boolean }) {
  const mandate = useMandate();
  const options: { mode: ApprovalMode; title: string; body: string }[] = [
    { mode: "client", title: "I approve each release", body: "You read the report and press release, or appeal to a person." },
    {
      mode: "agent",
      title: "My agent approves within its limits",
      body: `${mandate.name} releases verified work up to ${money(mandate.perMilestoneLimit)} when AI confidence is at least ${Math.round(mandate.minConfidence * 100)}%. Anything else comes back to you.`,
    },
  ];
  return (
    <div role="radiogroup" aria-label="Who approves releases" className="grid gap-3 sm:grid-cols-2">
      {options.map((o) => {
        const active = value === o.mode;
        return (
          <button
            key={o.mode}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={locked && !active}
            onClick={() => onChange(o.mode)}
            className={`relative isolate rounded-2xl border p-4 text-left transition-colors duration-300 disabled:opacity-40 ${active ? "border-transparent" : "border-white/[0.08] bg-white/[0.02] hover:border-white/15"}`}
          >
            {active ? (
              <motion.span
                layoutId="approval-choice"
                transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                className={`absolute inset-0 -z-10 rounded-2xl border ${o.mode === "agent" ? "border-nova/50 bg-nova/[0.08] shadow-[0_0_30px_-12px_rgba(185,162,255,0.7)]" : "border-white/25 bg-white/[0.06]"}`}
              />
            ) : null}
            <span className="flex items-center justify-between gap-2">
              <span className="font-medium text-ink">{o.title}</span>
              <span className={`grid size-5 shrink-0 place-items-center rounded-full border transition-colors ${active ? "border-transparent bg-star" : "border-white/20"}`}>
                {active ? <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", bounce: 0.5, duration: 0.4 }} className="size-2 rounded-full bg-void" /> : null}
              </span>
            </span>
            <span className="mt-2 block text-[13px] leading-relaxed text-mute">{o.body}</span>
          </button>
        );
      })}
    </div>
  );
}

function Fund({ m }: { m: Milestone }) {
  const mandate = useMandate();
  const [approval, setLocalApproval] = useState<ApprovalMode>(m.walkthrough && m.status === "awaiting_funding" ? "agent" : m.approval);
  const auth = m.ledger.find((e) => e.kind === "authorization");
  const names = partyNames(m);
  const funded = m.status !== "awaiting_funding";
  const choice = funded ? m.approval : approval;

  function choose(mode: ApprovalMode) {
    if (funded) setApproval(m.id, mode);
    else setLocalApproval(mode);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-6">
        <RoleChip role="client" name={m.clientName.split(" ")[0]} />
        <Panel>
          <MilestoneOrbit m={m} />
        </Panel>
        <Panel>
          <h2 className="font-display text-lg font-semibold">What {names.freelancer} will deliver</h2>
          <p className="mt-1 text-sm text-mute">Each criterion releases its share of {money(m.amount)} when it passes.</p>
          <ul className="mt-5 divide-y divide-white/[0.06]">
            {m.criteria.map((c, i) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3.5">
                <span className="flex min-w-0 items-center gap-3 text-sm text-ink">
                  <span className="font-mono text-[11px] text-dim">{String(i + 1).padStart(2, "0")}</span>
                  {c.title}
                </span>
                <span className="flex items-center gap-3">
                  {c.mustPass ? <Chip tone="warn">Must pass</Chip> : null}
                  <span className="w-28 text-right font-mono text-xs tabular-nums text-mute">
                    {c.weight}% · <span className="text-ink">{money((m.amount * c.weight) / 100)}</span>
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-lg font-semibold">Who approves releases?</h2>
            <Link href="/agents" className="text-[13px] text-nova underline-offset-4 hover:underline">
              Agent settings
            </Link>
          </div>
          <p className="mt-1 text-sm text-mute">After the AI report, someone has to say yes. You can change this until the report arrives.</p>
          <div className="mt-5">
            <ApprovalChoice value={choice} onChange={choose} locked={m.status !== "awaiting_funding" && m.status !== "funded" && m.status !== "verifying"} />
          </div>
        </Panel>
      </div>

      <aside className="min-w-0 space-y-4 lg:sticky lg:top-8 lg:self-start">
        <Panel className={funded ? "" : "beam"}>
          {!funded ? (
            <>
              <Eyebrow>Lock this milestone</Eyebrow>
              <p className="mt-3 font-sans text-5xl font-semibold tracking-tight text-ink font-stretch-semi-expanded">{money(m.amount)}</p>
              <p className="mt-2 text-sm text-mute">An authorization hold on your PayPal. Nothing is charged now.</p>
              <div className="mt-6">
                <PayPalMockButton
                  amount={m.amount}
                  payerEmail={m.clientEmail}
                  agentNote={approval === "agent" ? `${mandate.name} may release verified work up to ${money(mandate.perMilestoneLimit)} from this hold.` : undefined}
                  onApprove={() => {
                    fundMilestone(m.id, approval);
                    toast(`${money(m.amount)} locked on PayPal`, "Authorization approved. Nothing was charged.", "info");
                  }}
                />
              </div>
              <p className="mt-4 text-xs leading-relaxed text-dim">Prototype: this simulates PayPal. Phase 1 uses a real sandbox authorization.</p>
            </>
          ) : (
            <>
              <Chip tone="info" dot>
                Locked on PayPal
              </Chip>
              <p className="mt-4 text-sm text-mute">
                Authorization <span className="font-mono text-xs text-ink">{auth?.id}</span>
                {auth ? <CopyButton value={auth.id} /> : null}
                <br />
                approved <When at={auth?.at} />
              </p>
              <div className="mt-5">
                <MoneyBar ledger={m.ledger} amount={m.amount} />
              </div>
              {m.status === "funded" ? (
                <ButtonLink href={`/m/${m.id}/submit`} className="group mt-6 w-full">
                  Continue as {names.freelancer}: deliver
                  <Arrow />
                </ButtonLink>
              ) : (
                <ButtonLink href={`/m/${m.id}`} variant="secondary" className="mt-6 w-full">
                  Go to the current step
                </ButtonLink>
              )}
            </>
          )}
        </Panel>
      </aside>

      {!m.walkthrough ? null : m.status === "awaiting_funding" ? (
        <DemoGuide step={2}>
          Now you are <strong>{names.client}, the client</strong>. Keep <strong>My agent approves</strong> selected, then approve the hold with the PayPal button.
        </DemoGuide>
      ) : m.status === "funded" ? (
        <DemoGuide step={2} next={{ href: `/m/${m.id}/submit`, label: `Switch to ${names.freelancer} and deliver` }}>
          The money is locked on {names.client}&apos;s own PayPal. PayPlan never holds it. {m.approval === "agent" ? `${names.client}'s agent will decide on the release.` : ""}
        </DemoGuide>
      ) : null}
    </div>
  );
}

export default function FundPage() {
  return <MilestoneShell>{(m) => <Fund m={m} />}</MilestoneShell>;
}
