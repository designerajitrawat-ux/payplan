// Runs the checker for a submitted milestone and records the signed report.
// Each step is written to the timeline as a "check" event, so the verify page shows the real log.

import type { CriterionResultJson } from "../db/schema";
import { releasableCents, formatCents } from "../domain/rules";
import { InvalidStateError, type MilestoneService } from "../milestones/service";
import { collectPage, type Evidence } from "./evidence";
import type { Judge } from "./judge";

export type CheckLine = {
  attempt: number;
  verb: "open" | "carry" | "test" | "rubric" | "decide" | "sign" | "note";
  text: string;
  tone?: "good" | "bad" | "ai" | "money";
  criterionId?: string;
  result?: Omit<CriterionResultJson, "criterionId">;
};

const short = (title: string) => (title.length > 46 ? `${title.slice(0, 44)}…` : title);
const mark = (v: CriterionResultJson["verdict"]) => (v === "pass" ? "✓" : v === "fail" ? "✗" : "?");

export async function runVerification(svc: MilestoneService, judge: Judge, id: string, deps: { fetch?: typeof fetch } = {}) {
  const m = await svc.getMilestone(id);
  if (m.status !== "verifying") return { ran: false as const, reason: `milestone is ${m.status}` };
  const attempt = m.submissions.length;
  // The report for this attempt exists but its release did not finish: only retry the release.
  if (m.reports.length >= attempt) {
    await svc.retryFixRelease(id);
    return { ran: false as const, reason: "retried the release" };
  }

  const line = (l: Omit<CheckLine, "attempt">) => svc.addEvent(id, "system", "check", { attempt, ...l });
  const previous = m.reports.at(-1);
  const submission = m.submissions.at(-1);

  let evidence: Evidence = { kind: "missing", reason: "No URL was submitted" };
  if (submission?.url) {
    evidence = await collectPage(submission.url, deps);
    await line(
      evidence.kind === "page"
        ? { verb: "open", text: `${submission.url} → ${evidence.status} in ${evidence.ms} ms`, tone: evidence.ok ? "good" : "bad" }
        : { verb: "open", text: `${submission.url} → ${evidence.reason}`, tone: "bad" },
    );
  }

  const passedBefore = new Map((previous?.results ?? []).filter((r) => r.verdict === "pass").map((r) => [r.criterionId, r]));
  if (passedBefore.size) await line({ verb: "carry", text: `${passedBefore.size} criteria passed before; not run again` });

  const results: CriterionResultJson[] = [];
  for (const c of m.criteria) {
    const carried = passedBefore.get(c.id);
    if (carried) {
      results.push(carried);
      continue;
    }
    const v = await judge.judge({ criterion: c, milestone: { title: m.title, brief: m.brief }, evidence });
    results.push({ criterionId: c.id, ...v });
    await line({
      verb: c.check === "ai" ? "rubric" : "test",
      text: `${short(c.title)} · ${v.confidence.toFixed(2)} ${mark(v.verdict)}`,
      tone: v.verdict === "fail" ? "bad" : c.check === "ai" || v.verdict === "review" ? "ai" : "good",
      criterionId: c.id,
      result: v,
    });
  }

  const due = releasableCents(m.criteria, results, m.totals.authorized);
  await line({ verb: "decide", text: `${results.filter((r) => r.verdict === "pass").length}/${results.length} passed · releasable ${formatCents(due)}`, tone: "money" });

  let report;
  try {
    report = await svc.recordReport(id, { results, model: judge.model });
  } catch (error) {
    // Another run finished first; its report stands.
    if (error instanceof InvalidStateError) return { ran: false as const, reason: "another check finished first" };
    // A fix report was stored but its release failed; the timer job retries the release.
    await line({ verb: "note", text: "Release did not finish; it will be retried", tone: "bad" });
    throw error;
  }
  await line({ verb: "sign", text: `report ${report.reportHash.slice(0, 6)}…${report.reportHash.slice(-4)}`, tone: "money" });

  if (attempt === 1 && m.approval === "agent") {
    try {
      await svc.agentDecide(id);
    } catch (error) {
      await line({ verb: "note", text: `The agent could not decide: ${error instanceof Error ? error.message : String(error)}`, tone: "bad" });
    }
  }
  return { ran: true as const, attempt, results };
}
