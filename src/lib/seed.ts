import { landingPagePreset, logoPreset } from "./criteria-presets";
import { fakePayPalId, previewHash } from "./format";
import type { Criterion, Milestone, Report } from "./types";

const HOUR = 3_600_000;

function withIds(prefix: string, presets: Omit<Criterion, "id">[]): Criterion[] {
  return presets.map((p, i) => ({ ...p, id: `${prefix}-c${i + 1}` }));
}

function firstReport(criteria: Criterion[], at: string): Report {
  const results = criteria.map((c) => ({ criterionId: c.id, ...c.demo.first }));
  return { attempt: 1, results, verifiedAt: at, reportHash: previewHash(JSON.stringify(results) + at) };
}

const iso = (t: number) => new Date(t).toISOString();

/** Dummy milestones for the prototype. Times are relative to `now` so countdowns stay meaningful. */
export function makeSeed(now: number): Milestone[] {
  const logoCriteria = withIds("m-1039", logoPreset);
  const deckCriteria = withIds("m-1045", landingPagePreset).map((c, i) => ({
    ...c,
    title: [
      "All 12 slides delivered as PDF and Figma",
      "Uses the new brand template",
      "Charts match the numbers in the brief",
      "Speaker notes on every slide",
      "No spelling mistakes",
    ][i],
  }));
  const photoPass = (confidence: number, evidence: string, reason: string) => {
    const r = { verdict: "pass" as const, confidence, evidence, reason };
    return { first: r, afterFix: r };
  };
  const photoCriteria: Criterion[] = [
    { title: "20 photos delivered at 3000 px", weight: 30, mustPass: true, evidence: "image", check: "automatic", demo: photoPass(0.99, "20 files, all 3000 × 3000 px", "Every photo was delivered at the agreed size.") },
    { title: "Background removed cleanly", weight: 25, mustPass: false, evidence: "image", check: "ai", demo: photoPass(0.9, "Edges checked on all 20 photos", "No leftover background or halos found.") },
    { title: "Consistent lighting across the set", weight: 25, mustPass: false, evidence: "image", check: "ai", demo: photoPass(0.86, "Brightness varies by less than 5% across the set", "The set looks consistent side by side.") },
    {
      title: "Shadows match the reference",
      weight: 20,
      mustPass: false,
      evidence: "image",
      check: "ai",
      demo: {
        first: { verdict: "fail", confidence: 0.81, evidence: "4 of 20 photos have no shadow", reason: "Shadows are missing on 4 photos." },
        afterFix: { verdict: "pass", confidence: 0.84, evidence: "All 20 photos have a soft shadow like the reference", reason: "Shadows now match the reference." },
      },
    },
  ].map((c, i) => ({ ...c, id: `m-1050-c${i + 1}` }) as Criterion);

  const t1039 = now - 9 * 24 * HOUR;
  const t1050 = now - 2 * 24 * HOUR;
  const photoReport = firstReport(photoCriteria, iso(t1050 + 30 * HOUR));

  return [
    {
      id: "m-1039",
      title: "Logo set for Brewly Coffee",
      clientName: "Ana Ruiz",
      clientEmail: "ana@brewly.example",
      freelancerName: "Riya Sharma",
      freelancerLocation: "Pune, India",
      boughtByAgent: false,
      amount: 400,
      currency: "USD",
      reviewWindowHours: 48,
      fixWindowHours: 72,
      criteria: logoCriteria,
      specHash: previewHash(JSON.stringify(logoCriteria)),
      status: "released",
      createdAt: iso(t1039),
      fundedAt: iso(t1039 + 2 * HOUR),
      submission: { url: "", prLink: "", files: ["brewly-logo-concepts.pdf", "logo.svg", "logo.png"], note: "", submittedAt: iso(t1039 + 50 * HOUR) },
      reports: [firstReport(logoCriteria, iso(t1039 + 51 * HOUR))],
      ledger: [
        { id: fakePayPalId("AUTH", "1039a"), kind: "authorization", amount: 400, at: iso(t1039 + 2 * HOUR), note: "Client approved the hold in PayPal" },
        { id: fakePayPalId("CAP", "1039c"), kind: "capture", amount: 400, at: iso(t1039 + 60 * HOUR), note: "All criteria passed; client accepted" },
      ],
    },
    {
      id: "m-1045",
      title: "Pitch deck redesign (12 slides)",
      clientName: "Sam Carter",
      clientEmail: "sam@northwind.example",
      freelancerName: "Riya Sharma",
      freelancerLocation: "Pune, India",
      boughtByAgent: false,
      amount: 1500,
      currency: "USD",
      reviewWindowHours: 48,
      fixWindowHours: 72,
      criteria: deckCriteria,
      specHash: previewHash(JSON.stringify(deckCriteria)),
      status: "funded",
      createdAt: iso(now - 3 * 24 * HOUR),
      fundedAt: iso(now - 3 * 24 * HOUR + 4 * HOUR),
      reports: [],
      ledger: [
        { id: fakePayPalId("AUTH", "1045a"), kind: "authorization", amount: 1500, at: iso(now - 3 * 24 * HOUR + 4 * HOUR), note: "Client approved the hold in PayPal" },
      ],
    },
    {
      id: "m-1050",
      title: "Retouch 20 product photos",
      clientName: "Sam's buyer agent",
      clientEmail: "agent@northwind.example",
      freelancerName: "Riya Sharma",
      freelancerLocation: "Pune, India",
      boughtByAgent: true,
      amount: 250,
      currency: "USD",
      reviewWindowHours: 24,
      fixWindowHours: 72,
      criteria: photoCriteria,
      specHash: previewHash(JSON.stringify(photoCriteria)),
      status: "fix_window",
      createdAt: iso(t1050),
      fundedAt: iso(t1050 + HOUR),
      fixDueAt: iso(t1050 + 32 * HOUR + 72 * HOUR),
      submission: { url: "", prLink: "", files: ["photos-batch-1.zip"], note: "", submittedAt: iso(t1050 + 29 * HOUR) },
      reports: [photoReport],
      ledger: [
        { id: fakePayPalId("AUTH", "1050a"), kind: "authorization", amount: 250, at: iso(t1050 + HOUR), note: "Agent requested funding; Sam approved once in PayPal" },
        { id: fakePayPalId("CAP", "1050c"), kind: "capture", amount: 200, at: iso(t1050 + 32 * HOUR), note: "Agent accepted 80% after reading the report" },
      ],
    },
  ];
}
