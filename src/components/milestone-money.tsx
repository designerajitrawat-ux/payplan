"use client";

import { ledgerTotals } from "@/lib/decision";
import { money } from "@/lib/format";
import type { Milestone } from "@/lib/types";
import { MoneyLock, type SliceState } from "./money-lock";
import { NumberTicker } from "./motion";

/** Each criterion's slice of the lock, coloured by where its money is right now. */
export function lockSlices(m: Milestone): { weight: number; state: SliceState }[] {
  const report = m.reports.at(-1);
  const releasedStatus = m.status === "fix_window" || m.status === "released" || m.status === "closed";
  return m.criteria.map((c) => {
    const r = report?.results.find((x) => x.criterionId === c.id);
    if (!r || m.status === "verifying") return { weight: c.weight, state: "pending" };
    if (r.verdict === "pass") return { weight: c.weight, state: releasedStatus ? "released" : "verified" };
    return { weight: c.weight, state: m.status === "closed" ? "returned" : "failed" };
  });
}

/** The milestone's money as the padlock: the client's PayPal, the hold split into criteria, the freelancer. */
export function MilestoneMoney({ m }: { m: Milestone }) {
  const t = ledgerTotals(m.ledger);
  const funded = t.authorized > 0;
  const caption = !funded ? "not locked yet" : t.held === 0 && t.captured > 0 ? "paid out" : `${m.criteria.length} criteria on hold`;
  return (
    <MoneyLock
      amount={money(t.authorized || m.amount).replace(".00", "")}
      caption={caption}
      slices={lockSlices(m)}
      locked={funded && t.held > 0}
      releasing={t.captured > 0}
      agent={m.approval === "agent"}
      client={{ label: `${m.clientName.split(" ")[0]}'s PayPal`, value: funded ? <NumberTicker value={t.held} /> : "Not locked" }}
      freelancer={{ label: `${m.freelancerName.split(" ")[0]} · ${m.freelancerLocation.split(",")[0]}`, value: <NumberTicker value={t.captured} /> }}
    />
  );
}
