import { stagger } from "@/lib/style";
import { Journey } from "./journey";
import { CtaLink, MiniVerifier, SpinSticker, TickSticker } from "./landing";
import { Bento, InView, Marquee, ProductWindow, ScrollLit, StoryScroll, WordReveal } from "./landing-motion";

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

const labelTones = {
  dark: { num: "text-dim", text: "text-brand-2" },
  blue: { num: "text-white/60", text: "text-white" },
  paper: { num: "text-paper-mute", text: "text-brand" },
};

/** Numbered section label: a large mono number with a slash, then the section name. */
function SectionLabel({ n, label, tone = "dark" }: { n: string; label: string; tone?: keyof typeof labelTones }) {
  const t = labelTones[tone];
  return (
    <p className="flex items-baseline gap-3 font-mono">
      <span className={`text-3xl tracking-tight sm:text-4xl ${t.num}`}>{n}/</span>
      <span className={`text-xs uppercase tracking-[0.16em] ${t.text}`}>{label}</span>
    </p>
  );
}

export default function Home() {
  return (
    <div className="overflow-x-clip">
      <section className="relative mx-auto max-w-6xl px-4 pb-16 pt-16 text-center sm:px-6 sm:pt-24">
        <SpinSticker text="Runs on PayPal sandbox · AI checked · " className="absolute right-6 top-12 hidden md:grid lg:right-2" />
        <InView>
          <p className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.03] px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.04em] text-mute sm:text-[11px] sm:tracking-[0.12em]">
            <span className="size-1.5 rounded-full bg-mint glow-dot" />
            For freelancers and the clients who hire them
          </p>
        </InView>
        <h1 className="mx-auto mt-7 max-w-5xl font-display text-5xl font-bold leading-[0.95] tracking-[-0.045em] font-stretch-expanded sm:text-7xl lg:text-[88px]">
          <span className="block">
            <WordReveal text="Paid as agreed." wordClassName="pb-[0.08em]" delay={0.05} />
            <span className="rise inline-block" style={stagger(6)}>
              <TickSticker />
            </span>
          </span>
          <WordReveal text="Criterion by criterion." className="block text-brand-2" delay={0.2} />
        </h1>
        <InView delay={0.35}>
          <p className="mx-auto mt-7 max-w-xl text-lg leading-relaxed text-mute">
            The client locks each milestone on their own <span className="font-semibold text-ink">PayPal</span>. An <span className="font-semibold text-ink">AI checker</span> tests the work against what was agreed. Only the share that passed is released.
          </p>
          <ul className="mx-auto mt-6 flex max-w-2xl flex-wrap justify-center gap-2 text-[13px]">
            {[
              ["Freelancers", "get paid for every part that passed"],
              ["Clients", "pay only for what was delivered"],
              ["AI agents", "pay within limits you set"],
            ].map(([who, what]) => (
              <li key={who} className="rounded-full border border-white/12 bg-white/[0.03] px-3.5 py-1.5 text-mute">
                <span className="font-semibold text-ink">{who}</span> {what}
              </li>
            ))}
          </ul>
        </InView>
        <InView delay={0.45}>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <CtaLink href="/new?demo=1">Start the walkthrough</CtaLink>
            <CtaLink href="/dashboard" variant="secondary">
              Open the app
            </CtaLink>
          </div>
          <p className="mt-6 text-xs text-dim">About two minutes · you play both sides</p>
        </InView>
      </section>

      <Journey />

      <div id="product" className="scroll-mt-16 pt-24">
        <ProductWindow />
      </div>

      <section className="mx-auto mt-20 max-w-6xl px-4 sm:px-6">
        <p className="text-center font-mono text-[11px] uppercase tracking-[0.12em] text-dim">Every money move is a PayPal API call</p>
        <div className="mt-4">
          <Marquee items={platform} />
        </div>
      </section>

      <section id="problem" className="mx-auto max-w-7xl scroll-mt-16 px-4 pt-32 sm:px-6">
        <SectionLabel n="01" label="The problem" />
        <ScrollLit
          className="mt-6 max-w-5xl font-display text-3xl font-semibold leading-[1.12] tracking-[-0.03em] text-balance sm:text-5xl"
          accent={["PayPal", "AI"]}
          text="Freelance payments break at handoff. The client goes quiet, or says the work is not what was agreed, and the freelancer waits. PayPlan holds the money on the client's own PayPal, has an AI checker test the work, and releases exactly the share that passed."
        />
      </section>

      <section id="how" className="scroll-mt-16 pt-32">
        <InView className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionLabel n="02" label="How it works" />
          <h2 className="mt-4 max-w-3xl font-display text-4xl font-semibold tracking-[-0.03em] text-balance sm:text-5xl">
            From a handshake <span className="text-dim">to a payout.</span>
          </h2>
          <p className="mt-4 max-w-lg text-mute">Scroll through one $1,000 milestone. The orbit is the PayPal hold, split into the five things that were agreed.</p>
        </InView>
        <div className="mt-16 pb-24">
          <StoryScroll />
        </div>
      </section>

      <section id="try" className="scroll-mt-12 bg-brand">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-24 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <InView>
            <SectionLabel n="03" label="Try the checker" tone="blue" />
            <h2 className="mt-4 font-display text-4xl font-semibold tracking-[-0.03em] text-balance text-white sm:text-5xl">
              Watch money unlock <span className="text-white/60">as each check passes.</span>
            </h2>
            <p className="mt-4 max-w-md leading-relaxed text-white/90">Every criterion carries its share of the payment. When the AI confirms it with evidence, that share can be captured. A failed check holds back only its own part.</p>
          </InView>
          <InView delay={0.1}>
            <MiniVerifier />
          </InView>
        </div>
      </section>

      <section id="paypal" className="scroll-mt-12 bg-paper text-paper-ink">
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
          <InView>
            <SectionLabel n="04" label="Built on the PayPal platform" tone="paper" />
            <h2 className="mt-4 max-w-3xl font-display text-4xl font-semibold tracking-[-0.03em] text-balance sm:text-5xl">
              Every money move <span className="text-paper-mute">is a PayPal API call.</span>
            </h2>
            <p className="mt-4 max-w-xl text-paper-mute">With sandbox keys set, each call below runs on the PayPal sandbox with test accounts. Without keys the app simulates them, and every screen says so.</p>
          </InView>
          <InView delay={0.1}>
            <ol className="-mx-3 mt-12 border-t border-paper-ink/15">
              {paypalParts.map((p, i) => (
                <li key={p.api} className="group grid gap-1 border-b border-paper-ink/15 px-3 py-5 transition-colors duration-200 hover:bg-brand hover:text-white sm:grid-cols-[72px_minmax(0,1fr)_minmax(0,1.2fr)] sm:items-baseline sm:gap-4">
                  <span className="font-mono text-sm text-paper-mute group-hover:text-white/70">{String(i + 1).padStart(2, "0")}/</span>
                  <span className="font-mono text-sm font-semibold">{p.api}</span>
                  <span className="text-paper-mute group-hover:text-white/90">{p.use}</span>
                </li>
              ))}
            </ol>
          </InView>
        </div>
      </section>

      <section className="pt-28 pb-24">
        <InView className="mx-auto mb-10 max-w-7xl px-4 sm:px-6">
          <SectionLabel n="05" label="Details that matter" />
          <h2 className="mt-4 max-w-3xl font-display text-4xl font-semibold tracking-[-0.03em] text-balance sm:text-5xl">
            Built so nobody <span className="text-dim">has to trust anybody.</span>
          </h2>
        </InView>
        <Bento />
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6">
        <InView>
          <div className="relative overflow-hidden rounded-[36px] bg-brand px-6 py-16 text-center sm:px-12 sm:py-20">
            <h2 className="mx-auto max-w-4xl font-display text-4xl font-bold uppercase leading-[0.95] tracking-[-0.03em] text-balance text-white font-stretch-expanded sm:text-6xl">See one milestone from brief to payout.</h2>
            <p className="mx-auto mt-5 max-w-lg text-white/90">Seven steps, about two minutes. You play both the freelancer and the client.</p>
            <div className="mt-10 flex justify-center">
              <CtaLink href="/new?demo=1" variant="light">
                Start the walkthrough
              </CtaLink>
            </div>
          </div>
        </InView>
      </section>
    </div>
  );
}
