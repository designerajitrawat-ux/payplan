"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import type { ReactNode } from "react";
import { FlowSteps } from "@/components/flow-steps";
import { Badge, Card, StatusBadge } from "@/components/ui";
import { money, shortHash } from "@/lib/format";
import { useMilestone } from "@/lib/store";
import type { Milestone } from "@/lib/types";

/** Short names for buttons and walkthrough text, e.g. "Continue as Sam". */
export function partyNames(m: Milestone) {
  return {
    client: m.boughtByAgent ? "the buyer agent" : m.clientName.split(" ")[0],
    freelancer: m.freelancerName.split(" ")[0],
  };
}

export function useMilestoneId(): string {
  const params = useParams<{ id: string }>();
  return params.id;
}

/** Common frame for every milestone page: title, parties, status and the six-step progress. */
export function MilestoneShell({ children }: { children: (m: Milestone) => ReactNode }) {
  const id = useMilestoneId();
  const m = useMilestone(id);
  if (!m) {
    return (
      <Card>
        <h1 className="text-xl font-semibold">Milestone not found</h1>
        <p className="mt-2 text-sm text-slate-600">It may have been removed when the demo was reset.</p>
        <Link href="/dashboard" className="mt-4 inline-block font-semibold text-teal-700 underline">
          Back to milestones
        </Link>
      </Card>
    );
  }
  return (
    <div className="min-w-0 space-y-6">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
          <Link href="/dashboard" className="hover:text-slate-900">
            Milestones
          </Link>
          <span aria-hidden>/</span>
          <span className="font-mono text-xs">{m.id.toUpperCase()}</span>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{m.title}</h1>
            <p className="mt-1 text-slate-600">
              {m.freelancerName} ({m.freelancerLocation}) for {m.clientName} · {money(m.amount)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {m.boughtByAgent ? <Badge tone="info">Bought by an AI agent</Badge> : null}
            <StatusBadge status={m.status} />
          </div>
        </div>
        <FlowSteps status={m.status} />
        <p className="text-xs text-slate-500">
          Spec hash <span className="font-mono">{shortHash(m.specHash)}</span> · frozen when funded
        </p>
      </div>
      {children(m)}
    </div>
  );
}
