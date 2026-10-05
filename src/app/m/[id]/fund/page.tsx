"use client";

import { DemoGuide } from "@/components/demo-guide";
import { MilestoneShell, partyNames } from "@/components/milestone-shell";
import { PayPalMockButton } from "@/components/paypal-mock";
import { When } from "@/components/time";
import { Badge, ButtonLink, Card, MoneyBar, RoleChip } from "@/components/ui";
import { money } from "@/lib/format";
import { fundMilestone } from "@/lib/store";

export default function FundPage() {
  return (
    <MilestoneShell>
      {(m) => {
        const auth = m.ledger.find((e) => e.kind === "authorization");
        const names = partyNames(m);
        return (
          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            <div className="min-w-0 space-y-6">
              <div className="flex flex-wrap items-center gap-2">
                <RoleChip role="client" />
              </div>
              <Card>
                <h2 className="font-semibold">What {names.freelancer} will deliver</h2>
                <p className="mt-1 text-sm text-slate-600">Each criterion releases its share of {money(m.amount)} when it passes.</p>
                <ul className="mt-4 divide-y divide-slate-100">
                  {m.criteria.map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <span className="text-sm">{c.title}</span>
                      <span className="flex items-center gap-2">
                        {c.mustPass ? <Badge tone="warn">Must pass</Badge> : null}
                        <span className="w-24 text-right text-sm font-semibold tabular-nums">
                          {c.weight}% · {money((m.amount * c.weight) / 100)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
              <Card>
                <h2 className="font-semibold">What happens next</h2>
                <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-700">
                  <li>The money stays in your PayPal account as an authorization hold. Nothing is charged now.</li>
                  <li>When the work arrives, an AI verifier checks each criterion and shows you the evidence.</li>
                  <li>
                    Only the share that passed is released. You have {m.reviewWindowHours} hours to review, and you can appeal to a person before anything is released.
                  </li>
                </ol>
              </Card>
            </div>

            <aside className="min-w-0 space-y-4">
              <Card>
                {m.status === "awaiting_funding" ? (
                  <>
                    <p className="text-sm text-slate-500">Lock this milestone</p>
                    <p className="mt-1 text-3xl font-bold tabular-nums">{money(m.amount)}</p>
                    <div className="mt-5">
                      <PayPalMockButton amount={m.amount} payerEmail={m.clientEmail} onApprove={() => fundMilestone(m.id)} />
                    </div>
                    <p className="mt-3 text-xs text-slate-500">Prototype: this simulates PayPal. Phase 1 uses a real sandbox authorization.</p>
                  </>
                ) : (
                  <>
                    <Badge tone="good">Locked in PayPal</Badge>
                    <p className="mt-3 text-sm text-slate-600">
                      Authorization <span className="font-mono text-xs">{auth?.id}</span> on <When at={auth?.at} />.
                    </p>
                    <div className="mt-4">
                      <MoneyBar ledger={m.ledger} amount={m.amount} />
                    </div>
                    <ButtonLink href={`/m/${m.id}/submit`} className="mt-5 w-full">
                      Continue as {names.freelancer}: deliver the work
                    </ButtonLink>
                  </>
                )}
              </Card>
            </aside>

            {!m.walkthrough ? null : m.status === "awaiting_funding" ? (
              <DemoGuide step="step 2 of 7">
                Now you are <strong>{names.client}, the client</strong>. You got {names.freelancer}&apos;s link. Read the criteria, then approve the hold with the PayPal button.
              </DemoGuide>
            ) : (
              <DemoGuide step="step 2 of 7" next={{ href: `/m/${m.id}/submit`, label: `Switch to ${names.freelancer} and deliver` }}>
                The money is locked on {names.client}&apos;s own PayPal. PayPlan never holds it.
              </DemoGuide>
            )}
          </div>
        );
      }}
    </MilestoneShell>
  );
}
