"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { DemoGuide } from "@/components/demo-guide";
import { Badge, Button, Card, Field, RoleChip, inputClass } from "@/components/ui";
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
    setTimeout(() => {
      setCriteria(suggestCriteria(brief).map((c) => ({ ...c, key: nextKey++ })));
      setSuggesting(false);
    }, 900);
  }

  function change(key: number, patch: Partial<Draft>) {
    setCriteria((list) => list.map((c) => (c.key === key ? { ...c, ...patch } : c)));
  }

  function create() {
    const id = createMilestone({
      title: title.trim(),
      clientName: clientName.trim() || "Client",
      clientEmail: clientEmail.trim(),
      amount,
      reviewWindowHours,
      criteria: criteria.map(withoutKey),
    }, demo);
    router.push(`/m/${id}/fund`);
  }

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">New milestone</h1>
          <p className="mt-1 text-slate-600">Agree on what &quot;done&quot; means before any money moves.</p>
        </div>
        <RoleChip role="freelancer" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <h2 className="font-semibold">Basics</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field label="Milestone title">
                  <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Landing page for …" />
                </Field>
              </div>
              <Field label="Client name">
                <input className={inputClass} value={clientName} onChange={(e) => setClientName(e.target.value)} />
              </Field>
              <Field label="Client email" hint="We send the PayPal funding link here.">
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
          </Card>

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold">Brief</h2>
              <Badge tone="brand">AI helper</Badge>
            </div>
            <p className="mt-1 text-sm text-slate-600">Paste the client&apos;s brief. The AI suggests criteria; you edit and approve them.</p>
            <textarea className={`${inputClass} mt-3 min-h-28`} value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="Paste the brief or message from the client…" />
            <Button className="mt-3" variant="secondary" onClick={suggest} disabled={suggesting || !brief.trim()}>
              {suggesting ? "Reading the brief…" : "Suggest criteria"}
            </Button>
          </Card>

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold">Acceptance criteria</h2>
              <span className={`text-sm font-semibold tabular-nums ${totalWeight === 100 ? "text-emerald-700" : "text-amber-700"}`}>Weights: {totalWeight}% of 100%</span>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              Each passed criterion releases its weight. A <strong>must-pass</strong> criterion that fails releases nothing until it is fixed.
            </p>

            {criteria.length === 0 ? (
              <p className="mt-6 rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">No criteria yet. Use the AI helper above or add one yourself.</p>
            ) : (
              <ul className="mt-5 space-y-3">
                {criteria.map((c, i) => (
                  <li key={c.key} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex items-start gap-3">
                      <span className="mt-2 text-sm font-semibold text-slate-400">{i + 1}</span>
                      <div className="flex-1 space-y-3">
                        <input className={inputClass} aria-label={`Criterion ${i + 1} title`} value={c.title} onChange={(e) => change(c.key, { title: e.target.value })} placeholder="What must be true?" />
                        <div className="flex flex-wrap items-center gap-3 text-sm">
                          <label className="flex items-center gap-2">
                            <span className="whitespace-nowrap text-slate-500">Evidence</span>
                            <select className={`${inputClass} w-auto`} value={c.evidence} onChange={(e) => change(c.key, { evidence: e.target.value as EvidenceType })}>
                              {Object.entries(evidenceLabels).map(([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="flex items-center gap-2">
                            <span className="whitespace-nowrap text-slate-500">Checked by</span>
                            <select className={`${inputClass} w-auto`} value={c.check} onChange={(e) => change(c.key, { check: e.target.value as Draft["check"] })}>
                              <option value="automatic">Automatic test</option>
                              <option value="ai">AI rubric</option>
                            </select>
                          </label>
                          <label className="flex items-center gap-2">
                            <span className="whitespace-nowrap text-slate-500">Weight</span>
                            <input
                              className={`${inputClass} w-20`}
                              type="number"
                              min={0}
                              max={100}
                              value={c.weight}
                              onChange={(e) => change(c.key, { weight: Number(e.target.value) })}
                            />
                            <span className="text-slate-500">%</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input type="checkbox" className="size-4 accent-teal-700" checked={c.mustPass} onChange={(e) => change(c.key, { mustPass: e.target.checked })} />
                            <span>Must pass</span>
                          </label>
                        </div>
                      </div>
                      <button onClick={() => setCriteria((list) => list.filter((x) => x.key !== c.key))} className="text-sm text-slate-400 hover:text-rose-600" aria-label={`Remove criterion ${i + 1}`}>
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <Button className="mt-4" variant="ghost" onClick={() => setCriteria((list) => [...list, { ...genericCriterion(""), key: nextKey++ }])}>
              + Add criterion
            </Button>
          </Card>
        </div>

        <aside className="min-w-0 space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card>
            <h2 className="font-semibold">Summary</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Amount</dt>
                <dd className="font-semibold tabular-nums">{money(amount || 0)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Criteria</dt>
                <dd className="font-semibold">{criteria.length}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Must-pass gates</dt>
                <dd className="font-semibold">{criteria.filter((c) => c.mustPass).length}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Fix window</dt>
                <dd className="font-semibold">72 hours</dd>
              </div>
            </dl>
            {problems.length > 0 ? (
              <ul className="mt-4 space-y-1 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
                {problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            ) : !hasGate ? (
              <p className="mt-4 rounded-xl bg-sky-50 p-3 text-xs text-sky-900">Tip: mark at least one criterion as must-pass, such as &quot;page is live&quot;.</p>
            ) : null}
            <Button className="mt-4 w-full" size="lg" onClick={create} disabled={problems.length > 0}>
              Create and get funding link
            </Button>
            <p className="mt-2 text-xs text-slate-500">The spec is frozen and hashed once the client funds it. Changes after that need a new milestone.</p>
          </Card>
        </aside>
      </div>

      {demo ? (
        <DemoGuide step="step 1 of 7">
          You are <strong>Riya, the freelancer</strong>. Click <strong>Suggest criteria</strong>, check the weights add up to 100%, then press <strong>Create and get funding link</strong>.
        </DemoGuide>
      ) : null}
    </div>
  );
}
