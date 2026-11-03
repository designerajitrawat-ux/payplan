import { beforeAll, describe, expect, it } from "vitest";
import type { Services } from "../app";
import { createPgliteDb } from "../db/client";
import { createMilestoneService, InvalidStateError, NotFoundError, ValidationError } from "../milestones/service";
import { createSimulatedPayPal } from "../paypal/simulated";
import { createRulesJudge } from "../verifier/judge";
import { createMilestoneFor, getMilestoneFor, runAction } from "./actions";
import { handleWebhook } from "./webhook";

let s: Services;
beforeAll(async () => {
  const db = await createPgliteDb();
  const simulated = createSimulatedPayPal();
  s = { db, database: "embedded", paypalMode: "simulated", paypal: simulated.gateway, simulated, milestones: createMilestoneService({ db, paypal: simulated.gateway }), judge: createRulesJudge(), checker: {}, demoControls: true };
}, 30_000);

const body = {
  title: "Logo for Chai Point",
  clientName: "Sam Carter",
  clientEmail: "sam@northwind.test",
  freelancerName: "Riya Sharma",
  freelancerEmail: "riya@example.in",
  amountCents: 30000,
  reviewWindowHours: 48,
  criteria: [
    { title: "Three logo concepts as SVG", weight: 60, mustPass: true, evidence: "pdf", check: "automatic" },
    { title: "Works in one colour", weight: 40, mustPass: false, evidence: "image", check: "ai" },
  ],
};

describe("milestone API", () => {
  it("runs a milestone end to end through the action endpoint", async () => {
    const ws = "ws_test_end_to_end_000001";
    const created = await createMilestoneFor(s, ws, body);
    expect(created).not.toHaveProperty("workspaceId");
    const id = created.id;

    const funding = await runAction(s, ws, id, { action: "start_funding", returnUrl: "https://payplan.test/m/x/fund" });
    const orderId = funding.order!.id;
    await runAction(s, ws, id, { action: "simulate_approval", orderId });
    expect((await runAction(s, ws, id, { action: "complete_funding", orderId })).milestone.status).toBe("funded");
    await runAction(s, ws, id, { action: "submit", url: "https://chaipoint.example/logo", note: "Three concepts attached" });
    const results = created.criteria.map((c) => ({ criterionId: c.id, verdict: "pass", confidence: 0.92, evidence: "ok", reason: "ok" }));
    expect((await runAction(s, ws, id, { action: "record_verdict", results })).milestone.status).toBe("awaiting_decision");
    const done = await runAction(s, ws, id, { action: "accept" });
    expect(done.milestone.status).toBe("released");
    expect(done.milestone.totals.captured).toBe(30000);
  });

  it("hides other workspaces' milestones", async () => {
    const created = await createMilestoneFor(s, "ws_owner_000000000000001", body);
    await expect(getMilestoneFor(s, "ws_stranger_00000000000001", created.id)).rejects.toThrow(NotFoundError);
    await expect(runAction(s, "ws_stranger_00000000000001", created.id, { action: "cancel" })).rejects.toThrow(NotFoundError);
  });

  it("explains bad requests", async () => {
    const bad = await createMilestoneFor(s, "ws_x", { ...body, clientEmail: "nope", amountCents: 1.5 }).catch((e: Error) => e.message);
    expect(bad).toContain("clientEmail");
    expect(bad).toContain("amountCents");
    const created = await createMilestoneFor(s, "ws_x", body);
    await expect(runAction(s, "ws_x", created.id, { action: "dance" })).rejects.toThrow(ValidationError);
    await expect(runAction(s, "ws_x", created.id, { action: "submit", url: "javascript:alert(1)" })).rejects.toThrow(ValidationError);
    await expect(runAction(s, "ws_x", created.id, { action: "accept" })).rejects.toThrow(InvalidStateError);
  });
});

describe("PayPal webhook", () => {
  const event = (id: string, type: string, resource: Record<string, unknown>) => JSON.stringify({ id, event_type: type, resource });

  it("stores each event once and ignores redeliveries", async () => {
    const first = await handleWebhook(s, new Headers(), event("WH-DUP-1", "PAYMENT.CAPTURE.COMPLETED", { id: "CAP-X", invoice_id: "nothing-1" }));
    expect(first).toEqual({ status: 200, body: { ok: true, matched: false } });
    expect(await handleWebhook(s, new Headers(), event("WH-DUP-1", "PAYMENT.CAPTURE.COMPLETED", { id: "CAP-X", invoice_id: "nothing-1" }))).toEqual({ status: 200, body: { duplicate: true } });
  });

  it("rejects bodies that are not PayPal events", async () => {
    expect((await handleWebhook(s, new Headers(), "not json")).status).toBe(400);
    expect((await handleWebhook(s, new Headers(), "{}")).status).toBe(400);
  });

  it("refuses unsigned events when real PayPal is configured", async () => {
    const real = { ...s, paypalClient: { verifyWebhookSignature: async () => false } as unknown as Services["paypalClient"], webhookId: "WH-ID" };
    expect((await handleWebhook(real, new Headers(), event("WH-FAKE", "PAYMENT.CAPTURE.COMPLETED", {}))).status).toBe(401);
    expect((await handleWebhook({ ...real, webhookId: undefined }, new Headers(), event("WH-FAKE", "PAYMENT.CAPTURE.COMPLETED", {}))).status).toBe(503);
  });

  it("logs a dispute on the milestone it belongs to", async () => {
    const ws = "ws_dispute_00000000000001";
    const created = await createMilestoneFor(s, ws, body);
    const { order } = await runAction(s, ws, created.id, { action: "start_funding" });
    await runAction(s, ws, created.id, { action: "simulate_approval", orderId: order!.id });
    await runAction(s, ws, created.id, { action: "complete_funding", orderId: order!.id });
    await runAction(s, ws, created.id, { action: "submit", url: "https://x.example" });
    await runAction(s, ws, created.id, { action: "record_verdict", results: created.criteria.map((c) => ({ criterionId: c.id, verdict: "pass", confidence: 0.9, evidence: "", reason: "" })) });
    const { milestone } = await runAction(s, ws, created.id, { action: "accept" });
    const captureId = milestone.moneyMoves.find((m) => m.kind === "capture")!.paypalId;

    const res = await handleWebhook(s, new Headers(), event("WH-DISPUTE-1", "CUSTOMER.DISPUTE.CREATED", { dispute_id: "PP-D-1", reason: "MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED", status: "OPEN", disputed_transactions: [{ seller_transaction_id: captureId }] }));
    expect(res.body).toMatchObject({ ok: true, applied: true });
    const view = await getMilestoneFor(s, ws, created.id);
    expect(view.events.at(-1)).toMatchObject({ actor: "paypal", type: "dispute_created", detail: { disputeId: "PP-D-1" } });
  });

  it("answers a new dispute with the signed report as a PDF through the Disputes API", async () => {
    const ws = "ws_dispute_00000000000002";
    const created = await createMilestoneFor(s, ws, body);
    const { order } = await runAction(s, ws, created.id, { action: "start_funding" });
    await runAction(s, ws, created.id, { action: "simulate_approval", orderId: order!.id });
    await runAction(s, ws, created.id, { action: "complete_funding", orderId: order!.id });
    await runAction(s, ws, created.id, { action: "submit", url: "https://x.example" });
    await runAction(s, ws, created.id, { action: "record_verdict", results: created.criteria.map((c) => ({ criterionId: c.id, verdict: "pass", confidence: 0.9, evidence: "HTTP 200", reason: "Shown" })) });
    const { milestone } = await runAction(s, ws, created.id, { action: "accept" });
    const captureId = milestone.moneyMoves.find((m) => m.kind === "capture")!.paypalId;

    const sent: { disputeId: string; name: string; head: string }[] = [];
    const paypalClient = {
      verifyWebhookSignature: async () => true,
      provideDisputeEvidence: async (disputeId: string, input: { notes: string; file: { name: string; data: Blob } }) => {
        sent.push({ disputeId, name: input.file.name, head: (await input.file.data.text()).slice(0, 8) });
        return {};
      },
    } as unknown as Services["paypalClient"];
    const real = { ...s, paypalClient, webhookId: "WH-ID", appUrl: "https://payplan.test" };
    const res = await handleWebhook(real, new Headers(), event("WH-DISPUTE-2", "CUSTOMER.DISPUTE.CREATED", { dispute_id: "PP-D-2", reason: "MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED", status: "WAITING_FOR_SELLER_RESPONSE", disputed_transactions: [{ seller_transaction_id: captureId }] }));
    expect(res.body).toMatchObject({ ok: true, applied: true, evidenceSent: true });
    expect(sent).toEqual([{ disputeId: "PP-D-2", name: expect.stringMatching(/^payplan-report-[0-9a-f]{8}\.pdf$/), head: "%PDF-1.4" }]);
    const view = await getMilestoneFor(s, ws, created.id);
    expect(view.events.at(-1)).toMatchObject({ actor: "paypal", type: "dispute_evidence_sent", detail: { disputeId: "PP-D-2" } });
  });
});
