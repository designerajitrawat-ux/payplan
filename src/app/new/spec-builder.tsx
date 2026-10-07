"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { DemoGuide } from "@/components/demo-guide";
import { Arrow, Button, Chip, Eyebrow, Field, Panel, RoleChip, Toggle, inputClass } from "@/components/ui";
import { useAction } from "@/components/use-action";
import { genericCriterion, suggestCriteria } from "@/lib/criteria-presets";
import { money } from "@/lib/format";
import { createMilestone } from "@/lib/store";
import type { Criterion, EvidenceType } from "@/lib/types";

type Draft = Omit<Criterion, "id"> & { key: number };

const DEMO_BRIEF =
  "Landing page for Northwind's new budgeting app. Use the approved headline \"Know where every rupee goes\" and the button \"Join the waitlist\". Must work on phones, include a working contact form, and follow our style guide (colours and logo attached).";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  const { pending, run } = useAction();
  const [criteria, setCriteria] = useState<Draft[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [draftNote, setDraftNote] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);

  const totalWeight = criteria.reduce((s, c) => s + (Number.isFinite(c.weight) ? c.weight : 0), 0);
  const hasGate = criteria.some((c) => c.mustPass);
  const errors = {
    title: !title.trim() ? "Add a milestone title." : null,
    clientEmail: !EMAIL.test(clientEmail.trim()) ? "Enter the client's email, like sam@company.com. The PayPal funding link goes there." : null,
    amount: !(amount > 0) ? "Set an amount above $0." : null,
    criteria:
      criteria.length === 0
        ? "Add at least one criterion."
        : criteria.some((c) => !c.title.trim())
          ? "Every criterion needs a title."
          : totalWeight !== 100
            ? `Weights add up to ${totalWeight}%. They must total 100%.`
            : null,
  };
  const problems = Object.values(errors).filter(Boolean) as string[];

  function suggest(mode: "replace" | "add" = "replace") {
    if (mode === "replace" && criteria.length > 0 && !confirmReplace) {
      setConfirmReplace(true);
      return;
    }
    setConfirmReplace(false);
    setSuggesting(true);
    setDraftNote(null);
    if (mode === "replace") setCriteria([]);
    setTimeout(() => {
      const suggestion = suggestCriteria(brief);
      const drafted = suggestion.criteria.map((c) => ({ ...c, key: nextKey++ }));
      setCriteria((list) => (mode === "add" ? [...list, ...drafted] : drafted));
      setDraftNote(
        suggestion.kind === "general"
          ? "This brief did not match a template, so the AI drafted general criteria. Edit them so they describe this job."
          : mode === "add"
            ? "Drafted criteria were added below yours. Use Split evenly to fix the weights."
            : "Drafted from the brief. Check the wording and the weights before you create.",
      );
      setSuggesting(false);
    }, 1200);
  }

  function addCriterion() {
    // A new criterion starts with whatever weight is still unassigned.
    setCriteria((list) => [...list, { ...genericCriterion(""), weight: Math.max(0, 100 - list.reduce((s, c) => s + c.weight, 0)), key: nextKey++ }]);
  }

  function tryCreate() {
    if (problems.length > 0) {
      setShowErrors(true);
      const first = errors.title ? "f-title" : errors.clientEmail ? "f-email" : errors.amount ? "f-amount" : "f-criteria";
      document.getElementById(first)?.focus();
      return;
    }
    void create();
  }

  /** Gives every criterion the same weight; any remainder goes to the first ones so the total is exactly 100. */
  function splitEvenly() {
    setCriteria((list) => {
      const base = Math.floor(100 / list.length);
      const extra = 100 - base * list.length;
      return list.map((c, i) => ({ ...c, weight: base + (i < extra ? 1 : 0) }));
    });
  }

  function change(key: number, patch: Partial<Draft>) {
    setCriteria((list) => list.map((c) => (c.key === key ? { ...c, ...patch } : c)));
  }

  async function create() {
    let id = "";
    const ok = await run(async () => {
      id = await createMilestone(
        {
          title: title.trim(),
          brief: brief.trim() || undefined,
          clientName: clientName.trim() || "Client",
          clientEmail: clientEmail.trim(),
          amount,
          reviewWindowHours,
          criteria: criteria.map(withoutKey),
        },
        demo,
      );
    }, "Could not create the milestone");
    if (ok) router.push(`/m/${id}/fund`);
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
                <Field label="Milestone title" error={showErrors ? errors.title : null}>
                  <input id="f-title" className={inputClass} aria-invalid={showErrors && !!errors.title} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Landing page for …" />
                </Field>
              </div>
              <Field label="Client name">
                <input className={inputClass} value={clientName} onChange={(e) => setClientName(e.target.value)} />
              </Field>
              <Field label="Client email" hint="The PayPal funding link goes here." error={showErrors ? errors.clientEmail : null}>
                <input id="f-email" className={inputClass} type="email" inputMode="email" autoComplete="email" aria-invalid={showErrors && !!errors.clientEmail} value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="sam@company.com" />
              </Field>
              <Field label="Amount (USD)" error={showErrors ? errors.amount : null}>
                <input id="f-amount" className={inputClass} type="number" inputMode="decimal" min={1} aria-invalid={showErrors && !!errors.amount} value={amount || ""} onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))} placeholder="1000" />
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
            <Button className="mt-4" variant="agent" onClick={() => suggest("replace")} disabled={suggesting || !brief.trim()}>
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
            {confirmReplace ? (
              <div role="alertdialog" aria-label="Replace your criteria?" className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-sun/25 bg-sun/[0.06] p-3.5 text-sm">
                <span className="mr-auto text-ink">You already have {criteria.length} criteria. Replace them?</span>
                <Button size="sm" variant="secondary" onClick={() => suggest("add")}>
                  Add to mine
                </Button>
                <Button size="sm" variant="danger" onClick={() => suggest("replace")}>
                  Replace
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmReplace(false)}>
                  Cancel
                </Button>
              </div>
            ) : null}
            {draftNote ? (
              <p role="status" className="mt-3 flex gap-2 text-[13px] text-mute">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-nova" />
                {draftNote}
              </p>
            ) : null}
          </Panel>

          <Panel>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="f-criteria" tabIndex={-1} className="font-display text-lg font-semibold outline-none">
                Acceptance criteria
              </h2>
              <span className="flex items-center gap-2">
                <span className={`font-mono text-xs tabular-nums ${totalWeight === 100 ? "text-mint" : "text-sun"}`}>Weights: {totalWeight}% of 100%</span>
                {criteria.length > 0 && totalWeight !== 100 ? (
                  <Button variant="secondary" size="sm" onClick={splitEvenly}>
                    Split evenly
                  </Button>
                ) : null}
              </span>
            </div>
            <p className="mt-1 text-sm text-mute">
              Each passed criterion releases its weight. A <span className="text-ink">must-pass</span> criterion that fails releases nothing until it is fixed.
            </p>

            {showErrors && errors.criteria ? (
              <p role="alert" className="mt-3 text-[13px] font-medium text-flare">
                {errors.criteria}
              </p>
            ) : null}
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
                          <div className="grid grid-cols-1 gap-3 text-[13px] sm:flex sm:flex-wrap sm:items-center sm:gap-x-4">
                            <label className="flex items-center gap-2">
                              <span className="whitespace-nowrap text-dim">Evidence</span>
                              <select className={`${inputClass} w-full py-1.5 sm:w-auto`} value={c.evidence} onChange={(e) => change(c.key, { evidence: e.target.value as EvidenceType })}>
                                {Object.entries(evidenceLabels).map(([value, label]) => (
                                  <option key={value} value={value}>
                                    {label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="flex items-center gap-2">
                              <span className="whitespace-nowrap text-dim">Checked by</span>
                              <select className={`${inputClass} w-full py-1.5 sm:w-auto`} value={c.check} onChange={(e) => change(c.key, { check: e.target.value as Draft["check"] })}>
                                <option value="automatic">Automatic test</option>
                                <option value="ai">AI rubric</option>
                              </select>
                            </label>
                            <label className="flex items-center gap-2">
                              <span className="whitespace-nowrap text-dim">Weight</span>
                              <input className={`${inputClass} w-20 py-1.5`} type="number" min={0} max={100} value={c.weight} onChange={(e) => change(c.key, { weight: Math.min(100, Math.max(0, Math.round(Number(e.target.value) || 0))) })} />
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
            <Button className="mt-4" variant="ghost" size="sm" onClick={addCriterion}>
              + Add criterion
            </Button>
          </Panel>
        </div>

        <aside className="min-w-0 lg:sticky lg:top-8 lg:self-start">
          <Panel>
            <Eyebrow>Summary</Eyebrow>
            <p className="mt-3 font-sans text-4xl font-semibold tracking-tight text-ink font-stretch-semi-expanded">
              {money(amount || 0)}
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
              <ul id="create-status" className="mt-5 space-y-1.5 rounded-2xl border border-sun/20 bg-sun/[0.06] p-3.5 text-xs text-sun">
                {problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            ) : !hasGate ? (
              <p className="mt-5 rounded-2xl border border-ice/20 bg-ice/[0.06] p-3.5 text-xs text-ice">Tip: mark at least one criterion as must-pass, such as &quot;every deliverable is handed over&quot;.</p>
            ) : (
              <p className="mt-5 rounded-2xl border border-mint/20 bg-mint/[0.06] p-3.5 text-xs text-mint">Ready. {money(amount)} splits across {criteria.length} criteria.</p>
            )}
            <Button className="group mt-5 w-full" size="lg" onClick={tryCreate} disabled={pending} aria-describedby="create-status">
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
