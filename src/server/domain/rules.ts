// Money rules for the server, in integer cents. Pure functions, no I/O.

import { createHash } from "node:crypto";
import type { AgentCheckJson, CriterionResultJson } from "../db/schema";

export type RuleCriterion = { id: string; weight: number; mustPass: boolean };
export type RuleMove = { kind: "authorization" | "capture" | "void" | "reauthorization"; status: "pending" | "completed" | "failed"; amountCents: number };
export type RuleMandate = { name: string; perMilestoneLimitCents: number; minConfidence: number; releaseVerified: boolean };

/**
 * A failed must-pass criterion releases nothing. Otherwise the weights of the passed criteria
 * decide the share of the authorized amount, rounded down to the cent.
 */
export function releasableCents(criteria: RuleCriterion[], results: Pick<CriterionResultJson, "criterionId" | "verdict">[], authorizedCents: number): number {
  const byId = new Map(results.map((r) => [r.criterionId, r.verdict]));
  if (criteria.some((c) => c.mustPass && byId.get(c.id) !== "pass")) return 0;
  const total = criteria.reduce((s, c) => s + c.weight, 0);
  if (total <= 0) return 0;
  const passed = criteria.reduce((s, c) => s + (byId.get(c.id) === "pass" ? c.weight : 0), 0);
  return Math.min(Math.floor((authorizedCents * passed) / total), authorizedCents);
}

/**
 * What PayPal holds for a milestone. Pending moves count as already spent, so a second
 * request can never capture money that an earlier, unfinished request is about to take.
 */
export function moneyTotals(moves: RuleMove[]) {
  const sum = (kind: RuleMove["kind"], status: RuleMove["status"][]) => moves.filter((m) => m.kind === kind && status.includes(m.status)).reduce((s, m) => s + m.amountCents, 0);
  const authorized = sum("authorization", ["completed"]);
  const captured = sum("capture", ["completed"]);
  const voided = sum("void", ["completed"]);
  const pending = sum("capture", ["pending"]) + sum("void", ["pending"]);
  return { authorized, captured, voided, pending, held: Math.max(0, authorized - captured - voided), available: Math.max(0, authorized - captured - voided - pending) };
}

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
export const formatCents = (cents: number) => usd.format(cents / 100);
const percent = (v: number) => `${Math.round(v * 100)}%`;

/**
 * The client's agent may release only inside its mandate. Any failed check hands the decision
 * back to the client. The agent never appeals and never moves more than was verified.
 */
export function agentReview(criteria: RuleCriterion[], results: CriterionResultJson[], authorizedCents: number, mandate: RuleMandate) {
  const releasable = releasableCents(criteria, results, authorizedCents);
  const byId = new Map(results.map((r) => [r.criterionId, r]));
  const gatesPassed = criteria.filter((c) => c.mustPass).every((c) => byId.get(c.id)?.verdict === "pass");
  const passed = results.filter((r) => r.verdict === "pass");
  const lowest = passed.length ? Math.min(...passed.map((r) => r.confidence)) : 0;
  const needsPerson = results.some((r) => r.verdict === "review");
  const checks: AgentCheckJson[] = [
    { label: "Release permission", detail: mandate.releaseVerified ? "Allowed to release verified work" : "Releasing is switched off", ok: mandate.releaseVerified },
    { label: "Within spending limit", detail: `${formatCents(releasable)} of ${formatCents(mandate.perMilestoneLimitCents)} allowed`, ok: releasable <= mandate.perMilestoneLimitCents },
    { label: "Must-pass criteria", detail: gatesPassed ? "Every must-pass criterion passed" : "A must-pass criterion failed", ok: gatesPassed },
    { label: "AI confidence", detail: `Lowest ${percent(lowest)}, needs ${percent(mandate.minConfidence)}`, ok: lowest >= mandate.minConfidence },
    { label: "Nothing flagged for a person", detail: needsPerson ? "A result needs human review" : "No result needs human review", ok: !needsPerson },
  ];
  return { releasable, checks, approved: releasable > 0 && checks.every((c) => c.ok) };
}

/** JSON with sorted keys, so the same data always hashes the same way. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export const sha256 = (value: unknown) => createHash("sha256").update(canonicalJson(value)).digest("hex");
