"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DemoGuide } from "@/components/demo-guide";
import { MilestoneOrbit } from "@/components/milestone-orbit";
import { MilestoneShell, partyNames } from "@/components/milestone-shell";
import { HoldButton, NumberTicker } from "@/components/motion";
import { Countdown } from "@/components/time";
import { toast } from "@/components/toast";
import { Arrow, Avatar, Button, ButtonLink, Chip, Eyebrow, Field, MoneyBar, Panel, RoleChip, inputClass } from "@/components/ui";
import { agentReview, ledgerTotals, releasableAmount } from "@/lib/decision";
import { money } from "@/lib/format";
import { acceptRelease, agentDecide, autoRelease, openAppeal, setApproval, useMandate, withdrawAppeal } from "@/lib/store";
import { stagger } from "@/lib/style";
import type { AgentCheck, Milestone } from "@/lib/types";

const CHECK_MS = 650;

function CheckList({ checks, shown }: { checks: AgentCheck[]; shown: number }) {
  return (
    <ul className="space-y-2.5">
      {checks.map((c, i) => {
        const visible = i < shown;
        const thinking = i === shown;
        return (
          <li key={c.label} className={`flex items-center gap-3 rounded-2xl border px-4 py-3 transition-all duration-500 ${visible ? (c.ok ? "border-mint/20 bg-mint/[0.04]" : "border-flare/30 bg-flare/[0.06]") : "border-white/[0.06] bg-white/[0.02]"} ${thinking ? "beam" : ""}`}>
            <span className={`grid size-6 shrink-0 place-items-center rounded-full ${visible ? (c.ok ? "bg-mint text-void" : "bg-flare text-void") : "border border-white/15"}`}>
              {visible ? (
                c.ok ? (
                  <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden>
                    <path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 16 16" className="size-3" aria-hidden>
                    <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
                  </svg>
                )
              ) : thinking ? (
                <span className="size-3 animate-spin rounded-full border-2 border-nova/30 border-t-nova" />
              ) : null}
            </span>
            <span className="min-w-0 flex-1">
              <span className={`block text-sm ${visible || thinking ? "text-ink" : "text-dim"}`}>{c.label}</span>
              <span className={`block text-xs transition-opacity duration-500 ${visible ? "text-mute opacity-100" : "opacity-0"}`}>{c.detail}</span>
            </span>
            <span className={`font-mono text-[11px] ${visible ? (c.ok ? "text-mint" : "text-flare") : "text-transparent"}`}>{c.ok ? "GO" : "NO-GO"}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** The client's agent works through its mandate in front of you, then releases or hands back. */
function AgentDecision({ m }: { m: Milestone }) {
  const mandate = useMandate();
  const [shown, setShown] = useState(0);
  const report = m.reports.at(-1)!;
  const authorized = ledgerTotals(m.ledger).authorized || m.amount;
  const review = agentReview(m.criteria, report.results, authorized, mandate);
  const names = partyNames(m);
  const count = review.checks.length;

  useEffect(() => {
    const timers = Array.from({ length: count }, (_, i) => setTimeout(() => setShown(i + 1), CHECK_MS * (i + 1) + 400));
    timers.push(
      setTimeout(
        () => {
          agentDecide(m.id);
          if (review.approved) toast(`${money(review.releasable)} released to ${names.freelancer}`, `${mandate.name} captured the verified share on PayPal.`, "good");
          else toast("Handed back to you", `${mandate.name} found something outside its limits.`, "warn");
        },
        CHECK_MS * (count + 1) + 1100,
      ),
    );
    return () => timers.forEach(clearTimeout);
  }, [m.id, count, review.approved, review.releasable, mandate.name, names.freelancer]);

  const done = shown >= count;
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-6">
        <RoleChip role="agent" name={mandate.name} />
        <Panel className="beam">
          <div className="flex flex-wrap items-center gap-3">
            <Avatar name={mandate.name} kind="agent" />
            <div className="min-w-0">
              <p className="font-medium text-ink">{mandate.name}</p>
              <p className="text-xs text-dim">Acting for {mandate.owner} · reads the signed report, checks its mandate</p>
            </div>
            <Chip tone="brand" dot pulse>
              {done ? (review.approved ? "Releasing" : "Handing back") : "Reviewing"}
            </Chip>
          </div>
          <h2 className="mt-6 font-display text-3xl font-semibold tracking-tight text-balance font-stretch-semi-expanded">
            {done ? (
              review.approved ? (
                <>
                  All clear. Releasing <span className="font-sans">{money(review.releasable)}</span>.
                </>
              ) : (
                "Something is outside my limits."
              )
            ) : (
              "Go / no-go on the release"
            )}
          </h2>
          <div className="mt-6">
            <CheckList checks={review.checks} shown={shown} />
          </div>
        </Panel>
      </div>
      <aside className="min-w-0 space-y-4">
        <Panel>
          <Eyebrow>Would release</Eyebrow>
          <p className="mt-3 font-display text-4xl font-semibold text-sun">
            <NumberTicker value={review.releasable} from={0} />
          </p>
          <p className="mt-2 text-sm text-mute">Captured from the hold on {names.client}&apos;s PayPal. The rest stays a hold.</p>
          <Button variant="secondary" className="mt-5 w-full" onClick={() => setApproval(m.id, "client")}>
            Stop, I&apos;ll decide myself
          </Button>
          <Link href="/agents" className="mt-3 block text-center text-xs text-nova underline-offset-4 hover:underline">
            Change the agent&apos;s limits
          </Link>
        </Panel>
      </aside>
      {m.walkthrough ? (
        <DemoGuide step={5}>
          Now <strong>{names.client}&apos;s AI agent</strong> decides. It checks the report against the limits {names.client} gave it, then captures the verified share on PayPal by itself.
        </DemoGuide>
      ) : null}
    </div>
  );
}

function ManualDecision({ m }: { m: Milestone }) {
  const [appealing, setAppealing] = useState(false);
  const [reason, setReason] = useState("");
  const report = m.reports.at(-1);
  const totals = ledgerTotals(m.ledger);
  const releasable = report ? releasableAmount(m.criteria, report.results, totals.authorized || m.amount) : 0;
  const waiting = Math.max(0, Math.round(((totals.authorized || m.amount) - releasable) * 100) / 100);
  const failed = report?.results.filter((r) => r.verdict !== "pass").length ?? 0;
  const names = partyNames(m);
  const handedBack = m.agentDecision?.outcome === "handed_to_client" ? m.agentDecision : undefined;

  function release() {
    acceptRelease(m.id);
    toast(`${money(releasable)} released to ${names.freelancer}`, "PayPal captured the verified share.", "good");
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-6">
        <RoleChip role="client" name={names.client} />
        {handedBack ? (
          <Panel className="border-nova/25">
            <p className="flex items-center gap-2 text-sm font-medium text-nova">
              <span className="size-1.5 rounded-full bg-nova glow-dot" />
              Your agent handed this decision back
            </p>
            <ul className="mt-3 space-y-1 text-sm text-mute">
              {handedBack.checks
                .filter((c) => !c.ok)
                .map((c) => (
                  <li key={c.label}>
                    <span className="text-ink">{c.label}:</span> {c.detail}
                  </li>
                ))}
            </ul>
          </Panel>
        ) : null}
        <Panel>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-balance">Release <span className="font-sans">{money(releasable)}</span> for the criteria that passed?</h2>
          <p className="mt-2 text-sm leading-relaxed text-mute">
            {failed > 0
              ? `${failed === 1 ? "1 criterion was" : `${failed} criteria were`} not met. Their ${money(waiting)} stays on your PayPal as a hold while ${names.freelancer} fixes them, for up to ${m.fixWindowHours} hours.`
              : "Every criterion passed. Releasing pays the full amount."}
          </p>
          <div className="mt-6">
            <MoneyBar ledger={m.ledger} amount={m.amount} />
          </div>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <HoldButton onComplete={release}>Hold to release {money(releasable)}</HoldButton>
            <Button size="lg" variant="danger" onClick={() => setAppealing((v) => !v)}>
              Appeal to a person
            </Button>
          </div>
          <p className="mt-3 text-xs text-dim">Press and hold for a second, so money never moves by accident.</p>
          {appealing ? (
            <div className="rise mt-6 space-y-3 rounded-2xl border border-flare/25 bg-flare/[0.04] p-4">
              <Field label="What is wrong with the verdict?" hint="A person reviews the evidence. Nothing is released until then.">
                <textarea className={`${inputClass} min-h-20`} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="For example: the hero headline is right, but the button colour is wrong." />
              </Field>
              <Button variant="danger" disabled={!reason.trim()} onClick={() => openAppeal(m.id, reason.trim())}>
                Send appeal
              </Button>
            </div>
          ) : null}
        </Panel>
      </div>
      <aside className="min-w-0 space-y-4">
        <Panel>
          <Eyebrow>If you do not reply</Eyebrow>
          <p className="mt-3 font-display text-3xl font-semibold text-ink">
            <Countdown to={m.decisionDueAt} />
          </p>
          <p className="mt-2 text-sm leading-relaxed text-mute">When the review window ends, the verified {money(releasable)} is released automatically. A silent client cannot stall payment for work that passed.</p>
          <Button variant="ghost" size="sm" className="mt-4 w-full" onClick={() => autoRelease(m.id)}>
            Simulate: review window ends
          </Button>
        </Panel>
        <Button variant="secondary" className="w-full" onClick={() => setApproval(m.id, "agent")}>
          Let my agent decide
        </Button>
        <ButtonLink href={`/m/${m.id}/report`} variant="ghost" className="w-full">
          Back to the evidence
        </ButtonLink>
      </aside>
      {m.walkthrough ? (
        <DemoGuide step={5}>
          You are <strong>{names.client}, the client</strong>. Press and hold <strong>Hold to release</strong>, or try <strong>Appeal to a person</strong> to see that path.
        </DemoGuide>
      ) : null}
    </div>
  );
}

function Decision({ m }: { m: Milestone }) {
  const totals = ledgerTotals(m.ledger);
  const names = partyNames(m);

  if (m.status === "appealed") {
    return (
      <div className="max-w-3xl space-y-6">
        <RoleChip role="client" name={names.client} />
        <Panel className="border-flare/25">
          <Chip tone="bad" dot>
            Under appeal
          </Chip>
          <h2 className="mt-4 font-display text-2xl font-semibold">A person will review this milestone</h2>
          <p className="mt-2 text-sm text-mute">Nothing is released while the appeal is open. Both sides can add notes.</p>
          <p className="mt-5 rounded-2xl border border-flare/20 bg-flare/[0.05] p-4 text-sm text-ink">
            <span className="text-dim">Reason given: </span>
            {m.appealReason}
          </p>
          <Button variant="secondary" className="mt-5" onClick={() => withdrawAppeal(m.id)}>
            Withdraw the appeal (demo)
          </Button>
        </Panel>
      </div>
    );
  }

  if (m.status === "fix_window" || m.status === "released") {
    const byAgent = m.agentDecision?.outcome === "released";
    return (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <Panel className="rise border-mint/20">
            <Chip tone="good" dot>
              {byAgent ? "Released by the client's agent" : "Released"}
            </Chip>
            <h2 className="mt-4 font-display text-4xl font-semibold tracking-tight text-ink font-stretch-semi-expanded">
              <NumberTicker value={totals.captured} from={0} duration={1400} className="text-mint" /> <span className="text-mute">to {names.freelancer}</span>
            </h2>
            <p className="mt-2 text-sm text-mute">{totals.held > 0 ? `${money(totals.held)} is still only a hold on ${names.client}'s PayPal while the fix is made.` : "The milestone is paid in full."}</p>
            <div className="mt-6">
              <MilestoneOrbit m={m} />
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              {totals.held > 0 ? (
                <ButtonLink href={`/m/${m.id}/submit`} className="group">
                  Continue as {names.freelancer}: submit the fix
                  <Arrow />
                </ButtonLink>
              ) : null}
              <ButtonLink href={`/m/${m.id}/report`} variant="secondary">
                Open the report
              </ButtonLink>
            </div>
          </Panel>
        </div>
        {byAgent && m.agentDecision ? (
          <aside className="min-w-0">
            <Panel>
              <div className="flex items-center gap-3">
                <Avatar name="agent" kind="agent" />
                <Eyebrow>Agent&apos;s go / no-go</Eyebrow>
              </div>
              <ul className="mt-4 space-y-2.5 text-sm">
                {m.agentDecision.checks.map((c, i) => (
                  <li key={c.label} className="rise flex items-start gap-2.5" style={stagger(i)}>
                    <span className={`mt-1.5 size-1.5 shrink-0 rounded-full ${c.ok ? "bg-mint" : "bg-flare"} glow-dot`} />
                    <span>
                      <span className="text-ink">{c.label}</span>
                      <span className="block text-xs text-dim">{c.detail}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          </aside>
        ) : null}
        {m.walkthrough && totals.held > 0 ? (
          <DemoGuide step={5} next={{ href: `/m/${m.id}/submit`, label: `Switch to ${names.freelancer} and fix` }}>
            PayPal captured exactly the verified share. The rest stays a hold, not in anyone&apos;s balance. {byAgent ? "No human had to click anything." : ""}
          </DemoGuide>
        ) : null}
      </div>
    );
  }

  if (m.status !== "awaiting_decision" || !m.reports.length) {
    return (
      <Panel>
        <p className="text-sm text-mute">There is nothing to decide right now.</p>
        <ButtonLink href={`/m/${m.id}`} className="mt-4" variant="secondary">
          Go to the current step
        </ButtonLink>
      </Panel>
    );
  }

  return m.approval === "agent" && !m.agentDecision ? <AgentDecision m={m} /> : <ManualDecision m={m} />;
}

export default function DecidePage() {
  return <MilestoneShell>{(m) => <Decision m={m} />}</MilestoneShell>;
}
