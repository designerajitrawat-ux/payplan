// The MCP server the client's own AI agent connects to: stateless JSON-RPC over HTTP (MCP "Streamable
// HTTP", answering with plain JSON). The agent works only inside the limits the client set on the
// Agents page, and the PayPal authorization stays the hard ceiling. It can read reports, propose and
// fund milestones (the owner still approves every PayPal hold), release verified work, or hand a
// decision back. It can never appeal, void, or change its own limits.

import { z } from "zod";
import type { Services } from "../app";
import { draftCriteria } from "../criteria/draft";
import type * as t from "../db/schema";
import { agentReview, releasableCents } from "../domain/rules";
import { llmFromEnv } from "../llm";
import { InvalidStateError, NotFoundError, ValidationError } from "../milestones/service";

export const MCP_PROTOCOL = "2025-06-18";
const SUPPORTED = new Set(["2025-06-18", "2025-03-26", "2024-11-05"]);

type Ctx = { s: Services; workspaceId: string; origin: string };
type Tool<S extends z.ZodType> = { name: string; title: string; description: string; input: S; run: (ctx: Ctx, input: z.infer<S>) => Promise<Record<string, unknown>> };

const usd = (cents: number) => Math.round(cents) / 100;
const milestoneId = z.string().min(3).max(40).describe("The milestone id, for example m_1d1201ec2d");

async function owned(ctx: Ctx, id: string) {
  const m = await ctx.s.milestones.getMilestone(id);
  if (m.workspaceId !== ctx.workspaceId) throw new NotFoundError(id);
  return m;
}

async function mandateOf(ctx: Ctx) {
  const mandate = await ctx.s.milestones.getMandate(ctx.workspaceId);
  if (!mandate) throw new ValidationError("This client has not set up an agent mandate yet");
  return mandate;
}

const ruleMandate = (m: t.AgentMandateRow) => ({ name: m.name, perMilestoneLimitCents: m.perMilestoneLimitCents, minConfidence: m.minConfidence, releaseVerified: m.releaseVerified });

function tool<S extends z.ZodType>(def: Tool<S>) {
  return def;
}

export const TOOLS = [
  tool({
    name: "list_milestones",
    title: "List milestones",
    description: "Lists this client's milestones with their status and where the money is: held on PayPal, released, or returned.",
    input: z.object({}),
    async run(ctx) {
      const views = await ctx.s.milestones.listMilestoneViews(ctx.workspaceId);
      return {
        milestones: views.map((m) => {
          const report = m.reports.at(-1);
          return {
            id: m.id,
            number: `M-${m.number}`,
            title: m.title,
            freelancer: m.freelancerName,
            status: m.status,
            whoApprovesReleases: m.approval,
            amountUsd: usd(m.amountCents),
            heldUsd: usd(m.totals.held),
            releasedUsd: usd(m.totals.captured),
            returnedUsd: usd(m.totals.voided),
            latestReport: report ? { attempt: report.attempt, passed: report.results.filter((r) => r.verdict === "pass").length, total: report.results.length } : null,
          };
        }),
      };
    },
  }),
  tool({
    name: "get_report",
    title: "Read the acceptance report",
    description:
      "Reads the latest signed acceptance report for a milestone: each agreed criterion with its verdict, confidence and reason, how much can be released, and whether a release would fit this agent's limits.",
    input: z.object({ milestone_id: milestoneId }),
    async run(ctx, { milestone_id }) {
      const m = await owned(ctx, milestone_id);
      const report = m.reports.at(-1);
      if (!report) return { milestone: milestone_id, status: m.status, report: null, note: "No report yet: the work has not been checked." };
      const mandate = await ctx.s.milestones.getMandate(ctx.workspaceId);
      const review = mandate ? agentReview(m.criteria, report.results, m.totals.authorized, ruleMandate(mandate)) : null;
      return {
        milestone: milestone_id,
        title: m.title,
        status: m.status,
        attempt: report.attempt,
        verifiedAt: report.verifiedAt,
        signedReport: `${ctx.origin}/r/${report.reportHash}`,
        criteria: m.criteria.map((c) => {
          const r = report.results.find((x) => x.criterionId === c.id);
          return { title: c.title, weightPercent: c.weight, mustPass: c.mustPass, verdict: r?.verdict ?? "missing", confidence: r?.confidence ?? 0, reason: r?.reason ?? "" };
        }),
        releasableUsd: usd(releasableCents(m.criteria, report.results, m.totals.authorized)),
        alreadyReleasedUsd: usd(m.totals.captured),
        withinMyLimits: review ? { approved: review.approved, checks: review.checks } : { approved: false, checks: [{ label: "Agent set up", detail: "No mandate", ok: false }] },
      };
    },
  }),
  tool({
    name: "create_milestone",
    title: "Propose a milestone",
    description:
      "Proposes a new milestone for a job: a title, a brief and an amount. Acceptance criteria are drafted from the brief unless you pass your own. Nothing is charged; the owner approves the PayPal hold separately (see fund_milestone).",
    input: z.object({
      title: z.string().trim().min(3).max(120),
      brief: z.string().trim().min(10).max(4000).describe("What the freelancer will deliver, in plain words"),
      amount_usd: z.number().min(1).max(10_000),
      client_email: z.email().describe("The owner's email, where the PayPal funding link goes"),
      freelancer_name: z.string().trim().min(1).max(80),
      freelancer_email: z.email(),
      criteria: z
        .array(z.object({ title: z.string().trim().min(3).max(200), weight: z.int().min(1).max(100), mustPass: z.boolean().default(false), check: z.enum(["automatic", "ai"]).default("ai") }))
        .min(1)
        .max(10)
        .optional()
        .describe("Optional. Leave out to draft criteria from the brief"),
    }),
    async run(ctx, input) {
      const mandate = await mandateOf(ctx);
      const drafted = input.criteria ? null : await draftCriteria(input.brief, llmFromEnv());
      const criteria = input.criteria
        ? input.criteria.map((c) => ({ ...c, evidence: "url" as const }))
        : drafted!.criteria.map((c) => ({ title: c.title, weight: c.weight, mustPass: c.mustPass, evidence: c.evidence, check: c.check }));
      const id = await ctx.s.milestones.createMilestone({
        workspaceId: ctx.workspaceId,
        title: input.title,
        brief: input.brief,
        clientName: mandate.ownerName,
        clientEmail: input.client_email,
        freelancerName: input.freelancer_name,
        freelancerEmail: input.freelancer_email,
        amountCents: Math.round(input.amount_usd * 100),
        reviewWindowHours: 48,
        boughtByAgent: true,
        criteria,
      });
      return {
        milestone: id,
        criteria: criteria.map((c) => ({ title: c.title, weightPercent: c.weight, mustPass: c.mustPass })),
        criteriaSource: drafted ? drafted.source : "agent",
        next: "Call fund_milestone so the owner can approve the PayPal hold.",
      };
    },
  }),
  tool({
    name: "fund_milestone",
    title: "Ask the owner to approve the hold",
    description:
      "Gets the link where the owner approves this milestone's PayPal hold. Only a person can approve a PayPal payment; the agent never does. Requires the 'fund new milestones' permission.",
    input: z.object({ milestone_id: milestoneId }),
    async run(ctx, { milestone_id }) {
      const mandate = await mandateOf(ctx);
      if (!mandate.fundMilestones) throw new ValidationError("Funding new milestones is switched off for this agent");
      const m = await owned(ctx, milestone_id);
      if (m.status !== "awaiting_funding") throw new InvalidStateError(milestone_id, "ask for funding", m.status);
      return {
        milestone: milestone_id,
        amountUsd: usd(m.amountCents),
        ownerApprovesAt: `${ctx.origin}/m/${milestone_id}/fund`,
        note: `Send this link to ${mandate.ownerName}. Approving places a hold on their PayPal; nothing is charged until verified work is released.`,
      };
    },
  }),
  tool({
    name: "release_verified",
    title: "Release verified work",
    description:
      "Releases the verified share of a milestone by capturing it from the PayPal hold, but only if every check in this agent's mandate passes (release permission, spending limit, must-pass criteria, AI confidence, nothing flagged for a person). Otherwise the decision goes back to the owner.",
    input: z.object({ milestone_id: milestoneId, max_usd: z.number().min(0).max(10_000).optional().describe("Optional extra cap for this release") }),
    async run(ctx, { milestone_id, max_usd }) {
      const mandate = await mandateOf(ctx);
      const m = await owned(ctx, milestone_id);
      if (m.status !== "awaiting_decision") throw new InvalidStateError(milestone_id, "release", m.status);
      if (m.approval !== "agent") throw new ValidationError("The owner approves releases for this milestone themselves; use hand_back or wait for them");
      const report = m.reports.at(-1);
      if (report && max_usd !== undefined) {
        const due = releasableCents(m.criteria, report.results, m.totals.authorized) - m.totals.captured;
        if (due > Math.round(max_usd * 100)) {
          await ctx.s.milestones.setApproval(milestone_id, "client");
          await ctx.s.milestones.addEvent(milestone_id, "agent", "handed_to_client", { via: "mcp", reason: `Release of ${usd(due)} is above the cap of ${max_usd} set for this call` });
          return { milestone: milestone_id, outcome: "handed_to_client", reason: `The release (${usd(due)} USD) is above max_usd` };
        }
      }
      const decision = await ctx.s.milestones.agentDecide(milestone_id);
      const after = decision.milestone;
      const capture = decision.outcome === "released" ? (await owned(ctx, milestone_id)).moneyMoves.filter((x) => x.kind === "capture").at(-1) : undefined;
      return {
        milestone: milestone_id,
        outcome: decision.outcome,
        releasedUsd: decision.outcome === "released" ? usd(decision.review.releasable) : 0,
        paypalCaptureId: capture?.paypalId ?? null,
        status: after.status,
        checks: decision.review.checks,
        agent: mandate.name,
      };
    },
  }),
  tool({
    name: "hand_back",
    title: "Hand the decision back",
    description: "Returns the release decision to the owner, with a note saying why. Use it whenever something is unclear.",
    input: z.object({ milestone_id: milestoneId, note: z.string().trim().min(3).max(500) }),
    async run(ctx, { milestone_id, note }) {
      const m = await owned(ctx, milestone_id);
      if (m.status !== "awaiting_decision") throw new InvalidStateError(milestone_id, "hand back", m.status);
      await ctx.s.milestones.setApproval(milestone_id, "client");
      await ctx.s.milestones.addEvent(milestone_id, "agent", "handed_to_client", { via: "mcp", note });
      return { milestone: milestone_id, outcome: "handed_to_client", note };
    },
  }),
];

type JsonRpc = { jsonrpc: "2.0"; id?: string | number | null; method: string; params?: Record<string, unknown> };
const reply = (id: JsonRpc["id"], result: unknown) => ({ jsonrpc: "2.0" as const, id: id ?? null, result });
const failure = (id: JsonRpc["id"], code: number, message: string) => ({ jsonrpc: "2.0" as const, id: id ?? null, error: { code, message } });

/**
 * Handles one JSON-RPC message. Returns undefined for notifications, which get no reply.
 * Tool errors come back as results with isError, so the agent can read them and adjust.
 */
export async function handleMcp(ctx: Ctx, message: unknown) {
  const msg = message as JsonRpc;
  if (!msg || msg.jsonrpc !== "2.0" || typeof msg.method !== "string") return failure(null, -32600, "Invalid request");
  if (msg.id === undefined) return undefined;
  switch (msg.method) {
    case "initialize": {
      const asked = String(msg.params?.protocolVersion ?? "");
      return reply(msg.id, {
        protocolVersion: SUPPORTED.has(asked) ? asked : MCP_PROTOCOL,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "payplan", title: "PayPlan milestone payments", version: "0.2.0" },
        instructions:
          "You act for the client. Read the signed report before releasing money, release only verified work, and hand the decision back when anything is unclear. Every release is captured on PayPal from a hold the client approved.",
      });
    }
    case "ping":
      return reply(msg.id, {});
    case "tools/list":
      return reply(msg.id, { tools: TOOLS.map((x) => ({ name: x.name, title: x.title, description: x.description, inputSchema: z.toJSONSchema(x.input, { io: "input" }) })) });
    case "tools/call": {
      const name = String(msg.params?.name ?? "");
      const found = TOOLS.find((x) => x.name === name);
      if (!found) return failure(msg.id, -32602, `Unknown tool: ${name}`);
      const parsed = found.input.safeParse(msg.params?.arguments ?? {});
      if (!parsed.success) return reply(msg.id, { isError: true, content: [{ type: "text", text: `Invalid arguments: ${parsed.error.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; ")}` }] });
      try {
        const result = await (found.run as (c: Ctx, i: unknown) => Promise<Record<string, unknown>>)(ctx, parsed.data);
        return reply(msg.id, { content: [{ type: "text", text: JSON.stringify(result, null, 2) }], structuredContent: result });
      } catch (error) {
        const known = error instanceof ValidationError || error instanceof InvalidStateError || error instanceof NotFoundError;
        if (!known) console.error(error);
        return reply(msg.id, { isError: true, content: [{ type: "text", text: known ? error.message : "Something went wrong on our side. Try again in a minute." }] });
      }
    }
    default:
      return failure(msg.id, -32601, `Method not found: ${msg.method}`);
  }
}
