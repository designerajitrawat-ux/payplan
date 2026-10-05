"use client";

import { ledgerTotals } from "@/lib/decision";
import { money } from "@/lib/format";
import type { Milestone } from "@/lib/types";
import { MoneyOrbit, type MoonState } from "./cosmos";
import { NumberTicker } from "./motion";

/** Each criterion's slice of the orbit, coloured by where its money is right now. */
export function orbitSegments(m: Milestone): { weight: number; state: MoonState }[] {
  const report = m.reports.at(-1);
  const releasedStatus = m.status === "fix_window" || m.status === "released" || m.status === "closed";
  return m.criteria.map((c) => {
    const r = report?.results.find((x) => x.criterionId === c.id);
    if (!r || m.status === "verifying") return { weight: c.weight, state: "pending" };
    if (r.verdict === "pass") return { weight: c.weight, state: releasedStatus ? "released" : "verified" };
    return { weight: c.weight, state: m.status === "closed" ? "returned" : "failed" };
  });
}

/** The milestone's money as a small solar system, with plain labels underneath. */
export function MilestoneOrbit({ m }: { m: Milestone }) {
  const t = ledgerTotals(m.ledger);
  const funded = t.authorized > 0;
  return (
    <div>
      <MoneyOrbit amountLabel={money(m.amount).replace(".00", "")} segments={orbitSegments(m)} holding={funded && t.held > 0} releasing={t.captured > 0} agent={m.approval === "agent"} />
      <div className="mt-1 grid grid-cols-3 gap-2 text-center text-xs">
        <div>
          <p className="text-dim">{m.clientName.split(" ")[0]}&apos;s PayPal</p>
          <p className="mt-0.5 font-medium text-ice">{funded ? <NumberTicker value={t.held} /> : "Not locked yet"}</p>
        </div>
        <div>
          <p className="text-dim">Authorization</p>
          <p className="mt-0.5 font-medium text-ink">{funded ? `${m.criteria.length} criteria` : "Waiting"}</p>
        </div>
        <div>
          <p className="text-dim">
            {m.freelancerName.split(" ")[0]} · {m.freelancerLocation.split(",")[0]}
          </p>
          <p className="mt-0.5 font-medium text-mint">
            <NumberTicker value={t.captured} />
          </p>
        </div>
      </div>
    </div>
  );
}
