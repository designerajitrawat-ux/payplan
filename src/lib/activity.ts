import { money } from "./format";
import type { Milestone } from "./types";

export type Actor = "freelancer" | "client" | "agent" | "verifier" | "paypal";

export type ActivityItem = { at: string; actor: Actor; who: string; text: string; tone?: "good" | "warn" | "bad" };

/** Everything that happened to a milestone, oldest first, derived from its stored records. */
export function activityFor(m: Milestone): ActivityItem[] {
  const items: ActivityItem[] = [
    { at: m.createdAt, actor: "freelancer", who: m.freelancerName, text: `Proposed ${m.criteria.length} criteria for ${money(m.amount)}` },
  ];
  for (const e of m.ledger) {
    if (e.kind === "authorization") items.push({ at: e.at, actor: "paypal", who: "PayPal", text: `${money(e.amount)} hold approved on ${m.clientName}'s PayPal` });
    if (e.kind === "capture") items.push({ at: e.at, actor: "paypal", who: "PayPal", text: `Captured ${money(e.amount)} for ${m.freelancerName}`, tone: "good" });
    if (e.kind === "void") items.push({ at: e.at, actor: "paypal", who: "PayPal", text: `Returned ${money(e.amount)} to ${m.clientName}` });
  }
  if (m.submission) items.push({ at: m.submission.submittedAt, actor: "freelancer", who: m.freelancerName, text: "Sent the work for checking" });
  for (const r of m.reports) {
    const passed = r.results.filter((x) => x.verdict === "pass").length;
    const failed = r.results.length - passed;
    items.push({
      at: r.verifiedAt,
      actor: "verifier",
      who: "AI checker",
      text: `${r.attempt > 1 ? "Re-checked the fix" : `Checked ${r.results.length} criteria`}: ${passed} passed${failed ? `, ${failed} not met` : ""}`,
      tone: failed ? "warn" : "good",
    });
  }
  if (m.agentDecision) {
    items.push({
      at: m.agentDecision.at,
      actor: "agent",
      who: "Client's agent",
      text: m.agentDecision.outcome === "released" ? `Released ${money(m.agentDecision.amount)} within its limit` : "Handed the decision to the client",
      tone: m.agentDecision.outcome === "released" ? "good" : "warn",
    });
  }
  if (m.appealedAt) items.push({ at: m.appealedAt, actor: "client", who: m.clientName, text: "Appealed to a person", tone: "bad" });
  return items.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}
