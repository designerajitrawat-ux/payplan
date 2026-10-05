"use client";

import { DemoGuide } from "@/components/demo-guide";
import { MilestoneShell, partyNames } from "@/components/milestone-shell";
import { Countdown, When } from "@/components/time";
import { Badge, Button, ButtonLink, Card, MoneyBar, RoleChip, VerdictBadge } from "@/components/ui";
import { ledgerTotals, releasableAmount } from "@/lib/decision";
import { money, shortHash } from "@/lib/format";
import { voidRemainder } from "@/lib/store";
import type { Criterion, CriterionResult, Milestone } from "@/lib/types";

function EvidenceThumb({ criterion, result }: { criterion: Criterion; result: CriterionResult }) {
  const bad = result.verdict !== "pass";
  if (criterion.evidence !== "url" && criterion.evidence !== "image") return null;
  const mobile = criterion.title.toLowerCase().includes("mobile");
  return (
    <div className={`shrink-0 overflow-hidden rounded-lg border ${bad ? "border-rose-200" : "border-slate-200"} bg-slate-50 ${mobile ? "h-24 w-12" : "h-16 w-24"}`} aria-hidden>
      <div className={`h-2 ${bad ? "bg-rose-200" : "bg-teal-200"}`} />
      <div className="space-y-1 p-1.5">
        <div className="h-1.5 w-3/4 rounded bg-slate-300" />
        <div className="h-1.5 w-1/2 rounded bg-slate-200" />
        <div className={`mt-1.5 h-2.5 w-8 rounded ${bad ? "bg-rose-300" : "bg-teal-500"}`} />
      </div>
    </div>
  );
}

function ReportView({ m }: { m: Milestone }) {
  const report = m.reports.at(-1);
  if (!report) {
    return (
      <Card>
        <p className="text-sm text-slate-600">No report yet. The report appears after the work is submitted and verified.</p>
        <ButtonLink href={`/m/${m.id}`} variant="secondary" className="mt-4">
          Go to the current step
        </ButtonLink>
      </Card>
    );
  }
  const passed = report.results.filter((r) => r.verdict === "pass").length;
  const names = partyNames(m);
  const totals = ledgerTotals(m.ledger);
  const releasable = releasableAmount(m.criteria, report.results, totals.authorized || m.amount);
  const waiting = Math.max(0, Math.round(((totals.authorized || m.amount) - releasable) * 100) / 100);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="min-w-0 space-y-6">
        <RoleChip role="both" />
        <Card className="border-teal-200 bg-teal-50/40">
          <p className="text-sm font-semibold text-teal-800">Acceptance report · attempt {report.attempt}</p>
          <h2 className="mt-1 text-2xl font-bold">
            {passed} of {report.results.length} criteria passed
          </h2>
          <p className="mt-1 text-slate-700">
            {money(releasable)} {m.status === "awaiting_decision" ? "can be released" : "verified"} · {money(waiting)} {waiting > 0 ? "waits for a fix" : "outstanding"}
          </p>
          <div className="mt-5">
            <MoneyBar ledger={m.ledger} amount={m.amount} />
          </div>
        </Card>

        <Card>
          <h2 className="font-semibold">Evidence per criterion</h2>
          <ul className="mt-4 space-y-4">
            {m.criteria.map((c) => {
              const r = report.results.find((x) => x.criterionId === c.id);
              if (!r) return null;
              return (
                <li key={c.id} className="flex gap-4 rounded-xl border border-slate-200 p-4">
                  <EvidenceThumb criterion={c} result={r} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">{c.title}</p>
                      <VerdictBadge verdict={r.verdict} />
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{r.reason}</p>
                    <p className="mt-2 text-xs text-slate-500">Evidence: {r.evidence}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <Badge tone={c.check === "ai" ? "brand" : "neutral"}>{c.check === "ai" ? "AI rubric" : "Automatic test"}</Badge>
                      <span>Weight {c.weight}%</span>
                      {c.mustPass ? <Badge tone="warn">Must pass</Badge> : null}
                      <span>Confidence {Math.round(r.confidence * 100)}%</span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card>
          <h2 className="font-semibold">PayPal records</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Amount</th>
                  <th className="py-2 pr-4">PayPal ID</th>
                  <th className="py-2 pr-4">When</th>
                  <th className="py-2">Why</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {m.ledger.map((e) => (
                  <tr key={e.id}>
                    <td className="py-2 pr-4 capitalize">{e.kind}</td>
                    <td className="py-2 pr-4 tabular-nums">{money(e.amount)}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{e.id}</td>
                    <td className="py-2 pr-4 whitespace-nowrap">
                      <When at={e.at} />
                    </td>
                    <td className="py-2 text-slate-600">{e.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <aside className="min-w-0 space-y-4">
        <Card>
          {m.status === "awaiting_decision" ? (
            <>
              <p className="text-sm text-slate-500">Client review window</p>
              <p className="mt-1 text-2xl font-bold">
                <Countdown to={m.decisionDueAt} />
              </p>
              <p className="mt-2 text-sm text-slate-600">If {names.client} does not reply in time, the verified {money(releasable)} is released automatically.</p>
              <ButtonLink href={`/m/${m.id}/decide`} className="mt-4 w-full">
                Continue as {names.client}: decide
              </ButtonLink>
            </>
          ) : m.status === "fix_window" ? (
            <>
              <p className="text-sm text-slate-500">Fix window</p>
              <p className="mt-1 text-2xl font-bold">
                <Countdown to={m.fixDueAt} />
              </p>
              <p className="mt-2 text-sm text-slate-600">{money(totals.held)} stays on the client&apos;s PayPal until the failed criteria pass or the window ends.</p>
              <ButtonLink href={`/m/${m.id}/submit`} className="mt-4 w-full">
                Continue as {names.freelancer}: submit a fix
              </ButtonLink>
              <Button variant="ghost" className="mt-2 w-full" onClick={() => voidRemainder(m.id)}>
                Simulate: fix window ends
              </Button>
            </>
          ) : m.status === "appealed" ? (
            <>
              <Badge tone="bad">Under appeal</Badge>
              <p className="mt-3 text-sm text-slate-600">Nothing is released until a person reviews the appeal.</p>
              <ButtonLink href={`/m/${m.id}/decide`} variant="secondary" className="mt-4 w-full">
                View the appeal
              </ButtonLink>
            </>
          ) : (
            <>
              <Badge tone={m.status === "released" ? "good" : "neutral"}>{m.status === "released" ? "Paid in full" : "Closed"}</Badge>
              <p className="mt-3 text-sm text-slate-600">
                {m.status === "released" ? "Every criterion passed and the full amount was released." : "The unverified share went back to the client."}
              </p>
              <ButtonLink href="/dashboard" variant="secondary" className="mt-4 w-full">
                See all milestones
              </ButtonLink>
            </>
          )}
        </Card>
        <Card>
          <h2 className="text-sm font-semibold">Signature</h2>
          <dl className="mt-2 space-y-1.5 text-xs text-slate-600">
            <div className="flex justify-between gap-2">
              <dt>Spec hash</dt>
              <dd className="font-mono">{shortHash(m.specHash)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>Report hash</dt>
              <dd className="font-mono">{shortHash(report.reportHash)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>Verified</dt>
              <dd>
                <When at={report.verifiedAt} />
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-slate-500">If a dispute is opened, this report becomes the evidence pack sent to PayPal.</p>
        </Card>
      </aside>

      {!m.walkthrough ? null : m.status === "awaiting_decision" ? (
        <DemoGuide step="step 5 of 7" next={{ href: `/m/${m.id}/decide`, label: `Switch to ${names.client} and decide` }}>
          Both sides see the same evidence. {passed} of {report.results.length} passed, so {money(releasable)} can be released
          {waiting > 0 ? ` and ${money(waiting)} waits for a fix.` : "."}
        </DemoGuide>
      ) : m.status === "fix_window" ? (
        <DemoGuide step="step 6 of 7" next={{ href: `/m/${m.id}/submit`, label: `Switch to ${names.freelancer} and fix` }}>
          {money(totals.captured)} is released. The other {money(totals.held)} is still only a hold on {names.client}&apos;s PayPal while {names.freelancer} fixes it.
        </DemoGuide>
      ) : m.status === "released" ? (
        <DemoGuide step="step 7 of 7" next={{ href: "/dashboard", label: "See all milestones" }}>
          Paid as agreed: every criterion passed and the full amount was released, with a signed record of why.
        </DemoGuide>
      ) : null}
    </div>
  );
}

export default function ReportPage() {
  return <MilestoneShell>{(m) => <ReportView m={m} />}</MilestoneShell>;
}
