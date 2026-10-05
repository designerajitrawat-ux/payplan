import type { Criterion } from "./types";

type Preset = Omit<Criterion, "id">;

const pass = (confidence: number, evidence: string, reason: string) =>
  ({ verdict: "pass", confidence, evidence, reason }) as const;

export const landingPagePreset: Preset[] = [
  {
    title: "Page is live and loads over HTTPS",
    weight: 20,
    mustPass: true,
    evidence: "url",
    check: "automatic",
    demo: {
      first: pass(0.99, "HTTP 200 in 412 ms, valid TLS certificate", "The page loaded on the first try."),
      afterFix: pass(0.99, "HTTP 200 in 398 ms, valid TLS certificate", "The page loaded on the first try."),
    },
  },
  {
    title: "Hero uses the approved headline and call to action",
    weight: 20,
    mustPass: false,
    evidence: "url",
    check: "ai",
    demo: {
      first: pass(0.93, "Screenshot at 1440 px; headline and button text match the brief", "Headline and button label match the approved copy word for word."),
      afterFix: pass(0.93, "Screenshot at 1440 px; headline and button text match the brief", "Headline and button label match the approved copy word for word."),
    },
  },
  {
    title: "Works on mobile at 375 px with no sideways scrolling",
    weight: 20,
    mustPass: false,
    evidence: "url",
    check: "automatic",
    demo: {
      first: pass(0.97, "Screenshot at 375 px; content width 375 px, no overflow", "Every section fits the phone width."),
      afterFix: pass(0.97, "Screenshot at 375 px; content width 375 px, no overflow", "Every section fits the phone width."),
    },
  },
  {
    title: "Contact form sends a message",
    weight: 20,
    mustPass: false,
    evidence: "url",
    check: "automatic",
    demo: {
      first: {
        verdict: "fail",
        confidence: 0.98,
        evidence: "Test message returned HTTP 500 from /api/contact",
        reason: "The form's submit request failed, so visitor messages would be lost.",
      },
      afterFix: pass(0.98, "Test message returned HTTP 200; confirmation shown", "The test message went through and the visitor saw a confirmation."),
    },
  },
  {
    title: "Colours and logo follow the style guide",
    weight: 20,
    mustPass: false,
    evidence: "image",
    check: "ai",
    demo: {
      first: pass(0.88, "6 of 6 colours match the style guide; logo matches the supplied file", "Brand colours and logo are used as specified."),
      afterFix: pass(0.88, "6 of 6 colours match the style guide; logo matches the supplied file", "Brand colours and logo are used as specified."),
    },
  },
];

export const logoPreset: Preset[] = [
  {
    title: "Three distinct logo concepts delivered",
    weight: 30,
    mustPass: true,
    evidence: "pdf",
    check: "ai",
    demo: {
      first: pass(0.95, "PDF with 3 concepts on separate pages", "Three clearly different directions were delivered."),
      afterFix: pass(0.95, "PDF with 3 concepts on separate pages", "Three clearly different directions were delivered."),
    },
  },
  {
    title: "Final files in SVG and PNG",
    weight: 25,
    mustPass: false,
    evidence: "image",
    check: "automatic",
    demo: {
      first: pass(0.99, "logo.svg (vector) and logo.png (2048 px) found", "Both formats were delivered and open correctly."),
      afterFix: pass(0.99, "logo.svg (vector) and logo.png (2048 px) found", "Both formats were delivered and open correctly."),
    },
  },
  {
    title: "Readable at 32 px and in one colour",
    weight: 25,
    mustPass: false,
    evidence: "image",
    check: "ai",
    demo: {
      first: pass(0.86, "Rendered at 32 px and in black on white", "The mark stays legible small and without colour."),
      afterFix: pass(0.86, "Rendered at 32 px and in black on white", "The mark stays legible small and without colour."),
    },
  },
  {
    title: "Uses the brand colours from the brief",
    weight: 20,
    mustPass: false,
    evidence: "image",
    check: "ai",
    demo: {
      first: pass(0.91, "Primary #1E5B4F and accent #F2B544 detected", "Colours match the brief."),
      afterFix: pass(0.91, "Primary #1E5B4F and accent #F2B544 detected", "Colours match the brief."),
    },
  },
];

/** Simulated AI helper: picks criteria from a pasted brief. The real version calls the AI model. */
/** Criteria that fit almost any creative brief, for when the brief is not a website or a logo. */
export const genericPreset: Preset[] = [
  {
    title: "Every agreed deliverable is handed over",
    weight: 30,
    mustPass: true,
    evidence: "pdf",
    check: "automatic",
    demo: {
      first: pass(0.99, "All files named in the brief were received", "Nothing that was agreed is missing."),
      afterFix: pass(0.99, "All files named in the brief were received", "Nothing that was agreed is missing."),
    },
  },
  {
    title: "Matches what the brief asks for",
    weight: 30,
    mustPass: false,
    evidence: "image",
    check: "ai",
    demo: {
      first: pass(0.9, "Each request in the brief maps to delivered work", "The work covers every point in the brief."),
      afterFix: pass(0.9, "Each request in the brief maps to delivered work", "The work covers every point in the brief."),
    },
  },
  {
    title: "Follows the brand or style guide",
    weight: 20,
    mustPass: false,
    evidence: "image",
    check: "ai",
    demo: {
      first: { verdict: "fail", confidence: 0.84, evidence: "2 of 8 items use colours outside the style guide", reason: "Two items use colours that are not in the style guide." },
      afterFix: pass(0.88, "8 of 8 items use the style guide colours", "Every item now follows the style guide."),
    },
  },
  {
    title: "Delivered in the agreed sizes and formats",
    weight: 20,
    mustPass: false,
    evidence: "image",
    check: "automatic",
    demo: {
      first: pass(0.98, "Sizes and file types match the brief", "Every file has the agreed size and format."),
      afterFix: pass(0.98, "Sizes and file types match the brief", "Every file has the agreed size and format."),
    },
  },
];

export type Suggestion = { kind: "website" | "logo" | "general"; criteria: Preset[] };

/** Stands in for the AI helper: picks criteria from the brief, and says when it could only offer general ones. */
export function suggestCriteria(brief: string): Suggestion {
  const text = brief.toLowerCase();
  const isWebsite = ["landing", "website", "web page", "webpage", "homepage", "site"].some((w) => text.includes(w));
  if (isWebsite) return { kind: "website", criteria: landingPagePreset };
  if (text.includes("logo") || text.includes("brand mark")) return { kind: "logo", criteria: logoPreset };
  return { kind: "general", criteria: genericPreset };
}

export function genericCriterion(title: string): Preset {
  return {
    title,
    weight: 0,
    mustPass: false,
    evidence: "url",
    check: "ai",
    demo: {
      first: pass(0.9, "Checked against the delivered work", "This criterion is met."),
      afterFix: pass(0.9, "Checked against the delivered work", "This criterion is met."),
    },
  };
}
