"use client";

import { useSyncExternalStore } from "react";
import { agentReview, ledgerTotals, releasableAmount } from "./decision";
import { fakePayPalId, previewHash } from "./format";
import { defaultMandate, makeSeed } from "./seed";
import type { AgentMandate, ApprovalMode, Criterion, CriterionResult, Milestone, Submission } from "./types";

// Prototype-only store: dummy data kept in the browser (localStorage). Replaced by the real API in Phase 1.

type State = { milestones: Milestone[]; mandate: AgentMandate };

const KEY = "payplan-prototype-v2";
const HOUR = 3_600_000;
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

export function useMilestone(id: string): Milestone | undefined {
  return useMilestones().find((m) => m.id === id);
}

export function useMandate(): AgentMandate {
  return useSyncExternalStore(
    subscribe,
    () => load().mandate,
    () => serverState.mandate,
  );
}

function update(id: string, change: (m: Milestone) => Milestone) {
  const s = load();
  save({ ...s, milestones: s.milestones.map((m) => (m.id === id ? change(m) : m)) });
}

const nowIso = () => new Date().toISOString();

export type NewMilestoneInput = {
  title: string;
  clientName: string;
  clientEmail: string;
  amount: number;
  reviewWindowHours: number;
  criteria: Omit<Criterion, "id">[];
};

export function createMilestone(input: NewMilestoneInput, walkthrough = false): string {
  const s = load();
  const next = Math.max(1050, ...s.milestones.map((m) => Number(m.id.replace("m-", "")) || 0)) + 1;
  const id = `m-${next}`;
  const criteria = input.criteria.map((c, i) => ({ ...c, id: `${id}-c${i + 1}` }));
  const milestone: Milestone = {
    id,
    title: input.title,
    clientName: input.clientName,
    clientEmail: input.clientEmail,
    freelancerName: "Riya Sharma",
    freelancerLocation: "Pune, India",
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

export function fundMilestone(id: string, approval: ApprovalMode) {
  update(id, (m) => ({
    ...m,
    status: "funded",
    approval,
    fundedAt: nowIso(),
    ledger: [
      ...m.ledger,
      { id: fakePayPalId("AUTH", id + nowIso()), kind: "authorization", amount: m.amount, at: nowIso(), note: "Client approved the hold in PayPal" },
    ],
  }));
}

/** Switching back to the agent before a release lets it review the report again. */
export function setApproval(id: string, approval: ApprovalMode) {
  update(id, (m) => ({ ...m, approval, agentDecision: approval === "agent" && m.status === "awaiting_decision" ? undefined : m.agentDecision }));
}

export function submitWork(id: string, submission: Omit<Submission, "submittedAt">) {
  update(id, (m) => ({ ...m, status: "verifying", submission: { ...submission, submittedAt: nowIso() } }));
}

/** Scripted verifier: first attempt uses each criterion's first result; a fix attempt re-checks only what failed. */
export function finishVerification(id: string) {
  update(id, (m) => {
    const attempt = m.reports.length + 1;
    const previous = m.reports.at(-1);
    const results: CriterionResult[] = m.criteria.map((c) => {
      const before = previous?.results.find((r) => r.criterionId === c.id);
      if (attempt > 1 && before?.verdict === "pass") return before;
      const scripted = attempt === 1 ? c.demo.first : c.demo.afterFix;
      return { criterionId: c.id, ...scripted };
    });
    const at = nowIso();
    const report = { attempt, results, verifiedAt: at, reportHash: previewHash(JSON.stringify(results) + at) };
    const withReport = { ...m, reports: [...m.reports, report] };
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

export function acceptRelease(id: string) {
  update(id, (m) => captureVerified(m, "Client accepted the acceptance report"));
}

/** The client's agent reviews the report against its mandate and either releases or hands the decision back. */
export function agentDecide(id: string) {
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

export function autoRelease(id: string) {
  update(id, (m) => captureVerified(m, "Review window ended without a reply; verified share released"));
}

export function openAppeal(id: string, reason: string) {
  update(id, (m) => ({ ...m, status: "appealed", appealReason: reason, appealedAt: nowIso() }));
}

export function withdrawAppeal(id: string) {
  update(id, (m) => ({ ...m, status: "awaiting_decision", appealReason: undefined, appealedAt: undefined }));
}

export function startFix(id: string) {
  update(id, (m) => ({ ...m, status: "verifying" }));
}

export function voidRemainder(id: string) {
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

export function updateMandate(patch: Partial<AgentMandate>) {
  const s = load();
  save({ ...s, mandate: { ...s.mandate, ...patch } });
}

export function resetDemo() {
  save(fresh());
}
