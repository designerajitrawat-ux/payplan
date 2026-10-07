// The timer job: finishes checks that stalled, then runs the review and fix window timers.

import type { Services } from "./app";
import { runVerification } from "./verifier/run";

const STALLED_MS = 3 * 60_000;
/** The agent normally decides while the client watches; if nobody opens the page, it acts anyway. */
const AGENT_GRACE_MS = 2 * 60_000;

export async function runTimers(s: Services) {
  const done: { id: string; job: string; ok: boolean; error?: string }[] = [];
  for (const { id } of await s.milestones.stuckVerifications(STALLED_MS)) {
    await runVerification(s.milestones, s.judge, id, s.checker).then(
      () => done.push({ id, job: "verify", ok: true }),
      (e: unknown) => done.push({ id, job: "verify", ok: false, error: e instanceof Error ? e.message : String(e) }),
    );
  }
  for (const { id } of await s.milestones.pendingAgentDecisions(AGENT_GRACE_MS)) {
    await s.milestones.agentDecide(id).then(
      () => done.push({ id, job: "agent", ok: true }),
      (e: unknown) => done.push({ id, job: "agent", ok: false, error: e instanceof Error ? e.message : String(e) }),
    );
  }
  return [...done, ...(await s.milestones.runDueJobs())];
}
