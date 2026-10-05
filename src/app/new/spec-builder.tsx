"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { DemoGuide } from "@/components/demo-guide";
import { NumberTicker } from "@/components/motion";
import { Arrow, Button, Chip, Eyebrow, Field, Panel, RoleChip, Toggle, inputClass } from "@/components/ui";
import { genericCriterion, suggestCriteria } from "@/lib/criteria-presets";
import { money } from "@/lib/format";
import { createMilestone } from "@/lib/store";
import type { Criterion, EvidenceType } from "@/lib/types";

type Draft = Omit<Criterion, "id"> & { key: number };

const DEMO_BRIEF =
  "Landing page for Northwind's new budgeting app. Use the approved headline \"Know where every rupee goes\" and the button \"Join the waitlist\". Must work on phones, include a working contact form, and follow our style guide (colours and logo attached).";

const evidenceLabels: Record<EvidenceType, string> = {
  url: "Live URL",
  image: "Image",
  pdf: "PDF",
  github: "GitHub PR",
  text: "Text",
};

const segmentShades = ["bg-nova", "bg-nova/75", "bg-nova/55", "bg-ice/80", "bg-ice/55", "bg-mint/70", "bg-mint/45", "bg-sun/60"];

let nextKey = 1;

function withoutKey(draft: Draft): Omit<Criterion, "id"> {
  const { title, weight, mustPass, evidence, check, demo } = draft;
  return { title, weight, mustPass, evidence, check, demo };
}

export function SpecBuilder() {
  const router = useRouter();
  const demo = useSearchParams().get("demo") === "1";
  const [title, setTitle] = useState(demo ? "Landing page for Northwind" : "");
  const [clientName, setClientName] = useState(demo ? "Sam Carter" : "");
  const [clientEmail, setClientEmail] = useState(demo ? "sam@northwind.example" : "");
  const [amount, setAmount] = useState(demo ? 1000 : 0);
  const [reviewWindowHours, setReviewWindowHours] = useState(48);
  const [brief, setBrief] = useState(demo ? DEMO_BRIEF : "");
  const [criteria, setCriteria] = useState<Draft[]>([]);
  const [suggesting, setSuggesting] = useState(false);

  const totalWeight = criteria.reduce((s, c) => s + (Number.isFinite(c.weight) ? c.weight : 0), 0);
  const hasGate = criteria.some((c) => c.mustPass);
  const problems = [
    !title.trim() && "Add a milestone title.",
    !(amount > 0) && "Set an amount above $0.",
    criteria.length === 0 && "Add at least one criterion.",
    criteria.some((c) => !c.title.trim()) && "Every criterion needs a title.",
    criteria.length > 0 && totalWeight !== 100 && `Weights add up to ${totalWeight}%. They must total 100%.`,
  ].filter(Boolean) as string[];

  function suggest() {
    setSuggesting(true);
    setCriteria([]);
    setTimeout(() => {
      setCriteria(suggestCriteria(brief).map((c) => ({ ...c, key: nextKey++ })));
      setSuggesting(false);
    }, 1200);
  }

  function change(key: number, patch: Partial<Draft>) {
    setCriteria((list) => list.map((c) => (c.key === key ? { ...c, ...patch } : c)));
  }

  function create() {
    const id = createMilestone(
      {
        title: title.trim(),
        clientName: clientName.trim() || "Client",
        clientEmail: clientEmail.trim(),
        amount,
        reviewWindowHours,
        criteria: criteria.map(withoutKey),
      },
      demo,
    );
    router.push(`/m/${id}/fund`);
  }

  return (
    <div className="min-w-0 space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>Step 1 · Agree on done</Eyebrow>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight font-stretch-semi-expanded">New milestone</h1>
          <p className="mt-2 text-mute">Agree on what &quot;done&quot; means before any money moves.</p>
        </div>
        <RoleChip role="freelancer" name="Riya" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <Panel>
            <h2 className="font-display text-lg font-semibold">Basics</h2>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field label="Milestone title">
                  <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Landing page for …" />
                </Field>
              </div>
              <Field label="Client name">
                <input className={inputClass} value={clientName} onChange={(e) => setClientName(e.target.value)} />
              </Field>
              <Field label="Client email" hint="The PayPal funding link goes here.">
                <input className={inputClass} type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} />
              </Field>
              <Field label="Amount (USD)">
                <input className={inputClass} type="number" min={1} value={amount || ""} onChange={(e) => setAmount(Number(e.target.value))} />
              </Field>
              <Field label="Client review window" hint="If the client stays silent, the verified share is released after this.">
                <select className={inputClass} value={reviewWindowHours} onChange={(e) => setReviewWindowHours(Number(e.target.value))}>
                  <option value={24}>24 hours</option>
                  <option value={48}>48 hours</option>
                  <option value={72}>72 hours</option>
                </select>
              </Field>
            </div>
          </Panel>

          <Panel className={suggesting ? "beam" : ""}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-lg font-semibold">Brief</h2>
              <Chip tone="brand" dot>
                AI helper
              </Chip>
            </div>
            <p className="mt-1 text-sm text-mute">Paste the client&apos;s brief. The AI drafts criteria; you edit and approve them.</p>
            <textarea className={`${inputClass} mt-4 min-h-28 leading-relaxed`} value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="Paste the brief or message from the client…" />
            <Button className="mt-4" variant="agent" onClick={suggest} disabled={suggesting || !brief.trim()}>
              {suggesting ? (
                <>
                  <span className="size-3.5 animate-spin rounded-full border-2 border-void/25 border-t-void" aria-hidden />
                  Reading the brief…
                </>
              ) : (
                <>
                  <svg viewBox="0 0 16 16" className="size-4" aria-hidden>
                    <path d="M8 1.5l1.6 4.2 4.4 1.3-4.4 1.3L8 12.5 6.4 8.3 2 7l4.4-1.3z" fill="currentColor" />
                  </svg>
                  Draft criteria with AI
                </>
              )}
            </Button>
          </Panel>

          <Panel>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-lg font-semibold">Acceptance criteria</h2>
              <span className={`font-mono text-xs tabular-nums ${totalWeight === 100 ? "text-mint" : "text-sun"}`}>Weights: {totalWeight}% of 100%</span>
            </div>
            <p className="mt-1 text-sm text-mute">
              Each passed criterion releases its weight. A <span className="text-ink">must-pass</span> criterion that fails releases nothing until it is fixed.
            </p>

            <div className="mt-5 flex h-2 w-full gap-1 overflow-hidden rounded-full bg-white/[0.04]" aria-hidden>
              {criteria.map((c, i) => (
                <span key={c.key} className={`h-full rounded-full transition-[flex-grow] duration-700 ease-out-expo ${segmentShades[i % segmentShades.length]}`} style={{ flexGrow: Math.max(0, c.weight), flexBasis: 0 }} title={c.title} />
              ))}
              {totalWeight < 100 ? <span className="h-full" style={{ flexGrow: 100 - totalWeight, flexBasis: 0 }} /> : null}
            </div>

            {suggesting ? (
              <ul className="mt-5 space-y-3" aria-label="Drafting criteria">
                {[0, 1, 2].map((i) => (
                  <li key={i} className="shimmer h-20 rounded-2xl" />
                ))}
              </ul>
            ) : criteria.length === 0 ? (
              <p className="mt-5 rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-dim">No criteria yet. Let the AI draft them from the brief, or add one yourself.</p>
            ) : (
              <ul className="mt-5 space-y-3">
                <AnimatePresence initial={false}>
                  {criteria.map((c, i) => (
                    <motion.li
                      key={c.key}
                      layout
                      initial={{ opacity: 0, y: 16, filter: "blur(6px)" }}
                      animate={{ opacity: 1, y: 0, filter: "blur(0px)", transition: { type: "spring", bounce: 0.2, duration: 0.6, delay: i * 0.07 } }}
                      exit={{ opacity: 0, x: -24, transition: { duration: 0.2 } }}
                      className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4"
                    >
                      <div className="flex items-start gap-3">
                        <span className={`mt-2.5 size-2 shrink-0 rounded-full ${segmentShades[i % segmentShades.length]}`} />
                        <div className="min-w-0 flex-1 space-y-3">
                          <input className={inputClass} aria-label={`Criterion ${i + 1} title`} value={c.title} onChange={(e) => change(c.key, { title: e.target.value })} placeholder="What must be true?" />
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-3 text-[13px]">
                            <label className="flex items-center gap-2">
                              <span className="whitespace-nowrap text-dim">Evidence</span>
                              <select className={`${inputClass} w-auto py-1.5`} value={c.evidence} onChange={(e) => change(c.key, { evidence: e.target.value as EvidenceType })}>
                                {Object.entries(evidenceLabels).map(([value, label]) => (
                                  <option key={value} value={value}>
                                    {label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="flex items-center gap-2">
                              <span className="whitespace-nowrap text-dim">Checked by</span>
                              <select className={`${inputClass} w-auto py-1.5`} value={c.check} onChange={(e) => change(c.key, { check: e.target.value as Draft["check"] })}>
                                <option value="automatic">Automatic test</option>
                                <option value="ai">AI rubric</option>
                              </select>
                            </label>
                            <label className="flex items-center gap-2">
                              <span className="whitespace-nowrap text-dim">Weight</span>
                              <input className={`${inputClass} w-20 py-1.5`} type="number" min={0} max={100} value={c.weight} onChange={(e) => change(c.key, { weight: Number(e.target.value) })} />
                              <span className="text-dim">%</span>
                            </label>
                            <span className="flex items-center gap-2">
                              <Toggle checked={c.mustPass} onChange={(v) => change(c.key, { mustPass: v })} label={`Criterion ${i + 1} must pass`} tone="mint" />
                              <span className="text-mute">Must pass</span>
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setCriteria((list) => list.filter((x) => x.key !== c.key))}
                          className="rounded-lg p-2 text-dim transition hover:bg-flare/10 hover:text-flare"
                          aria-label={`Remove criterion ${i + 1}`}
                        >
                          <svg viewBox="0 0 16 16" className="size-4" aria-hidden>
                            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                          </svg>
                        </button>
                      </div>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            )}
            <Button className="mt-4" variant="ghost" size="sm" onClick={() => setCriteria((list) => [...list, { ...genericCriterion(""), key: nextKey++ }])}>
              + Add criterion
            </Button>
          </Panel>
        </div>

        <aside className="min-w-0 lg:sticky lg:top-8 lg:self-start">
          <Panel>
            <Eyebrow>Summary</Eyebrow>
            <p className="mt-3 font-display text-4xl font-semibold tracking-tight text-ink font-stretch-semi-expanded">
              <NumberTicker value={amount || 0} duration={500} />
            </p>
            <dl className="mt-5 space-y-2.5 text-sm">
              {[
                ["Criteria", String(criteria.length)],
                ["Must-pass gates", String(criteria.filter((c) => c.mustPass).length)],
                ["Review window", `${reviewWindowHours} hours`],
                ["Fix window", "72 hours"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className="text-dim">{k}</dt>
                  <dd className="font-medium text-ink">{v}</dd>
                </div>
              ))}
            </dl>
            {problems.length > 0 ? (
              <ul className="mt-5 space-y-1.5 rounded-2xl border border-sun/20 bg-sun/[0.06] p-3.5 text-xs text-sun">
                {problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            ) : !hasGate ? (
              <p className="mt-5 rounded-2xl border border-ice/20 bg-ice/[0.06] p-3.5 text-xs text-ice">Tip: mark at least one criterion as must-pass, such as &quot;page is live&quot;.</p>
            ) : (
              <p className="mt-5 rounded-2xl border border-mint/20 bg-mint/[0.06] p-3.5 text-xs text-mint">Ready. {money(amount)} splits across {criteria.length} criteria.</p>
            )}
            <Button className="group mt-5 w-full" size="lg" onClick={create} disabled={problems.length > 0}>
              Create and get funding link
              <Arrow />
            </Button>
            <p className="mt-3 text-xs leading-relaxed text-dim">The spec is frozen and hashed once the client funds it. Changes after that need a new milestone.</p>
          </Panel>
        </aside>
      </div>

      {demo ? (
        <DemoGuide step={1}>
          You are <strong>Riya, the freelancer</strong>. Press <strong>Draft criteria with AI</strong>, check the weights add up to 100%, then press <strong>Create and get funding link</strong>.
        </DemoGuide>
      ) : null}
    </div>
  );
}
