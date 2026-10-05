"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import type { ReactNode } from "react";
import { FlowSteps } from "@/components/flow-steps";
import { CopyButton } from "@/components/motion";
import { Chip, Panel, StatusChip } from "@/components/ui";
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
      <Panel>
        <h1 className="font-display text-xl font-semibold">Milestone not found</h1>
        <p className="mt-2 text-sm text-mute">It may have been removed when the demo was reset.</p>
        <Link href="/dashboard" className="mt-4 inline-block text-sm font-semibold text-nova underline-offset-4 hover:underline">
          Back to milestones
        </Link>
      </Panel>
    );
  }
  return (
    <div className="min-w-0 space-y-8">
      <header className="space-y-5">
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-dim">
          <Link href="/dashboard" className="transition hover:text-ink">
            Milestones
          </Link>
          <span aria-hidden>/</span>
          <span className="font-mono text-xs text-mute">{m.id.toUpperCase()}</span>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-display text-3xl font-semibold tracking-tight text-balance text-ink font-stretch-semi-expanded sm:text-4xl">{m.title}</h1>
            <p className="mt-2 text-mute">
              {m.freelancerName} <span className="text-dim">· {m.freelancerLocation}</span> <span aria-hidden className="text-dim">→</span> {m.clientName}{" "}
              <span className="text-dim">·</span> <span className="font-medium text-ink">{money(m.amount)}</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {m.approval === "agent" ? (
              <Chip tone="brand" dot>
                Agent approves releases
              </Chip>
            ) : null}
            <StatusChip status={m.status} />
          </div>
        </div>
        <FlowSteps status={m.status} />
        <p className="flex flex-wrap items-center gap-1.5 text-xs text-dim">
          Spec hash <span className="font-mono text-mute">{shortHash(m.specHash)}</span>
          <CopyButton value={m.specHash} />
          <span>· frozen when funded</span>
        </p>
      </header>
      {children(m)}
    </div>
  );
}
