# PayPlan design language

## Volt ledger (2 Nov 2026, current)
The user shared three references they are very inspired by: Razorpay Sprint 26 (https://razorpay.com/sprint/26, Awwwards Site of the Day, 26 May 2026) and the Wero merchant page (https://sowieso.wero-wallet.eu/nl-en/merchant). Design is one of the five judging criteria, so the look was reworked around them. Principles are borrowed, not branding: no logos, copy, illustrations or exact brand colours.

**What we took from Razorpay Sprint 26**
- Two-colour discipline. Awwwards lists only #0039FF and #151515. We use a blue-black base and our own volt blue (#2448FF).
- Section rhythm: dark, then a full-bleed blue band, then a light paper band, then dark again, so a long page never feels flat.
- A ruled tab bar in mono with numbered sections ("01.PROBLEM"). The section on screen fills with blue.
- Big mono section numbers ("01/") next to a small uppercase label. Two-tone headings: the second half is dimmed.
- A statement that lights up word by word as you scroll (`ScrollLit`).
- Its weak spot was accessibility (Awwwards: 6.8/10), so we kept contrast at 4.5:1 or better and respect reduced motion.

**What we took from Wero**
- Tactile controls: a solid lip with no blur under each filled button (`.press`), which you press down into.
- Stickers: a round badge with text running around the rim and turning slowly, and a small tilted tick tile set inline in the headline (`.sticker`).
- Friendly, heavy display type for the hero and the final call to action.

**Tokens**

| Token | Hex | Use |
|---|---|---|
| void / deep | #090a10 / #0e1018 | Page background, sidebar |
| panel / panel-2 / edge | #141722 / #1a1e2c / #2a3044 | Cards (solid, no glass blur) |
| ink / mute / dim | #f4f5fb / #b8bfd9 / #8b93b3 | Text levels on dark (dim is about 5.9:1 on panel) |
| brand / brand-2 | #2448ff / #8ea2ff | Volt blue blocks and primary buttons (white text 6.1:1); light blue for links and accents |
| paper / paper-ink / paper-mute | #f1f0eb / #111218 / #4a4f63 | The light band on the landing page |
| sun, ice, mint, flare, nova | unchanged | Money moving, held, released, not met, AI |

**Type:** Hubot Sans and Mona Sans stay. Martian Mono became Geist Mono, which is cleaner for labels, IDs and section numbers.

**3D journey (added 2 Nov 2026, after the user asked for Razorpay's 3D scroll artwork):** right after the hero, a pinned, full-screen volt-blue Three.js scene (`web/src/app/journey-scene.ts`, `journey.tsx`). Scrolling drives a camera along a wireframe road with Razorpay-style black billboards for the five steps: Agree on done, Locked on PayPal, AI checked, Paid as agreed, Agent ready.
- The giant of the scene is a wireframe padlock, the client's PayPal hold. Its five slices are the five criteria.
- The shackle drops shut when the hold is approved, and a held-amount tag appears.
- A violet AI scanner sweeps the lock: four slices turn mint and one turns flare.
- Four coins arc over the road to the freelancer's pedestal, while a HUD card counts held and released money.
- An agent orb appears at the end.
- On phones the camera turns towards each billboard.
- Three.js loads only on the landing page. Without WebGL, the HUD still tells the story.
- A "Skip the tour" link jumps past it, and reduced motion turns off the idle motion and the parallax.

**Background:** the starfield is gone. A faint drafting grid (`.blueprint`) sits behind every page, because the agreement is the blueprint the work is checked against.

**Money lock (3 Nov 2026, replaced the money orbit after the user's design review):** the user found the orbit's three balls ugly. The signature visual is now the hero's padlock in 2D (`web/src/components/money-lock.tsx`).
- Layout: the client's PayPal on the left, the hold in the middle, the freelancer on the right.
- The lock's body has one slice per criterion, sized by its weight.
- The shackle is open until the hold is approved, and opens again when everything is paid.
- Slices take the verdict colours. The wires glow ice for the hold and mint once PayPal captures.
- It is used on the landing page (product window, "How it works") and on the fund, decide and report pages.
- "Try the checker" became a live checker console: a $200-per-slice money bar, then rows that each show how they are checked and then the evidence and the AI's confidence.
- Form hints now sit under the inputs, so fields side by side line up.
- On wide screens the walkthrough guide sits at the foot of the sidebar instead of over the page's buttons.

**Textured volt (3 Nov 2026, the user asked for texture on the flat blue):** no surface uses a flat #2448FF any more.
- `.volt` is for big surfaces: the "Try it" band and the final call-to-action card. It has:
  - a soft light from the top left and a deeper bottom-right corner;
  - a fine 44 px blueprint grid that fades out (the same idea as the dark pages' grid);
  - grey film grain blended with `overlay`.
- `.volt-fill` is the light plus grain without the grid. It is for primary buttons, the header's active tab, "Open the app" and the dashboard tab pill. It also adds a thin top highlight (`--shine`) to the pressable lip.
- The 3D hero gets the same light and grain as an overlay above the canvas.

## Royal orbit (5 Oct 2026, replaced)
Decided 5 Oct 2026, after the user asked for a B + C mix (modern fintech app + live agent console), an agent feature, and a creative, minimal, futuristic "universe" look with micro-interactions. The sections below describe that first version; where they differ from "Volt ledger" above, Volt ledger wins.

## Idea in one line
The PayPal mechanic drawn as a small solar system: the client's planet, the authorization as an orbit split into criteria, and the freelancer's planet. Comets carry captured money across. The verifier draws a constellation as it checks each criterion.

## Tokens ("royal orbit", changed 5 Oct 2026 after the user found the grey palette dull)
No greys: every neutral is a saturated royal blue. Deliberately **not** PayPal's exact brand colours, because the name PayPlan is close to PayPal and the product must not look like an official PayPal product. It is a trustworthy blue family that sits well next to PayPal's real button, which keeps PayPal's own colours in Phase 1.

| Token | Hex | Meaning |
|---|---|---|
| void / deep | #050a26 / #08113a | Page background (royal navy) with blue, violet and sky glows |
| panel / panel-2 / edge | #0d1a52 / #142466 / #26388f | Surfaces; glass is translucent blue with a periwinkle border |
| ink / mute / dim | #f5f7ff / #bcc8ff / #8f9ee0 | Text levels, all at least 4.5:1 on void (dim about 7.5:1) |
| brand / brand-2 | #2f5eff / #7aa2ff | Primary buttons (white text, 5:1), links, progress, focus rings |
| sun | #ffc53d | Money moving: fund and release buttons, comets, walkthrough |
| ice | #4fc8ff | Money held on the client's PayPal |
| mint | #22e3a0 | Money released, criteria passed |
| flare | #ff5c7c | Criteria not met |
| nova | #a78bff | AI checker and agents |

## Type
- Hubot Sans (wide) for headlines. Its zero is dotted, so amounts never use it.
- Mona Sans for text and every money amount (plain zero).
- Martian Mono for logs, IDs and labels.

## Signature moments
- Landing: orbit hero, plus a mini "Run the AI check" demo instead of feature claims.
- Verify: live checker log, constellation, border beam on the criterion being checked, "verified so far" ticker.
- Decide: the agent's go / no-go checklist; hold-to-release for people (no accidental money moves).
- Release: number tickers, comet on the money orbit, toast with a timer.
- Agents: sliders with a live preview that flips between "release" and "hand back".

## Micro-interactions in use
Number ticker, cursor spotlight cards, magnetic CTAs, staggered rise-in, border beam, text scramble on hashes, copy feedback, hold-to-release, morphing approve button, toasts with timer, starfield with parallax and rare shooting stars, shimmer while the AI drafts criteria. All respect `prefers-reduced-motion`.

## References that shaped it (principles, not branding)
- Awwwards winners: Igloo Inc (restraint, transitions), Messenger by abeto (a world on a tiny planet), Vast (space without purple clichés), Moto Finance (money as a physical object), AI in Banking UX (live mini demos instead of claims).
- Products: Stripe globe write-up (progressive arcs), Mercury (balance first, one vivid action colour), Linear (calm dark surfaces), Trigger.dev run page (live trace), Vercel AI Elements (step states), NASA Eyes (time scrubber idea for a future "replay verification").
- Rauno Freiberg, "Interaction design" essay: https://rauno.me/craft/interaction-design

## Motion (added 5 Oct 2026, after the user asked for a Framer/Webflow feel)
Library: `motion` (the Framer Motion successor), imported from `motion/react`. `MotionConfig reducedMotion="user"` wraps the app.
- Springs: shared-layout pills `bounce 0.2, duration 0.5–0.6`; entrances `bounce 0.2, duration 0.8`; UI feedback `bounce 0.25–0.3, duration 0.4–0.5`.
- Landing, in order:
  - Centred hero with a word-by-word blur reveal.
  - A real product window that tilts back and flattens as you scroll (useScroll + useTransform + useSpring).
  - A marquee of the platform calls.
  - Sticky "life of a milestone" scrollytelling: five chapters (agree, lock, verify, release, agent) drive the money orbit; the active chapter is the one crossing the screen's middle.
  - "Try the checker": passed criteria fly from **Held** to **Released** (shared layoutId) while both totals count.
  - Bento tiles that are small working demos.
- App:
  - Sliding nav pill and approval-choice pill (layoutId).
  - Enter-only page transition, because exit animations fight the App Router.
  - Spring modal, and a morphing "Approve hold → Authorizing… → Held" button.
  - Toasts that stack and swipe away.
  - Criteria that animate in and out.
  - Agent checks with drawn checkmarks.
  - Agents page: a spend-limit bar with a dashed cap line that shakes when a release would go over it.
- Research notes: Framer Awards 2025 and Webflow Awards 2025 winners (Checkout.com, Razorpay, Perplexity, Miro, Panton × Vitra), plus the motion.dev docs. The type scale follows them: H1 64–80px at −0.04em, weight 600; H2 40–56px.

## Not done yet (ideas for later)
Replay verification with a time scrubber, odometer digits, view transitions between the log and the report, light theme.
