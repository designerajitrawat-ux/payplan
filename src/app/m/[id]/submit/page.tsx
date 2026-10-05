"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { DemoGuide } from "@/components/demo-guide";
import { MilestoneShell, partyNames } from "@/components/milestone-shell";
import { Badge, Button, ButtonLink, Card, Field, RoleChip, VerdictBadge, inputClass } from "@/components/ui";
import { ledgerTotals } from "@/lib/decision";
import { money } from "@/lib/format";
import { startFix, submitWork } from "@/lib/store";
import type { Milestone } from "@/lib/types";

const SAMPLE_FILES = ["style-guide-check.png", "hero-1440.png", "mobile-375.png"];

function SubmitForm({ m }: { m: Milestone }) {
  const router = useRouter();
  const fixing = m.status === "fix_window";
  const [url, setUrl] = useState(m.submission?.url || "https://northwind-landing.example");
  const [prLink, setPrLink] = useState(m.submission?.prLink || "https://github.com/riya-designs/northwind-landing/pull/12");
  const [files, setFiles] = useState<string[]>(m.submission?.files ?? []);
  const [note, setNote] = useState(fixing ? "Fixed the contact form endpoint; it now returns 200 and shows a confirmation." : "");

  const failed = m.reports.at(-1)?.results.filter((r) => r.verdict !== "pass") ?? [];
  const names = partyNames(m);
  const totals = ledgerTotals(m.ledger);

  function send() {
    if (fixing) startFix(m.id);
    else submitWork(m.id, { url, prLink, files, note });
    router.push(`/m/${m.id}/verify`);
  }

  if (m.status !== "funded" && !fixing) {
    return (
      <Card>
        <p className="text-sm text-slate-600">Work can be submitted only while the milestone is locked or a fix window is open.</p>
        <ButtonLink href={`/m/${m.id}`} className="mt-4" variant="secondary">
          Go to the current step
        </ButtonLink>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="min-w-0 space-y-6">
        <RoleChip role="freelancer" />
        {fixing ? (
          <Card className="border-amber-200 bg-amber-50/40">
            <h2 className="font-semibold">Fix what was not met</h2>
            <p className="mt-1 text-sm text-slate-600">Only these criteria are re-checked. Everything that already passed stays passed.</p>
            <ul className="mt-3 space-y-2">
              {failed.map((r) => {
                const c = m.criteria.find((x) => x.id === r.criterionId);
                return (
                  <li key={r.criterionId} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white p-3 text-sm ring-1 ring-amber-200">
                    <span>{c?.title}</span>
                    <VerdictBadge verdict={r.verdict} />
                  </li>
                );
              })}
            </ul>
          </Card>
        ) : null}
        <Card>
          <h2 className="font-semibold">{fixing ? "Your fix" : "Hand over the work"}</h2>
          <div className="mt-4 space-y-4">
            <Field label="Live URL" hint="The verifier opens it in a real browser and takes its own screenshots.">
              <input className={inputClass} value={url} onChange={(e) => setUrl(e.target.value)} />
            </Field>
            <Field label="GitHub pull request (optional)">
              <input className={inputClass} value={prLink} onChange={(e) => setPrLink(e.target.value)} />
            </Field>
            <div>
              <p className="text-sm font-semibold text-slate-800">Files</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {files.map((f) => (
                  <Badge key={f}>{f}</Badge>
                ))}
                {files.length < SAMPLE_FILES.length ? (
                  <button onClick={() => setFiles(SAMPLE_FILES.slice(0, files.length + 1))} className="rounded-full border border-dashed border-slate-300 px-3 py-0.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                    + Add file (sample)
                  </button>
                ) : null}
              </div>
            </div>
            <Field label={fixing ? "What did you fix?" : "Note for the client (optional)"}>
              <textarea className={`${inputClass} min-h-20`} value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
          </div>
        </Card>
      </div>
      <aside className="min-w-0">
        <Card>
          <h2 className="font-semibold">Checks that will run</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {m.criteria.map((c) => (
              <li key={c.id} className="flex items-start justify-between gap-2">
                <span className="text-slate-700">{c.title}</span>
                <Badge tone={c.check === "ai" ? "brand" : "neutral"}>{c.check === "ai" ? "AI" : "Test"}</Badge>
              </li>
            ))}
          </ul>
          <Button className="mt-5 w-full" size="lg" onClick={send} disabled={!url.trim()}>
            {fixing ? "Submit the fix for re-check" : "Submit for verification"}
          </Button>
        </Card>
      </aside>
      {!m.walkthrough ? null : fixing ? (
        <DemoGuide step="step 6 of 7">
          You are <strong>{names.freelancer}</strong> again. {money(totals.captured)} is released and {money(totals.held)} waits on the fix. Submit it and only the failed criteria are re-checked.
        </DemoGuide>
      ) : (
        <DemoGuide step="step 3 of 7">
          You are <strong>{names.freelancer}, the freelancer</strong>. Add a sample file if you like, then press <strong>Submit for verification</strong>.
        </DemoGuide>
      )}
    </div>
  );
}

export default function SubmitPage() {
  return <MilestoneShell>{(m) => <SubmitForm m={m} />}</MilestoneShell>;
}
