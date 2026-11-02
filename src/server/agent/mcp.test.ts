import { beforeAll, describe, expect, it } from "vitest";
import type { Services } from "../app";
import { createPgliteDb } from "../db/client";
import { createMilestoneService } from "../milestones/service";
import { createSimulatedPayPal } from "../paypal/simulated";
import { createRulesJudge } from "../verifier/judge";
import { handleMcp, TOOLS } from "./mcp";

let s: Services;
let simulated: ReturnType<typeof createSimulatedPayPal>;
beforeAll(async () => {
  const db = await createPgliteDb();
  simulated = createSimulatedPayPal();
  s = { db, database: "embedded", paypalMode: "simulated", paypal: simulated.gateway, simulated, milestones: createMilestoneService({ db, paypal: simulated.gateway }), judge: createRulesJudge(), checker: {}, demoControls: true };
}, 30_000);

const mandate = (workspaceId: string, extra: Partial<{ fundMilestones: boolean; perMilestoneLimitCents: number }> = {}) =>
  s.milestones.upsertMandate({ workspaceId, ownerName: "Sam Carter", name: "Northwind buying agent", perMilestoneLimitCents: 100000, minConfidence: 0.85, releaseVerified: true, fundMilestones: false, ...extra });

let n = 0;
const call = (workspaceId: string, method: string, params?: Record<string, unknown>) => handleMcp({ s, workspaceId, origin: "https://payplan.test" }, { jsonrpc: "2.0", id: ++n, method, params });
const tool = async (workspaceId: string, name: string, args: Record<string, unknown> = {}) => {
  const out = (await call(workspaceId, "tools/call", { name, arguments: args })) as { result: { isError?: boolean; structuredContent?: Record<string, unknown>; content: { text: string }[] } };
  return out.result;
};

/** A funded milestone where the client chose "my agent approves", checked and waiting for a decision. */
async function awaitingAgent(workspaceId: string, verdicts: ("pass" | "fail" | "review")[]) {
  const id = await s.milestones.createMilestone({
    workspaceId,
    title: "Landing page for Northwind",
    clientName: "Sam Carter",
    clientEmail: "sam@northwind.test",
    freelancerName: "Riya Sharma",
    freelancerEmail: "riya@example.in",
    amountCents: 80000,
    reviewWindowHours: 48,
    criteria: verdicts.map((_, i) => ({ title: `Criterion ${i + 1}`, weight: 25, mustPass: i === 0, evidence: "url" as const, check: "ai" as const })),
  });
  const order = await s.milestones.startFunding(id);
  simulated.approve(order.id);
  await s.milestones.completeFunding(id, { orderId: order.id, approval: "agent" });
  await s.milestones.submitWork(id, { url: "https://northwind.example" });
  await s.milestones.recordReport(id, { model: "test", results: verdicts.map((v, i) => ({ criterionId: `${id}-c${i + 1}`, verdict: v, confidence: 0.95, evidence: "checked", reason: "because" })) });
  return id;
}

describe("agent keys", () => {
  it("issues a key that maps to the workspace, and a new key replaces the old one", async () => {
    await mandate("ws_keys");
    const first = await s.milestones.issueAgentKey("ws_keys");
    expect(first).toMatch(/^ppk_[A-Za-z0-9_-]{32}$/);
    expect(await s.milestones.workspaceForAgentKey(first)).toBe("ws_keys");
    const second = await s.milestones.issueAgentKey("ws_keys");
    expect(await s.milestones.workspaceForAgentKey(first)).toBeUndefined();
    expect(await s.milestones.workspaceForAgentKey(second)).toBe("ws_keys");
    expect(await s.milestones.workspaceForAgentKey("ppk_not-a-real-key-at-all-xxxxxxxxxx")).toBeUndefined();
  });

  it("needs the agent's limits saved first", async () => {
    await expect(s.milestones.issueAgentKey("ws_no_mandate")).rejects.toThrow(/limits first/);
  });
});

describe("MCP protocol", () => {
  it("initializes and lists every tool with a JSON schema", async () => {
    const init = (await call("ws_proto", "initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "1" } })) as { result: { protocolVersion: string; capabilities: unknown } };
    expect(init.result).toMatchObject({ protocolVersion: "2025-06-18", capabilities: { tools: {} } });
    const list = (await call("ws_proto", "tools/list")) as { result: { tools: { name: string; inputSchema: { type: string } }[] } };
    expect(list.result.tools.map((x) => x.name)).toEqual(TOOLS.map((x) => x.name));
    expect(list.result.tools.every((x) => x.inputSchema.type === "object")).toBe(true);
  });

  it("does not answer notifications and rejects unknown methods", async () => {
    expect(await handleMcp({ s, workspaceId: "ws_proto", origin: "https://payplan.test" }, { jsonrpc: "2.0", method: "notifications/initialized" })).toBeUndefined();
    expect(await call("ws_proto", "resources/list")).toMatchObject({ error: { code: -32601 } });
  });
});

describe("MCP tools", () => {
  it("reads the report and releases verified work inside the mandate, capturing it on PayPal", async () => {
    await mandate("ws_go");
    const id = await awaitingAgent("ws_go", ["pass", "pass", "pass", "fail"]);
    const report = await tool("ws_go", "get_report", { milestone_id: id });
    expect(report.structuredContent).toMatchObject({ releasableUsd: 600, withinMyLimits: { approved: true } });

    const released = await tool("ws_go", "release_verified", { milestone_id: id });
    expect(released.isError).toBeUndefined();
    expect(released.structuredContent).toMatchObject({ outcome: "released", releasedUsd: 600, status: "fix_window" });
    expect(released.structuredContent!.paypalCaptureId).toMatch(/^CAP-/);
  });

  it("hands back when a must-pass criterion needs a person, and moves no money", async () => {
    await mandate("ws_back");
    const id = await awaitingAgent("ws_back", ["review", "pass", "pass", "pass"]);
    const out = await tool("ws_back", "release_verified", { milestone_id: id });
    expect(out.structuredContent).toMatchObject({ outcome: "handed_to_client", releasedUsd: 0 });
    expect((await s.milestones.getMilestone(id)).totals.captured).toBe(0);
  });

  it("respects a per-call cap by handing back", async () => {
    await mandate("ws_cap");
    const id = await awaitingAgent("ws_cap", ["pass", "pass", "pass", "pass"]);
    const out = await tool("ws_cap", "release_verified", { milestone_id: id, max_usd: 100 });
    expect(out.structuredContent).toMatchObject({ outcome: "handed_to_client" });
    expect((await s.milestones.getMilestone(id)).approval).toBe("client");
  });

  it("never shows or touches another client's milestones", async () => {
    await mandate("ws_owner");
    await mandate("ws_stranger");
    const id = await awaitingAgent("ws_owner", ["pass", "pass", "pass", "pass"]);
    const out = await tool("ws_stranger", "release_verified", { milestone_id: id });
    expect(out.isError).toBe(true);
    const list = await tool("ws_stranger", "list_milestones");
    expect(list.structuredContent).toEqual({ milestones: [] });
  });

  it("needs permission to ask for funding, and then only returns the owner's approval link", async () => {
    await mandate("ws_fund");
    const created = await tool("ws_fund", "create_milestone", {
      title: "Logo for Chai Point",
      brief: "Three logo concepts as SVG, works in one colour",
      amount_usd: 300,
      client_email: "sam@northwind.test",
      freelancer_name: "Riya Sharma",
      freelancer_email: "riya@example.in",
      criteria: [{ title: "Three logo concepts as SVG", weight: 100, mustPass: true }],
    });
    const id = created.structuredContent!.milestone as string;
    expect((await tool("ws_fund", "fund_milestone", { milestone_id: id })).isError).toBe(true);
    await mandate("ws_fund", { fundMilestones: true });
    expect((await tool("ws_fund", "fund_milestone", { milestone_id: id })).structuredContent).toMatchObject({ ownerApprovesAt: `https://payplan.test/m/${id}/fund`, amountUsd: 300 });
  });

  it("explains invalid arguments instead of failing", async () => {
    const out = await tool("ws_go", "get_report", {});
    expect(out.isError).toBe(true);
    expect(out.content[0].text).toMatch(/milestone_id/);
  });
});
