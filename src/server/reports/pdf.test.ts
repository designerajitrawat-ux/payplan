import { describe, expect, it } from "vitest";
import { reportPdf, type VerifiedReport } from "./pdf";

const report = (criteria = 4): VerifiedReport => ({
  reportHash: "a".repeat(64),
  signature: "c2lnbmF0dXJl".repeat(8),
  valid: true,
  payload: {
    milestone: { id: "m_1", number: 42, title: "Landing page for Northwind (v2)", specHash: "b".repeat(64), amountCents: 100000, currency: "USD", client: "Sam Carter", freelancer: "Riya Sharma" },
    attempt: 2,
    verifiedAt: "2026-11-03T10:00:00.000Z",
    checker: "rules + AI rubric",
    criteria: Array.from({ length: criteria }, (_, i) => ({ id: `c${i}`, title: `Criterion “${i}” · headline`, weight: Math.round(100 / criteria), mustPass: i === 0 })),
    results: Array.from({ length: criteria }, (_, i) => ({ criterionId: `c${i}`, verdict: i === 1 ? "fail" : "pass", confidence: 0.93, evidence: "HTTP 200, hero reads the approved headline", reason: "The page shows it" })),
    releasableCents: 75000,
    paypal: { orderId: "ORDER-1", authorizationId: "AUTH-1" },
  },
  paypalMoves: [
    { kind: "authorization", amountCents: 100000, paypalId: "AUTH-1", at: new Date("2026-11-03T09:00:00Z") },
    { kind: "capture", amountCents: 75000, paypalId: "CAP-1", at: new Date("2026-11-03T10:05:00Z") },
  ],
});

const text = (bytes: Uint8Array) => Buffer.from(bytes).toString("latin1");

describe("report PDF", () => {
  it("is a well-formed PDF whose cross-reference table points at every object", () => {
    const pdf = text(reportPdf(report(), "https://payplan.test/r/aaa"));
    expect(pdf.startsWith("%PDF-1.4\n")).toBe(true);
    expect(pdf.trimEnd().endsWith("%%EOF")).toBe(true);
    const xrefAt = Number(pdf.match(/startxref\n(\d+)\n/)![1]);
    expect(pdf.slice(xrefAt, xrefAt + 4)).toBe("xref");
    const offsets = [...pdf.slice(xrefAt).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
    offsets.forEach((o, i) => expect(pdf.slice(o, o + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`));
  });

  it("carries what a dispute reviewer needs: verdicts, PayPal ids, hashes and the verify link", () => {
    const pdf = text(reportPdf(report(), "https://payplan.test/r/aaa"));
    for (const s of ["M-42", "Landing page for Northwind \\(v2\\)", "NOT MET", "PASSED, confidence 93%", "CAP-1", "AUTH-1", "https://payplan.test/r/aaa", "a".repeat(40)]) expect(pdf).toContain(s);
    // Curly quotes and the middle dot become plain ASCII that Helvetica can show.
    expect(pdf).toContain('Criterion "0" - headline');
  });

  it("flows a long report onto more pages", () => {
    const pdf = text(reportPdf(report(40), "https://payplan.test/r/aaa"));
    expect(Number(pdf.match(/\/Count (\d+)/)![1])).toBeGreaterThan(1);
  });
});
