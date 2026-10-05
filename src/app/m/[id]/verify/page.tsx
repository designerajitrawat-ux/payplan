"use client";

import { useEffect, useRef, useState } from "react";
import { ConfidenceRing, Constellation, type StarState } from "@/components/cosmos";
import { DemoGuide } from "@/components/demo-guide";
import { MilestoneShell, partyNames } from "@/components/milestone-shell";
import { NumberTicker, TextScramble } from "@/components/motion";
import { toast } from "@/components/toast";
import { Arrow, ButtonLink, Chip, Eyebrow, Panel, RoleChip, VerdictChip } from "@/components/ui";
import { releasableAmount } from "@/lib/decision";
import { money, shortHash } from "@/lib/format";
import { finishVerification } from "@/lib/store";
import type { Criterion, Milestone, ScriptedResult } from "@/lib/types";

const STEP_MS = 1100;

const clock = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

type LogLine = { t: number; verb: string; text: string; tone?: "good" | "bad" | "money" | "ai" };

function short(title: string) {
  return title.length > 46 ? `${title.slice(0, 44)}…` : title;
}

function resultLine(c: Criterion, r: ScriptedResult, t: number): LogLine {
  const ok = r.verdict === "pass";
  return c.check === "ai"
    ? { t, verb: "rubric", text: `${short(c.title)} · ${r.confidence.toFixed(2)} ${ok ? "✓" : "✗"}`, tone: ok ? "ai" : "bad" }
    : { t, verb: "test", text: `${short(c.title)} → ${short(r.evidence)} ${ok ? "✓" : "✗"}`, tone: ok ? "good" : "bad" };
}

function Verifier({ m }: { m: Milestone }) {
  const [revealed, setRevealed] = useState(0);
  const running = m.status === "verifying";
  const attempt = running ? m.reports.length + 1 : m.reports.length;
  const previous = running ? m.reports.at(-1) : m.reports.at(-2);
  const finalReport = running ? undefined : m.reports.at(-1);
  const names = partyNames(m);
  const logRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    if (!running) return;
    const timers = m.criteria.map((_, i) => setTimeout(() => setRevealed(i + 1), STEP_MS * (i + 1)));
    timers.push(
      setTimeout(() => {
        finishVerification(m.id);
        toast("Report signed", "Both sides can now see the evidence.", "info");
      }, STEP_MS * (m.criteria.length + 1) + 300),
    );
    return () => timers.forEach(clearTimeout);
  }, [running, m.id, m.criteria]);

  const rows = m.criteria.map((c, i) => {
    const prior = previous?.results.find((r) => r.criterionId === c.id);
    const carried = attempt > 1 && prior?.verdict === "pass";
    const scripted = attempt === 1 ? c.demo.first : c.demo.afterFix;
    const result: ScriptedResult | undefined = finalReport?.results.find((r) => r.criterionId === c.id) ?? (carried ? prior : scripted);
    const done = !running || carried || revealed > i;
    const checking = running && !carried && revealed === i;
    const state: StarState = carried ? "carried" : done ? (result?.verdict === "pass" ? "pass" : "fail") : checking ? "checking" : "queued";
    return { c, result, done, checking, carried, state };
  });

  const totalWeight = m.criteria.reduce((sum, c) => sum + c.weight, 0) || 1;
  const passedWeight = rows.filter((r) => r.done && r.result?.verdict === "pass").reduce((sum, r) => sum + r.c.weight, 0);
  const verifiedAmount = Math.floor((m.amount * 100 * passedWeight) / totalWeight) / 100;
  const checkedCount = rows.filter((r) => r.done).length;

  const base = Date.parse(m.submission?.submittedAt ?? m.createdAt) + (attempt > 1 ? 3_600_000 : 0);
  const lines: LogLine[] = [
    { t: base, verb: "open", text: `${m.submission?.url || "delivered files"} → 200`, tone: "good" },
    { t: base + 2000, verb: "shot", text: "screenshots at 1440 px and 375 px saved" },
  ];
  if (attempt > 1) lines.push({ t: base + 3000, verb: "carry", text: `${rows.filter((r) => r.carried).length} criteria passed before; not run again` });
  rows.forEach((r, i) => {
    if (r.carried) return;
    if (r.done && r.result) lines.push(resultLine(r.c, r.result, base + 4000 + i * 4000));
    else if (r.checking) lines.push({ t: base + 4000 + i * 4000, verb: r.c.check === "ai" ? "rubric" : "test", text: `${short(r.c.title)} …`, tone: "ai" });
  });
  if (!running && finalReport) {
    const passed = finalReport.results.filter((r) => r.verdict === "pass").length;
    const releasable = releasableAmount(m.criteria, finalReport.results, m.amount);
    lines.push({ t: base + 26000, verb: "decide", text: `${passed}/${finalReport.results.length} passed · releasable ${money(releasable)}`, tone: "money" });
    lines.push({ t: base + 27000, verb: "sign", text: `report ${shortHash(finalReport.reportHash)}`, tone: "money" });
  }

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines.length]);

  return (
    <div className="min-w-0 space-y-6">
      <RoleChip role="both" />
      <p className="sr-only" aria-live="polite">
        {running ? `Checked ${checkedCount} of ${m.criteria.length} criteria.` : `Check finished. ${finalReport?.results.filter((r) => r.verdict === "pass").length ?? 0} of ${m.criteria.length} criteria passed.`}
      </p>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        <Panel className={running ? "beam" : ""}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Eyebrow>
              AI checker · attempt {attempt}
            </Eyebrow>
            {running ? (
              <Chip tone="brand" dot pulse>
                Live
              </Chip>
            ) : (
              <Chip tone="good" dot>
                Finished
              </Chip>
            )}
          </div>
          <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-balance font-stretch-semi-expanded sm:text-4xl">
            {running ? (
              <>
                Checking {Math.min(checkedCount + 1, m.criteria.length)} of {m.criteria.length}
                <span className="caret text-nova">_</span>
              </>
            ) : (
              `${finalReport?.results.filter((r) => r.verdict === "pass").length ?? 0} of ${m.criteria.length} criteria passed`
            )}
          </h2>
          <p className="mt-3 max-w-lg text-sm leading-relaxed text-mute">Automatic tests run first. The AI rubric judges only what a test cannot, and it never moves money by itself.</p>
          <dl className="mt-6 flex flex-wrap gap-x-10 gap-y-4">
            <div>
              <dt className="text-xs text-dim">Verified so far</dt>
              <dd className="mt-1 font-display text-3xl font-semibold text-mint">
                <NumberTicker value={verifiedAmount} from={0} duration={700} />
              </dd>
            </div>
            <div>
              <dt className="text-xs text-dim">Checked</dt>
              <dd className="mt-1 font-display text-3xl font-semibold text-ink">
                {checkedCount}/{m.criteria.length}
              </dd>
            </div>
          </dl>
        </Panel>
        <Panel className="hidden flex-col justify-center lg:flex">
          <Constellation states={rows.map((r) => r.state)} />
          <p className="mt-2 text-center text-xs text-dim">Each star is a criterion. Lines join once both ends are checked.</p>
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-label="Checker log" className="min-w-0 overflow-hidden rounded-3xl border border-white/[0.08] bg-void/80">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3.5">
            <span className="flex items-center gap-2 text-sm font-medium text-ink">
              <span className="flex gap-1" aria-hidden>
                <span className="size-2 rounded-full bg-white/15" />
                <span className="size-2 rounded-full bg-white/15" />
                <span className="size-2 rounded-full bg-white/15" />
              </span>
              Checker log
            </span>
            <span className="font-mono text-xs text-dim">{lines.length} lines</span>
          </div>
          <ol ref={logRef} tabIndex={0} aria-label="Checker log lines" className="max-h-80 space-y-2 overflow-auto p-5 font-mono text-[12px] leading-relaxed">
            {lines.map((l, i) => (
              <li key={`${l.verb}-${i}`} className="rise flex gap-3" style={{ animationDuration: "400ms" }}>
                <span className="shrink-0 text-dim">{clock.format(new Date(l.t))}</span>
                <span className={`w-12 shrink-0 ${l.tone === "ai" ? "text-nova" : l.tone === "money" ? "text-sun" : "text-ice"}`}>{l.verb}</span>
                <span className={`min-w-0 break-words ${l.tone === "bad" ? "text-flare" : l.tone === "good" ? "text-ink" : "text-mute"}`}>{l.text}</span>
              </li>
            ))}
            {running ? (
              <li className="flex gap-3">
                <span className="caret inline-block h-4 w-2 bg-nova" aria-hidden />
              </li>
            ) : null}
          </ol>
        </section>

        <section aria-label="Criteria" className="order-first min-w-0 space-y-2.5 lg:order-none">
          {rows.map(({ c, result, done, checking, carried }) => (
            <article
              key={c.id}
              className={`glass flex items-center gap-4 rounded-2xl p-4 transition-all duration-500 ${checking ? "beam" : ""} ${done && result?.verdict === "fail" ? "shake border-flare/30" : ""} ${!done && !checking ? "opacity-50" : ""}`}
            >
              {done && result ? <ConfidenceRing value={result.confidence} tone={result.verdict === "pass" ? "mint" : "flare"} /> : <span className={`grid size-10 shrink-0 place-items-center rounded-full border ${checking ? "border-nova/50" : "border-white/10"}`}>{checking ? <span className="size-3 animate-spin rounded-full border-2 border-nova/30 border-t-nova" /> : <span className="size-1.5 rounded-full bg-white/20" />}</span>}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink">{c.title}</p>
                <p className="mt-0.5 truncate text-xs text-dim">{carried ? "Passed before, not run again" : done && result ? result.evidence : checking ? (c.check === "ai" ? "Asking the AI rubric, with screenshots…" : "Running the automatic test…") : "Queued"}</p>
              </div>
              {done && result ? <VerdictChip verdict={result.verdict} /> : null}
            </article>
          ))}
        </section>
      </div>

      {!running && finalReport ? (
        <Panel className="rise flex flex-wrap items-center justify-between gap-5">
          <div className="min-w-0">
            <Eyebrow>Report signed</Eyebrow>
            <p className="mt-2 text-sm text-mute">
              Report hash <TextScramble text={shortHash(finalReport.reportHash)} className="text-ink" />. If a dispute opens, this report becomes the evidence file.
            </p>
            {m.approval === "agent" && m.status === "awaiting_decision" ? <p className="mt-2 text-sm text-nova">{names.client}&apos;s agent will review it against its limits.</p> : null}
          </div>
          <ButtonLink href={`/m/${m.id}/report`} className="group">
            Open the acceptance report
            <Arrow />
          </ButtonLink>
        </Panel>
      ) : null}

      {m.walkthrough ? (
        <DemoGuide step={attempt > 1 ? 8 : 4} next={running ? undefined : { href: `/m/${m.id}/report`, label: "Open the report" }}>
          {attempt > 1
            ? "Only the criterion that failed is checked again. When it passes, the remaining share is released automatically, as agreed in the spec."
            : "Watch the checker work. In the real app it opens the live URL in a browser, takes screenshots, runs tests and asks the AI rubric, then signs the report."}
        </DemoGuide>
      ) : null}
    </div>
  );
}

export default function VerifyPage() {
  return <MilestoneShell>{(m) => <Verifier m={m} />}</MilestoneShell>;
}
