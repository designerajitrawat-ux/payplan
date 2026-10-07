import { beforeAll, describe, expect, it } from "vitest";
import { createPgliteDb, type Db } from "../db/client";
import type { CriterionResultJson } from "../db/schema";
import { PayPalError } from "../paypal/client";
import { createSimulatedPayPal } from "../paypal/simulated";
import { createMilestoneService, InvalidStateError, MoveInProgressError, ValidationError, type NewMilestone } from "./service";

let db: Db;
beforeAll(async () => {
  db = await createPgliteDb();
}, 30_000);

const HOUR = 3_600_000;

function setup() {
  const clock = { t: Date.parse("2026-10-20T10:00:00Z") };
  const pp = createSimulatedPayPal();
  const svc = createMilestoneService({ db, paypal: pp.gateway, now: () => new Date(clock.t) });
  return { svc, pp, clock };
}

let n = 0;
/** $800 landing page: one must-pass criterion and three weighted ones (100 in total). */
function landingPage(overrides: Partial<NewMilestone> = {}): NewMilestone {
  n++;
  return {
    workspaceId: `ws-${n}`,
    title: "Landing page for Northwind",
    clientName: "Sam Carter",
    clientEmail: `sam${n}@northwind.test`,
    freelancerName: "Riya Sharma",
    freelancerEmail: "riya@example.in",
    freelancerLocation: "Pune, India",
    amountCents: 80000,
    reviewWindowHours: 48,
    criteria: [
      { title: "Site is live at the agreed URL", weight: 25, mustPass: true, evidence: "url", check: "automatic" },
      { title: "Lighthouse performance 90 or more", weight: 25, mustPass: false, evidence: "url", check: "automatic" },
      { title: "Matches the style guide", weight: 25, mustPass: false, evidence: "image", check: "ai" },
      { title: "Contact form sends email", weight: 25, mustPass: false, evidence: "url", check: "ai" },
    ],
    ...overrides,
  };
}

const result = (criterionId: string, verdict: CriterionResultJson["verdict"], confidence = 0.95): CriterionResultJson => ({ criterionId, verdict, confidence, evidence: "checked", reason: "because" });

/** Creates, funds (client approves on PayPal) and submits a milestone. */
async function fundedAndSubmitted(ctx: ReturnType<typeof setup>, input = landingPage(), approval: "client" | "agent" = "client") {
  const id = await ctx.svc.createMilestone(input);
  const order = await ctx.svc.startFunding(id, { returnUrl: "https://payplan.test/back" });
  ctx.pp.approve(order.id);
  await ctx.svc.completeFunding(id, { orderId: order.id, approval });
  await ctx.svc.submitWork(id, { url: "https://northwind.example", note: "Ready" });
  return id;
}

const c = (id: string, i: number) => `${id}-c${i}`;

describe("creating a milestone", () => {
  it("stores the spec with a stable SHA-256 agreement id", async () => {
    const { svc } = setup();
    const input = landingPage();
    const a = await svc.getMilestone(await svc.createMilestone(input));
    const b = await svc.getMilestone(await svc.createMilestone(input));
    const changed = await svc.getMilestone(await svc.createMilestone({ ...input, criteria: input.criteria.map((x, i) => (i === 0 ? { ...x, weight: 30 } : x)) }));
    expect(a.specHash).toMatch(/^[0-9a-f]{64}$/);
    expect(a.specHash).toBe(b.specHash);
    expect(changed.specHash).not.toBe(a.specHash);
    expect(a.status).toBe("awaiting_funding");
    expect(a.criteria.map((x) => x.position)).toEqual([1, 2, 3, 4]);
    expect(a.events.map((e) => e.type)).toEqual(["created"]);
  });

  it("rejects bad input with every problem listed", async () => {
    const { svc } = setup();
    await expect(svc.createMilestone(landingPage({ amountCents: 50, clientEmail: "nope", criteria: [] }))).rejects.toThrow(ValidationError);
    await expect(svc.createMilestone(landingPage({ amountCents: 800.5 }))).rejects.toThrow(/amount/);
  });
});

describe("funding", () => {
  it("holds the money on PayPal only after the client approves", async () => {
    const { svc, pp } = setup();
    const id = await svc.createMilestone(landingPage());
    const order = await svc.startFunding(id);
    expect(order.approveUrl).toContain(order.id);
    await expect(svc.completeFunding(id, { orderId: order.id })).rejects.toThrow(PayPalError);
    expect((await svc.getMilestone(id)).moneyMoves[0]).toMatchObject({ kind: "authorization", status: "failed", error: { issue: "ORDER_NOT_APPROVED" } });

    // A second try after approval uses a fresh order.
    const retry = await svc.startFunding(id);
    pp.approve(retry.id);
    const funded = await svc.completeFunding(id, { orderId: retry.id, approval: "agent" });
    expect(funded).toMatchObject({ status: "funded", approval: "agent" });
    const view = await svc.getMilestone(id);
    expect(view.totals).toMatchObject({ authorized: 80000, held: 80000, captured: 0 });
    expect(view.paypalAuthorizationId).toMatch(/^AUTH-/);
  });

  it("refuses an order that belongs to another milestone", async () => {
    const { svc, pp } = setup();
    const a = await svc.createMilestone(landingPage());
    const b = await svc.createMilestone(landingPage());
    await svc.startFunding(a);
    const orderB = await svc.startFunding(b);
    pp.approve(orderB.id);
    await expect(svc.completeFunding(a, { orderId: orderB.id })).rejects.toThrow(InvalidStateError);
  });
});

describe("release by the client", () => {
  it("captures the verified share, keeps the rest held for the fix, then releases the fix", async () => {
    const ctx = setup();
    const { svc, pp, clock } = ctx;
    const id = await fundedAndSubmitted(ctx);

    await svc.recordReport(id, { model: "test", results: [result(c(id, 1), "pass"), result(c(id, 2), "pass"), result(c(id, 3), "fail"), result(c(id, 4), "pass")] });
    let view = await svc.getMilestone(id);
    expect(view.status).toBe("awaiting_decision");
    expect(view.decisionDueAt?.getTime()).toBe(clock.t + 48 * HOUR);
    expect(view.reports[0].reportHash).toMatch(/^[0-9a-f]{64}$/);

    await svc.acceptRelease(id);
    view = await svc.getMilestone(id);
    expect(view.status).toBe("fix_window");
    expect(view.fixDueAt?.getTime()).toBe(clock.t + 72 * HOUR);
    expect(view.totals).toMatchObject({ captured: 60000, held: 20000 });
    expect(view.moneyMoves.at(-1)).toMatchObject({ kind: "capture", status: "completed", finalCapture: false, invoiceId: `${id}-1` });

    // The fix: only the failed criterion changes, and the rest is released automatically.
    await svc.submitWork(id, { url: "https://northwind.example", note: "Fixed the style guide colours" });
    await svc.recordReport(id, { model: "test", results: [result(c(id, 1), "pass"), result(c(id, 2), "pass"), result(c(id, 3), "pass"), result(c(id, 4), "pass")] });
    view = await svc.getMilestone(id);
    expect(view.status).toBe("released");
    expect(view.totals).toMatchObject({ captured: 80000, held: 0 });
    expect(view.moneyMoves.at(-1)).toMatchObject({ amountCents: 20000, finalCapture: true });
    expect(pp.holds.get(view.paypalAuthorizationId!)).toMatchObject({ captured: 80000, closed: true });
    expect(view.events.map((e) => e.type)).toEqual(["created", "funding_started", "funded", "submitted", "verified", "released", "fix_submitted", "verified", "released"]);
  });

  it("captures nothing when a must-pass criterion fails, and returns the hold when the fix window ends", async () => {
    const ctx = setup();
    const { svc, pp, clock } = ctx;
    const id = await fundedAndSubmitted(ctx);
    await svc.recordReport(id, { model: "test", results: [result(c(id, 1), "fail"), result(c(id, 2), "pass"), result(c(id, 3), "pass"), result(c(id, 4), "pass")] });
    await svc.acceptRelease(id);
    expect(pp.calls.filter((x) => x.method === "captureAuthorization")).toHaveLength(0);
    expect((await svc.getMilestone(id)).status).toBe("fix_window");

    clock.t += 73 * HOUR;
    const jobs = await svc.runDueJobs();
    expect(jobs).toContainEqual({ id, job: "void", ok: true });
    const view = await svc.getMilestone(id);
    expect(view.status).toBe("closed");
    expect(view.totals).toMatchObject({ captured: 0, voided: 80000, held: 0 });
  });

  it("moves money once when release is clicked twice at the same time", async () => {
    const ctx = setup();
    const { svc, pp } = ctx;
    const id = await fundedAndSubmitted(ctx);
    await svc.recordReport(id, { model: "test", results: [result(c(id, 1), "pass"), result(c(id, 2), "pass"), result(c(id, 3), "fail"), result(c(id, 4), "pass")] });
    const outcomes = await Promise.allSettled([svc.acceptRelease(id), svc.acceptRelease(id), svc.acceptRelease(id)]);
    expect(outcomes.some((o) => o.status === "fulfilled")).toBe(true);
    for (const o of outcomes) if (o.status === "rejected") expect(o.reason).toBeInstanceOf(InvalidStateError);
    const view = await svc.getMilestone(id);
    expect(view.moneyMoves.filter((m) => m.kind === "capture")).toHaveLength(1);
    expect(pp.calls.filter((x) => x.method === "captureAuthorization")).toHaveLength(1);
    expect(view.totals.captured).toBe(60000);
    expect(pp.holds.get(view.paypalAuthorizationId!)?.captured).toBe(60000);
  });

  it("marks a refused capture as failed and lets the client try again", async () => {
    const ctx = setup();
    const { svc, pp } = ctx;
    const id = await fundedAndSubmitted(ctx);
    await svc.recordReport(id, { model: "test", results: [1, 2, 3, 4].map((i) => result(c(id, i), "pass")) });
    pp.failNext("captureAuthorization", new PayPalError(422, "UNPROCESSABLE_ENTITY", "Payer cannot pay", "PAYER_CANNOT_PAY", "dbg-1"));
    await expect(svc.acceptRelease(id)).rejects.toThrow(PayPalError);
    let view = await svc.getMilestone(id);
    expect(view.status).toBe("awaiting_decision");
    expect(view.moneyMoves.at(-1)).toMatchObject({ status: "failed", error: { issue: "PAYER_CANNOT_PAY", debugId: "dbg-1" } });
    expect(view.events.at(-1)?.type).toBe("money_move_failed");

    await svc.acceptRelease(id);
    view = await svc.getMilestone(id);
    expect(view.status).toBe("released");
    expect(view.totals.captured).toBe(80000);
  });

  it("re-sends the same request after a lost reply, so PayPal does not capture twice", async () => {
    const ctx = setup();
    const { svc, pp } = ctx;
    const id = await fundedAndSubmitted(ctx);
    await svc.recordReport(id, { model: "test", results: [1, 2, 3, 4].map((i) => result(c(id, i), "pass")) });
    pp.failNext("captureAuthorization", new TypeError("fetch failed"), true);
    await expect(svc.acceptRelease(id)).rejects.toThrow("fetch failed");
    expect((await svc.getMilestone(id)).moneyMoves.at(-1)?.status).toBe("pending");

    // Straight away, the first request may still be in flight, so nothing is re-sent.
    await expect(svc.acceptRelease(id)).rejects.toThrow(MoveInProgressError);
    ctx.clock.t += 2 * 60_000;
    await svc.acceptRelease(id);
    const view = await svc.getMilestone(id);
    const captures = pp.calls.filter((x) => x.method === "captureAuthorization");
    expect(captures.map((x) => x.requestId)).toEqual([`capture-${id}-1`, `capture-${id}-1`]);
    expect(pp.holds.get(view.paypalAuthorizationId!)?.captured).toBe(80000);
    expect(view.status).toBe("released");
  });
});

describe("the client's agent", () => {
  it("releases inside its mandate", async () => {
    const ctx = setup();
    const input = landingPage();
    await ctx.svc.upsertMandate({ workspaceId: input.workspaceId, ownerName: "Sam Carter", name: "Northwind buying agent", perMilestoneLimitCents: 100000, minConfidence: 0.85, releaseVerified: true, fundMilestones: true });
    const id = await fundedAndSubmitted(ctx, input, "agent");
    await ctx.svc.recordReport(id, { model: "test", results: [result(c(id, 1), "pass"), result(c(id, 2), "pass"), result(c(id, 3), "fail"), result(c(id, 4), "pass", 0.9)] });
    const decision = await ctx.svc.agentDecide(id);
    expect(decision.outcome).toBe("released");
    expect(decision.milestone.status).toBe("fix_window");
    const view = await ctx.svc.getMilestone(id);
    expect(view.agentDecisions).toHaveLength(1);
    expect(view.agentDecisions[0]).toMatchObject({ outcome: "released", amountCents: 60000 });
    expect(view.events.find((e) => e.type === "released")?.actor).toBe("agent");
  });

  it("hands the decision back when a limit is not met, and cannot decide again", async () => {
    const ctx = setup();
    const input = landingPage();
    await ctx.svc.upsertMandate({ workspaceId: input.workspaceId, ownerName: "Sam", name: "Agent", perMilestoneLimitCents: 50000, minConfidence: 0.85, releaseVerified: true, fundMilestones: false });
    const id = await fundedAndSubmitted(ctx, input, "agent");
    await ctx.svc.recordReport(id, { model: "test", results: [1, 2, 3, 4].map((i) => result(c(id, i), "pass")) });
    const decision = await ctx.svc.agentDecide(id);
    expect(decision.outcome).toBe("handed_to_client");
    expect(decision.review.checks.find((x) => !x.ok)?.label).toBe("Within spending limit");
    expect(decision.milestone).toMatchObject({ status: "awaiting_decision", approval: "client" });
    expect(ctx.pp.calls.filter((x) => x.method === "captureAuthorization")).toHaveLength(0);
    await expect(ctx.svc.agentDecide(id)).rejects.toThrow(InvalidStateError);
  });

  it("hands back when the client has no mandate", async () => {
    const ctx = setup();
    const id = await fundedAndSubmitted(ctx, landingPage(), "agent");
    await ctx.svc.recordReport(id, { model: "test", results: [1, 2, 3, 4].map((i) => result(c(id, i), "pass")) });
    expect((await ctx.svc.agentDecide(id)).outcome).toBe("handed_to_client");
  });
});

describe("timers, appeals and guards", () => {
  it("releases the verified share when the review window ends with no reply", async () => {
    const ctx = setup();
    const id = await fundedAndSubmitted(ctx);
    await ctx.svc.recordReport(id, { model: "test", results: [1, 2, 3, 4].map((i) => result(c(id, i), "pass")) });
    await expect(ctx.svc.autoRelease(id)).rejects.toThrow(InvalidStateError);
    ctx.clock.t += 49 * HOUR;
    expect(await ctx.svc.runDueJobs()).toContainEqual({ id, job: "auto_release", ok: true });
    const view = await ctx.svc.getMilestone(id);
    expect(view.status).toBe("released");
    expect(view.events.at(-1)).toMatchObject({ type: "released", actor: "system" });
  });

  it("freezes money during an appeal", async () => {
    const ctx = setup();
    const id = await fundedAndSubmitted(ctx);
    await ctx.svc.recordReport(id, { model: "test", results: [1, 2, 3, 4].map((i) => result(c(id, i), "pass")) });
    await expect(ctx.svc.openAppeal(id, "short")).rejects.toThrow(ValidationError);
    await ctx.svc.openAppeal(id, "The contact form sends to the wrong inbox");
    await expect(ctx.svc.acceptRelease(id)).rejects.toThrow(InvalidStateError);
    ctx.clock.t += 49 * HOUR;
    expect(await ctx.svc.runDueJobs()).not.toContainEqual(expect.objectContaining({ id }));
    const back = await ctx.svc.withdrawAppeal(id);
    expect(back).toMatchObject({ status: "awaiting_decision", appealReason: null });
  });

  it("rejects a report that does not cover every criterion", async () => {
    const ctx = setup();
    const id = await fundedAndSubmitted(ctx);
    await expect(ctx.svc.recordReport(id, { model: "test", results: [result(c(id, 1), "pass")] })).rejects.toThrow(ValidationError);
    await expect(ctx.svc.recordReport(id, { model: "test", results: [1, 2, 3, 4].map((i) => result(c(id, i), "pass", 1.5)) })).rejects.toThrow(ValidationError);
  });

  it("does not allow work to be submitted before funding", async () => {
    const { svc } = setup();
    const id = await svc.createMilestone(landingPage());
    await expect(svc.submitWork(id, { url: "x" })).rejects.toThrow(InvalidStateError);
    await svc.cancel(id);
    expect((await svc.getMilestone(id)).status).toBe("closed");
  });

  it("lists only the workspace's milestones, newest first", async () => {
    const { svc } = setup();
    const input = landingPage();
    const first = await svc.createMilestone(input);
    const second = await svc.createMilestone(input);
    await svc.createMilestone(landingPage());
    expect((await svc.listMilestones(input.workspaceId)).map((m) => m.id)).toEqual([second, first]);
  });

  it("completes a capture from PayPal's webhook when our own reply was lost", async () => {
    const ctx = setup();
    const id = await fundedAndSubmitted(ctx);
    await ctx.svc.recordReport(id, { model: "test", results: [1, 2, 3, 4].map((i) => result(c(id, i), "pass")) });
    ctx.pp.failNext("captureAuthorization", new TypeError("fetch failed"), true);
    await expect(ctx.svc.acceptRelease(id)).rejects.toThrow("fetch failed");

    const res = await ctx.svc.reconcileCapture({ invoiceId: `${id}-1`, captureId: "CAP-FROM-WEBHOOK", status: "COMPLETED" });
    expect(res).toEqual({ matched: true, milestoneId: id, changed: true });
    const view = await ctx.svc.getMilestone(id);
    expect(view.status).toBe("released");
    expect(view.moneyMoves.at(-1)).toMatchObject({ status: "completed", paypalId: "CAP-FROM-WEBHOOK" });
    // A redelivered webhook changes nothing.
    expect(await ctx.svc.reconcileCapture({ invoiceId: `${id}-1`, captureId: "CAP-FROM-WEBHOOK", status: "COMPLETED" })).toMatchObject({ changed: false });
    expect(await ctx.svc.findByPayPalId({ captureId: "CAP-FROM-WEBHOOK" })).toBe(id);
  });
});
