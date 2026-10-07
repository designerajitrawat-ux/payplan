import { describe, expect, it } from "vitest";
import { canonicalJson, moneyTotals, releasableCents, sha256 } from "./rules";

const crit = (id: string, weight: number, mustPass = false) => ({ id, weight, mustPass });

describe("releasableCents", () => {
  it("pays the passed weights, rounded down to the cent", () => {
    const criteria = [crit("a", 1), crit("b", 1), crit("c", 1)];
    expect(releasableCents(criteria, [{ criterionId: "a", verdict: "pass" }], 100)).toBe(33);
    expect(releasableCents(criteria, ["a", "b"].map((criterionId) => ({ criterionId, verdict: "pass" as const })), 100)).toBe(66);
    expect(releasableCents(criteria, ["a", "b", "c"].map((criterionId) => ({ criterionId, verdict: "pass" as const })), 29)).toBe(29);
  });

  it("pays nothing when a must-pass criterion did not pass", () => {
    const criteria = [crit("gate", 10, true), crit("b", 90)];
    expect(releasableCents(criteria, [{ criterionId: "gate", verdict: "review" }, { criterionId: "b", verdict: "pass" }], 80000)).toBe(0);
  });

  it("never pays more than was authorized", () => {
    expect(releasableCents([crit("a", 100)], [{ criterionId: "a", verdict: "pass" }], 80000)).toBe(80000);
    expect(releasableCents([crit("a", 0)], [{ criterionId: "a", verdict: "pass" }], 80000)).toBe(0);
  });
});

describe("moneyTotals", () => {
  it("counts pending captures as spent, but not as captured", () => {
    const t = moneyTotals([
      { kind: "authorization", status: "completed", amountCents: 80000 },
      { kind: "capture", status: "completed", amountCents: 60000 },
      { kind: "capture", status: "pending", amountCents: 10000 },
      { kind: "capture", status: "failed", amountCents: 20000 },
    ]);
    expect(t).toEqual({ authorized: 80000, captured: 60000, voided: 0, pending: 10000, held: 20000, available: 10000 });
  });
});

describe("hashing", () => {
  it("does not depend on key order", () => {
    expect(canonicalJson({ b: 1, a: [{ d: 2, c: 3 }] })).toBe('{"a":[{"c":3,"d":2}],"b":1}');
    expect(sha256({ x: 1, y: 2 })).toBe(sha256({ y: 2, x: 1 }));
    expect(sha256({ x: 1 })).not.toBe(sha256({ x: 2 }));
  });
});
