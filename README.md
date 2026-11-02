# PayPlan web app

PayPlan (working name) is milestone payments for freelancers, where the money moves only for work that is checked.

1. The client locks each milestone with a **PayPal authorization hold** on their own PayPal account. Nothing is charged, and PayPlan never holds the money.
2. When the freelancer delivers, an **AI checker** opens the delivered work and judges it against the criteria both sides agreed.
3. It signs a report, and **only the share that passed is captured**.
4. What failed stays a hold while the freelancer fixes it.

The client can approve each release themselves or hand that job to their **AI agent**, within limits they set.

## Run it locally (no keys needed)

```bash
cd web
npm install
npm run dev
```

Open http://localhost:3000 and press **Start the walkthrough**. With no keys set, the app runs on:

| Part | Without keys | With keys |
|---|---|---|
| PayPal | A simulated PayPal in the server process. Every screen says "Simulated PayPal". | The real **PayPal sandbox** (`PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`) |
| Database | Embedded Postgres (PGlite) in `web/.data/` | Neon Postgres (`DATABASE_URL`) |
| Checker | Plain tests only: page is live, form sends, mobile audit. Everything else goes to "Needs a person". | AI judge (`LLM_API_KEY`, Gemini by default), plus PageSpeed mobile audit and screenshot (`PAGESPEED_API_KEY`) |

Copy `.env.example` to `.env.local` to set keys. Never commit real values.

### The walkthrough

1. **Riya (freelancer)** pastes the client's brief. The AI drafts acceptance criteria with weights and must-pass gates; she edits and creates the milestone. The agreed spec gets a SHA-256 **Agreement ID**.
2. **Sam (client)** picks who approves releases (himself, or his AI agent within its limits) and approves a PayPal **authorization hold**.
3. Riya submits the work. In the walkthrough it is a sample client site served by this app at `/demo/northwind/v1`; its contact form is broken on purpose.
4. The **checker** runs live and saves every step to the log:
   - opens the URL
   - sends a test message through the form
   - runs the mobile audit
   - asks the AI about the rest
   - signs the report
5. Sam's **agent** works through its mandate (go / no-go) and captures the verified share, or hands the decision back. With manual approval, Sam holds a button to release, or appeals to a person.
6. Riya submits the fix (`/demo/northwind/v2`). Only what failed is checked again, and the rest is captured automatically.
7. **Demo buttons** end a review or fix window early, so you can see the timer rules without waiting days:
   - the verified share is released when the client stays silent
   - the rest of the hold is voided when the fix window ends

## How money moves (PayPal sandbox)

| Step | PayPal API |
|---|---|
| Client locks the milestone | `POST /v2/checkout/orders` (intent `AUTHORIZE`), approved with the PayPal JS SDK v6 button, then `POST /v2/checkout/orders/{id}/authorize` |
| Verified share released | `POST /v2/payments/authorizations/{id}/capture` with `final_capture: false` (partial) |
| Last share released | the same call with `final_capture: true` |
| Fix window ends | `POST /v2/payments/authorizations/{id}/void` |
| Long jobs | `POST /v2/payments/authorizations/{id}/reauthorize` |
| Team splits | `POST /v1/payments/payouts` |
| Disputes | `POST /v1/customer/disputes/{id}/provide-evidence` with the signed report |
| Events | webhooks, checked with `POST /v1/notifications/verify-webhook-signature` |

The app takes these precautions:
- **No double charges.** Every money move is saved as "pending" with its `PayPal-Request-Id` *before* PayPal is called. A double click, a crash or a lost reply re-sends the same key, so PayPal never moves money twice. Tests cover all three.
- **Webhooks are trusted only when checked.** Each one is verified with PayPal and processed once. A capture whose reply was lost is completed from its webhook.

## Signed reports

Every acceptance report is signed with Ed25519. Its id is the SHA-256 of exactly what was signed. Anyone with the link can open `/r/<id>` to see whether it is genuine and unchanged, with the verdicts and the PayPal ids. Anyone can also download it from `/api/reports/<id>` and check it themselves against `/api/reports/key`.

## Safety in the checker
- **Delivered pages are untrusted.** Their content is fenced off in the prompt. A page that tries to instruct the checker never gets a pass; a person looks instead.
- **No probing private networks.** The checker never fetches private or local addresses in production.
- **The AI never moves money by itself.**
  - The rules engine turns verdicts into an amount, capped by the PayPal hold.
  - The agent can act only inside its mandate.
- **No fake AI.** Without an AI key, nothing is called AI: criteria drafting returns a labelled template, and judgement calls go to a person.

## Deploy
1. **Vercel:** Root Directory `web`. The `vercel-build` script applies database migrations, then builds.
2. **Neon Postgres:** set `DATABASE_URL`.
3. **Environment variables:** listed in `.env.example`. Set `CRON_SECRET` too, and `REPORT_SIGNING_KEY` (`npm run keys:generate`) so signed reports stay verifiable across deploys.
4. **PayPal webhook:** point it at `https://<your-app>/api/paypal/webhook` and set `PAYPAL_WEBHOOK_ID`.
5. **Timer job:** `.github/workflows/timer.yml` calls `/api/cron/due` every 30 minutes. Add the repository secrets `APP_URL` and `CRON_SECRET`. Scheduled runs only happen on the default branch.

`GET /api/health` shows which PayPal mode, database and checker are active (no secrets).

## Tests

```bash
npm test          # unit and integration tests (vitest, Postgres in memory)
npm run lint
npx tsc --noEmit  # run `npx next typegen` first on a fresh clone
```

The tests run against a real Postgres (PGlite) and a simulated PayPal that enforces PayPal's rules: idempotency keys, captures capped by the hold, and no captures after a void. They cover:
- the full money flow, including partial and final captures
- double clicks, refused and lost PayPal replies, and webhook reconciliation
- the agent mandate
- the timers and appeals
- the API and workspace isolation
- the checker's evidence, form test, PageSpeed parsing and prompt-injection guard
- AI drafting

## Code map

| Path | What it is |
|---|---|
| `src/app/` | Pages: landing, `new`, `dashboard`, `agents`, `m/[id]/{fund,submit,verify,report,decide}` |
| `src/app/api/` | Route handlers: milestones and actions, mandate, criteria drafting, PayPal webhook and config, timer, health |
| `src/app/demo/northwind/` | The sample client site the walkthrough delivers (v1 broken form, v2 fixed) |
| `src/server/paypal/` | Typed PayPal REST client, and the simulated PayPal |
| `src/server/db/` | Drizzle schema; Neon or embedded Postgres. Migrations are in `drizzle/` |
| `src/server/milestones/service.ts` | Every state change and money move |
| `src/server/domain/rules.ts` | Rules engine in integer cents: releasable amount, agent review, hashing |
| `src/server/verifier/` | Evidence collectors, AI and rules judges, the check run |
| `src/server/criteria/draft.ts` | AI drafting of acceptance criteria |
| `src/lib/store.ts` | What screens import: `store-remote.ts` (the API) in the app, `store-local.ts` (dummy data) in the static preview |
| `src/components/paypal-button.tsx` | PayPal Web SDK v6 button |
| `preview/` | Single-file static preview of the prototype (`npm run preview:build`) |

## Design language

The theme is "volt ledger": a blue-black base, one volt blue used in big blocks, and a light paper band on the landing page. Buttons are tactile: a solid lip you press into. Colour always means money state:

| Colour | Meaning |
|---|---|
| Amber | Money moving, or "needs a person" |
| Ice | Money held |
| Mint | Released |
| Flare | Not met |
| Violet | AI and agents |

Fonts:
- **Hubot Sans** for headlines.
- **Mona Sans** for text and amounts.
- **Geist Mono** for logs, labels and section numbers.

Motion respects `prefers-reduced-motion`. Details are in `docs/design-language.md`.

PayPal is a trademark of PayPal, Inc. This project is not affiliated with PayPal.
