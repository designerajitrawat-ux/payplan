import { stagger } from "@/lib/style";
import { HeroVisual, MagneticLink, MiniVerifier } from "./landing";

const steps = [
  { title: "Agree on done", body: "Freelancer and client list the criteria and a weight for each. The spec is frozen and hashed." },
  { title: "Lock on PayPal", body: "The client approves an authorization hold. Nothing is charged, and PayPlan never holds the money." },
  { title: "AI checks the work", body: "Automatic tests and an AI rubric check every criterion and attach evidence both sides can see." },
  { title: "Release what passed", body: "PayPal captures exactly the share that passed. The rest waits for a fix or goes back." },
];

const paypalParts = [
  { api: "Orders v2 · AUTHORIZE", use: "Locks the milestone on the client's own PayPal" },
  { api: "Payments v2 · partial capture", use: "Releases one criterion's share at a time" },
  { api: "Void and reauthorize", use: "Returns unverified money, keeps long jobs alive" },
  { api: "Payouts", use: "Splits agency work across team members" },
  { api: "Disputes · evidence", use: "Sends the signed report if a dispute opens" },
  { api: "Webhooks", use: "Moves each milestone when PayPal confirms" },
];

const rules = [
  "Releases only work the AI verified",
  "Stays under its spending limit per milestone",
  "Hands anything uncertain back to the person",
  "Can never open or close an appeal",
];

export default function Home() {
  return (
    <div className="overflow-x-clip">
      <section className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-20 pt-14 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pt-20">
        <div className="min-w-0">
          <p className="rise inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-mute" style={stagger(0)}>
            <span className="size-1.5 rounded-full bg-mint glow-dot" />
            Milestone payments on PayPal, checked by AI
          </p>
          <h1 className="rise mt-6 font-display text-5xl font-semibold leading-[0.98] tracking-tight text-balance font-stretch-expanded sm:text-6xl xl:text-7xl" style={stagger(1)}>
            <span className="text-gradient">Paid as agreed.</span>
            <br />
            <span className="text-mute">Criterion by criterion.</span>
          </h1>
          <p className="rise mt-6 max-w-xl text-lg leading-relaxed text-mute" style={stagger(2)}>
            The client locks each milestone on their own PayPal. An AI checker tests the delivered work against what you both agreed, and only the share that passed is released.
          </p>
          <div className="rise mt-9 flex flex-wrap gap-3" style={stagger(3)}>
            <MagneticLink href="/new?demo=1">Start the walkthrough</MagneticLink>
            <MagneticLink href="/dashboard" variant="secondary">
              Open the app
            </MagneticLink>
          </div>
          <dl className="rise mt-12 grid max-w-lg grid-cols-3 gap-6 border-t border-white/[0.08] pt-6" style={stagger(4)}>
            <div>
              <dt className="text-xs text-dim">Money held by PayPlan</dt>
              <dd className="mt-1 font-sans text-2xl font-semibold text-ink font-stretch-semi-expanded">$0</dd>
            </div>
            <div>
              <dt className="text-xs text-dim">Steps to get paid</dt>
              <dd className="mt-1 font-display text-2xl font-semibold text-ink">4</dd>
            </div>
            <div>
              <dt className="text-xs text-dim">Silent clients</dt>
              <dd className="mt-1 font-display text-2xl font-semibold text-ink">Can&apos;t stall</dd>
            </div>
          </dl>
        </div>
        <div className="rise" style={stagger(2)}>
          <HeroVisual />
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-nova">Try it</p>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-balance font-stretch-semi-expanded sm:text-4xl">Watch money unlock as each check passes.</h2>
          <p className="mt-4 max-w-md leading-relaxed text-mute">
            Every criterion carries its share of the payment. When the AI confirms it with evidence, that share can be captured. A failed check holds back only its own part.
          </p>
        </div>
        <MiniVerifier />
      </section>

      <section id="how" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-16 sm:px-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-nova">How it works</p>
        <h2 className="mt-3 max-w-2xl font-display text-3xl font-semibold tracking-tight text-balance font-stretch-semi-expanded sm:text-4xl">From a handshake to a payout, in four moves.</h2>
        <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <li key={s.title} className="glass relative overflow-hidden rounded-3xl p-6">
              <span className="font-mono text-xs text-dim">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="mt-6 font-display text-xl font-semibold text-ink">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-mute">{s.body}</p>
              <span aria-hidden className="absolute -right-10 -top-10 size-28 rounded-full border border-white/[0.06]" />
              <span aria-hidden className="absolute -right-4 -top-4 size-16 rounded-full border border-white/[0.06]" />
            </li>
          ))}
        </ol>
      </section>

      <section id="agents" className="mx-auto grid max-w-7xl scroll-mt-24 gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-nova">Agent ready</p>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-balance font-stretch-semi-expanded sm:text-4xl">Let your AI agent pay for work that passed.</h2>
          <p className="mt-4 max-w-md leading-relaxed text-mute">
            A client can hand releases to their own agent. It reads the signed report, checks its mandate, and captures the verified share on PayPal. Anything outside its limits goes back to the person.
          </p>
          <ul className="mt-6 space-y-3">
            {rules.map((r) => (
              <li key={r} className="flex items-center gap-3 text-sm text-ink">
                <span className="grid size-5 place-items-center rounded-full bg-nova/15 text-nova">
                  <svg viewBox="0 0 16 16" className="size-3" aria-hidden>
                    <path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                {r}
              </li>
            ))}
          </ul>
        </div>
        <div className="glass rounded-3xl p-6 sm:p-8">
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 font-medium text-ink">
              <span className="grid size-8 place-items-center rounded-full bg-gradient-to-br from-nova to-ice text-[11px] font-bold text-void">AI</span>
              Northwind buying agent
            </p>
            <span className="rounded-full bg-mint/10 px-2.5 py-1 text-xs font-medium text-mint ring-1 ring-inset ring-mint/25">Active</span>
          </div>
          <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
            <div className="rounded-2xl bg-white/[0.03] p-4">
              <dt className="text-xs text-dim">Limit per milestone</dt>
              <dd className="mt-1 font-sans text-2xl font-semibold text-ink font-stretch-semi-expanded">$1,000</dd>
            </div>
            <div className="rounded-2xl bg-white/[0.03] p-4">
              <dt className="text-xs text-dim">Minimum AI confidence</dt>
              <dd className="mt-1 font-display text-2xl font-semibold text-ink">85%</dd>
            </div>
          </dl>
          <pre className="mt-6 overflow-x-auto rounded-2xl border border-white/[0.06] bg-void/60 p-4 font-mono text-xs leading-relaxed text-mute">
            <span className="text-dim">{"// tool call from the agent, over MCP"}</span>
            {"\n"}
            <span className="text-nova">release_verified</span>({"{"} milestone: <span className="text-sun">&quot;m-1051&quot;</span> {"}"}){"\n"}
            <span className="text-dim">{"→ "}</span>
            <span className="text-mint">captured $800.00</span> <span className="text-dim">· 4 of 5 passed · within limit</span>
          </pre>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-nova">Built on the PayPal platform</p>
        <h2 className="mt-3 max-w-2xl font-display text-3xl font-semibold tracking-tight text-balance font-stretch-semi-expanded sm:text-4xl">Every money move is a real PayPal call.</h2>
        <ul className="mt-10 grid gap-px overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.06] sm:grid-cols-2 lg:grid-cols-3">
          {paypalParts.map((p) => (
            <li key={p.api} className="bg-void/80 p-6 transition-colors hover:bg-panel/80">
              <p className="font-mono text-xs text-sun">{p.api}</p>
              <p className="mt-2 text-sm text-mute">{p.use}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-24 pt-8 sm:px-6">
        <div className="glass relative overflow-hidden rounded-[2rem] px-6 py-14 text-center sm:px-12">
          <span aria-hidden className="absolute left-1/2 top-full size-[520px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-nova/20 blur-3xl" />
          <h2 className="relative mx-auto max-w-2xl font-display text-3xl font-semibold tracking-tight text-balance font-stretch-semi-expanded sm:text-5xl">See one milestone from first brief to final payout.</h2>
          <p className="relative mx-auto mt-4 max-w-lg text-mute">Seven steps, about two minutes. You play both the freelancer and the client.</p>
          <div className="relative mt-8 flex justify-center">
            <MagneticLink href="/new?demo=1">Start the walkthrough</MagneticLink>
          </div>
        </div>
      </section>
    </div>
  );
}
