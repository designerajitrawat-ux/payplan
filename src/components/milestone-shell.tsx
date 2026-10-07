"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import type { ReactNode } from "react";
import { FlowSteps } from "@/components/flow-steps";
import { CopyButton } from "@/components/motion";
import { Chip, InfoTip, Panel, StatusChip } from "@/components/ui";
import { money, shortHash } from "@/lib/format";
import { useMilestone, useMilestoneLoad } from "@/lib/store";
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
  const load = useMilestoneLoad(id);
  if (!m && load === "loading") {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading the milestone">
        <div className="h-4 w-40 animate-pulse rounded bg-white/10" />
        <div className="h-10 w-2/3 animate-pulse rounded-xl bg-white/10" />
        <div className="h-24 animate-pulse rounded-3xl bg-white/[0.06]" />
        <div className="h-64 animate-pulse rounded-3xl bg-white/[0.06]" />
      </div>
    );
  }
  if (!m) {
    return (
      <Panel>
        <h1 className="font-display text-xl font-semibold">Milestone not found</h1>
        <p className="mt-2 text-sm text-mute">It may belong to another browser, or it was removed when the demo was reset.</p>
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
          <Link href="/dashboard" className="inline-flex min-h-7 items-center transition hover:text-ink">
            Milestones
          </Link>
          <span aria-hidden>/</span>
          <span className="font-mono text-xs text-mute">{m.displayId ?? m.id.toUpperCase()}</span>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-semibold tracking-tight text-balance text-ink font-stretch-semi-expanded sm:text-4xl">{m.title}</h1>
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
          Agreement ID <span className="font-mono text-mute">{shortHash(m.specHash)}</span>
          <InfoTip label="Agreement ID">A fingerprint of the criteria, weights and amount. It is locked when the client funds, so nobody can change the deal afterwards.</InfoTip>
          <CopyButton value={m.specHash} />
          <span>· locked when funded</span>
        </p>
      </header>
      {children(m)}
    </div>
  );
}
