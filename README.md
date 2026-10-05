# PayPlan web app

PayPlan (working name) handles milestone payments for freelancers. The client locks each milestone with a PayPal authorization. An AI verifier checks the delivered work against the agreed criteria, and only the share that passed is released.

> **Current state: clickable prototype with dummy data.** No backend, no real PayPal calls and no real AI calls yet.
> Data lives in the browser's localStorage. Use **Reset demo** in the sidebar to start over.

## Run it

```bash
cd web
npm install
npm run dev
```

Open http://localhost:3000 and press **Start the walkthrough**.

### Single-file preview

```bash
npm run preview:build
```

This writes `preview-dist/payplan.html`, one HTML file with the whole prototype inside. It needs no server: open `preview-dist/index.html` in a browser or host the file anywhere. The preview uses the same pages; `preview/` holds the hash router and small stand-ins for `next/link` and `next/navigation`.

## Walkthrough (7 steps)

1. **Freelancer** creates a milestone. "Draft criteria with AI" stands in for the AI helper.
2. **Client** chooses who approves releases (themselves, or their AI agent within its limits) and locks the money with a simulated PayPal authorization.
3. **Freelancer** submits the work.
4. The AI checker runs live: a log, a constellation of criteria and a running "verified so far" amount. In the prototype the results are scripted.
5. **Client's agent** checks the signed report against its mandate (go / no-go) and releases $800; $200 waits for a fix. With manual approval the client holds a button to release, or appeals.
6. **Freelancer** submits a fix. Only the failed criterion is checked again, and the rest is released.
7. The **dashboard** shows every milestone and where its money is. The **Agents** page sets the agent's limits, with a live preview.

## Design language

Dark "deep orbit" theme. Colour always means money state: amber for money moving, ice for money held, mint for released, flare for not met, violet for AI and agents. Fonts: Hubot Sans (headlines), Mona Sans (text and amounts, because its zero is plain) and Martian Mono (logs and IDs). Motion respects `prefers-reduced-motion`. Details are in `docs/design-language.md` at the repo root.

## Code map

| Path | What it is |
|---|---|
| `src/app/` | Pages: landing, `new`, `dashboard`, `agents`, `m/[id]/{fund,submit,verify,report,decide}` |
| `src/components/` | UI building blocks, walkthrough card, simulated PayPal button, countdowns |
| `src/components/cosmos.tsx` | Starfield, landing orbit, verifier constellation, money orbit, rings |
| `src/components/motion.tsx`, `toast.tsx` | Number ticker, spotlight, magnetic links, text scramble, hold-to-release, toasts |
| `src/lib/decision.ts` | Rules engine: verdicts to releasable amount, and the agent's go / no-go checks (kept for the real app) |
| `src/lib/activity.ts` | Milestone timeline derived from stored records |
| `src/lib/store.ts` | Prototype-only store (localStorage). Replaced by the API in Phase 1 |
| `src/lib/seed.ts`, `criteria-presets.ts` | Dummy milestones and scripted verifier results |
| `preview/` | Single-file preview build (esbuild + Tailwind CLI) |

## Next (Phase 1)

Replace the dummy store with the real PayPal sandbox:
- Orders v2 AUTHORIZE
- partial capture and void
- Payouts
- webhooks

Add a database behind the same screens.
