import { describe, expect, it } from "vitest";
import { ledgerAt, PHASES, RESULTS, stationAt, STATIONS } from "./journey-scene";

describe("3D journey timeline", () => {
  it("holds nothing before the lock closes and $1,000 after", () => {
    expect(ledgerAt(0)).toEqual({ held: 0, released: 0 });
    expect(ledgerAt(PHASES.lock[1])).toEqual({ held: 1000, released: 0 });
  });

  it("releases $200 per passed criterion and keeps the failed share held", () => {
    const passed = RESULTS.filter(Boolean).length;
    expect(ledgerAt(1)).toEqual({ held: 1000 - passed * 200, released: passed * 200 });
    expect(ledgerAt(1)).toEqual({ held: 200, released: 800 });
  });

  it("never releases money while it is still being checked", () => {
    for (let p = 0; p <= PHASES.verify[1]; p += 0.01) expect(ledgerAt(p).released).toBe(0);
  });

  it("walks the stations in order", () => {
    expect(stationAt(0)).toBe(0);
    expect(stationAt(1)).toBe(STATIONS.length - 1);
    let last = 0;
    for (let p = 0; p <= 1; p += 0.01) {
      const s = stationAt(p);
      expect(s).toBeGreaterThanOrEqual(last);
      last = s;
    }
  });
});
