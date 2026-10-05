"use client";

import Link from "next/link";
import { OrbitRing } from "@/components/cosmos";
import { DemoGuide } from "@/components/demo-guide";
import { NumberTicker, trackSpotlight } from "@/components/motion";
import { Countdown, When } from "@/components/time";
import { Arrow, Avatar, ButtonLink, Chip, Eyebrow, Panel, StatusChip } from "@/components/ui";
import { activityFor, type Actor } from "@/lib/activity";
import { ledgerTotals } from "@/lib/decision";
import { money } from "@/lib/format";
import { useMilestones } from "@/lib/store";
import { stagger } from "@/lib/style";
import type { Milestone } from "@/lib/types";

function nextDeadline(m: Milestone): { label: string; at?: string } | null {
  if (m.status === "awaiting_decision") return { label: "Auto-release in", at: m.decisionDueAt };
  if (m.status === "fix_window") return { label: "Fix due in", at: m.fixDueAt };
  return null;
}

const actorDot: Record<Actor, string> = {
  freelancer: "bg-sun",
  client: "bg-ice",
  agent: "bg-nova",
  verifier: "bg-nova",
  paypal: "bg-mint",
};

export default function Dashboard() {
  const milestones = useMilestones();
  const totals = milestones.map((m) => ledgerTotals(m.ledger));
  const held = totals.reduce((s, t) => s + t.held, 0);
  const released = totals.reduce((s, t) => s + t.captured, 0);
  const waitingOnYou = milestones.filter((m) => m.status === "funded" || m.status === "fix_window").length;
  const agentReleases = milestones.filter((m) => m.agentDecision?.outcome === "released");
  const agentPaid = agentReleases.reduce((s, m) => s + (m.agentDecision?.amount ?? 0), 0);
  const activity = milestones
    .flatMap((m) => activityFor(m).map((a) => ({ ...a, milestone: m })))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, 7);

  return (
    <div className="min-w-0 space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>Riya Sharma · product designer, Pune</Eyebrow>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight font-stretch-semi-expanded">Milestones</h1>
        </div>
        <ButtonLink href="/new" className="group">
          New milestone
          <Arrow />
        </ButtonLink>
      </div>

      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div onMouseMove={trackSpotlight} className="spotlight glass rise relative overflow-hidden rounded-3xl p-6 sm:col-span-2" style={stagger(0)}>
          <dt className="flex items-center gap-2 text-sm text-mute">
            <span className="size-2 rounded-full bg-mint glow-dot" />
            Released to you
          </dt>
          <dd className="mt-3 font-display text-5xl font-semibold tracking-tight text-ink font-stretch-semi-expanded">
            <NumberTicker value={released} from={0} duration={1400} />
          </dd>
          <dd className="mt-2 text-sm text-dim">Captured on PayPal after the AI verified the work</dd>
          <span aria-hidden className="absolute -bottom-24 -right-16 size-64 rounded-full border border-mint/10" />
          <span aria-hidden className="absolute -bottom-12 -right-4 size-40 rounded-full border border-mint/15" />
        </div>
        <div className="glass rise rounded-3xl p-6" style={stagger(1)}>
          <dt className="flex items-center gap-2 text-sm text-mute">
            <span className="size-2 rounded-full bg-ice glow-dot" />
            Held on clients&apos; PayPal
          </dt>
          <dd className="mt-3 font-display text-3xl font-semibold text-ink">
            <NumberTicker value={held} from={0} duration={1200} />
          </dd>
          <dd className="mt-2 text-xs text-dim">
            Locked, not charged · {waitingOnYou} waiting on you
          </dd>
        </div>
        <div className="glass rise rounded-3xl p-6" style={stagger(2)}>
          <dt className="flex items-center gap-2 text-sm text-mute">
            <span className="size-2 rounded-full bg-nova glow-dot" />
            Paid by AI agents
          </dt>
          <dd className="mt-3 font-display text-3xl font-semibold text-ink">
            <NumberTicker value={agentPaid} from={0} duration={1200} />
          </dd>
          <dd className="mt-2 text-xs text-dim">
            {agentReleases.length} release{agentReleases.length === 1 ? "" : "s"} decided by an agent
          </dd>
        </div>
      </dl>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section aria-label="All milestones" className="min-w-0 space-y-3">
          {milestones.map((m, i) => {
            const t = ledgerTotals(m.ledger);
            const d = nextDeadline(m);
            return (
              <Link
                key={m.id}
                href={`/m/${m.id}`}
                onMouseMove={trackSpotlight}
                className="spotlight glass rise group flex flex-wrap items-center gap-x-5 gap-y-3 rounded-3xl p-5 transition hover:border-white/15"
                style={stagger(i + 3)}
              >
                <div className="relative shrink-0">
                  <OrbitRing captured={t.captured} held={t.held || (t.authorized ? 0 : m.amount)} voided={t.voided} />
                </div>
                <div className="min-w-0 flex-1 basis-48">
                  <p className="truncate font-medium text-ink">{m.title}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-dim">
                    {m.clientName}
                    {m.boughtByAgent || m.approval === "agent" ? (
                      <Chip tone="brand">{m.boughtByAgent ? "Bought by an agent" : "Agent approves"}</Chip>
                    ) : null}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-2">
                  <div className="text-right">
                    <p className="font-sans text-lg font-semibold text-ink font-stretch-semi-expanded">{money(m.amount)}</p>
                    <p className="text-xs text-dim">{t.captured ? `${money(t.captured)} released` : t.authorized ? "On hold" : "Not funded"}</p>
                  </div>
                  <div className="flex w-44 flex-col items-start gap-1">
                    <StatusChip status={m.status} />
                    {d ? (
                      <span className="pl-1 text-xs text-dim">
                        {d.label} <Countdown to={d.at} />
                      </span>
                    ) : null}
                  </div>
                  <Arrow className="size-4 text-dim" />
                </div>
              </Link>
            );
          })}
        </section>

        <Panel as="aside" className="min-w-0 self-start p-5">
          <Eyebrow>Activity</Eyebrow>
          <ol className="mt-4 space-y-4">
            {activity.map((a, i) => (
              <li key={`${a.milestone.id}-${i}`} className="flex gap-3 text-[13px]">
                <span className={`mt-1.5 size-1.5 shrink-0 rounded-full ${actorDot[a.actor]} glow-dot`} />
                <div className="min-w-0">
                  <p className="text-ink">
                    <span className="font-medium">{a.who}</span> <span className="text-mute">{a.text}</span>
                  </p>
                  <p className="mt-0.5 flex gap-1 text-xs text-dim">
                    <span className="truncate">{a.milestone.title}</span>
                    <span className="shrink-0">
                      · <When at={a.at} />
                    </span>
                  </p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-5 flex items-center gap-2 border-t border-white/[0.06] pt-4 text-xs text-dim">
            <Avatar name="Riya Sharma" kind="freelancer" size="sm" />
            Signed in as Riya · freelancer
          </div>
        </Panel>
      </div>

      <DemoGuide step="tour" next={{ href: "/new?demo=1", label: "Start the walkthrough" }}>
        These are example milestones. One was bought by Sam&apos;s AI agent, which released the verified 80% on its own. Start the walkthrough to create your own.
      </DemoGuide>
    </div>
  );
}
