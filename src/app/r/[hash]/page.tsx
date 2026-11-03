import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Logo } from "@/components/site-header";
import { Chip, Eyebrow, Panel, VerdictChip } from "@/components/ui";
import { money } from "@/lib/format";
import type { CriterionResultJson } from "@/server/db/schema";
import { services } from "@/server/app";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Verify an acceptance report · PayPlan", robots: { index: false } };

type Payload = {
  milestone: { id: string; number: number; title: string; specHash: string; amountCents: number; currency: string; client: string; freelancer: string };
  attempt: number;
  verifiedAt: string;
  checker: string;
  criteria: { id: string; title: string; weight: number; mustPass: boolean }[];
  results: CriterionResultJson[];
  releasableCents: number;
  paypal: { orderId: string | null; authorizationId: string | null };
};

const when = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

/** Public page: anyone with the link (a client, a freelancer, a dispute reviewer) can check a report is genuine. */
export default async function VerifyReportPage({ params }: { params: Promise<{ hash: string }> }) {
  const { hash } = await params;
  if (!/^[0-9a-f]{64}$/.test(hash)) notFound();
  const r = await (await services()).milestones.verifyReport(hash);
  if (!r) notFound();
  const p = r.payload as Payload;
  const checks = [
    { label: "Content unchanged", ok: r.hashMatches, detail: "The SHA-256 of the report matches its id." },
    { label: "Signed by PayPlan", ok: r.signatureValid, detail: r.knownKey ? "The Ed25519 signature matches this site's public key." : "Signed by a key this site does not use any more." },
  ];
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-10 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/" aria-label="PayPlan home">
          <Logo />
        </Link>
        <Chip tone="neutral">Report verification</Chip>
      </header>

      <Panel className={r.valid ? "border-mint/30" : "border-flare/40"}>
        <Eyebrow>Acceptance report · attempt {p.attempt}</Eyebrow>
        <h1 className={`mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl ${r.valid ? "text-mint" : "text-flare"}`}>{r.valid ? "This report is genuine" : "This report could not be verified"}</h1>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {checks.map((c) => (
            <li key={c.label} className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
              <p className={`text-sm font-semibold ${c.ok ? "text-mint" : "text-flare"}`}>
                {c.ok ? "✓" : "✗"} {c.label}
              </p>
              <p className="mt-1 text-xs text-dim">{c.detail}</p>
            </li>
          ))}
        </ul>
        <p className="mt-5 break-all font-mono text-xs text-dim">Report id (SHA-256) {r.reportHash}</p>
        <a
          href={`/api/reports/${r.reportHash}/pdf`}
          className="press volt-fill mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-brand px-5 text-sm font-semibold text-white [--lip-color:#0f249e] hover:bg-[#3557ff]"
        >
          Download the PDF for a PayPal dispute
        </a>
      </Panel>

      <Panel>
        <h2 className="font-display text-xl font-semibold text-ink">{p.milestone.title}</h2>
        <p className="mt-1 text-sm text-mute">
          {p.milestone.freelancer} → {p.milestone.client} · <span className="font-sans text-ink">{money(p.milestone.amountCents / 100)}</span> · M-{p.milestone.number}
        </p>
        <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-dim">Checked</dt>
            <dd className="mt-1 text-ink">{when.format(new Date(p.verifiedAt))} UTC</dd>
          </div>
          <div>
            <dt className="text-xs text-dim">Checker</dt>
            <dd className="mt-1 text-ink">{p.checker}</dd>
          </div>
          <div>
            <dt className="text-xs text-dim">Releasable by this report</dt>
            <dd className="mt-1 font-sans font-semibold text-sun">{money(p.releasableCents / 100)}</dd>
          </div>
        </dl>
        <p className="mt-4 break-all font-mono text-xs text-dim">Agreement ID {p.milestone.specHash}</p>
      </Panel>

      <Panel>
        <h2 className="font-display text-lg font-semibold">Criteria and verdicts</h2>
        <ul className="mt-4 divide-y divide-white/[0.06]">
          {p.criteria.map((c) => {
            const v = p.results.find((x) => x.criterionId === c.id);
            return (
              <li key={c.id} className="py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-medium text-ink">
                    {c.title} <span className="font-mono text-xs text-dim">· {c.weight}%{c.mustPass ? " · must pass" : ""}</span>
                  </p>
                  {v ? <VerdictChip verdict={v.verdict} /> : null}
                </div>
                {v ? (
                  <p className="mt-1 text-xs leading-relaxed text-mute">
                    {v.reason} <span className="text-dim">Evidence: {v.evidence}.</span>
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      </Panel>

      <Panel>
        <h2 className="font-display text-lg font-semibold">PayPal</h2>
        <p className="mt-2 text-sm text-mute">
          Authorization <span className="font-mono text-xs text-ink">{p.paypal.authorizationId ?? "none"}</span>
        </p>
        <ul className="mt-3 space-y-1.5 text-sm">
          {r.paypalMoves.map((m, i) => (
            <li key={i} className="flex flex-wrap justify-between gap-2 font-mono text-xs">
              <span className="text-mute">
                {m.kind} · {m.paypalId}
              </span>
              <span className="font-sans text-ink">{money(m.amountCents / 100)}</span>
            </li>
          ))}
        </ul>
      </Panel>

      <p className="text-xs leading-relaxed text-dim">
        Check it yourself: download the{" "}
        <Link prefetch={false} className="text-nova underline-offset-4 hover:underline" href={`/api/reports/${r.reportHash}`}>
          signed report (JSON)
        </Link>{" "}
        and the{" "}
        <Link prefetch={false} className="text-nova underline-offset-4 hover:underline" href="/api/reports/key">
          public key
        </Link>
        . The signature is Ed25519 over the canonical JSON of <code>payload</code> (keys sorted), and the report id is the SHA-256 of the same bytes. PayPal is a trademark of PayPal, Inc.; this project is not affiliated with PayPal.
      </p>
    </div>
  );
}
