"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import type { CSSProperties } from "react";
import { DemoGuide } from "@/components/demo-guide";
import { NumberTicker } from "@/components/motion";
import { When } from "@/components/time";
import { Arrow, Avatar, ButtonLink, Chip, Eyebrow, Panel, Toggle } from "@/components/ui";
import { landingPagePreset } from "@/lib/criteria-presets";
import { agentReview } from "@/lib/decision";
import { money } from "@/lib/format";
import { updateMandate, useMandate, useMilestones } from "@/lib/store";
import type { Criterion } from "@/lib/types";

const tools = [
  { name: "create_milestone", body: "Proposes criteria and an amount for a job" },
  { name: "fund_milestone", body: "Asks the owner to approve one PayPal hold" },
  { name: "get_report", body: "Reads the signed acceptance report" },
  { name: "release_verified", body: "Captures the verified share, within limits" },
  { name: "hand_back", body: "Returns the decision to the owner" },
];

// A sample report for the live preview: the Northwind landing page, 4 of 5 criteria passed.
const sampleCriteria: Criterion[] = landingPagePreset.map((c, i) => ({ ...c, id: `sample-${i}` }));
const sampleResults = sampleCriteria.map((c) => ({ criterionId: c.id, ...c.demo.first }));

/** How much of the agent's limit this release uses; over the dashed cap line it turns red and shakes. */
function SpendBar({ amount, limit }: { amount: number; limit: number }) {
  const scale = Math.max(limit, amount) * 1.2;
  const over = amount > limit;
  return (
    <div className="mt-5">
      <div className="flex justify-between text-[11px] text-dim">
        <span>
          This release <span className={over ? "text-flare" : "text-ink"}>{money(amount)}</span>
        </span>
        <span>Limit {money(limit)}</span>
      </div>
      <motion.div key={over ? "over" : "ok"} animate={over ? { x: [0, -5, 5, -3, 0] } : { x: 0 }} transition={{ duration: 0.4 }} className="relative mt-2 h-3 rounded-full bg-white/[0.06]">
        <motion.div
          className={`absolute inset-y-0 left-0 rounded-full ${over ? "bg-flare shadow-[0_0_16px_var(--color-flare)]" : "bg-mint shadow-[0_0_16px_rgba(79,227,176,0.6)]"}`}
          initial={false}
          animate={{ width: `${(amount / scale) * 100}%` }}
          transition={{ type: "spring", bounce: 0.25, duration: 0.6 }}
        />
        <motion.span
          aria-hidden
          className="absolute -inset-y-1.5 w-0 border-l-2 border-dashed border-ink/70"
          initial={false}
          animate={{ left: `${(limit / scale) * 100}%` }}
          transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
        />
      </motion.div>
      {over ? <p className="mt-2 text-xs text-flare">Over the limit: this one needs {"Sam's"} approval.</p> : null}
    </div>
  );
}

function fill(value: number, min: number, max: number) {
  return { "--fill": `${((value - min) / (max - min)) * 100}%` } as CSSProperties;
}

export default function AgentsPage() {
  const mandate = useMandate();
  const milestones = useMilestones();
  const decisions = milestones.filter((m) => m.agentDecision).map((m) => ({ m, d: m.agentDecision! }));
  const preview = agentReview(sampleCriteria, sampleResults, 1000, mandate);
  const blocking = preview.checks.filter((c) => !c.ok);

  return (
    <div className="min-w-0 space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>Agentic commerce</Eyebrow>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight font-stretch-semi-expanded">Agents</h1>
          <p className="mt-2 max-w-xl text-mute">Let an AI agent buy and pay for verified work, inside limits you set. People keep the final word on anything uncertain.</p>
        </div>
        <Chip tone="good" dot pulse>
          1 agent active
        </Chip>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-6">
          <Panel interactive className="p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-4">
              <Avatar name={mandate.name} kind="agent" />
              <div className="min-w-0 flex-1">
                <p className="font-display text-xl font-semibold text-ink">{mandate.name}</p>
                <p className="text-sm text-dim">Acts for {mandate.owner} · connects over MCP</p>
              </div>
              <Chip tone="brand">Client side</Chip>
            </div>

            <div className="mt-8 grid gap-8 sm:grid-cols-2">
              <div>
                <label htmlFor="limit" className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-mute">Limit per milestone</span>
                  <span className="font-display text-2xl font-semibold text-ink">
                    <NumberTicker value={mandate.perMilestoneLimit} duration={300} format={(n) => money(Math.round(n)).replace(".00", "")} />
                  </span>
                </label>
                <input
                  id="limit"
                  type="range"
                  min={100}
                  max={5000}
                  step={100}
                  value={mandate.perMilestoneLimit}
                  onChange={(e) => updateMandate({ perMilestoneLimit: Number(e.target.value) })}
                  className="range mt-4"
                  style={fill(mandate.perMilestoneLimit, 100, 5000)}
                />
              </div>
              <div>
                <label htmlFor="confidence" className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-mute">Minimum AI confidence</span>
                  <span className="font-display text-2xl font-semibold text-ink">{Math.round(mandate.minConfidence * 100)}%</span>
                </label>
                <input
                  id="confidence"
                  type="range"
                  min={50}
                  max={99}
                  step={1}
                  value={Math.round(mandate.minConfidence * 100)}
                  onChange={(e) => updateMandate({ minConfidence: Number(e.target.value) / 100 })}
                  className="range mt-4"
                  style={fill(mandate.minConfidence * 100, 50, 99)}
                />
              </div>
            </div>

            <ul className="mt-8 divide-y divide-white/[0.06] border-t border-white/[0.06]">
              <li className="flex items-center justify-between gap-4 py-4">
                <span>
                  <span className="block text-sm text-ink">Release verified work</span>
                  <span className="block text-xs text-dim">Capture the share the AI verified, from the PayPal hold</span>
                </span>
                <Toggle checked={mandate.releaseVerified} onChange={(v) => updateMandate({ releaseVerified: v })} label="Release verified work" />
              </li>
              <li className="flex items-center justify-between gap-4 py-4">
                <span>
                  <span className="block text-sm text-ink">Fund new milestones</span>
                  <span className="block text-xs text-dim">{mandate.owner} still approves each PayPal hold once</span>
                </span>
                <Toggle checked={mandate.fundMilestones} onChange={(v) => updateMandate({ fundMilestones: v })} label="Fund new milestones" />
              </li>
              <li className="flex items-center justify-between gap-4 py-4 opacity-60">
                <span>
                  <span className="block text-sm text-ink">Open or settle appeals</span>
                  <span className="block text-xs text-dim">Always a person. Agents can never appeal or settle one.</span>
                </span>
                <span className="font-mono text-[11px] uppercase tracking-widest text-dim">Locked</span>
              </li>
            </ul>
            <p className="mt-4 rounded-2xl border border-ice/20 bg-ice/[0.05] p-3.5 text-xs leading-relaxed text-ice">
              The PayPal authorization stays the hard ceiling: the agent can never capture more than {mandate.owner.split(" ")[0]} approved on PayPal.
            </p>
          </Panel>

          <Panel>
            <Eyebrow>Tools it can call</Eyebrow>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {tools.map((t) => (
                <li key={t.name} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3.5">
                  <p className="font-mono text-xs text-nova">{t.name}</p>
                  <p className="mt-1 text-xs text-mute">{t.body}</p>
                </li>
              ))}
            </ul>
            <pre className="mt-5 overflow-x-auto rounded-2xl border border-white/[0.06] bg-void/70 p-4 font-mono text-xs leading-relaxed text-mute">
              <span className="text-nova">release_verified</span>({"{"} milestone: <span className="text-sun">&quot;m-1051&quot;</span>, max: <span className="text-sun">{mandate.perMilestoneLimit}</span> {"}"})
            </pre>
          </Panel>
        </div>

        <aside className="min-w-0 space-y-6">
          <Panel className={preview.approved ? "border-mint/20" : "border-flare/25"}>
            <Eyebrow>Live preview</Eyebrow>
            <p className="mt-2 text-sm text-mute">With these limits, on a $1,000 landing page where 4 of 5 criteria passed, the agent would:</p>
            <div className="mt-4 h-9 overflow-hidden">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.p
                  key={preview.approved ? "go" : "back"}
                  initial={{ y: 28, opacity: 0, filter: "blur(6px)" }}
                  animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
                  exit={{ y: -28, opacity: 0, filter: "blur(6px)" }}
                  transition={{ type: "spring", bounce: 0.25, duration: 0.5 }}
                  className={`font-sans text-2xl font-semibold font-stretch-semi-expanded ${preview.approved ? "text-mint" : "text-flare"}`}
                >
                  {preview.approved ? `Release ${money(preview.releasable)}` : "Hand it back to you"}
                </motion.p>
              </AnimatePresence>
            </div>
            <SpendBar amount={preview.releasable} limit={mandate.perMilestoneLimit} />
            <ul className="mt-5 space-y-2 text-xs">
              {preview.checks.map((c) => (
                <li key={c.label} className="flex items-start justify-between gap-3">
                  <span className="text-mute">{c.label}</span>
                  <motion.span key={String(c.ok)} initial={{ scale: 1.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", bounce: 0.5, duration: 0.4 }} className={`shrink-0 font-mono ${c.ok ? "text-mint" : "text-flare"}`}>
                    {c.ok ? "GO" : "NO-GO"}
                  </motion.span>
                </li>
              ))}
            </ul>
            {blocking.length ? <p className="mt-4 text-xs text-flare">{blocking.map((c) => c.detail).join(". ")}.</p> : null}
          </Panel>

          <Panel>
            <Eyebrow>Decisions so far</Eyebrow>
            {decisions.length === 0 ? (
              <p className="mt-3 text-sm text-dim">No decisions yet.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {decisions.map(({ m, d }) => (
                  <li key={m.id}>
                    <Link href={`/m/${m.id}/report`} className="group flex items-center justify-between gap-3 rounded-2xl p-2 -m-2 transition hover:bg-white/[0.03]">
                      <span className="min-w-0">
                        <span className="block truncate text-sm text-ink">{m.title}</span>
                        <span className="block text-xs text-dim">
                          {d.outcome === "released" ? `Released ${money(d.amount)}` : "Handed back"} · <When at={d.at} />
                        </span>
                      </span>
                      <Arrow className="size-4 text-dim" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <ButtonLink href="/new?demo=1" variant="secondary" size="sm" className="group mt-5 w-full">
              Watch it decide in the walkthrough
              <Arrow className="size-3.5" />
            </ButtonLink>
          </Panel>
        </aside>
      </div>

      <DemoGuide step="tour">
        Move the sliders and watch the live preview flip between <strong>release</strong> and <strong>hand back</strong>. Try a confidence above 88%.
      </DemoGuide>
    </div>
  );
}
