import { ButtonLink, Card } from "@/components/ui";

const steps = [
  {
    title: "Agree on what \"done\" means",
    body: "The freelancer and the client list the criteria up front, with a weight for each. The spec is frozen and hashed.",
  },
  {
    title: "Lock the money in PayPal",
    body: "The client approves an authorization hold in PayPal. Nothing is charged yet, and we never hold the money.",
  },
  {
    title: "Get paid per criterion that passes",
    body: "An AI verifier checks the delivered work and writes an evidence report. Pre-agreed rules release exactly the share that passed.",
  },
];

export default function Home() {
  return (
    <div className="space-y-16">
      <section className="grid items-center gap-10 pt-6 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Milestone payments for freelancers and their clients</p>
          <h1 className="mt-3 text-4xl font-bold leading-tight tracking-tight text-slate-900 sm:text-5xl">Paid as agreed. Criterion by criterion.</h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600">
            The client locks each milestone with PayPal. An AI verifier checks the work against the criteria you both agreed on, and only the share that passed is released.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/new?demo=1" size="lg">
              Start the walkthrough
            </ButtonLink>
            <ButtonLink href="/dashboard" size="lg" variant="secondary">
              See example milestones
            </ButtonLink>
          </div>
        </div>
        <Card className="bg-gradient-to-b from-white to-slate-50">
          <p className="text-sm font-semibold text-slate-500">Landing page for Northwind · $1,000</p>
          <ul className="mt-4 space-y-2.5 text-sm">
            {[
              ["Page is live and loads over HTTPS", true],
              ["Hero uses the approved headline", true],
              ["Works on mobile at 375 px", true],
              ["Contact form sends a message", false],
              ["Colours follow the style guide", true],
            ].map(([label, ok]) => (
              <li key={String(label)} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                <span>{label}</span>
                <span className={ok ? "font-semibold text-emerald-700" : "font-semibold text-rose-700"}>{ok ? "Passed" : "Not met"}</span>
              </li>
            ))}
          </ul>
          <div className="mt-5 rounded-xl bg-teal-50 p-4 text-sm text-teal-900">
            <p className="font-semibold">4 of 5 criteria passed</p>
            <p className="mt-1">$800 released now. $200 stays on the client&apos;s PayPal while the form is fixed.</p>
          </div>
        </Card>
      </section>

      <section>
        <h2 className="text-2xl font-bold tracking-tight">How it works</h2>
        <ol className="mt-6 grid gap-4 md:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.title}>
              <Card className="h-full">
                <span className="flex size-8 items-center justify-center rounded-full bg-teal-700 text-sm font-bold text-white">{i + 1}</span>
                <h3 className="mt-4 font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.body}</p>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <h3 className="font-semibold">For freelancers</h3>
          <p className="mt-2 text-sm text-slate-600">No more &quot;this isn&apos;t what we asked for&quot; after delivery. If the client goes silent, the verified share is released when the review window ends.</p>
        </Card>
        <Card>
          <h3 className="font-semibold">For clients</h3>
          <p className="mt-2 text-sm text-slate-600">Pay only for the criteria that passed, approve inside PayPal, and appeal to a person if you disagree.</p>
        </Card>
        <Card>
          <h3 className="font-semibold">For AI buyer agents</h3>
          <p className="mt-2 text-sm text-slate-600">An agent can buy a service and read a machine-readable report. The PayPal authorization is its hard spending limit.</p>
        </Card>
      </section>
    </div>
  );
}
