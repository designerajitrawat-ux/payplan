// Request validation and dispatch for the milestone API. Kept free of Next.js so it can be tested directly.

import { z } from "zod";
import type { Services } from "../app";
import { NotFoundError, ValidationError, type MilestoneView } from "../milestones/service";

const name = z.string().trim().min(1).max(80);
const email = z.email().max(254);

export const createMilestoneBody = z.object({
  title: z.string().trim().min(3).max(120),
  brief: z.string().max(2000).optional(),
  clientName: name,
  clientEmail: email,
  freelancerName: name,
  freelancerEmail: email,
  freelancerLocation: z.string().max(80).optional(),
  amountCents: z.int().min(100).max(1_000_000),
  reviewWindowHours: z.int().min(1).max(336),
  fixWindowHours: z.int().min(1).max(336).optional(),
  criteria: z
    .array(
      z.object({
        title: z.string().trim().min(3).max(160),
        weight: z.int().min(0).max(100),
        mustPass: z.boolean(),
        evidence: z.enum(["url", "image", "pdf", "github", "text"]),
        check: z.enum(["automatic", "ai"]),
      }),
    )
    .min(1)
    .max(10),
});

const optionalUrl = z.union([z.url({ protocol: /^https?$/ }), z.literal("")]).optional();

const verdict = z.object({
  criterionId: z.string(),
  verdict: z.enum(["pass", "fail", "review"]),
  confidence: z.number().min(0).max(1),
  evidence: z.string().max(500),
  reason: z.string().max(500),
});

export const actionBody = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start_funding"), returnUrl: optionalUrl, cancelUrl: optionalUrl }),
  z.object({ action: z.literal("simulate_approval"), orderId: z.string().min(1) }),
  z.object({ action: z.literal("complete_funding"), orderId: z.string().min(1), approval: z.enum(["client", "agent"]).default("client") }),
  z.object({ action: z.literal("set_approval"), approval: z.enum(["client", "agent"]) }),
  z.object({ action: z.literal("submit"), url: optionalUrl, prLink: optionalUrl, files: z.array(z.string().max(200)).max(20).optional(), note: z.string().max(2000).optional() }),
  /** Stands in for the AI checker until it is wired (plan T1.6). */
  z.object({ action: z.literal("record_verdict"), results: z.array(verdict).min(1).max(10), model: z.string().max(80).default("manual") }),
  z.object({ action: z.literal("accept") }),
  z.object({ action: z.literal("agent_decide") }),
  z.object({ action: z.literal("appeal"), reason: z.string().trim().min(10).max(1000) }),
  z.object({ action: z.literal("withdraw_appeal") }),
  z.object({ action: z.literal("void") }),
  z.object({ action: z.literal("cancel") }),
]);

export const mandateBody = z.object({
  ownerName: name,
  name: name,
  perMilestoneLimitCents: z.int().min(0).max(1_000_000),
  minConfidence: z.number().min(0.5).max(1),
  releaseVerified: z.boolean(),
  fundMilestones: z.boolean(),
});

export type ActionBody = z.infer<typeof actionBody>;

/** Parses with zod and turns problems into one readable ValidationError. */
export function parse<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input);
  if (!result.success) throw new ValidationError(result.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; "));
  return result.data;
}

/** What the browser may see. The workspace id works like a password, so it never leaves the server. */
export function publicView(view: MilestoneView) {
  const { workspaceId: _hidden, ...rest } = view;
  void _hidden;
  return rest;
}

async function owned(s: Services, workspaceId: string, id: string) {
  const view = await s.milestones.getMilestone(id);
  if (view.workspaceId !== workspaceId) throw new NotFoundError(id);
  return view;
}

export async function getMilestoneFor(s: Services, workspaceId: string, id: string) {
  return publicView(await owned(s, workspaceId, id));
}

export async function createMilestoneFor(s: Services, workspaceId: string, body: unknown) {
  const input = parse(createMilestoneBody, body);
  const id = await s.milestones.createMilestone({ ...input, workspaceId });
  return getMilestoneFor(s, workspaceId, id);
}

export async function runAction(s: Services, workspaceId: string, id: string, body: unknown) {
  const input = parse(actionBody, body);
  await owned(s, workspaceId, id);
  const svc = s.milestones;
  let extra: { order?: Awaited<ReturnType<typeof svc.startFunding>>; agent?: { outcome: "released" | "handed_to_client"; checks: { label: string; detail: string; ok: boolean }[] } } = {};
  switch (input.action) {
    case "start_funding": {
      const order = await svc.startFunding(id, { returnUrl: input.returnUrl || undefined, cancelUrl: input.cancelUrl || undefined });
      extra = { order };
      break;
    }
    case "simulate_approval":
      if (!s.simulated) throw new ValidationError("Approval happens on PayPal in sandbox mode");
      s.simulated.approve(input.orderId);
      break;
    case "complete_funding":
      await svc.completeFunding(id, { orderId: input.orderId, approval: input.approval });
      break;
    case "set_approval":
      await svc.setApproval(id, input.approval);
      break;
    case "submit":
      await svc.submitWork(id, { url: input.url, prLink: input.prLink, files: input.files, note: input.note });
      break;
    case "record_verdict":
      await svc.recordReport(id, { results: input.results, model: input.model });
      break;
    case "accept":
      await svc.acceptRelease(id);
      break;
    case "agent_decide": {
      const decision = await svc.agentDecide(id);
      extra = { agent: { outcome: decision.outcome, checks: decision.review.checks } };
      break;
    }
    case "appeal":
      await svc.openAppeal(id, input.reason);
      break;
    case "withdraw_appeal":
      await svc.withdrawAppeal(id);
      break;
    case "void":
      await svc.voidRemainder(id, "freelancer");
      break;
    case "cancel":
      await svc.cancel(id);
      break;
  }
  return { milestone: await getMilestoneFor(s, workspaceId, id), ...extra };
}
