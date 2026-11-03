// Runs the checker for a submitted milestone and records the signed report.
// Each step is written to the timeline as a "check" event, so the verify page shows the real log.

import type { CriterionResultJson } from "../db/schema";
import { releasableCents, formatCents } from "../domain/rules";
import { InvalidStateError, type MilestoneService } from "../milestones/service";
import { collectPage, runPageSpeed, testForm, type Evidence, type FormTest, type PageSpeed } from "./evidence";
import { NEEDS, type Judge } from "./judge";

export type CheckerOptions = {
  fetch?: typeof fetch;
  /** Google API key for PageSpeed Insights (mobile audit and screenshot). */
  pagespeedKey?: string;
  /** Local runs may check http://localhost pages, such as the sample site. Never in production. */
  allowPrivate?: boolean;
};

export type CheckLine = {
  attempt: number;
  verb: "open" | "form" | "audit" | "carry" | "test" | "rubric" | "decide" | "sign" | "note";
  text: string;
  tone?: "good" | "bad" | "ai" | "money";
  criterionId?: string;
  result?: Omit<CriterionResultJson, "criterionId">;
};

const short = (title: string) => (title.length > 46 ? `${title.slice(0, 44)}…` : title);
const mark = (v: CriterionResultJson["verdict"]) => (v === "pass" ? "✓" : v === "fail" ? "✗" : "?");

export async function runVerification(svc: MilestoneService, judge: Judge, id: string, deps: CheckerOptions = {}) {
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
    evidence = await collectPage(submission.url, { fetch: deps.fetch, allowPrivate: deps.allowPrivate });
    await line(
      evidence.kind === "page"
        ? { verb: "open", text: `${submission.url} → ${evidence.status} in ${evidence.ms} ms`, tone: evidence.ok ? "good" : "bad" }
        : { verb: "open", text: `${submission.url} → ${evidence.reason}`, tone: "bad" },
    );
  }

  const passedBefore = new Map((previous?.results ?? []).filter((r) => r.verdict === "pass").map((r) => [r.criterionId, r]));
  if (passedBefore.size) await line({ verb: "carry", text: `${passedBefore.size} criteria passed before; not run again` });

  // Real tests, run once and shared by the criteria that need them.
  const todo = m.criteria.filter((c) => !passedBefore.has(c.id));
  const needs = (re: RegExp) => todo.some((c) => re.test(c.title));
  let form: FormTest | undefined;
  if (evidence.kind === "page" && needs(NEEDS.form)) {
    const target = evidence.facts.forms[0];
    form = target ? await testForm(target, { fetch: deps.fetch, allowPrivate: deps.allowPrivate }) : { action: evidence.url, error: "No form found on the page" };
    await line(
      "error" in form
        ? { verb: "form", text: `contact form → ${form.error}`, tone: "bad" }
        : { verb: "form", text: `test message → ${form.status} from ${new URL(form.action).pathname}`, tone: form.ok ? "good" : "bad" },
    );
  }
  let pagespeed: PageSpeed | undefined;
  if (evidence.kind === "page" && (needs(NEEDS.mobile) || needs(NEEDS.speed) || needs(NEEDS.visual))) {
    pagespeed = await runPageSpeed(evidence.finalUrl, { key: deps.pagespeedKey, fetch: deps.fetch });
    await line(
      "unavailable" in pagespeed
        ? { verb: "audit", text: `mobile audit skipped: ${pagespeed.unavailable}` }
        : {
            verb: "audit",
            text: `mobile audit: performance ${pagespeed.performance}, viewport ${pagespeed.viewport === undefined ? "not reported" : pagespeed.viewport ? "ok" : "failed"}${pagespeed.contentWidth === undefined ? "" : `, fits the screen ${pagespeed.contentWidth ? "yes" : "no"}`}${pagespeed.screenshot ? ", screenshot saved" : ""}`,
            tone: pagespeed.viewport === false || pagespeed.contentWidth === false ? "bad" : "good",
          },
    );
  }
  const screenshot = pagespeed && !("unavailable" in pagespeed) ? pagespeed.screenshot : undefined;

  const results: CriterionResultJson[] = [];
  for (const c of m.criteria) {
    const carried = passedBefore.get(c.id);
    if (carried) {
      results.push(carried);
      continue;
    }
    const extra = { form: NEEDS.form.test(c.title) ? form : undefined, pagespeed: NEEDS.mobile.test(c.title) || NEEDS.speed.test(c.title) || NEEDS.visual.test(c.title) ? pagespeed : undefined };
    // Visual criteria see the phone screenshot, and so does a mobile criterion the audit could not settle.
    const image = NEEDS.visual.test(c.title) || NEEDS.mobile.test(c.title) ? screenshot : undefined;
    const v = await judge.judge({ criterion: c, milestone: { title: m.title, brief: m.brief }, evidence, extra, image });
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

  return { ran: true as const, attempt, results };
}
