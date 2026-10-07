import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { eq, sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { createPgliteDb, type Db } from "./db/client";
import { reports } from "./db/schema";
import { createMilestoneService } from "./milestones/service";
import { createSimulatedPayPal } from "./paypal/simulated";
import { generateSigningKeyPem, memorySigner, signerFromEnv, verifySignature } from "./signing";

describe("signing", () => {
  it("signs and verifies, and catches any change", () => {
    const s = memorySigner();
    const sig = s.sign('{"a":1}');
    expect(verifySignature('{"a":1}', sig, s.publicKeyPem)).toBe(true);
    expect(verifySignature('{"a":2}', sig, s.publicKeyPem)).toBe(false);
    expect(verifySignature('{"a":1}', sig, memorySigner().publicKeyPem)).toBe(false);
    expect(s.keyId).toMatch(/^[0-9a-f]{16}$/);
  });

  it("reads the key from the environment, as PEM or one-line base64", () => {
    const pem = generateSigningKeyPem();
    const a = signerFromEnv({ REPORT_SIGNING_KEY: pem });
    const b = signerFromEnv({ REPORT_SIGNING_KEY: Buffer.from(pem).toString("base64") });
    expect(a.source).toBe("env");
    expect(a.keyId).toBe(b.keyId);
  });

  it("keeps a local key on disk so local reports stay verifiable after a restart", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "payplan-key-"));
    const first = signerFromEnv({ NODE_ENV: "development" }, dir);
    const second = signerFromEnv({ NODE_ENV: "development" }, dir);
    expect(first.source).toBe("local-file");
    expect(second.keyId).toBe(first.keyId);
    expect(signerFromEnv({ NODE_ENV: "production" }, dir).source).toBe("memory");
  });
});

describe("verifyReport", () => {
  let db: Db;
  beforeAll(async () => {
    db = await createPgliteDb();
  }, 30_000);

  async function reported(signer = memorySigner()) {
    const pp = createSimulatedPayPal();
    const svc = createMilestoneService({ db, paypal: pp.gateway, signer });
    const id = await svc.createMilestone({
      workspaceId: `ws-sign-${Math.random()}`,
      title: "Logo for Chai Point",
      clientName: "Sam",
      clientEmail: "sam@n.test",
      freelancerName: "Riya",
      freelancerEmail: "riya@x.in",
      amountCents: 30000,
      reviewWindowHours: 48,
      criteria: [
        { title: "Three concepts as SVG", weight: 60, mustPass: true, evidence: "pdf", check: "ai" },
        { title: "Works in one colour", weight: 40, mustPass: false, evidence: "image", check: "ai" },
      ],
    });
    const order = await svc.startFunding(id);
    pp.approve(order.id);
    await svc.completeFunding(id, { orderId: order.id });
    await svc.submitWork(id, { url: "https://x.example" });
    const report = await svc.recordReport(id, {
      model: "test",
      results: [
        { criterionId: `${id}-c1`, verdict: "pass", confidence: 0.95, evidence: "3 SVGs", reason: "Three concepts." },
        { criterionId: `${id}-c2`, verdict: "fail", confidence: 0.9, evidence: "Uses gradients", reason: "Not one colour." },
      ],
    });
    return { svc, report, id };
  }

  it("confirms a genuine report and shows what it covers", async () => {
    const { svc, report } = await reported();
    const v = await svc.verifyReport(report.reportHash);
    expect(v).toMatchObject({ valid: true, hashMatches: true, signatureValid: true, knownKey: true });
    expect(v!.payload).toMatchObject({ type: "payplan.acceptance-report", attempt: 1, releasableCents: 18000, milestone: { title: "Logo for Chai Point", amountCents: 30000 } });
    expect(v!.paypalMoves.map((m) => m.kind)).toEqual(["authorization"]);
  });

  it("flags a report that was changed after signing", async () => {
    const { svc, report } = await reported();
    await db
      .update(reports)
      .set({ payload: sql`jsonb_set(${reports.payload}, '{releasableCents}', '30000')` })
      .where(eq(reports.reportHash, report.reportHash));
    expect(await svc.verifyReport(report.reportHash)).toMatchObject({ valid: false, hashMatches: false });
  });

  it("does not vouch for a report signed by another key", async () => {
    const { report } = await reported(memorySigner());
    const other = createMilestoneService({ db, paypal: createSimulatedPayPal().gateway, signer: memorySigner() });
    expect(await other.verifyReport(report.reportHash)).toMatchObject({ valid: false, knownKey: false, publicKey: null });
    expect(await other.verifyReport("0".repeat(64))).toBeUndefined();
  });
});
