"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import type { MilestoneView } from "@/server/milestones/service";
import { defaultMandate } from "./seed";
import type { AgentMandate, ApprovalMode, CheckLine, CriteriaDraft, Milestone, MilestoneStatus, NewMilestoneInput, PayPalMode, Submission } from "./types";

export type { NewMilestoneInput };

/** Which store this build uses: "local" is the dummy-data prototype, "remote" is the app with its API. */
export const storeKind: "local" | "remote" = "remote";

// The app's store: the same hooks and actions as the prototype store, backed by the API.
// Money, checks and decisions all happen on the server; this only fetches and caches.

/** What JSON makes of a server type: dates become strings. */
type Wire<T> = T extends Date ? string : T extends (infer U)[] ? Wire<U>[] : T extends object ? { [K in keyof T]: Wire<T[K]> } : T;
type View = Wire<Omit<MilestoneView, "workspaceId">>;
type ServerMandate = { ownerName: string; name: string; perMilestoneLimitCents: number; minConfidence: number; releaseVerified: boolean; fundMilestones: boolean };

type State = {
  byId: Record<string, Milestone>;
  order: string[] | null;
  missing: Record<string, true>;
  mandate: AgentMandate | null;
  paypal: PayPalMode | null;
  demoControls: boolean;
};

const initial: State = { byId: {}, order: null, missing: {}, mandate: null, paypal: null, demoControls: false };
let state: State = initial;
const listeners = new Set<() => void>();

function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function useStore(): State {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => initial,
  );
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
  ) {
    super(message);
  }
}

async function api<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(path, {
    method: init?.method ?? "GET",
    headers: init?.body === undefined ? undefined : { "Content-Type": "application/json" },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
  });
  const body = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
  if (!res.ok) throw new ApiError(res.status, body.message ?? "Something went wrong. Please try again.", body.error);
  return body as T;
}

// ---- Walkthrough flags stay in this browser.

const WALK_KEY = "payplan-walkthrough";

function walkthroughIds(): Set<string> {
  try {
    return new Set(JSON.parse(window.localStorage.getItem(WALK_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

function markWalkthrough(id: string) {
  try {
    window.localStorage.setItem(WALK_KEY, JSON.stringify([...walkthroughIds(), id]));
  } catch {
    // Without storage the walkthrough card simply does not show.
  }
}

// ---- Server view -> the Milestone shape the screens use.

const dollars = (cents: number) => cents / 100;
const opt = <T,>(v: T | null | undefined) => (v === null ? undefined : v);

function toMilestone(v: View, walk = walkthroughIds()): Milestone {
  const attempt = v.submissions.length;
  const latestReport = v.reports.at(-1);
  const decision = [...v.agentDecisions].reverse().find((d) => d.reportAttempt === latestReport?.attempt);
  const sub = v.submissions.at(-1);
  const checks: CheckLine[] = v.events
    .filter((e) => e.type === "check" && e.detail.attempt === attempt)
    .map((e) => ({ ...(e.detail as Omit<CheckLine, "at">), at: e.at }));
  return {
    id: v.id,
    displayId: `M-${v.number}`,
    title: v.title,
    brief: v.brief,
    clientName: v.clientName,
    clientEmail: v.clientEmail,
    freelancerName: v.freelancerName,
    freelancerLocation: v.freelancerLocation,
    boughtByAgent: v.boughtByAgent,
    amount: dollars(v.amountCents),
    currency: "USD",
    reviewWindowHours: v.reviewWindowHours,
    fixWindowHours: v.fixWindowHours,
    criteria: v.criteria.map((c) => ({ id: c.id, title: c.title, weight: c.weight, mustPass: c.mustPass, evidence: c.evidence, check: c.check })),
    specHash: v.specHash,
    status: v.status as MilestoneStatus,
    createdAt: v.createdAt,
    fundedAt: opt(v.fundedAt),
    decisionDueAt: opt(v.decisionDueAt),
    fixDueAt: opt(v.fixDueAt),
    verifyStartedAt: opt(v.verifyStartedAt),
    submission: sub ? { url: sub.url, prLink: sub.prLink, files: sub.files, note: sub.note, submittedAt: sub.submittedAt } : undefined,
    reports: v.reports.map((r) => ({ attempt: r.attempt, results: r.results, verifiedAt: r.verifiedAt, reportHash: r.reportHash })),
    ledger: v.moneyMoves
      .filter((mv) => mv.status === "completed" && mv.kind !== "reauthorization")
      .map((mv) => ({ id: mv.paypalId ?? mv.requestId, kind: mv.kind as "authorization" | "capture" | "void", amount: dollars(mv.amountCents), at: mv.completedAt ?? mv.createdAt, note: mv.note })),
    appealReason: opt(v.appealReason),
    appealedAt: opt(v.appealedAt),
    approval: v.approval,
    agentDecision: decision ? { at: decision.decidedAt, outcome: decision.outcome, amount: dollars(decision.amountCents), checks: decision.checks } : undefined,
    walkthrough: walk.has(v.id),
    checks,
  };
}

function toMandate(m: ServerMandate): AgentMandate {
  return { name: m.name, owner: m.ownerName, perMilestoneLimit: dollars(m.perMilestoneLimitCents), minConfidence: m.minConfidence, releaseVerified: m.releaseVerified, fundMilestones: m.fundMilestones };
}

function fromMandate(m: AgentMandate): ServerMandate {
  return { name: m.name, ownerName: m.owner, perMilestoneLimitCents: Math.round(m.perMilestoneLimit * 100), minConfidence: m.minConfidence, releaseVerified: m.releaseVerified, fundMilestones: m.fundMilestones };
}

function put(view: View) {
  const m = toMilestone(view);
  const order = state.order && !state.order.includes(m.id) ? [m.id, ...state.order] : state.order;
  const missing = { ...state.missing };
  delete missing[m.id];
  set({ byId: { ...state.byId, [m.id]: m }, order, missing });
}

// ---- Loading, de-duplicated so many components can ask at once.

const inflight = new Map<string, Promise<unknown>>();

function once<T>(key: string, run: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const p = run().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

function refreshList() {
  return once("list", async () => {
    const body = await api<{ milestones: View[]; paypal: PayPalMode; demoControls: boolean }>("/api/milestones");
    const walk = walkthroughIds();
    const byId = { ...state.byId };
    for (const v of body.milestones) byId[v.id] = toMilestone(v, walk);
    set({ byId, order: body.milestones.map((v) => v.id), paypal: body.paypal, demoControls: body.demoControls });
  });
}

function refreshOne(id: string) {
  return once(`m:${id}`, async () => {
    try {
      put((await api<{ milestone: View }>(`/api/milestones/${encodeURIComponent(id)}`)).milestone);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) set({ missing: { ...state.missing, [id]: true } });
      else throw error;
    }
  });
}

function refreshMandate() {
  return once("mandate", async () => {
    const body = await api<{ mandate: ServerMandate | null }>("/api/mandate");
    // A new workspace starts with the prototype's agent so the agent screens have something to show.
    const saved = body.mandate ?? (await api<{ mandate: ServerMandate }>("/api/mandate", { method: "PUT", body: fromMandate(defaultMandate) })).mandate;
    set({ mandate: toMandate(saved) });
  });
}

const quiet = (p: Promise<unknown>) => void p.catch(() => undefined);

/** Polls while something is still happening on the server (the checker is running). */
function usePolling(active: boolean, run: () => Promise<unknown>, ms: number) {
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => quiet(run()), ms);
    return () => clearInterval(timer);
  }, [active, run, ms]);
}

// ---- Hooks

export function useMilestones(): Milestone[] {
  const s = useStore();
  useEffect(() => {
    if (state.order === null) quiet(refreshList());
  }, []);
  const list = useMemo(() => (s.order ?? []).map((id) => s.byId[id]).filter(Boolean), [s.order, s.byId]);
  usePolling(list.some((m) => m.status === "verifying"), refreshList, 2500);
  return list;
}

export function useMilestonesLoaded(): boolean {
  return useStore().order !== null;
}

export function useMilestone(id: string): Milestone | undefined {
  const s = useStore();
  const m = s.byId[id];
  useEffect(() => {
    if (!state.byId[id] && !state.missing[id]) quiet(refreshOne(id));
  }, [id]);
  const refresh = useMemo(() => () => refreshOne(id), [id]);
  usePolling(m?.status === "verifying", refresh, 1200);
  return m;
}

export function useMilestoneLoad(id: string): "loading" | "ready" | "missing" {
  const s = useStore();
  return s.byId[id] ? "ready" : s.missing[id] ? "missing" : "loading";
}

export function useMandate(): AgentMandate {
  const s = useStore();
  useEffect(() => {
    if (!state.mandate) quiet(refreshMandate());
  }, []);
  return s.mandate ?? defaultMandate;
}

export function usePayPalMode(): PayPalMode | null {
  const s = useStore();
  useEffect(() => {
    if (!state.paypal) quiet(refreshList());
  }, []);
  return s.paypal;
}

export function useDemoControls(): boolean {
  return useStore().demoControls;
}

// ---- Actions. Each one returns once the server has answered; errors carry a message for a toast.

type ActionResult = { milestone: View; order?: { id: string; approveUrl?: string } };

async function act(id: string, body: Record<string, unknown>): Promise<ActionResult> {
  try {
    const res = await api<ActionResult>(`/api/milestones/${encodeURIComponent(id)}/actions`, { method: "POST", body });
    put(res.milestone);
    return res;
  } catch (error) {
    // Someone else changed it first: show the latest state, then report.
    if (error instanceof ApiError && error.status === 409) quiet(refreshOne(id));
    throw error;
  }
}

/** The server drafts criteria from the brief: with AI when it has a key, otherwise from a labelled template. */
export async function draftCriteria(brief: string): Promise<CriteriaDraft> {
  return api<CriteriaDraft>("/api/criteria/draft", { method: "POST", body: { brief } });
}

export async function createMilestone(input: NewMilestoneInput, walkthrough = false): Promise<string> {
  const body = {
    title: input.title,
    brief: input.brief,
    clientName: input.clientName,
    clientEmail: input.clientEmail,
    freelancerName: input.freelancerName ?? "Riya Sharma",
    freelancerEmail: input.freelancerEmail ?? "riya@payplan.example",
    freelancerLocation: input.freelancerLocation ?? "Pune, India",
    amountCents: Math.round(input.amount * 100),
    reviewWindowHours: input.reviewWindowHours,
    criteria: input.criteria.map((c) => ({ title: c.title, weight: c.weight, mustPass: c.mustPass, evidence: c.evidence, check: c.check })),
  };
  const { milestone } = await api<{ milestone: View }>("/api/milestones", { method: "POST", body });
  if (walkthrough) markWalkthrough(milestone.id);
  put(milestone);
  return milestone.id;
}

/** Without sandbox keys the server simulates PayPal; this plays the client's approval. */
export async function fundWithSimulatedPayPal(id: string, approval: ApprovalMode) {
  const { order } = await act(id, { action: "start_funding" });
  await act(id, { action: "simulate_approval", orderId: order!.id });
  await act(id, { action: "complete_funding", orderId: order!.id, approval });
}

/** Creates the PayPal order that the PayPal button opens. */
export async function startFunding(id: string): Promise<{ orderId: string }> {
  const { order } = await act(id, { action: "start_funding", returnUrl: window.location.href, cancelUrl: window.location.href });
  return { orderId: order!.id };
}

/** After the client approves on PayPal: the server authorizes the order, so the money is held. */
export async function completeFunding(id: string, orderId: string, approval: ApprovalMode) {
  await act(id, { action: "complete_funding", orderId, approval });
}

export async function setApproval(id: string, approval: ApprovalMode) {
  await act(id, { action: "set_approval", approval });
}

export async function submitWork(id: string, submission: Omit<Submission, "submittedAt">) {
  const previous = state.byId[id]?.submission;
  await act(id, {
    action: "submit",
    url: submission.url || previous?.url || "",
    prLink: submission.prLink || previous?.prLink || "",
    files: submission.files.length ? submission.files : previous?.files ?? [],
    note: submission.note,
  });
}

/** The real checker runs on the server; the page polls until it finishes. */
export async function finishVerification(id: string) {
  await refreshOne(id);
}

export function resumeBackgroundWork(milestones: Milestone[]) {
  void milestones;
}

/** The client answers checks the AI handed to a person: passed, or not met. */
export async function resolveReview(id: string, answers: { criterionId: string; verdict: "pass" | "fail"; note: string }[]) {
  await act(id, { action: "resolve_review", answers });
}

export async function acceptRelease(id: string) {
  await act(id, { action: "accept" });
}

/** Runs the client's agent now. If it already acted (the timer job got there first), just show the result. */
export async function agentDecide(id: string) {
  try {
    await act(id, { action: "agent_decide" });
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 409)) throw error;
    await refreshOne(id);
  }
}

export async function endReviewWindow(id: string) {
  await act(id, { action: "demo_end_window", which: "review" });
}

export async function openAppeal(id: string, reason: string) {
  await act(id, { action: "appeal", reason });
}

export async function withdrawAppeal(id: string) {
  await act(id, { action: "withdraw_appeal" });
}

export async function endFixWindow(id: string) {
  await act(id, { action: "demo_end_window", which: "fix" });
}

let mandateTimer: ReturnType<typeof setTimeout> | undefined;
let mandateWaiters: { resolve: () => void; reject: (e: unknown) => void }[] = [];

/** Shows the change at once and saves it shortly after, so dragging a slider sends one request. */
export async function updateMandate(patch: Partial<AgentMandate>) {
  const next = { ...(state.mandate ?? defaultMandate), ...patch };
  set({ mandate: next });
  clearTimeout(mandateTimer);
  return new Promise<void>((resolve, reject) => {
    mandateWaiters.push({ resolve, reject });
    mandateTimer = setTimeout(() => {
      const waiters = mandateWaiters;
      mandateWaiters = [];
      api<{ mandate: ServerMandate }>("/api/mandate", { method: "PUT", body: fromMandate(state.mandate ?? next) }).then(
        ({ mandate }) => {
          set({ mandate: toMandate(mandate) });
          waiters.forEach((w) => w.resolve());
        },
        (error: unknown) => waiters.forEach((w) => w.reject(error)),
      );
    }, 400);
  });
}

/** Starts a fresh, empty workspace in this browser. */
export async function resetDemo() {
  await api("/api/workspace/reset", { method: "POST" });
  try {
    window.localStorage.removeItem(WALK_KEY);
  } catch {
    // Nothing to clear.
  }
  set({ ...initial, paypal: state.paypal, demoControls: state.demoControls, order: [] });
  quiet(refreshList());
}
