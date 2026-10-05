"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { DemoGuide } from "@/components/demo-guide";
import { MilestoneShell, partyNames } from "@/components/milestone-shell";
import { Countdown } from "@/components/time";
import { Arrow, Button, ButtonLink, Chip, Eyebrow, Field, Panel, RoleChip, VerdictChip, inputClass } from "@/components/ui";
import { ledgerTotals } from "@/lib/decision";
import { money } from "@/lib/format";
import { startFix, submitWork } from "@/lib/store";
import { stagger } from "@/lib/style";
import type { Milestone } from "@/lib/types";

const SAMPLE_FILES = ["style-guide-check.png", "hero-1440.png", "mobile-375.png"];

function SubmitForm({ m }: { m: Milestone }) {
  const router = useRouter();
  const fixing = m.status === "fix_window";
  const [url, setUrl] = useState(m.submission?.url || "https://northwind-landing.example");
  const [prLink, setPrLink] = useState(m.submission?.prLink || "https://github.com/riya-designs/northwind-landing/pull/12");
  const [files, setFiles] = useState<string[]>(m.submission?.files ?? []);
  const [uploading, setUploading] = useState<string | null>(null);
  const [note, setNote] = useState(fixing ? "Fixed the contact form endpoint; it now returns 200 and shows a confirmation." : "");

  const failed = m.reports.at(-1)?.results.filter((r) => r.verdict !== "pass") ?? [];
  const names = partyNames(m);
  const totals = ledgerTotals(m.ledger);

  function addFile() {
    const name = SAMPLE_FILES[files.length];
    setUploading(name);
    setTimeout(() => {
      setFiles((list) => [...list, name]);
      setUploading(null);
    }, 700);
  }

  function send() {
    if (fixing) startFix(m.id);
    else submitWork(m.id, { url, prLink, files, note });
    router.push(`/m/${m.id}/verify`);
  }

  if (m.status !== "funded" && !fixing) {
    return (
      <Panel>
        <p className="text-sm text-mute">Work can be submitted only while the milestone is locked or a fix window is open.</p>
        <ButtonLink href={`/m/${m.id}`} className="mt-4" variant="secondary">
          Go to the current step
        </ButtonLink>
      </Panel>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-6">
        <RoleChip role="freelancer" name={names.freelancer} />
        {fixing ? (
          <Panel className="border-flare/25">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-lg font-semibold">Fix what was not met</h2>
              <span className="font-mono text-xs text-sun">
                Fix due in <Countdown to={m.fixDueAt} />
              </span>
            </div>
            <p className="mt-1 text-sm text-mute">Only these criteria are checked again. Everything that passed stays passed, and {money(totals.captured)} is already yours.</p>
            <ul className="mt-4 space-y-2">
              {failed.map((r) => {
                const c = m.criteria.find((x) => x.id === r.criterionId);
                return (
                  <li key={r.criterionId} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-flare/20 bg-flare/[0.05] p-3.5 text-sm">
                    <span className="min-w-0">
                      <span className="block text-ink">{c?.title}</span>
                      <span className="mt-0.5 block text-xs text-mute">{r.evidence}</span>
                    </span>
                    <VerdictChip verdict={r.verdict} />
                  </li>
                );
              })}
            </ul>
          </Panel>
        ) : null}
        <Panel>
          <h2 className="font-display text-lg font-semibold">{fixing ? "Your fix" : "Hand over the work"}</h2>
          <div className="mt-5 space-y-5">
            <Field label="Live URL" hint="The checker opens it in a real browser and takes its own screenshots.">
              <input className={inputClass} value={url} onChange={(e) => setUrl(e.target.value)} />
            </Field>
            <Field label="GitHub pull request (optional)">
              <input className={inputClass} value={prLink} onChange={(e) => setPrLink(e.target.value)} />
            </Field>
            <div>
              <p className="text-[13px] font-medium text-ink">Files</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {files.map((f, i) => (
                  <span key={f} className="rise inline-flex items-center gap-2 rounded-full bg-white/[0.05] px-3 py-1.5 text-xs text-ink ring-1 ring-inset ring-white/10" style={stagger(i === files.length - 1 ? 0 : -20)}>
                    <svg viewBox="0 0 16 16" className="size-3.5 text-mint" aria-hidden>
                      <path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {f}
                  </span>
                ))}
                {uploading ? (
                  <span className="relative inline-flex items-center overflow-hidden rounded-full bg-white/[0.05] px-3 py-1.5 text-xs text-mute ring-1 ring-inset ring-white/10">
                    <span className="shimmer absolute inset-0" aria-hidden />
                    <span className="relative">Uploading {uploading}…</span>
                  </span>
                ) : files.length < SAMPLE_FILES.length ? (
                  <button type="button" onClick={addFile} className="rounded-full border border-dashed border-white/20 px-3 py-1.5 text-xs font-medium text-mute transition hover:border-white/35 hover:text-ink">
                    + Add file (sample)
                  </button>
                ) : null}
              </div>
            </div>
            <Field label={fixing ? "What did you fix?" : "Note for the client (optional)"}>
              <textarea className={`${inputClass} min-h-20`} value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
          </div>
        </Panel>
      </div>
      <aside className="min-w-0 lg:sticky lg:top-8 lg:self-start">
        <Panel>
          <Eyebrow>Checks that will run</Eyebrow>
          <ul className="mt-4 space-y-3 text-sm">
            {m.criteria.map((c) => {
              const skip = fixing && !failed.some((r) => r.criterionId === c.id);
              return (
                <li key={c.id} className={`flex items-start justify-between gap-3 ${skip ? "opacity-40" : ""}`}>
                  <span className="text-mute">{c.title}</span>
                  {skip ? <Chip tone="good">Passed</Chip> : <Chip tone={c.check === "ai" ? "brand" : "neutral"}>{c.check === "ai" ? "AI" : "Test"}</Chip>}
                </li>
              );
            })}
          </ul>
          <Button className="group mt-6 w-full" size="lg" onClick={send} disabled={!url.trim()}>
            {fixing ? "Submit the fix for re-check" : "Submit for verification"}
            <Arrow />
          </Button>
        </Panel>
      </aside>
      {!m.walkthrough ? null : fixing ? (
        <DemoGuide step={7}>
          You are <strong>{names.freelancer}</strong> again. {money(totals.captured)} is released and {money(totals.held)} waits on the fix. Submit it and only the failed criterion is checked again.
        </DemoGuide>
      ) : (
        <DemoGuide step={3}>
          You are <strong>{names.freelancer}, the freelancer</strong>. Add a sample file if you like, then press <strong>Submit for verification</strong>.
        </DemoGuide>
      )}
    </div>
  );
}

export default function SubmitPage() {
  return <MilestoneShell>{(m) => <SubmitForm m={m} />}</MilestoneShell>;
}
