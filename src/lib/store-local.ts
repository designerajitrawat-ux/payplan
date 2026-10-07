"use client";

import { useSyncExternalStore } from "react";
import { agentReview, ledgerTotals, releasableAmount } from "./decision";
import { fakePayPalId, money, previewHash, shortHash } from "./format";
import { defaultMandate, makeSeed } from "./seed";
import type { AgentMandate, ApprovalMode, CheckLine, Criterion, CriterionResult, Milestone, NewMilestoneInput, PayPalMode, ScriptedResult, Submission } from "./types";

export type { NewMilestoneInput };

// Prototype store: dummy data kept in the browser (localStorage). The static preview build uses it;
// the app itself uses store-remote.ts. Both export the same hooks and actions.

type State = { milestones: Milestone[]; mandate: AgentMandate };

const KEY = "payplan-prototype-v3";
const HOUR = 3_600_000;
/** Time between two criteria in the scripted checker, so the live log reads like a real run. */
const STEP_MS = 1100;
const SERVER_NOW = Date.parse("2026-10-05T12:00:00Z");
const serverState: State = { milestones: makeSeed(SERVER_NOW), mandate: defaultMandate };

let state: State | null = null;
const listeners = new Set<() => void>();

function fresh(): State {
  return { milestones: makeSeed(Date.now()), mandate: defaultMandate };
}

function load(): State {
  if (state) return state;
  try {
    const raw = window.localStorage.getItem(KEY);
    state = raw ? (JSON.parse(raw) as State) : fresh();
  } catch {
    state = fresh();
  }
  return state;
}

function save(next: State) {
  state = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage can be unavailable (private mode); the prototype still works in memory.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useMilestones(): Milestone[] {
  return useSyncExternalStore(
    subscribe,
    () => load().milestones,
    () => serverState.milestones,
  );
}

/** The prototype's data is always at hand. */
export function useMilestonesLoaded(): boolean {
  return true;
}

export function useMilestone(id: string): Milestone | undefined {
  return useMilestones().find((m) => m.id === id);
}

export function useMilestoneLoad(id: string): "loading" | "ready" | "missing" {
  return useMilestone(id) ? "ready" : "missing";
}

export function useMandate(): AgentMandate {
  return useSyncExternalStore(
    subscribe,
    () => load().mandate,
    () => serverState.mandate,
  );
}

export function usePayPalMode(): PayPalMode {
  return "prototype";
}

/** Demo shortcuts (end a review or fix window now) are always on in the prototype. */
export function useDemoControls(): boolean {
  return true;
}

function get(id: string) {
  return load().milestones.find((m) => m.id === id);
}

function update(id: string, change: (m: Milestone) => Milestone) {
  const s = load();
  save({ ...s, milestones: s.milestones.map((m) => (m.id === id ? change(m) : m)) });
}

const nowIso = () => new Date().toISOString();

const passed = (evidence: string): ScriptedResult => ({ verdict: "pass", confidence: 0.9, evidence, reason: "Meets the criterion." });
const scripted = (c: Criterion, attempt: number) => (attempt === 1 ? c.demo?.first : c.demo?.afterFix) ?? passed("Checked");

export async function createMilestone(input: NewMilestoneInput, walkthrough = false): Promise<string> {
  const s = load();
  const next = Math.max(1050, ...s.milestones.map((m) => Number(m.id.replace("m-", "")) || 0)) + 1;
  const id = `m-${next}`;
  const criteria = input.criteria.map((c, i) => ({ ...c, id: `${id}-c${i + 1}` }));
  const milestone: Milestone = {
    id,
    title: input.title,
    brief: input.brief,
    clientName: input.clientName,
    clientEmail: input.clientEmail,
    freelancerName: input.freelancerName ?? "Riya Sharma",
    freelancerLocation: input.freelancerLocation ?? "Pune, India",
    boughtByAgent: false,
    amount: input.amount,
    currency: "USD",
    reviewWindowHours: input.reviewWindowHours,
    fixWindowHours: 72,
    criteria,
    specHash: previewHash(JSON.stringify({ title: input.title, amount: input.amount, criteria })),
    status: "awaiting_funding",
    createdAt: nowIso(),
    reports: [],
    ledger: [],
    approval: "client",
    walkthrough,
  };
  save({ ...s, milestones: [milestone, ...s.milestones] });
  return id;
}

/** The prototype's stand-in for PayPal approving the hold. */
export async function fundWithSimulatedPayPal(id: string, approval: ApprovalMode) {
  update(id, (m) => ({
    ...m,
    status: "funded",
    approval,
    fundedAt: nowIso(),
    ledger: [...m.ledger, { id: fakePayPalId("AUTH", id + nowIso()), kind: "authorization", amount: m.amount, at: nowIso(), note: "Client approved the hold in PayPal" }],
  }));
}

/** Real PayPal only exists in the app, not in the prototype. */
export async function startFunding(id: string): Promise<{ orderId: string }> {
  void id;
  throw new Error("The prototype has no real PayPal. Use the simulated approval.");
}

export async function completeFunding(id: string, orderId: string, approval: ApprovalMode) {
  void orderId;
  await fundWithSimulatedPayPal(id, approval);
}

/** Switching back to the agent before a release lets it review the report again. */
export async function setApproval(id: string, approval: ApprovalMode) {
  update(id, (m) => ({ ...m, approval, agentDecision: approval === "agent" && m.status === "awaiting_decision" ? undefined : m.agentDecision }));
}

// ---- Scripted checker: writes the live log step by step, like the real one does on the server.

const running = new Map<string, ReturnType<typeof setTimeout>[]>();

function line(l: Omit<CheckLine, "at">): CheckLine {
  return { at: nowIso(), ...l };
}

const short = (title: string) => (title.length > 46 ? `${title.slice(0, 44)}…` : title);

function resultLine(c: Criterion, r: ScriptedResult): CheckLine {
  const ok = r.verdict === "pass";
  const mark = ok ? "✓" : r.verdict === "fail" ? "✗" : "?";
  return c.check === "ai"
    ? line({ verb: "rubric", text: `${short(c.title)} · ${r.confidence.toFixed(2)} ${mark}`, tone: ok ? "ai" : "bad", criterionId: c.id, result: r })
    : line({ verb: "test", text: `${short(c.title)} → ${short(r.evidence)} ${mark}`, tone: ok ? "good" : "bad", criterionId: c.id, result: r });
}

function startRun(id: string) {
  const m = get(id);
  if (!m || m.status !== "verifying" || running.has(id)) return;
  const attempt = m.reports.length + 1;
  const previous = m.reports.at(-1);
  const todo = m.criteria.filter((c) => !(attempt > 1 && previous?.results.find((r) => r.criterionId === c.id)?.verdict === "pass"));
  const elapsed = m.verifyStartedAt ? Date.now() - Date.parse(m.verifyStartedAt) : 0;
  const done = new Set((m.checks ?? []).map((l) => l.criterionId).filter(Boolean));
  const timers = todo.map((c, i) =>
    setTimeout(
      () => {
        if (done.has(c.id)) return;
        update(id, (x) => (x.status === "verifying" ? { ...x, checks: [...(x.checks ?? []), resultLine(c, scripted(c, attempt))] } : x));
      },
      Math.max(0, STEP_MS * (i + 1) - elapsed),
    ),
  );
  timers.push(setTimeout(() => void finishVerification(id), Math.max(0, STEP_MS * (todo.length + 1) + 300 - elapsed)));
  running.set(id, timers);
}

/** Restarts the scripted checker after a reload; the real checker runs on the server. */
export function resumeBackgroundWork(milestones: Milestone[]) {
  milestones.filter((m) => m.status === "verifying").forEach((m) => startRun(m.id));
}

export async function submitWork(id: string, submission: Omit<Submission, "submittedAt">) {
  const m = get(id);
  if (!m) return;
  const fixing = m.status === "fix_window";
  const attempt = m.reports.length + 1;
  const url = submission.url || m.submission?.url || "";
  const first: CheckLine[] = [
    line({ verb: "open", text: `${url || "delivered files"} → 200`, tone: "good" }),
    line({ verb: "shot", text: "screenshots at 1440 px and 375 px saved" }),
  ];
  if (attempt > 1) {
    const carried = m.reports.at(-1)?.results.filter((r) => r.verdict === "pass").length ?? 0;
    first.push(line({ verb: "carry", text: `${carried} criteria passed before; not run again` }));
  }
  update(id, (x) => ({
    ...x,
    status: "verifying",
    verifyStartedAt: nowIso(),
    checks: first,
    submission: fixing && x.submission ? { ...x.submission, note: submission.note || x.submission.note, submittedAt: nowIso() } : { ...submission, url, submittedAt: nowIso() },
  }));
  startRun(id);
}

/** Scripted verifier: first attempt uses each criterion's first result; a fix attempt re-checks only what failed. */
export async function finishVerification(id: string) {
  running.get(id)?.forEach(clearTimeout);
  running.delete(id);
  update(id, (m) => {
    if (m.status !== "verifying") return m;
    const attempt = m.reports.length + 1;
    const previous = m.reports.at(-1);
    const logged = new Map((m.checks ?? []).filter((l) => l.criterionId && l.result).map((l) => [l.criterionId!, l.result!]));
    const results: CriterionResult[] = m.criteria.map((c) => {
      const before = previous?.results.find((r) => r.criterionId === c.id);
      if (attempt > 1 && before?.verdict === "pass") return before;
      return { criterionId: c.id, ...(logged.get(c.id) ?? scripted(c, attempt)) };
    });
    const missing = m.criteria.filter((c) => !logged.has(c.id) && !(attempt > 1 && previous?.results.find((r) => r.criterionId === c.id)?.verdict === "pass"));
    const at = nowIso();
    const report = { attempt, results, verifiedAt: at, reportHash: previewHash(JSON.stringify(results) + at) };
    const releasable = releasableAmount(m.criteria, results, ledgerTotals(m.ledger).authorized || m.amount);
    const checks = [
      ...(m.checks ?? []),
      ...missing.map((c) => resultLine(c, scripted(c, attempt))),
      line({ verb: "decide", text: `${results.filter((r) => r.verdict === "pass").length}/${results.length} passed · releasable ${money(releasable)}`, tone: "money" }),
      line({ verb: "sign", text: `report ${shortHash(report.reportHash)}`, tone: "money" }),
    ];
    const withReport = { ...m, checks, reports: [...m.reports, report] };
    if (attempt === 1) {
      return { ...withReport, status: "awaiting_decision", decisionDueAt: new Date(Date.now() + m.reviewWindowHours * HOUR).toISOString() };
    }
    // A fix attempt releases the newly verified share automatically, as agreed in the spec.
    return captureVerified(withReport, "Fix verified; remaining share released as agreed");
  });
}

function captureVerified(m: Milestone, note: string): Milestone {
  const report = m.reports.at(-1);
  if (!report) return m;
  const { authorized, captured } = ledgerTotals(m.ledger);
  const due = releasableAmount(m.criteria, report.results, authorized);
  const delta = Math.round((due - captured) * 100) / 100;
  const ledger = delta > 0 ? [...m.ledger, { id: fakePayPalId("CAP", m.id + nowIso()), kind: "capture" as const, amount: delta, at: nowIso(), note }] : m.ledger;
  const held = ledgerTotals(ledger).held;
  return {
    ...m,
    ledger,
    status: held > 0 ? "fix_window" : "released",
    fixDueAt: held > 0 ? m.fixDueAt ?? new Date(Date.now() + m.fixWindowHours * HOUR).toISOString() : m.fixDueAt,
  };
}

export async function acceptRelease(id: string) {
  update(id, (m) => captureVerified(m, "Client accepted the acceptance report"));
}

/** The client's agent reviews the report against its mandate and either releases or hands the decision back. */
export async function agentDecide(id: string) {
  const mandate = load().mandate;
  update(id, (m) => {
    const report = m.reports.at(-1);
    if (!report || m.status !== "awaiting_decision") return m;
    const review = agentReview(m.criteria, report.results, ledgerTotals(m.ledger).authorized || m.amount, mandate);
    const decision = { at: nowIso(), outcome: review.approved ? ("released" as const) : ("handed_to_client" as const), amount: review.releasable, checks: review.checks };
    if (!review.approved) return { ...m, approval: "client", agentDecision: decision };
    return { ...captureVerified(m, `${mandate.name} released verified work within its limit`), agentDecision: decision };
  });
}

/** Demo: the review window ends with no reply, so the verified share is released. */
export async function endReviewWindow(id: string) {
  update(id, (m) => captureVerified(m, "Review window ended without a reply; verified share released"));
}

export async function openAppeal(id: string, reason: string) {
  update(id, (m) => ({ ...m, status: "appealed", appealReason: reason, appealedAt: nowIso() }));
}

export async function withdrawAppeal(id: string) {
  update(id, (m) => ({ ...m, status: "awaiting_decision", appealReason: undefined, appealedAt: undefined }));
}

/** Demo: the fix window ends, so whatever is still held goes back to the client. */
export async function endFixWindow(id: string) {
  update(id, (m) => {
    const { held } = ledgerTotals(m.ledger);
    if (held <= 0) return m;
    return {
      ...m,
      status: "closed",
      ledger: [...m.ledger, { id: fakePayPalId("VOID", m.id + nowIso()), kind: "void", amount: held, at: nowIso(), note: "Fix window ended; the rest returned to the client" }],
    };
  });
}

export async function updateMandate(patch: Partial<AgentMandate>) {
  const s = load();
  save({ ...s, mandate: { ...s.mandate, ...patch } });
}

export async function resetDemo() {
  running.forEach((timers) => timers.forEach(clearTimeout));
  running.clear();
  save(fresh());
}
