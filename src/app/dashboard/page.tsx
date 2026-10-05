"use client";

import Link from "next/link";
import { DemoGuide } from "@/components/demo-guide";
import { Countdown } from "@/components/time";
import { Badge, ButtonLink, Card, StatusBadge } from "@/components/ui";
import { ledgerTotals } from "@/lib/decision";
import { money } from "@/lib/format";
import { useMilestones } from "@/lib/store";
import type { Milestone } from "@/lib/types";

function nextDeadline(m: Milestone): { label: string; at?: string } | null {
  if (m.status === "awaiting_decision") return { label: "Auto-release in", at: m.decisionDueAt };
  if (m.status === "fix_window") return { label: "Fix window ends in", at: m.fixDueAt };
  return null;
}

function MiniBar({ m }: { m: Milestone }) {
  const t = ledgerTotals(m.ledger);
  const total = t.authorized || m.amount;
  return (
    <div className="flex h-2 w-28 overflow-hidden rounded-full bg-slate-100" aria-hidden>
      <div className="bg-emerald-500" style={{ width: `${(t.captured / total) * 100}%` }} />
      <div className="bg-amber-400" style={{ width: `${(t.held / total) * 100}%` }} />
      <div className="bg-slate-300" style={{ width: `${(t.voided / total) * 100}%` }} />
    </div>
  );
}

export default function Dashboard() {
  const milestones = useMilestones();
  const totals = milestones.map((m) => ledgerTotals(m.ledger));
  const held = totals.reduce((s, t) => s + t.held, 0);
  const released = totals.reduce((s, t) => s + t.captured, 0);
  const waitingOnYou = milestones.filter((m) => m.status === "funded" || m.status === "fix_window").length;
  const agentBought = milestones.filter((m) => m.boughtByAgent).length;

  const tiles = [
    { label: "Held on clients' PayPal", value: money(held) },
    { label: "Released to you", value: money(released) },
    { label: "Waiting on you", value: String(waitingOnYou) },
    { label: "Bought by AI agents", value: String(agentBought) },
  ];

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Milestones</h1>
          <p className="mt-1 text-slate-600">Riya Sharma · freelance product designer, Pune</p>
        </div>
        <ButtonLink href="/new">New milestone</ButtonLink>
      </div>

      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <Card key={t.label} className="p-5">
            <dt className="text-sm text-slate-500">{t.label}</dt>
            <dd className="mt-1 text-2xl font-bold tabular-nums">{t.value}</dd>
          </Card>
        ))}
      </dl>

      <Card className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Milestone</th>
                <th className="px-5 py-3">Amount</th>
                <th className="px-5 py-3">Money</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Next deadline</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {milestones.map((m) => {
                const d = nextDeadline(m);
                return (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4">
                      <Link href={`/m/${m.id}`} className="font-semibold text-slate-900 hover:text-teal-700">
                        {m.title}
                      </Link>
                      <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        {m.clientName}
                        {m.boughtByAgent ? <Badge tone="info">AI agent</Badge> : null}
                      </p>
                    </td>
                    <td className="px-5 py-4 font-semibold tabular-nums">{money(m.amount)}</td>
                    <td className="px-5 py-4">
                      <MiniBar m={m} />
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={m.status} />
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {d ? (
                        <span>
                          {d.label} <Countdown to={d.at} />
                        </span>
                      ) : (
                        "None"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="text-xs text-slate-500">This table becomes the AG Studio acceptance cockpit in Phase 3.</p>

      <DemoGuide step="tour" next={{ href: "/new?demo=1", label: "Start the walkthrough" }}>
        These are dummy milestones. One was bought by Sam&apos;s AI agent and has a fix window open. Start the walkthrough to create your own.
      </DemoGuide>
    </div>
  );
}
