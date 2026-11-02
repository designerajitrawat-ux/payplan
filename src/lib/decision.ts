import { money } from "./format";
import type { AgentCheck, AgentMandate, Criterion, CriterionResult, LedgerEntry } from "./types";

/**
 * Rules engine: turns per-criterion verdicts into an amount.
 * A failed must-pass gate releases nothing; otherwise the weights of passed criteria
 * decide the share. The result never exceeds the authorized amount and is floored to cents.
 */
export function releasableAmount(criteria: Criterion[], results: CriterionResult[], authorized: number): number {
  const byId = new Map(results.map((r) => [r.criterionId, r]));
  const gateFailed = criteria.some((c) => c.mustPass && byId.get(c.id)?.verdict !== "pass");
  if (gateFailed) return 0;
  const totalWeight = criteria.reduce((sum, c) => sum + c.weight, 0);
  if (totalWeight <= 0) return 0;
  const passedWeight = criteria.reduce((sum, c) => sum + (byId.get(c.id)?.verdict === "pass" ? c.weight : 0), 0);
  const cents = Math.floor((authorized * 100 * passedWeight) / totalWeight);
  return Math.min(cents / 100, authorized);
}

/** A person's answer to a "needs a person" verdict. */
export type ReviewResolution = { criterionId: string; verdict: "pass" | "fail"; note: string; by: string };

/**
 * Applies a person's answers to the verdicts that needed one. The checker's definite verdicts
 * (pass or fail) always stand; only "review" results take the person's answer.
 */
export function withResolutions<R extends CriterionResult>(results: R[], resolutions: ReviewResolution[]): R[] {
  const byId = new Map(resolutions.map((r) => [r.criterionId, r]));
  return results.map((r) => {
    const answer = byId.get(r.criterionId);
    if (!answer || r.verdict !== "review") return r;
    const fallback = answer.verdict === "pass" ? `${answer.by} checked this and accepted it.` : `${answer.by} checked this and found it not met.`;
    return { ...r, verdict: answer.verdict, confidence: 1, evidence: `Checked by ${answer.by}`, reason: answer.note.trim() || fallback };
  });
}

export function ledgerTotals(ledger: LedgerEntry[]) {
  const authorized = ledger.filter((e) => e.kind === "authorization").reduce((s, e) => s + e.amount, 0);
  const captured = ledger.filter((e) => e.kind === "capture").reduce((s, e) => s + e.amount, 0);
  const voided = ledger.filter((e) => e.kind === "void").reduce((s, e) => s + e.amount, 0);
  const held = Math.max(0, Math.round((authorized - captured - voided) * 100) / 100);
  return { authorized, captured, voided, held };
}

const percent = (v: number) => `${Math.round(v * 100)}%`;

/**
 * The client's agent decides only inside its mandate. Every check must hold, otherwise the
 * decision goes back to the client. The agent never appeals and never moves more than was verified.
 */
export function agentReview(criteria: Criterion[], results: CriterionResult[], authorized: number, mandate: AgentMandate) {
  const releasable = releasableAmount(criteria, results, authorized);
  const byId = new Map(results.map((r) => [r.criterionId, r]));
  const gatesPassed = criteria.filter((c) => c.mustPass).every((c) => byId.get(c.id)?.verdict === "pass");
  const passed = results.filter((r) => r.verdict === "pass");
  const lowest = passed.length ? Math.min(...passed.map((r) => r.confidence)) : 0;
  const needsPerson = results.some((r) => r.verdict === "review");
  const checks: AgentCheck[] = [
    { label: "Release permission", detail: mandate.releaseVerified ? "Allowed to release verified work" : "Releasing is switched off", ok: mandate.releaseVerified },
    { label: "Within spending limit", detail: `${money(releasable)} of ${money(mandate.perMilestoneLimit)} allowed`, ok: releasable <= mandate.perMilestoneLimit },
    { label: "Must-pass criteria", detail: gatesPassed ? "Every must-pass criterion passed" : "A must-pass criterion failed", ok: gatesPassed },
    { label: "AI confidence", detail: `Lowest ${percent(lowest)}, needs ${percent(mandate.minConfidence)}`, ok: lowest >= mandate.minConfidence },
    { label: "Nothing flagged for a person", detail: needsPerson ? "A result needs human review" : "No result needs human review", ok: !needsPerson },
  ];
  return { releasable, checks, approved: releasable > 0 && checks.every((c) => c.ok) };
}
