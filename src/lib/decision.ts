import type { Criterion, CriterionResult, LedgerEntry } from "./types";

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

export function ledgerTotals(ledger: LedgerEntry[]) {
  const authorized = ledger.filter((e) => e.kind === "authorization").reduce((s, e) => s + e.amount, 0);
  const captured = ledger.filter((e) => e.kind === "capture").reduce((s, e) => s + e.amount, 0);
  const voided = ledger.filter((e) => e.kind === "void").reduce((s, e) => s + e.amount, 0);
  const held = Math.max(0, Math.round((authorized - captured - voided) * 100) / 100);
  return { authorized, captured, voided, held };
}
