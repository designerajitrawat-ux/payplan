# PayPlan web app

PayPlan (working name) handles milestone payments for freelancers. The client locks each milestone with a PayPal authorization. An AI verifier checks the delivered work against the agreed criteria, and only the share that passed is released.

> **Current state: clickable prototype with dummy data.** No backend, no real PayPal calls and no real AI calls yet.
> Data lives in the browser's localStorage. Use **Reset demo** in the header to start over.

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

1. **Freelancer** creates a milestone. "Suggest criteria" stands in for the AI helper.
2. **Client** locks the money with a simulated PayPal authorization.
3. **Freelancer** submits the work.
4. The verifier checks each criterion. In the prototype the results are scripted.
5. **Client** reads the report, then accepts or appeals. 4 of 5 criteria pass, so $800 is released and $200 waits.
6. **Freelancer** submits a fix. Only the failed criterion is re-checked, and the rest is released.
7. The **dashboard** shows every milestone and the money state.

## Code map

| Path | What it is |
|---|---|
| `src/app/` | Pages: landing, `new`, `dashboard`, `m/[id]/{fund,submit,verify,report,decide}` |
| `src/components/` | UI building blocks, walkthrough card, simulated PayPal button, countdowns |
| `src/lib/decision.ts` | Rules engine: verdicts to releasable amount (kept for the real app) |
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
