// The timer job: finishes checks that stalled, then runs the review and fix window timers.

import type { Services } from "./app";
import { runVerification } from "./verifier/run";

const STALLED_MS = 3 * 60_000;

export async function runTimers(s: Services) {
  const done: { id: string; job: string; ok: boolean; error?: string }[] = [];
  for (const { id } of await s.milestones.stuckVerifications(STALLED_MS)) {
    await runVerification(s.milestones, s.judge, id).then(
      () => done.push({ id, job: "verify", ok: true }),
      (e: unknown) => done.push({ id, job: "verify", ok: false, error: e instanceof Error ? e.message : String(e) }),
    );
  }
  return [...done, ...(await s.milestones.runDueJobs())];
}
