import { MagneticLink, MiniVerifier } from "./landing";
import { Bento, InView, Marquee, ProductWindow, StoryScroll, WordReveal } from "./landing-motion";

const platform = [
  "Orders v2 · AUTHORIZE",
  "Payments v2 · partial capture",
  "Void",
  "Reauthorize",
  "Payouts",
  "Disputes · evidence",
  "Webhooks",
  "MCP agent tools",
  "AI rubric",
  "Headless browser checks",
];

const paypalParts = [
  { api: "Orders v2 · AUTHORIZE", use: "Locks the milestone on the client's own PayPal" },
  { api: "Payments v2 · partial capture", use: "Releases one criterion's share at a time" },
  { api: "Void and reauthorize", use: "Returns unverified money, keeps long jobs alive" },
  { api: "Payouts", use: "Splits agency work across team members" },
  { api: "Disputes · evidence", use: "Sends the signed report if a dispute opens" },
  { api: "Webhooks", use: "Moves each milestone when PayPal confirms" },
];

function HeroBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-32 flex justify-center [mask-image:radial-gradient(closest-side,black,transparent)]">
      <svg viewBox="0 0 800 800" className="h-[820px] w-[820px] max-w-none opacity-60">
        <circle cx="400" cy="400" r="380" fill="none" stroke="rgba(255,255,255,0.06)" />
        <circle cx="400" cy="400" r="290" fill="none" stroke="rgba(255,255,255,0.07)" strokeDasharray="2 8" />
        <circle cx="400" cy="400" r="200" fill="none" stroke="rgba(167,139,255,0.12)" />
        <g className="spin-slower" style={{ transformOrigin: "400px 400px" }}>
          <circle cx="780" cy="400" r="5" fill="var(--color-mint)" />
          <circle cx="20" cy="400" r="3" fill="var(--color-ice)" />
        </g>
        <g className="spin-slow" style={{ transformOrigin: "400px 400px", animationDuration: "24s" }}>
          <circle cx="400" cy="110" r="4" fill="var(--color-sun)" />
        </g>
        <g className="spin-slow" style={{ transformOrigin: "400px 400px", animationDuration: "40s", animationDirection: "reverse" }}>
          <circle cx="600" cy="400" r="3.5" fill="var(--color-nova)" />
        </g>
      </svg>
    </div>
  );
}

export default function Home() {
  return (
    <div className="overflow-x-clip">
      <section className="relative mx-auto max-w-5xl px-4 pb-16 pt-20 text-center sm:px-6 sm:pt-28">
        <HeroBackdrop />
        <div className="relative">
          <InView>
            <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-xs text-mute backdrop-blur">
              <span className="size-1.5 rounded-full bg-mint glow-dot" />
              Milestone payments on PayPal, checked by AI
            </p>
          </InView>
          <h1 className="mx-auto mt-7 max-w-4xl font-display text-5xl font-semibold leading-[0.95] tracking-[-0.04em] font-stretch-expanded sm:text-7xl lg:text-[80px]">
            <WordReveal text="Paid as agreed." className="block" wordClassName="text-gradient pb-[0.08em]" delay={0.05} />
            <WordReveal text="Criterion by criterion." className="block text-mute" delay={0.2} />
          </h1>
          <InView delay={0.35}>
            <p className="mx-auto mt-7 max-w-xl text-lg leading-relaxed text-mute">
              The client locks each milestone on their own PayPal. An AI checker tests the work against what you both agreed, and only the share that passed is released.
            </p>
          </InView>
          <InView delay={0.45}>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <MagneticLink href="/new?demo=1">Start the walkthrough</MagneticLink>
              <MagneticLink href="/dashboard" variant="secondary">
                Open the app
              </MagneticLink>
            </div>
            <p className="mt-5 text-xs text-dim">Prototype with dummy data · about two minutes · you play both sides</p>
          </InView>
        </div>
      </section>

      <ProductWindow />

      <section className="mx-auto mt-20 max-w-6xl px-4 sm:px-6">
        <p className="text-center text-xs text-dim">Every money move is a real platform call</p>
        <div className="mt-4">
          <Marquee items={platform} />
        </div>
      </section>

      <section id="how" className="scroll-mt-20 pt-28">
        <InView className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-nova">How it works</p>
          <h2 className="mt-3 font-display text-4xl font-semibold tracking-[-0.03em] text-balance font-stretch-semi-expanded sm:text-5xl">From a handshake to a payout.</h2>
          <p className="mx-auto mt-4 max-w-lg text-mute">Scroll through one $1,000 milestone. The orbit is the PayPal hold, split into the five things that were agreed.</p>
        </InView>
        <div className="mt-16 pb-12">
          <StoryScroll />
        </div>
      </section>

      <section id="try" className="mx-auto grid max-w-7xl scroll-mt-20 gap-10 px-4 py-24 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <InView>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-nova">Try the checker</p>
          <h2 className="mt-3 font-display text-4xl font-semibold tracking-[-0.03em] text-balance font-stretch-semi-expanded">Watch money unlock as each check passes.</h2>
          <p className="mt-4 max-w-md leading-relaxed text-mute">Every criterion carries its share of the payment. When the AI confirms it with evidence, that share can be captured. A failed check holds back only its own part.</p>
        </InView>
        <InView delay={0.1}>
          <MiniVerifier />
        </InView>
      </section>

      <section className="pb-24">
        <InView className="mx-auto mb-10 max-w-7xl px-4 sm:px-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-nova">Details that matter</p>
          <h2 className="mt-3 max-w-2xl font-display text-4xl font-semibold tracking-[-0.03em] text-balance font-stretch-semi-expanded">Built so nobody has to trust anybody.</h2>
        </InView>
        <Bento />
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6">
        <InView>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-nova">Built on the PayPal platform</p>
          <h2 className="mt-3 max-w-2xl font-display text-4xl font-semibold tracking-[-0.03em] text-balance font-stretch-semi-expanded">Every money move is a real PayPal call.</h2>
        </InView>
        <InView delay={0.1}>
          <ul className="mt-10 grid gap-px overflow-hidden rounded-[28px] border border-white/[0.08] bg-white/[0.06] sm:grid-cols-2 lg:grid-cols-3">
            {paypalParts.map((p) => (
              <li key={p.api} className="bg-void/85 p-6 transition-colors duration-300 hover:bg-panel/85">
                <p className="font-mono text-xs text-sun">{p.api}</p>
                <p className="mt-2 text-sm text-mute">{p.use}</p>
              </li>
            ))}
          </ul>
        </InView>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6">
        <InView>
          <div className="glass relative overflow-hidden rounded-[36px] px-6 py-16 text-center sm:px-12">
            <span aria-hidden className="absolute left-1/2 top-full size-[560px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-nova/25 blur-3xl" />
            <h2 className="relative mx-auto max-w-2xl font-display text-4xl font-semibold tracking-[-0.03em] text-balance font-stretch-semi-expanded sm:text-6xl">See one milestone from brief to payout.</h2>
            <p className="relative mx-auto mt-4 max-w-lg text-mute">Seven steps, about two minutes. You play both the freelancer and the client.</p>
            <div className="relative mt-9 flex justify-center">
              <MagneticLink href="/new?demo=1">Start the walkthrough</MagneticLink>
            </div>
          </div>
        </InView>
      </section>
    </div>
  );
}
