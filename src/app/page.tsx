import { stagger } from "@/lib/style";
import { Journey } from "./journey";
import { CtaLink, MiniVerifier, SpinSticker, TickSticker } from "./landing";
import { Bento, InView, Marquee, ProductWindow, ScrollLit, StoryScroll, WordReveal } from "./landing-motion";

const platform = [
  "Orders v2 · AUTHORIZE",
  "Payee: the freelancer's PayPal",
  "Payments v2 · partial capture",
  "Void",
  "Reauthorize",
  "Disputes · evidence",
  "Webhooks",
  "MCP agent tools",
  "AI rubric",
  "PageSpeed mobile audit",
];

// Each figure is quoted from its source as published; the link is the page it was checked on (3 Nov 2026).
const problemStats = [
  {
    figure: "2,184",
    text: "of the 2,542 complaints New York freelancers filed in five years were about late or missing payment.",
    source: "NYC DCWP, 2023",
    href: "https://www.nyc.gov/assets/dca/downloads/pdf/workers/DCWP-Freelance-Isnt-Free-Act-Five-YearReport-2023.pdf",
  },
  { figure: "31%", text: "of UK freelancers have finished work and never been paid for it.", source: "IPSE", href: "https://www.ipse.co.uk/policy/research/financial-wellbeing/late-payment-within-the-self-employed-sector.html" },
  {
    figure: "31%",
    text: "of UK businesses that paid suppliers late blamed a disputed invoice: was the work done as agreed?",
    source: "UK Dept for Business and Trade, 2024",
    href: "https://assets.publishing.service.gov.uk/media/66eb01e7ba4b4b3f945016c8/late-payments-research-understanding-variations-in-payment-performance-and-practices-across-business-sectors-and-sizes.pdf",
  },
  { figure: "+55%", text: "growth of India's gig workforce in four years, to 1.2 crore workers, freelancers among them.", source: "Economic Survey 2025-26", href: "https://www.indiabudget.gov.in/economicsurvey/doc/eschapter/echap12.pdf" },
];

const paypalParts = [
  { api: "Orders v2 · AUTHORIZE", use: "Locks the milestone on the client's own PayPal, payable straight to the freelancer" },
  { api: "Payments v2 · partial capture", use: "Releases one criterion's share at a time" },
  { api: "Void and reauthorize", use: "Returns unverified money, and keeps a long job's hold alive past day 3" },
  { api: "Disputes · evidence", use: "Turns the signed report into a PDF for any PayPal dispute, sent by API when the dispute reaches PayPlan" },
  { api: "Webhooks", use: "Confirms captures and catches disputes as PayPal reports them" },
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
      <Journey
        intro={
          <>
            <SpinSticker text="Runs on PayPal sandbox · AI checked · " className="absolute right-8 top-24 hidden md:grid" />
            <InView>
              <p className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-paper-ink/45 px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.04em] text-white/90 backdrop-blur sm:text-[11px] sm:tracking-[0.12em]">
                <span className="size-1.5 rounded-full bg-mint glow-dot" />
                For freelancers and the clients who hire them
              </p>
            </InView>
            <h1 className="mx-auto mt-6 max-w-5xl font-display text-5xl font-bold leading-[0.95] tracking-[-0.045em] text-white font-stretch-expanded [text-shadow:0_4px_30px_rgba(9,10,16,0.35)] sm:text-7xl lg:text-[88px]">
              <span className="block">
                <WordReveal text="Paid as agreed." wordClassName="pb-[0.08em]" delay={0.05} />
                <span className="rise inline-block" style={stagger(6)}>
                  <TickSticker />
                </span>
              </span>
              <WordReveal text="Criterion by criterion." className="block text-white/75" delay={0.2} />
            </h1>
            <InView delay={0.35}>
              <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-white/90 sm:text-lg">
                The client locks each milestone on their own <span className="font-semibold text-white">PayPal</span>. An <span className="font-semibold text-white">AI checker</span> tests the work against what was agreed. Only the share that passed is released.
              </p>
              <ul className="mx-auto mt-5 hidden max-w-2xl flex-wrap justify-center gap-2 text-[13px] sm:flex">
                {[
                  ["Freelancers", "get paid for every part that passed"],
                  ["Clients", "pay only for what was delivered"],
                  ["AI agents", "pay within limits you set"],
                ].map(([who, what]) => (
                  <li key={who} className="rounded-full border border-white/20 bg-paper-ink/45 px-3.5 py-1.5 text-white/80 backdrop-blur">
                    <span className="font-semibold text-white">{who}</span> {what}
                  </li>
                ))}
              </ul>
            </InView>
            <InView delay={0.45}>
              <div className="mt-8 flex flex-wrap justify-center gap-4">
                <CtaLink href="/new?demo=1" variant="light">
                  Start the walkthrough
                </CtaLink>
                <CtaLink href="/dashboard" variant="ink">
                  Open the app
                </CtaLink>
              </div>
              <p className="mt-5 hidden rounded-full bg-paper-ink/45 px-3 py-1 text-xs text-white/80 backdrop-blur sm:inline-block">About two minutes · you play both sides</p>
            </InView>
          </>
        }
      />

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
        <InView className="mt-14">
          <ul className="grid gap-px overflow-hidden rounded-[28px] border border-white/[0.08] bg-white/[0.08] sm:grid-cols-2 lg:grid-cols-4">
            {problemStats.map((s) => (
              <li key={s.source} className="flex flex-col bg-void p-6">
                <p className="font-display text-4xl font-semibold tracking-[-0.03em] text-ink">{s.figure}</p>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-mute">{s.text}</p>
                <a href={s.href} target="_blank" rel="noreferrer" className="mt-4 font-mono text-[11px] text-dim underline-offset-4 hover:text-brand-2 hover:underline">
                  {s.source} ↗
                </a>
              </li>
            ))}
          </ul>
        </InView>
      </section>

      <section id="how" className="scroll-mt-16 pt-32">
        <InView className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionLabel n="02" label="How it works" />
          <h2 className="mt-4 max-w-3xl font-display text-4xl font-semibold tracking-[-0.03em] text-balance sm:text-5xl">
            From a handshake <span className="text-dim">to a payout.</span>
          </h2>
          <p className="mt-4 max-w-lg text-mute">Scroll through one $1,000 milestone. The padlock is the PayPal hold, split into the five things that were agreed.</p>
        </InView>
        <div className="mt-16 pb-24">
          <StoryScroll />
        </div>
      </section>

      <section id="try" className="volt scroll-mt-12">
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
          <div className="volt overflow-hidden rounded-[36px] px-6 py-16 text-center sm:px-12 sm:py-20">
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
