// The signed acceptance report as a PDF, the format PayPal accepts as dispute evidence.
// A small hand-written PDF (Helvetica, text only), so no PDF library is needed on the server.

import type { CriterionResultJson } from "../db/schema";

export type ReportPayload = {
  milestone: { id: string; number: number; title: string; specHash: string; amountCents: number; currency: string; client: string; freelancer: string };
  attempt: number;
  verifiedAt: string;
  checker: string;
  criteria: { id: string; title: string; weight: number; mustPass: boolean }[];
  results: CriterionResultJson[];
  releasableCents: number;
  paypal: { orderId: string | null; authorizationId: string | null };
};

export type VerifiedReport = {
  reportHash: string;
  payload: unknown;
  signature: string;
  valid: boolean;
  paypalMoves: { kind: string; amountCents: number; paypalId: string | null; at: Date | null }[];
};

type Line = { text: string; size: number; bold?: boolean; gap?: number };

const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN = 50;
const usd = (cents: number) => `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Helvetica in a PDF speaks WinAnsi; anything outside plain ASCII is swapped for a close match. */
function ascii(text: string) {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/·/g, "-")
    .replace(/→/g, "->")
    .replace(/[^\x20-\x7e]/g, "?");
}

const escape = (text: string) => ascii(text).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

/** Wraps on spaces, and breaks words that are longer than a line (hashes, signatures). */
function wrap(text: string, size: number, width = PAGE_W - 2 * MARGIN) {
  const max = Math.max(10, Math.floor(width / (size * 0.56)));
  const out: string[] = [];
  let line = "";
  for (const word of ascii(text).split(/\s+/)) {
    for (let w = word; w.length; ) {
      const room = max - (line ? line.length + 1 : 0);
      if (w.length <= room) {
        line = line ? `${line} ${w}` : w;
        w = "";
      } else if (!line && w.length > max) {
        out.push(w.slice(0, max));
        w = w.slice(max);
      } else {
        out.push(line);
        line = "";
      }
    }
  }
  if (line) out.push(line);
  return out.length ? out : [""];
}

function reportLines(r: VerifiedReport, verifyUrl: string): Line[] {
  const p = r.payload as ReportPayload;
  const lines: Line[] = [];
  const add = (text: string, size = 10, bold = false, gap = 0) => wrap(text, size).forEach((t, i) => lines.push({ text: t, size, bold, gap: i === 0 ? gap : 0 }));

  add("PayPlan acceptance report", 18, true);
  add(`Milestone M-${p.milestone.number}: ${p.milestone.title}`, 12, true, 6);
  add(`Freelancer: ${p.milestone.freelancer} | Client: ${p.milestone.client} | Amount: ${usd(p.milestone.amountCents)} ${p.milestone.currency}`, 10, false, 4);
  add(`Checked ${p.verifiedAt} (UTC) by ${p.checker}, attempt ${p.attempt}. Releasable by this report: ${usd(p.releasableCents)}.`);
  add(`Report signature: ${r.valid ? "valid (Ed25519, checked when this PDF was made)" : "NOT VALID"}`, 10, true, 4);

  add("What was agreed, and what the checker found", 13, true, 14);
  add("Both sides agreed these criteria and weights before any money moved. The agreement id below is the SHA-256 of that spec, so it cannot have changed afterwards.", 9);
  for (const c of p.criteria) {
    const v = p.results.find((x) => x.criterionId === c.id);
    const verdict = v ? { pass: "PASSED", fail: "NOT MET", review: "NEEDS A PERSON" }[v.verdict] : "NOT CHECKED";
    add(`${c.title} (${c.weight}%${c.mustPass ? ", must pass" : ""}): ${verdict}${v ? `, confidence ${Math.round(v.confidence * 100)}%` : ""}`, 10, true, 8);
    if (v) {
      add(`Reason: ${v.reason}`, 9);
      add(`Evidence: ${v.evidence}`, 9);
    }
  }

  add("PayPal", 13, true, 14);
  add(`Order ${p.paypal.orderId ?? "none"}. Authorization ${p.paypal.authorizationId ?? "none"}.`);
  for (const m of r.paypalMoves) add(`${m.kind} ${m.paypalId ?? ""}: ${usd(m.amountCents)}${m.at ? ` on ${m.at.toISOString()}` : ""}`, 9);

  add("Check it yourself", 13, true, 14);
  add(`Agreement id (SHA-256 of the spec): ${p.milestone.specHash}`, 8);
  add(`Report id (SHA-256 of the report): ${r.reportHash}`, 8);
  add(`Signature (Ed25519, base64): ${r.signature}`, 8);
  add(`Verify online: ${verifyUrl}`, 9, false, 4);
  add("PayPal is a trademark of PayPal, Inc.; PayPlan is not affiliated with PayPal.", 8, false, 10);
  return lines;
}

/** Lays the lines out on A4 pages, top to bottom, and returns one content stream per page. */
function paginate(lines: Line[]) {
  const pages: string[][] = [[]];
  let y = PAGE_H - MARGIN;
  for (const l of lines) {
    const step = l.size * 1.35 + (l.gap ?? 0);
    if (y - step < MARGIN) {
      pages.push([]);
      y = PAGE_H - MARGIN;
    }
    y -= step;
    pages.at(-1)!.push(`BT /${l.bold ? "F2" : "F1"} ${l.size} Tf ${MARGIN} ${y.toFixed(1)} Td (${escape(l.text)}) Tj ET`);
  }
  return pages.map((ops) => ops.join("\n"));
}

/** Builds the PDF bytes for a verified report. `verifyUrl` is the public page anyone can check it on. */
export function reportPdf(r: VerifiedReport, verifyUrl: string): Uint8Array {
  const streams = paginate(reportLines(r, verifyUrl));
  // Objects: 1 catalog, 2 page tree, 3 and 4 fonts, then a page and its content stream per page.
  const objects: string[] = [];
  const kids = streams.map((_, i) => `${5 + i * 2} 0 R`).join(" ");
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push(`<< /Type /Pages /Kids [${kids}] /Count ${streams.length} >>`);
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  streams.forEach((stream, i) => {
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${6 + i * 2} 0 R >>`);
    objects.push(`<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`);
  });

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(pdf, "latin1"));
}
