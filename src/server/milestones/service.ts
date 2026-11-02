// The milestone service: every state change and money move goes through here.
//
// Money moves follow one pattern so a crash or a double click can never move money twice:
//   1. In a transaction, check the state and write the move as "pending" with its PayPal-Request-Id.
//   2. Call PayPal with that key. A retry re-sends the same key and PayPal returns the first result.
//   3. In a transaction, mark the move completed and change the milestone's state.

import { createHash, randomBytes } from "node:crypto";
import { and, asc, desc, eq, inArray, lte, sql } from "drizzle-orm";
import type { Db } from "../db/client";
import * as t from "../db/schema";
import { withResolutions, type ReviewResolution } from "@/lib/decision";
import { agentReview, canonicalJson, moneyTotals, releasableCents, sha256 } from "../domain/rules";
import { PayPalError, type PayPalClient } from "../paypal/client";
import { memorySigner, verifySignature, type Signer } from "../signing";

export type PaymentGateway = Pick<PayPalClient, "createAuthorizeOrder" | "authorizeOrder" | "captureAuthorization" | "voidAuthorization">;

type Status = t.MilestoneStatus;
type Actor = (typeof t.actor.enumValues)[number];
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

const HOUR = 3_600_000;
/** A pending move older than this was left by a crash or a lost reply, and is safe to re-send. */
const STALE_MOVE_MS = 60_000;

export class NotFoundError extends Error {
  constructor(readonly milestoneId: string) {
    super(`Milestone ${milestoneId} not found`);
  }
}

/** The action is not allowed in the milestone's current state (or someone else changed it first). */
export class InvalidStateError extends Error {
  constructor(
    readonly milestoneId: string,
    readonly action: string,
    readonly status: Status | undefined,
  ) {
    super(`Cannot ${action} while milestone ${milestoneId} is ${status ?? "missing"}`);
  }
}

/** Another request is moving this milestone's money right now. Try again in a minute. */
export class MoveInProgressError extends InvalidStateError {}

export class ValidationError extends Error {}

export type NewCriterion = { title: string; weight: number; mustPass: boolean; evidence: t.CriterionRow["evidence"]; check: t.CriterionRow["check"] };

export type NewMilestone = {
  workspaceId: string;
  title: string;
  brief?: string;
  clientName: string;
  clientEmail: string;
  freelancerName: string;
  freelancerEmail: string;
  freelancerLocation?: string;
  amountCents: number;
  reviewWindowHours: number;
  fixWindowHours?: number;
  boughtByAgent?: boolean;
  criteria: NewCriterion[];
};

export type SubmissionInput = { url?: string; prLink?: string; files?: string[]; note?: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(input: NewMilestone) {
  const problems: string[] = [];
  if (!input.title.trim()) problems.push("title is empty");
  if (!input.clientName.trim() || !input.freelancerName.trim()) problems.push("a name is empty");
  if (!EMAIL.test(input.clientEmail) || !EMAIL.test(input.freelancerEmail)) problems.push("an email is not valid");
  if (!Number.isInteger(input.amountCents) || input.amountCents < 100 || input.amountCents > 1_000_000) problems.push("amount must be between $1 and $10,000");
  if (!Number.isInteger(input.reviewWindowHours) || input.reviewWindowHours < 1 || input.reviewWindowHours > 14 * 24) problems.push("review window must be 1 hour to 14 days");
  if (input.criteria.length < 1 || input.criteria.length > 10) problems.push("add 1 to 10 criteria");
  if (input.criteria.some((c) => !c.title.trim() || !Number.isInteger(c.weight) || c.weight < 0 || c.weight > 100)) problems.push("each criterion needs a title and a weight from 0 to 100");
  if (input.criteria.reduce((s, c) => s + c.weight, 0) <= 0) problems.push("weights must add up to more than 0");
  if (problems.length) throw new ValidationError(problems.join("; "));
}

const newId = () => `m_${randomBytes(5).toString("hex")}`;
const hashKey = (key: string) => createHash("sha256").update(key).digest("hex");

/** Event type for the client's answer to a "needs a person" verdict. */
const RESOLVED = "review_resolved";

/** The client's latest answer per criterion on one report, read from the event log. */
function resolutionsFrom(events: Pick<t.EventRow, "type" | "detail">[], reportAttempt: number): ReviewResolution[] {
  const latest = new Map<string, ReviewResolution>();
  for (const e of events) {
    if (e.type !== RESOLVED || e.detail.reportAttempt !== reportAttempt) continue;
    const d = e.detail as { criterionId: string; verdict: "pass" | "fail"; note?: string; by?: string };
    latest.set(d.criterionId, { criterionId: d.criterionId, verdict: d.verdict, note: d.note ?? "", by: d.by ?? "The client" });
  }
  return [...latest.values()];
}

function errorJson(error: unknown): t.PayPalErrorJson {
  if (error instanceof PayPalError) return { status: error.status, name: error.name, issue: error.issue, debugId: error.debugId, message: error.message };
  return { message: error instanceof Error ? error.message : String(error) };
}

export function createMilestoneService(deps: { db: Db; paypal: PaymentGateway; now?: () => Date; signer?: Signer }) {
  const { db, paypal } = deps;
  const now = deps.now ?? (() => new Date());
  const signer = deps.signer ?? memorySigner();

  async function log(tx: Tx | Db, milestoneId: string, actor: Actor, type: string, detail: Record<string, unknown> = {}) {
    await tx.insert(t.events).values({ milestoneId, actor, type, detail, at: now() });
  }

  async function find(tx: Tx | Db, id: string, lock = false) {
    const q = tx.select().from(t.milestones).where(eq(t.milestones.id, id));
    const [row] = lock ? await q.for("update") : await q;
    if (!row) throw new NotFoundError(id);
    return row;
  }

  /** Changes state only if the milestone is still in one of `from`; otherwise someone got there first. */
  async function transition(tx: Tx | Db, id: string, action: string, from: Status[], patch: Partial<typeof t.milestones.$inferInsert>) {
    const [row] = await tx
      .update(t.milestones)
      .set({ ...patch, updatedAt: now(), version: sql`${t.milestones.version} + 1` })
      .where(and(eq(t.milestones.id, id), inArray(t.milestones.status, from)))
      .returning();
    if (!row) {
      const [current] = await tx.select({ status: t.milestones.status }).from(t.milestones).where(eq(t.milestones.id, id));
      if (!current) throw new NotFoundError(id);
      throw new InvalidStateError(id, action, current.status);
    }
    return row;
  }

  async function moves(tx: Tx | Db, id: string) {
    return tx.select().from(t.moneyMoves).where(eq(t.moneyMoves.milestoneId, id)).orderBy(asc(t.moneyMoves.id));
  }

  /**
   * The latest report as money decisions see it: the checker's verdicts, with the client's answers
   * to any "needs a person" results. `raw` gives the checker's verdicts alone.
   */
  async function latestReport(tx: Tx | Db, id: string, raw = false) {
    const [report] = await tx.select().from(t.reports).where(eq(t.reports.milestoneId, id)).orderBy(desc(t.reports.attempt)).limit(1);
    if (!report || raw) return report;
    const answers = await tx.select().from(t.events).where(and(eq(t.events.milestoneId, id), eq(t.events.type, RESOLVED))).orderBy(asc(t.events.id));
    return { ...report, results: withResolutions(report.results, resolutionsFrom(answers, report.attempt)) };
  }

  async function criteriaOf(tx: Tx | Db, id: string) {
    return tx.select().from(t.criteria).where(eq(t.criteria.milestoneId, id)).orderBy(asc(t.criteria.position));
  }

  async function markFailed(moveId: number, milestoneId: string, error: unknown) {
    await db.transaction(async (tx) => {
      await tx.update(t.moneyMoves).set({ status: "failed", error: errorJson(error), completedAt: now() }).where(and(eq(t.moneyMoves.id, moveId), eq(t.moneyMoves.status, "pending")));
      await log(tx, milestoneId, "paypal", "money_move_failed", { moveId, ...errorJson(error) });
    });
  }

  /**
   * Runs the PayPal call for a pending move. A clear PayPal "no" marks it failed. A lost
   * connection, a 5xx, 409 or 429 leaves it pending, because PayPal may still have done it.
   */
  async function send<T>(move: t.MoneyMoveRow, call: () => Promise<T>): Promise<T> {
    try {
      return await call();
    } catch (error) {
      const definite = error instanceof PayPalError && error.status >= 400 && error.status < 500 && error.status !== 409 && error.status !== 429;
      if (definite) await markFailed(move.id, move.milestoneId, error);
      throw error;
    }
  }

  /** A pending move is re-sent only once it is stale; a fresh one belongs to a request still in flight. */
  function resume(id: string, action: string, status: Status, pending: t.MoneyMoveRow, kind: t.MoneyMoveRow["kind"]) {
    if (pending.kind !== kind || now().getTime() - pending.createdAt.getTime() < STALE_MOVE_MS) throw new MoveInProgressError(id, action, status);
    return pending;
  }

  /**
   * Captures whatever the latest report makes due and is not yet captured. Partial captures keep
   * the authorization open for the fix window; the last capture closes it.
   */
  async function captureDue(id: string, action: string, from: Status[], actor: Actor, note: string) {
    const prepared = await db.transaction(async (tx) => {
      const m = await find(tx, id, true);
      if (!from.includes(m.status)) throw new InvalidStateError(id, action, m.status);
      if (!m.paypalAuthorizationId) throw new InvalidStateError(id, action, m.status);
      const all = await moves(tx, id);
      const pending = all.find((mv) => mv.status === "pending");
      if (pending) return { m, move: resume(id, action, m.status, pending, "capture") };

      const report = await latestReport(tx, id);
      if (!report) throw new InvalidStateError(id, action, m.status);
      const totals = moneyTotals(all);
      const due = releasableCents(await criteriaOf(tx, id), report.results, totals.authorized);
      const delta = Math.min(due - totals.captured, totals.available);
      if (delta <= 0) return { m, move: undefined };

      const n = all.filter((mv) => mv.kind === "capture").length + 1;
      const [move] = await tx
        .insert(t.moneyMoves)
        .values({ milestoneId: id, kind: "capture", amountCents: delta, requestId: `capture-${id}-${n}`, invoiceId: `${id}-${n}`, finalCapture: delta === totals.available, note, createdAt: now() })
        .returning();
      return { m, move };
    });

    const { m, move } = prepared;
    if (move) {
      const capture = await send(move, () =>
        paypal.captureAuthorization(m.paypalAuthorizationId!, {
          cents: move.amountCents,
          finalCapture: move.finalCapture ?? false,
          invoiceId: move.invoiceId ?? undefined,
          noteToPayer: move.note,
          requestId: move.requestId,
        }),
      );
      return db.transaction(async (tx) => {
        const [done] = await tx
          .update(t.moneyMoves)
          .set({ status: "completed", paypalId: capture.id, completedAt: now() })
          .where(and(eq(t.moneyMoves.id, move.id), eq(t.moneyMoves.status, "pending")))
          .returning();
        // Another request finished this same move first; its result already stands.
        if (!done) return find(tx, id);
        await log(tx, id, actor, "released", { amountCents: move.amountCents, captureId: capture.id, note });
        return settle(tx, id, action, from);
      });
    }
    return db.transaction((tx) => settle(tx, id, action, from));
  }

  /** After a capture: anything still held waits for a fix, otherwise the milestone is paid in full. */
  async function settle(tx: Tx, id: string, action: string, from: Status[]) {
    const m = await find(tx, id, true);
    const { held } = moneyTotals(await moves(tx, id));
    if (held > 0) return transition(tx, id, action, from, { status: "fix_window", fixDueAt: m.fixDueAt ?? new Date(now().getTime() + m.fixWindowHours * HOUR) });
    return transition(tx, id, action, from, { status: "released" });
  }

  async function views(rows: t.MilestoneRow[]) {
    const ids = rows.map((m) => m.id);
    if (!ids.length) return [];
    const [crit, subs, reps, mv, decisions, timeline] = await Promise.all([
      db.select().from(t.criteria).where(inArray(t.criteria.milestoneId, ids)).orderBy(asc(t.criteria.position)),
      db.select().from(t.submissions).where(inArray(t.submissions.milestoneId, ids)).orderBy(asc(t.submissions.attempt)),
      db.select().from(t.reports).where(inArray(t.reports.milestoneId, ids)).orderBy(asc(t.reports.attempt)),
      db.select().from(t.moneyMoves).where(inArray(t.moneyMoves.milestoneId, ids)).orderBy(asc(t.moneyMoves.id)),
      db.select().from(t.agentDecisions).where(inArray(t.agentDecisions.milestoneId, ids)).orderBy(asc(t.agentDecisions.id)),
      db.select().from(t.events).where(inArray(t.events.milestoneId, ids)).orderBy(asc(t.events.at), asc(t.events.id)),
    ]);
    const of = <T extends { milestoneId: string }>(list: T[], id: string) => list.filter((x) => x.milestoneId === id);
    return rows.map((m) => {
      const moneyMoves = of(mv, m.id);
      const events = of(timeline, m.id);
      // Screens and the next check see the client's answers on the latest report, like the money rules do.
      const reports = of(reps, m.id).map((r, i, all) => (i === all.length - 1 ? { ...r, results: withResolutions(r.results, resolutionsFrom(events, r.attempt)) } : r));
      return { ...m, criteria: of(crit, m.id), submissions: of(subs, m.id), reports, moneyMoves, agentDecisions: of(decisions, m.id), events, totals: moneyTotals(moneyMoves) };
    });
  }

  const service = {
    async createMilestone(input: NewMilestone): Promise<string> {
      validate(input);
      const id = newId();
      const spec = {
        title: input.title.trim(),
        brief: input.brief?.trim() ?? "",
        amountCents: input.amountCents,
        currency: "USD",
        reviewWindowHours: input.reviewWindowHours,
        fixWindowHours: input.fixWindowHours ?? 72,
        client: { name: input.clientName.trim(), email: input.clientEmail.trim().toLowerCase() },
        freelancer: { name: input.freelancerName.trim(), email: input.freelancerEmail.trim().toLowerCase() },
        criteria: input.criteria.map((c) => ({ title: c.title.trim(), weight: c.weight, mustPass: c.mustPass, evidence: c.evidence, check: c.check })),
      };
      await db.transaction(async (tx) => {
        await tx.insert(t.milestones).values({
          id,
          workspaceId: input.workspaceId,
          title: spec.title,
          brief: spec.brief,
          clientName: spec.client.name,
          clientEmail: spec.client.email,
          freelancerName: spec.freelancer.name,
          freelancerEmail: spec.freelancer.email,
          freelancerLocation: input.freelancerLocation ?? "",
          boughtByAgent: input.boughtByAgent ?? false,
          amountCents: spec.amountCents,
          reviewWindowHours: spec.reviewWindowHours,
          fixWindowHours: spec.fixWindowHours,
          specHash: sha256(spec),
          createdAt: now(),
        });
        await tx.insert(t.criteria).values(spec.criteria.map((c, i) => ({ ...c, id: `${id}-c${i + 1}`, milestoneId: id, position: i + 1 })));
        await log(tx, id, "freelancer", "created", { amountCents: spec.amountCents });
      });
      return id;
    },

    /** Creates the PayPal order the client approves. Nothing is held until completeFunding. */
    async startFunding(id: string, urls: { returnUrl?: string; cancelUrl?: string } = {}) {
      const m = await find(db, id);
      if (m.status !== "awaiting_funding") throw new InvalidStateError(id, "fund", m.status);
      const attempt = await db.$count(t.events, and(eq(t.events.milestoneId, id), eq(t.events.type, "funding_started")));
      const order = await paypal.createAuthorizeOrder({
        cents: m.amountCents,
        description: `PayPlan milestone: ${m.title}`,
        customId: id,
        invoiceId: `${id}-auth`,
        requestId: `order-${id}-${attempt + 1}`,
        ...urls,
      });
      await db.transaction(async (tx) => {
        await transition(tx, id, "fund", ["awaiting_funding"], { paypalOrderId: order.id });
        await log(tx, id, "client", "funding_started", { orderId: order.id });
      });
      return order;
    },

    /** After the client approves in PayPal: authorizes the order, so the money is held, not taken. */
    async completeFunding(id: string, input: { orderId: string; approval?: t.MilestoneRow["approval"] }) {
      const move = await db.transaction(async (tx) => {
        const m = await find(tx, id, true);
        if (m.status !== "awaiting_funding" || m.paypalOrderId !== input.orderId) throw new InvalidStateError(id, "complete funding", m.status);
        const requestId = `authorize-${input.orderId}`;
        await tx.insert(t.moneyMoves).values({ milestoneId: id, kind: "authorization", amountCents: m.amountCents, requestId, note: "Client approved the hold in PayPal", createdAt: now() }).onConflictDoNothing();
        const [row] = await tx.select().from(t.moneyMoves).where(eq(t.moneyMoves.requestId, requestId));
        return row;
      });
      const auth = await send(move, () => paypal.authorizeOrder(input.orderId, move.requestId));
      if (auth.cents !== move.amountCents) {
        await markFailed(move.id, id, new Error(`PayPal held ${auth.cents} cents, expected ${move.amountCents}`));
        throw new InvalidStateError(id, "complete funding", "awaiting_funding");
      }
      return db.transaction(async (tx) => {
        await tx.update(t.moneyMoves).set({ status: "completed", paypalId: auth.id, completedAt: now() }).where(eq(t.moneyMoves.id, move.id));
        const row = await transition(tx, id, "complete funding", ["awaiting_funding"], {
          status: "funded",
          approval: input.approval ?? "client",
          paypalAuthorizationId: auth.id,
          authorizationExpiresAt: auth.expirationTime ? new Date(auth.expirationTime) : null,
          fundedAt: now(),
        });
        await log(tx, id, "client", "funded", { authorizationId: auth.id, amountCents: auth.cents, approval: row.approval });
        return row;
      });
    },

    async setApproval(id: string, approval: t.MilestoneRow["approval"]) {
      return db.transaction(async (tx) => {
        const row = await transition(tx, id, "change who approves", ["awaiting_funding", "funded", "verifying", "awaiting_decision"], { approval });
        await log(tx, id, "client", "approval_changed", { approval });
        return row;
      });
    },

    /** The freelancer hands in work (first delivery, or a fix during the fix window). */
    async submitWork(id: string, input: SubmissionInput) {
      return db.transaction(async (tx) => {
        const attempt = (await tx.$count(t.submissions, eq(t.submissions.milestoneId, id))) + 1;
        const row = await transition(tx, id, "submit work", ["funded", "fix_window"], { status: "verifying", verifyStartedAt: now() });
        await tx.insert(t.submissions).values({ milestoneId: id, attempt, url: input.url ?? "", prLink: input.prLink ?? "", files: input.files ?? [], note: input.note ?? "", submittedAt: now() });
        await log(tx, id, "freelancer", attempt === 1 ? "submitted" : "fix_submitted", { attempt });
        return row;
      });
    },

    /**
     * Stores the AI checker's report. The first report waits for the client (or their agent).
     * A fix report releases the newly verified share straight away, as the spec says.
     */
    async recordReport(id: string, input: { results: t.CriterionResultJson[]; model: string }) {
      const report = await db.transaction(async (tx) => {
        const m = await find(tx, id, true);
        if (m.status !== "verifying") throw new InvalidStateError(id, "record a report", m.status);
        const crit = await criteriaOf(tx, id);
        const ids = new Set(crit.map((c) => c.id));
        if (input.results.length !== ids.size || input.results.some((r) => !ids.has(r.criterionId) || r.confidence < 0 || r.confidence > 1)) {
          throw new ValidationError("The report must have one result per criterion, with confidence from 0 to 1");
        }
        const attempt = (await tx.$count(t.reports, eq(t.reports.milestoneId, id))) + 1;
        const verifiedAt = now();
        // Exactly what is signed. Anyone can recompute its hash and check the signature.
        const payload = {
          v: 1,
          type: "payplan.acceptance-report",
          milestone: { id, number: m.number, title: m.title, specHash: m.specHash, amountCents: m.amountCents, currency: m.currency, client: m.clientName, freelancer: m.freelancerName },
          attempt,
          verifiedAt: verifiedAt.toISOString(),
          checker: input.model,
          criteria: crit.map((c) => ({ id: c.id, title: c.title, weight: c.weight, mustPass: c.mustPass })),
          results: input.results,
          releasableCents: releasableCents(crit, input.results, moneyTotals(await moves(tx, id)).authorized),
          paypal: { orderId: m.paypalOrderId, authorizationId: m.paypalAuthorizationId },
        };
        const message = canonicalJson(payload);
        const [report] = await tx
          .insert(t.reports)
          .values({ milestoneId: id, attempt, results: input.results, model: input.model, verifiedAt, reportHash: sha256(payload), payload, signature: signer.sign(message), signerKeyId: signer.keyId })
          .returning();
        await log(tx, id, "system", "verified", { attempt, passed: input.results.filter((r) => r.verdict === "pass").length, total: input.results.length });
        if (attempt === 1) {
          await transition(tx, id, "record a report", ["verifying"], { status: "awaiting_decision", decisionDueAt: new Date(verifiedAt.getTime() + m.reviewWindowHours * HOUR) });
        }
        return report;
      });
      if (report.attempt > 1) await captureDue(id, "release a verified fix", ["verifying"], "system", "Fix verified; the newly verified share is released as agreed");
      return report;
    },

    /**
     * The client answers "needs a person" verdicts on the latest report: passed, or not met, with a
     * note. The signed report keeps the checker's own verdicts; the answers are logged next to it.
     */
    async resolveReview(id: string, answers: { criterionId: string; verdict: "pass" | "fail"; note: string }[]) {
      return db.transaction(async (tx) => {
        const m = await find(tx, id, true);
        if (m.status !== "awaiting_decision") throw new InvalidStateError(id, "answer a check", m.status);
        const report = await latestReport(tx, id, true);
        if (!report) throw new InvalidStateError(id, "answer a check", m.status);
        for (const a of answers) {
          const result = report.results.find((r) => r.criterionId === a.criterionId);
          if (!result) throw new ValidationError("That criterion is not part of this milestone");
          if (result.verdict !== "review") throw new ValidationError("Only results that need a person can be answered; the checker already decided this one");
          await log(tx, id, "client", RESOLVED, { criterionId: a.criterionId, verdict: a.verdict, note: a.note.trim(), reportAttempt: report.attempt, by: m.clientName });
        }
        return find(tx, id);
      });
    },

    async acceptRelease(id: string) {
      return captureDue(id, "release", ["awaiting_decision"], "client", "Client accepted the acceptance report");
    },

    /** The client's agent decides inside its mandate, or hands the decision back to the client. */
    async agentDecide(id: string) {
      const { m, review, mandate, attempt } = await db.transaction(async (tx) => {
        const m = await find(tx, id, true);
        if (m.status !== "awaiting_decision" || m.approval !== "agent") throw new InvalidStateError(id, "let the agent decide", m.status);
        const report = await latestReport(tx, id);
        if (!report) throw new InvalidStateError(id, "let the agent decide", m.status);
        const [mandate] = await tx.select().from(t.agentMandates).where(eq(t.agentMandates.workspaceId, m.workspaceId));
        const authorized = moneyTotals(await moves(tx, id)).authorized;
        const review = mandate
          ? agentReview(await criteriaOf(tx, id), report.results, authorized, mandate)
          : { releasable: 0, approved: false, checks: [{ label: "Agent set up", detail: "This client has no agent mandate", ok: false }] };
        await tx.insert(t.agentDecisions).values({ milestoneId: id, reportAttempt: report.attempt, outcome: review.approved ? "released" : "handed_to_client", amountCents: review.releasable, checks: review.checks, decidedAt: now() });
        if (!review.approved) {
          await transition(tx, id, "let the agent decide", ["awaiting_decision"], { approval: "client" });
          await log(tx, id, "agent", "handed_to_client", { failed: review.checks.filter((c) => !c.ok).map((c) => c.label) });
        }
        return { m, review, mandate, attempt: report.attempt };
      });
      if (!review.approved) return { outcome: "handed_to_client" as const, review, milestone: await find(db, id) };
      const milestone = await captureDue(m.id, "release", ["awaiting_decision"], "agent", `${mandate!.name} released verified work within its limit (report ${attempt})`);
      return { outcome: "released" as const, review, milestone };
    },

    /** The review window ended with no reply: the verified share is released. */
    async autoRelease(id: string) {
      const m = await find(db, id);
      if (m.status !== "awaiting_decision" || !m.decisionDueAt || m.decisionDueAt > now()) throw new InvalidStateError(id, "auto-release", m.status);
      return captureDue(id, "auto-release", ["awaiting_decision"], "system", "Review window ended without a reply; verified share released");
    },

    /**
     * Demo only: ends the review or fix window now, so a judge can see what happens at the end
     * without waiting days. The timer rules that follow are the real ones.
     */
    async endWindowNow(id: string, which: "review" | "fix") {
      const row = await db.transaction(async (tx) => {
        const patch = which === "review" ? { decisionDueAt: now() } : { fixDueAt: now() };
        const row = await transition(tx, id, `end the ${which} window`, [which === "review" ? "awaiting_decision" : "fix_window"], patch);
        await log(tx, id, "system", "window_ended_early", { which, demo: true });
        return row;
      });
      return which === "review" ? service.autoRelease(row.id) : service.voidRemainder(row.id);
    },

    async openAppeal(id: string, reason: string) {
      if (reason.trim().length < 10) throw new ValidationError("Say in a sentence what is wrong with the report");
      return db.transaction(async (tx) => {
        const row = await transition(tx, id, "appeal", ["awaiting_decision"], { status: "appealed", appealReason: reason.trim(), appealedAt: now() });
        await log(tx, id, "client", "appealed", { reason: reason.trim() });
        return row;
      });
    },

    async withdrawAppeal(id: string) {
      return db.transaction(async (tx) => {
        const row = await transition(tx, id, "withdraw the appeal", ["appealed"], { status: "awaiting_decision", appealReason: null, appealedAt: null });
        await log(tx, id, "client", "appeal_withdrawn");
        return row;
      });
    },

    /** The fix window ended (or the freelancer gave up the rest): what is still held goes back to the client. */
    async voidRemainder(id: string, actor: Actor = "system") {
      const prepared = await db.transaction(async (tx) => {
        const m = await find(tx, id, true);
        if (m.status !== "fix_window" || !m.paypalAuthorizationId) throw new InvalidStateError(id, "return the rest", m.status);
        const all = await moves(tx, id);
        const pending = all.find((mv) => mv.status === "pending");
        if (pending) return { m, move: resume(id, "return the rest", m.status, pending, "void") };
        const { available } = moneyTotals(all);
        const [move] = await tx.insert(t.moneyMoves).values({ milestoneId: id, kind: "void", amountCents: available, requestId: `void-${id}`, note: "Fix window ended; the rest returned to the client", createdAt: now() }).returning();
        return { m, move };
      });
      const { m, move } = prepared;
      await send(move, () => paypal.voidAuthorization(m.paypalAuthorizationId!, move.requestId));
      return db.transaction(async (tx) => {
        const [done] = await tx.update(t.moneyMoves).set({ status: "completed", paypalId: m.paypalAuthorizationId, completedAt: now() }).where(and(eq(t.moneyMoves.id, move.id), eq(t.moneyMoves.status, "pending"))).returning();
        if (!done) return find(tx, id);
        await log(tx, id, actor, "voided", { amountCents: move.amountCents });
        return transition(tx, id, "return the rest", ["fix_window"], { status: "closed" });
      });
    },

    async cancel(id: string) {
      return db.transaction(async (tx) => {
        const row = await transition(tx, id, "cancel", ["awaiting_funding"], { status: "closed" });
        await log(tx, id, "freelancer", "cancelled");
        return row;
      });
    },

    async upsertMandate(input: Omit<typeof t.agentMandates.$inferInsert, "id" | "updatedAt">) {
      const [row] = await db
        .insert(t.agentMandates)
        .values({ ...input, updatedAt: now() })
        .onConflictDoUpdate({ target: t.agentMandates.workspaceId, set: { ...input, updatedAt: now() } })
        .returning();
      return row;
    },

    async getMandate(workspaceId: string) {
      const [row] = await db.select().from(t.agentMandates).where(eq(t.agentMandates.workspaceId, workspaceId));
      return row;
    },

    /** A new key for the client's own agent; any older key stops working. It is shown once and only its hash is kept. */
    async issueAgentKey(workspaceId: string) {
      const key = `ppk_${randomBytes(24).toString("base64url")}`;
      const [row] = await db.update(t.agentMandates).set({ agentKeyHash: hashKey(key), updatedAt: now() }).where(eq(t.agentMandates.workspaceId, workspaceId)).returning();
      if (!row) throw new ValidationError("Save the agent's limits first");
      return key;
    },

    /** The workspace an agent key belongs to, if the key is current. */
    async workspaceForAgentKey(key: string) {
      if (!/^ppk_[A-Za-z0-9_-]{32}$/.test(key)) return undefined;
      const [row] = await db.select({ workspaceId: t.agentMandates.workspaceId }).from(t.agentMandates).where(eq(t.agentMandates.agentKeyHash, hashKey(key)));
      return row?.workspaceId;
    },

    /**
     * Public check of a report by its hash: is the payload unchanged, and was it signed by this
     * deployment's key? Also lists what PayPal did for the milestone since.
     */
    async verifyReport(reportHash: string) {
      const [report] = await db.select().from(t.reports).where(eq(t.reports.reportHash, reportHash));
      if (!report) return undefined;
      const message = canonicalJson(report.payload);
      const hashMatches = sha256(report.payload) === report.reportHash;
      const knownKey = report.signerKeyId === signer.keyId;
      const signatureValid = knownKey && verifySignature(message, report.signature, signer.publicKeyPem);
      const paid = await db
        .select({ kind: t.moneyMoves.kind, amountCents: t.moneyMoves.amountCents, paypalId: t.moneyMoves.paypalId, at: t.moneyMoves.completedAt })
        .from(t.moneyMoves)
        .where(and(eq(t.moneyMoves.milestoneId, report.milestoneId), eq(t.moneyMoves.status, "completed")))
        .orderBy(asc(t.moneyMoves.id));
      return { reportHash: report.reportHash, payload: report.payload, signature: report.signature, signerKeyId: report.signerKeyId, publicKey: knownKey ? signer.publicKeyPem : null, hashMatches, knownKey, signatureValid, valid: hashMatches && signatureValid, paypalMoves: paid };
    },

    signingKey() {
      return { keyId: signer.keyId, publicKeyPem: signer.publicKeyPem, source: signer.source };
    },

    /** Everything a page needs about one milestone, in one call. */
    async getMilestone(id: string) {
      const [view] = await views([await find(db, id)]);
      return view;
    },

    /** Full views for a workspace's dashboard, loaded with one query per table. */
    async listMilestoneViews(workspaceId: string) {
      return views(await service.listMilestones(workspaceId));
    },

    async listMilestones(workspaceId: string) {
      return db.select().from(t.milestones).where(eq(t.milestones.workspaceId, workspaceId)).orderBy(desc(t.milestones.createdAt), desc(t.milestones.number));
    },

    /**
     * Applies a verified PayPal webhook about a capture we asked for. If our own request lost its
     * reply, this completes the move and settles the milestone without waiting for a retry.
     */
    async reconcileCapture(input: { invoiceId: string; captureId: string; status: "COMPLETED" | "DECLINED" | "DENIED" | "FAILED" }) {
      const [move] = await db.select().from(t.moneyMoves).where(and(eq(t.moneyMoves.invoiceId, input.invoiceId), eq(t.moneyMoves.kind, "capture")));
      if (!move) return { matched: false as const };
      if (input.status !== "COMPLETED") {
        await markFailed(move.id, move.milestoneId, new Error(`PayPal reported the capture as ${input.status}`));
        return { matched: true as const, milestoneId: move.milestoneId, changed: move.status === "pending" };
      }
      const changed = await db.transaction(async (tx) => {
        const [done] = await tx
          .update(t.moneyMoves)
          .set({ status: "completed", paypalId: input.captureId, completedAt: now() })
          .where(and(eq(t.moneyMoves.id, move.id), eq(t.moneyMoves.status, "pending")))
          .returning();
        if (!done) return false;
        await log(tx, move.milestoneId, "paypal", "released", { amountCents: move.amountCents, captureId: input.captureId, note: move.note, via: "webhook" });
        await settle(tx, move.milestoneId, "reconcile a capture", ["awaiting_decision", "verifying"]);
        return true;
      });
      return { matched: true as const, milestoneId: move.milestoneId, changed };
    },

    /** Adds a line to the milestone's timeline (the checker uses it for its live log). */
    async addEvent(id: string, actor: Actor, type: string, detail: Record<string, unknown>) {
      await log(db, id, actor, type, detail);
    },

    /** A fix was verified but its release did not finish (PayPal was down, say). Try the release again. */
    async retryFixRelease(id: string) {
      return captureDue(id, "release a verified fix", ["verifying"], "system", "Fix verified; the newly verified share is released as agreed");
    },

    /** Reports the client's agent has not acted on yet. The agent acts within minutes even if nobody watches. */
    async pendingAgentDecisions(olderThanMs: number) {
      const before = new Date(now().getTime() - olderThanMs);
      return db
        .select({ id: t.milestones.id })
        .from(t.milestones)
        .where(and(eq(t.milestones.status, "awaiting_decision"), eq(t.milestones.approval, "agent"), lte(t.milestones.updatedAt, before)));
    },

    /** Checks that started a while ago and never finished, for the timer job to pick up. */
    async stuckVerifications(olderThanMs: number) {
      const before = new Date(now().getTime() - olderThanMs);
      return db.select({ id: t.milestones.id }).from(t.milestones).where(and(eq(t.milestones.status, "verifying"), lte(t.milestones.verifyStartedAt, before)));
    },

    /** Records something PayPal told us about a milestone (a dispute, a refund, a hold that expired). */
    async notePayPalEvent(milestoneId: string, type: string, detail: Record<string, unknown>) {
      const [m] = await db.select({ id: t.milestones.id }).from(t.milestones).where(eq(t.milestones.id, milestoneId));
      if (!m) return false;
      await log(db, milestoneId, "paypal", type, detail);
      return true;
    },

    async findByPayPalId(input: { authorizationId?: string; captureId?: string }) {
      if (input.authorizationId) {
        const [m] = await db.select({ id: t.milestones.id }).from(t.milestones).where(eq(t.milestones.paypalAuthorizationId, input.authorizationId));
        if (m) return m.id;
      }
      if (input.captureId) {
        const [mv] = await db.select({ id: t.moneyMoves.milestoneId }).from(t.moneyMoves).where(eq(t.moneyMoves.paypalId, input.captureId));
        if (mv) return mv.id;
      }
      return undefined;
    },

    /**
     * The timer job (GitHub Actions cron calls it): releases verified work when a review window
     * ends, returns the rest when a fix window ends. One failure does not stop the others.
     */
    async runDueJobs() {
      const at = now();
      const [releases, voids] = await Promise.all([
        db.select({ id: t.milestones.id }).from(t.milestones).where(and(eq(t.milestones.status, "awaiting_decision"), lte(t.milestones.decisionDueAt, at))),
        db.select({ id: t.milestones.id }).from(t.milestones).where(and(eq(t.milestones.status, "fix_window"), lte(t.milestones.fixDueAt, at))),
      ]);
      const done: { id: string; job: "auto_release" | "void"; ok: boolean; error?: string }[] = [];
      for (const { id } of releases) {
        await service.autoRelease(id).then(
          () => done.push({ id, job: "auto_release", ok: true }),
          (e: unknown) => done.push({ id, job: "auto_release", ok: false, error: errorJson(e).message }),
        );
      }
      for (const { id } of voids) {
        await service.voidRemainder(id).then(
          () => done.push({ id, job: "void", ok: true }),
          (e: unknown) => done.push({ id, job: "void", ok: false, error: errorJson(e).message }),
        );
      }
      return done;
    },
  };
  return service;
}

export type MilestoneService = ReturnType<typeof createMilestoneService>;
export type MilestoneView = Awaited<ReturnType<MilestoneService["getMilestone"]>>;
