"use client";

import { useState } from "react";
import { DemoGuide } from "@/components/demo-guide";
import { MilestoneShell, partyNames } from "@/components/milestone-shell";
import { Countdown } from "@/components/time";
import { Badge, Button, ButtonLink, Card, Field, MoneyBar, RoleChip, inputClass } from "@/components/ui";
import { ledgerTotals, releasableAmount } from "@/lib/decision";
import { money } from "@/lib/format";
import { acceptRelease, autoRelease, openAppeal, withdrawAppeal } from "@/lib/store";
import type { Milestone } from "@/lib/types";

function Decision({ m }: { m: Milestone }) {
  const [appealing, setAppealing] = useState(false);
  const [reason, setReason] = useState("");
  const report = m.reports.at(-1);
  const totals = ledgerTotals(m.ledger);
  const releasable = report ? releasableAmount(m.criteria, report.results, totals.authorized || m.amount) : 0;
  const waiting = Math.max(0, Math.round(((totals.authorized || m.amount) - releasable) * 100) / 100);
  const failed = report?.results.filter((r) => r.verdict !== "pass").length ?? 0;
  const names = partyNames(m);

  if (m.status === "appealed") {
    return (
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-6">
          <RoleChip role="client" />
          <Card className="border-rose-200 bg-rose-50/40">
            <Badge tone="bad">Under appeal</Badge>
            <h2 className="mt-3 text-xl font-bold">A person will review this milestone</h2>
            <p className="mt-2 text-sm text-slate-700">Nothing is released while the appeal is open. Both sides can add notes.</p>
            <p className="mt-4 rounded-xl bg-white p-3 text-sm ring-1 ring-rose-200">
              <span className="font-semibold">Reason given:</span> {m.appealReason}
            </p>
            <Button variant="secondary" className="mt-4" onClick={() => withdrawAppeal(m.id)}>
              Withdraw the appeal (demo)
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  if (m.status === "fix_window" || m.status === "released") {
    return (
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-6">
          <RoleChip role="client" />
          <Card className="border-emerald-200 bg-emerald-50/40">
            <Badge tone="good">Released</Badge>
            <h2 className="mt-3 text-xl font-bold">{money(totals.captured)} released to {names.freelancer}</h2>
            <p className="mt-2 text-sm text-slate-700">
              {totals.held > 0 ? `${money(totals.held)} is still only a hold on your PayPal while the fix is made.` : "The milestone is paid in full."}
            </p>
            <div className="mt-5">
              <MoneyBar ledger={m.ledger} amount={m.amount} />
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              {totals.held > 0 ? (
                <ButtonLink href={`/m/${m.id}/submit`}>Continue as {names.freelancer}: submit the fix</ButtonLink>
              ) : null}
              <ButtonLink href={`/m/${m.id}/report`} variant="secondary">
                Open the report
              </ButtonLink>
            </div>
          </Card>
        </div>
        {m.walkthrough && totals.held > 0 ? (
          <DemoGuide step="step 5 of 7" next={{ href: `/m/${m.id}/submit`, label: `Switch to ${names.freelancer} and fix` }}>
            PayPal captured exactly the verified share. The rest stays as a hold, not in anyone&apos;s balance.
          </DemoGuide>
        ) : null}
      </div>
    );
  }

  if (m.status !== "awaiting_decision") {
    return (
      <Card>
        <p className="text-sm text-slate-600">There is nothing to decide right now.</p>
        <ButtonLink href={`/m/${m.id}/report`} className="mt-4" variant="secondary">
          Open the report
        </ButtonLink>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="min-w-0 space-y-6">
        <RoleChip role="client" />
        <Card>
          <h2 className="text-xl font-bold">Release {money(releasable)} for the criteria that passed?</h2>
          <p className="mt-2 text-sm text-slate-600">
            {failed > 0
              ? `${failed === 1 ? "1 criterion was" : `${failed} criteria were`} not met. Their ${money(waiting)} stays on your PayPal as a hold while ${names.freelancer} fixes them, for up to ${m.fixWindowHours} hours.`
              : "Every criterion passed. Accepting releases the full amount."}
          </p>
          <div className="mt-5">
            <MoneyBar ledger={m.ledger} amount={m.amount} />
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button size="lg" onClick={() => acceptRelease(m.id)}>
              Accept and release {money(releasable)}
            </Button>
            <Button size="lg" variant="danger" onClick={() => setAppealing((v) => !v)}>
              Appeal to a person
            </Button>
          </div>
          {appealing ? (
            <div className="mt-5 space-y-3 rounded-xl border border-rose-200 bg-rose-50/40 p-4">
              <Field label="What is wrong with the verdict?" hint="A person reviews the evidence. Nothing is released until then.">
                <textarea className={`${inputClass} min-h-20`} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="For example: the hero headline is right, but the button colour is wrong." />
              </Field>
              <Button variant="danger" disabled={!reason.trim()} onClick={() => openAppeal(m.id, reason.trim())}>
                Send appeal
              </Button>
            </div>
          ) : null}
        </Card>
      </div>
      <aside className="min-w-0 space-y-4">
        <Card>
          <p className="text-sm text-slate-500">If you do not reply</p>
          <p className="mt-1 text-2xl font-bold">
            <Countdown to={m.decisionDueAt} />
          </p>
          <p className="mt-2 text-sm text-slate-600">
            When the review window ends, the verified {money(releasable)} is released automatically. A silent client cannot stall payment for work that passed.
          </p>
          <Button variant="ghost" className="mt-3 w-full" onClick={() => autoRelease(m.id)}>
            Simulate: review window ends
          </Button>
        </Card>
        <ButtonLink href={`/m/${m.id}/report`} variant="secondary" className="w-full">
          Back to the evidence
        </ButtonLink>
      </aside>
      {m.walkthrough ? (
      <DemoGuide step="step 5 of 7">
        You are <strong>{names.client}, the client</strong>. Press <strong>Accept and release</strong>. You can also try <strong>Appeal to a person</strong> to see that path.
      </DemoGuide>
      ) : null}
    </div>
  );
}

export default function DecidePage() {
  return <MilestoneShell>{(m) => <Decision m={m} />}</MilestoneShell>;
}
