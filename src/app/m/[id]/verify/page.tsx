"use client";

import { useEffect, useState } from "react";
import { DemoGuide } from "@/components/demo-guide";
import { MilestoneShell } from "@/components/milestone-shell";
import { Badge, ButtonLink, Card, RoleChip, VerdictBadge } from "@/components/ui";
import { finishVerification } from "@/lib/store";
import type { Milestone } from "@/lib/types";

const STEP_MS = 900;

const working: Record<string, string> = {
  automatic: "Running the automatic test…",
  ai: "Asking the AI rubric, with screenshots…",
};

function Verifier({ m }: { m: Milestone }) {
  const [revealed, setRevealed] = useState(0);
  const running = m.status === "verifying";
  const attempt = running ? m.reports.length + 1 : m.reports.length;
  const previous = running ? m.reports.at(-1) : m.reports.at(-2);

  useEffect(() => {
    if (!running) return;
    const timers = m.criteria.map((_, i) => setTimeout(() => setRevealed(i + 1), STEP_MS * (i + 1)));
    timers.push(setTimeout(() => finishVerification(m.id), STEP_MS * (m.criteria.length + 1)));
    return () => timers.forEach(clearTimeout);
  }, [running, m.id, m.criteria]);

  const finalReport = running ? undefined : m.reports.at(-1);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="min-w-0 space-y-4">
        <RoleChip role="both" />
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">{running ? "Verifying the delivered work" : "Verification finished"}</h2>
            <Badge tone="brand">Attempt {attempt}</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-600">Automatic tests run first. The AI rubric only judges what a test cannot, and it never moves money.</p>
          <ul className="mt-5 space-y-3">
            {m.criteria.map((c, i) => {
              const carried = attempt > 1 && previous?.results.find((r) => r.criterionId === c.id)?.verdict === "pass";
              const scripted = attempt === 1 ? c.demo.first : c.demo.afterFix;
              const result = finalReport?.results.find((r) => r.criterionId === c.id) ?? (carried ? previous?.results.find((r) => r.criterionId === c.id) : scripted);
              const done = !running || carried || revealed > i;
              return (
                <li key={c.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium">{c.title}</span>
                    {done && result ? <VerdictBadge verdict={result.verdict} /> : <Badge tone="neutral">{revealed === i ? "Checking…" : "Queued"}</Badge>}
                  </div>
                  <p className="mt-1.5 text-xs text-slate-500">
                    {carried ? "Passed earlier, not re-checked." : done && result ? result.evidence : revealed === i ? working[c.check] : "Waiting"}
                  </p>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
      <aside className="min-w-0">
        <Card>
          {running ? (
            <>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div className="h-full bg-teal-600 transition-all duration-700" style={{ width: `${(revealed / m.criteria.length) * 100}%` }} />
              </div>
              <p className="mt-3 text-sm text-slate-600">
                Checked {revealed} of {m.criteria.length}. The report is signed when all checks finish.
              </p>
            </>
          ) : (
            <>
              <Badge tone="good">Report signed</Badge>
              <p className="mt-3 text-sm text-slate-600">The acceptance report is ready for both sides.</p>
              <ButtonLink href={`/m/${m.id}/report`} className="mt-4 w-full">
                Open the acceptance report
              </ButtonLink>
            </>
          )}
        </Card>
      </aside>
      {m.walkthrough ? (
      <DemoGuide step={attempt > 1 ? "step 6 of 7" : "step 4 of 7"} next={running ? undefined : { href: `/m/${m.id}/report`, label: "Open the report" }}>
        {attempt > 1
          ? "Only the criteria that failed are re-checked. When they pass, the remaining share is released automatically, as agreed in the spec."
          : "The verifier checks each criterion one by one. In the real app it loads the live URL, takes screenshots and runs the AI rubric."}
      </DemoGuide>
      ) : null}
    </div>
  );
}

export default function VerifyPage() {
  return <MilestoneShell>{(m) => <Verifier m={m} />}</MilestoneShell>;
}
