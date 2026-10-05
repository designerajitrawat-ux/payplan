"use client";

import { ConfidenceRing } from "@/components/cosmos";
import { DemoGuide } from "@/components/demo-guide";
import { MilestoneOrbit } from "@/components/milestone-orbit";
import { MilestoneShell, partyNames } from "@/components/milestone-shell";
import { CopyButton, NumberTicker, trackSpotlight } from "@/components/motion";
import { Countdown, When } from "@/components/time";
import { Arrow, Button, ButtonLink, Chip, Eyebrow, InfoTip, Panel, RoleChip, VerdictChip } from "@/components/ui";
import { activityFor, type Actor } from "@/lib/activity";
import { ledgerTotals, releasableAmount } from "@/lib/decision";
import { money, shortHash } from "@/lib/format";
import { voidRemainder } from "@/lib/store";
import { stagger } from "@/lib/style";
import type { Criterion, CriterionResult, Milestone } from "@/lib/types";

function EvidenceThumb({ criterion, result }: { criterion: Criterion; result: CriterionResult }) {
  const bad = result.verdict !== "pass";
  const mobile = criterion.title.toLowerCase().includes("mobile");
  return (
    <div className={`relative grid h-24 shrink-0 place-items-center overflow-hidden rounded-2xl border ${bad ? "border-flare/25 bg-flare/[0.05]" : "border-white/[0.07] bg-white/[0.03]"}`} aria-hidden>
      <div className={`overflow-hidden rounded-lg border border-white/10 bg-void/70 p-1.5 ${mobile ? "h-20 w-11" : "h-16 w-28"}`}>
        <div className={`h-1.5 w-1/2 rounded ${bad ? "bg-flare/50" : "bg-white/25"}`} />
        <div className="mt-1.5 h-1 w-3/4 rounded bg-white/15" />
        <div className="mt-1 h-1 w-2/3 rounded bg-white/10" />
        <div className={`mt-2 h-2.5 w-8 rounded ${bad ? "bg-flare/60" : "bg-nova/70"}`} />
      </div>
      {bad ? <span className="absolute bottom-2 right-2 rounded-md bg-flare px-1.5 py-0.5 font-mono text-[11px] font-semibold text-void">500</span> : null}
    </div>
  );
}

const actorDot: Record<Actor, string> = { freelancer: "bg-sun", client: "bg-ice", agent: "bg-nova", verifier: "bg-nova", paypal: "bg-mint" };

function apiTrail(m: Milestone, releasable: number) {
  const rows: { method: string; path: string; result: string; tone: "good" | "wait" }[] = [];
  for (const e of m.ledger) {
    if (e.kind === "authorization") {
      rows.push({ method: "POST", path: "/v2/checkout/orders · intent AUTHORIZE", result: "201 created", tone: "good" });
      rows.push({ method: "POST", path: `/v2/checkout/orders/{id}/authorize · ${money(e.amount)}`, result: e.id, tone: "good" });
    }
    if (e.kind === "capture") rows.push({ method: "POST", path: `/v2/payments/authorizations/{id}/capture · ${money(e.amount)}`, result: e.id, tone: "good" });
    if (e.kind === "void") rows.push({ method: "POST", path: `/v2/payments/authorizations/{id}/void · ${money(e.amount)}`, result: e.id, tone: "good" });
  }
  if (m.status === "awaiting_decision" && releasable > 0) rows.push({ method: "POST", path: `/v2/payments/authorizations/{id}/capture · ${money(releasable)}`, result: "waits for decision", tone: "wait" });
  if (m.status === "fix_window") rows.push({ method: "HOOK", path: "re-check the fix, then capture the rest", result: "waiting", tone: "wait" });
  return rows;
}

function ReportView({ m }: { m: Milestone }) {
  const report = m.reports.at(-1);
  if (!report) {
    return (
      <Panel>
        <p className="text-sm text-mute">No report yet. It appears after the work is submitted and checked.</p>
        <ButtonLink href={`/m/${m.id}`} variant="secondary" className="mt-4">
          Go to the current step
        </ButtonLink>
      </Panel>
    );
  }
  const passed = report.results.filter((r) => r.verdict === "pass").length;
  const names = partyNames(m);
  const totals = ledgerTotals(m.ledger);
  const authorized = totals.authorized || m.amount;
  const releasable = releasableAmount(m.criteria, report.results, authorized);
  const waiting = Math.max(0, Math.round((authorized - releasable) * 100) / 100);
  const failedCriteria = m.criteria.filter((c) => report.results.find((r) => r.criterionId === c.id)?.verdict !== "pass");
  const passedCriteria = m.criteria.filter((c) => report.results.find((r) => r.criterionId === c.id)?.verdict === "pass");
  const agentDecides = m.approval === "agent" && m.status === "awaiting_decision";

  const headline =
    m.status === "awaiting_decision" || m.status === "appealed"
      ? { value: releasable, label: `can be released to ${names.freelancer}` }
      : m.status === "closed"
        ? { value: totals.captured, label: `paid to ${names.freelancer}; the rest went back` }
        : { value: totals.captured, label: m.status === "released" ? `paid to ${names.freelancer} in full` : `released to ${names.freelancer}` };

  return (
    <div className="min-w-0 space-y-6">
      <RoleChip role="both" />

      <Panel className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center">
        <div className="min-w-0">
          <Eyebrow>Acceptance report · attempt {report.attempt}</Eyebrow>
          <p className="mt-4 font-display text-6xl font-semibold tracking-tight text-ink font-stretch-semi-expanded">
            <NumberTicker value={headline.value} from={0} duration={1300} />
          </p>
          <p className="mt-1 text-mute">{headline.label}</p>
          <p className="mt-4 text-sm text-mute">
            <span className="text-ink">
              {passed} of {report.results.length} criteria passed
            </span>
            {waiting > 0 && m.status !== "closed" ? ` · ${money(waiting)} waits for a fix` : null}
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            {m.status === "awaiting_decision" ? (
              agentDecides ? (
                <ButtonLink href={`/m/${m.id}/decide`} variant="agent" className="group">
                  Watch {names.client}&apos;s agent decide
                  <Arrow />
                </ButtonLink>
              ) : (
                <ButtonLink href={`/m/${m.id}/decide`} className="group">
                  Continue as {names.client}: decide
                  <Arrow />
                </ButtonLink>
              )
            ) : m.status === "fix_window" ? (
              <>
                <ButtonLink href={`/m/${m.id}/submit`} className="group">
                  Continue as {names.freelancer}: submit a fix
                  <Arrow />
                </ButtonLink>
                <Button variant="ghost" size="sm" onClick={() => voidRemainder(m.id)}>
                  Simulate: fix window ends
                </Button>
              </>
            ) : m.status === "appealed" ? (
              <ButtonLink href={`/m/${m.id}/decide`} variant="secondary">
                View the appeal
              </ButtonLink>
            ) : (
              <ButtonLink href="/dashboard" variant="secondary" className="group">
                See all milestones
                <Arrow />
              </ButtonLink>
            )}
          </div>
          {m.status === "awaiting_decision" ? (
            <p className="mt-4 text-xs text-dim">
              {agentDecides ? "If the agent hands it back and nobody replies, the verified share is released in " : "If nobody replies, the verified share is released in "}
              <span className="font-mono text-mute">
                <Countdown to={m.decisionDueAt} />
              </span>
            </p>
          ) : m.status === "fix_window" ? (
            <p className="mt-4 text-xs text-dim">
              Fix window ends in{" "}
              <span className="font-mono text-mute">
                <Countdown to={m.fixDueAt} />
              </span>
              . Until then {money(totals.held)} stays a hold on {names.client}&apos;s PayPal.
            </p>
          ) : null}
        </div>
        <div className="min-w-0">
          <MilestoneOrbit m={m} />
        </div>
      </Panel>

      <section aria-label="Evidence per criterion" className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="flex items-center gap-1 font-display text-xl font-semibold">
            Evidence
            <InfoTip label="AI confidence">The ring shows how sure the checker is about each verdict. Automatic tests are near 100%. AI rubric scores below the agent&apos;s limit are handed to a person.</InfoTip>
          </h2>
          <span className="text-xs text-dim">{m.criteria.length} criteria · same view for both sides</span>
        </div>
        {failedCriteria.map((c) => {
          const r = report.results.find((x) => x.criterionId === c.id)!;
          return (
            <article key={c.id} className="glass flex flex-wrap gap-5 rounded-3xl border-flare/25 p-5">
              <EvidenceThumb criterion={c} result={r} />
              <div className="min-w-0 flex-1 basis-64">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <VerdictChip verdict={r.verdict} />
                  <span className="font-mono text-xs text-flare">{money((authorized * c.weight) / 100)} held</span>
                </div>
                <h3 className="mt-3 font-medium text-ink">{c.title}</h3>
                <p className="mt-1 text-sm text-mute">{r.reason}</p>
                <p className="mt-2 text-xs text-dim">Evidence: {r.evidence}</p>
              </div>
            </article>
          );
        })}
        <div className="grid gap-3 sm:grid-cols-2">
          {passedCriteria.map((c, i) => {
            const r = report.results.find((x) => x.criterionId === c.id)!;
            return (
              <article key={c.id} onMouseMove={trackSpotlight} className="spotlight glass rise flex flex-col gap-4 rounded-3xl p-5" style={stagger(i)}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <VerdictChip verdict={r.verdict} />
                    <h3 className="mt-3 font-medium text-ink">{c.title}</h3>
                  </div>
                  <ConfidenceRing value={r.confidence} />
                </div>
                <p className="text-sm text-mute">{r.reason}</p>
                <div className="mt-auto flex flex-wrap items-center gap-2 text-xs text-dim">
                  <Chip tone={c.check === "ai" ? "brand" : "neutral"}>{c.check === "ai" ? "AI rubric" : "Automatic test"}</Chip>
                  {c.mustPass ? <Chip tone="warn">Must pass</Chip> : null}
                  <span className="ml-auto font-mono text-mint">{money((authorized * c.weight) / 100)}</span>
                </div>
                <p className="border-t border-white/[0.06] pt-3 text-xs text-dim">{r.evidence}</p>
              </article>
            );
          })}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <Panel>
          <Eyebrow>Activity</Eyebrow>
          <ol className="relative mt-5 space-y-5 before:absolute before:inset-y-1 before:left-[3px] before:w-px before:bg-white/[0.08]">
            {activityFor(m).map((a, i) => (
              <li key={i} className="relative flex gap-4 pl-0 text-sm">
                <span className={`relative mt-1.5 size-[7px] shrink-0 rounded-full ${actorDot[a.actor]} glow-dot`} />
                <div className="min-w-0">
                  <p className="text-ink">
                    <span className="font-medium">{a.who}</span> <span className="text-mute">{a.text}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-dim">
                    <When at={a.at} />
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </Panel>

        <div className="min-w-0 space-y-6">
          <Panel>
            <Eyebrow>Signature</Eyebrow>
            <dl className="mt-4 space-y-2.5 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <dt className="text-dim">Agreement ID</dt>
                <dd className="flex items-center gap-1 font-mono text-xs text-ink">
                  {shortHash(m.specHash)}
                  <CopyButton value={m.specHash} />
                </dd>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <dt className="text-dim">Report hash</dt>
                <dd className="flex items-center gap-1 font-mono text-xs text-ink">
                  {shortHash(report.reportHash)}
                  <CopyButton value={report.reportHash} />
                </dd>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <dt className="text-dim">Verified</dt>
                <dd className="text-xs text-ink">
                  <When at={report.verifiedAt} />
                </dd>
              </div>
            </dl>
            <p className="mt-4 text-xs leading-relaxed text-dim">If a dispute is opened, this report becomes the evidence file sent to PayPal.</p>
          </Panel>

          <section aria-label="PayPal calls" className="overflow-hidden rounded-3xl border border-white/[0.08] bg-void/80">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] px-5 py-3.5">
              <span className="text-sm font-medium text-ink">PayPal calls</span>
              <span className="font-mono text-xs text-dim">simulated · sandbox in Phase 1</span>
            </div>
            <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="PayPal calls, scrolls sideways">
              <table className="w-full min-w-[520px] font-mono text-xs">
                <tbody>
                  {apiTrail(m, releasable).map((row, i) => (
                    <tr key={i} className="border-b border-white/[0.04] last:border-0">
                      <td className={`py-3 pl-5 pr-3 ${row.method === "HOOK" ? "text-nova" : "text-ice"}`}>{row.method}</td>
                      <td className="py-3 pr-3 text-mute">{row.path}</td>
                      <td className={`py-3 pr-5 text-right ${row.tone === "good" ? "text-mint" : "text-sun"}`}>{row.result}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>

      {!m.walkthrough ? null : m.status === "awaiting_decision" ? (
        <DemoGuide step={5} next={{ href: `/m/${m.id}/decide`, label: agentDecides ? `Watch ${names.client}'s agent decide` : `Switch to ${names.client} and decide` }}>
          Both sides see the same evidence. {passed} of {report.results.length} passed, so {money(releasable)} can be released
          {waiting > 0 ? ` and ${money(waiting)} waits for a fix.` : "."} {agentDecides ? `${names.client}'s agent decides next.` : ""}
        </DemoGuide>
      ) : m.status === "fix_window" ? (
        <DemoGuide step={6} next={{ href: `/m/${m.id}/submit`, label: `Switch to ${names.freelancer} and fix` }}>
          {money(totals.captured)} is released. The other {money(totals.held)} is still only a hold on {names.client}&apos;s PayPal while {names.freelancer} fixes it.
        </DemoGuide>
      ) : m.status === "released" ? (
        <DemoGuide step={7} next={{ href: "/dashboard", label: "See all milestones" }}>
          Paid as agreed: every criterion passed and the full amount was released, with a signed record of why.
        </DemoGuide>
      ) : null}
    </div>
  );
}

export default function ReportPage() {
  return <MilestoneShell>{(m) => <ReportView m={m} />}</MilestoneShell>;
}
