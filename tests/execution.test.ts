import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { computeFill, costProfile } from "@/lib/execution";
import { place, remove, clearAll, loadAll, type ExecutionLeg } from "@/lib/executions";

// Mirrors tests/storage.test.ts's in-memory localStorage stand-in — the
// executions module guards on `typeof window === "undefined"` exactly the
// way storage.ts does, and vitest's default "node" environment has no
// `window` by default.
function fakeLocalStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
  };
}

describe("computeFill", () => {
  it("prices a buy worse than the zero-cost arrival by spread + impact", () => {
    // UST10Y: rate profile, spreadBp 0.5, impactBpPerMM 0.05.
    const fill = computeFill("UST10Y", "buy", 2_000_000, 1.2);
    expect(fill.arrivalPct).toBeCloseTo(1.2, 10);
    // totalCostBp = 0.5 + 0.05 * 2 = 0.6bp
    expect(fill.totalCostBp).toBeCloseTo(0.6, 10);
    expect(fill.fillPct).toBeCloseTo(1.2 - 0.6 / 100, 10);
    expect(fill.fillPct).toBeLessThan(fill.arrivalPct);
  });

  it("flips the arrival return for a sell, cost still working against the position", () => {
    const fill = computeFill("UST10Y", "sell", 1_000_000, 1.2);
    // arrival for a short is -pricePct
    expect(fill.arrivalPct).toBeCloseTo(-1.2, 10);
    expect(fill.fillPct).toBeLessThan(fill.arrivalPct);
  });

  it("scales market impact with notional but keeps spread flat regardless of size", () => {
    const small = computeFill("SPX", "buy", 100_000, 2);
    const large = computeFill("SPX", "buy", 10_000_000, 2);
    const profile = costProfile("SPX");
    expect(small.totalCostBp).toBeCloseTo(profile.spreadBp + profile.impactBpPerMM * 0.1, 10);
    expect(large.totalCostBp).toBeCloseTo(profile.spreadBp + profile.impactBpPerMM * 10, 10);
    expect(large.totalCostBp).toBeGreaterThan(small.totalCostBp);
  });

  it("floors commission at the asset class's minimum ticket", () => {
    // IG corporate: commissionBp 0.5, commissionMin 15. A tiny notional's bp
    // commission (well under $15) must still floor at the minimum.
    const fill = computeFill("IG", "buy", 1_000, 0.5);
    expect(fill.commission).toBeCloseTo(15, 10);
  });

  it("computes gross P&L with no cost applied and net P&L with cost + commission deducted", () => {
    const fill = computeFill("SPX", "buy", 1_000_000, 3);
    expect(fill.grossPnl).toBeCloseTo((1_000_000 * 3) / 100, 10);
    const expectedNet = (1_000_000 * fill.fillPct) / 100 - fill.commission;
    expect(fill.netPnl).toBeCloseTo(expectedNet, 10);
    expect(fill.netPnl).toBeLessThan(fill.grossPnl);
  });

  it("charges zero commission on a liquid G10 FX pair but still applies a (small) spread cost", () => {
    const fill = computeFill("EURUSD", "buy", 5_000_000, 0.4);
    expect(fill.commission).toBe(0);
    expect(fill.totalCostBp).toBeGreaterThan(0);
  });

  it("falls back to a conservative default profile for an unknown asset id rather than throwing", () => {
    expect(() => computeFill("NOT_A_REAL_ASSET", "buy", 100_000, 1)).not.toThrow();
    const fill = computeFill("NOT_A_REAL_ASSET", "buy", 100_000, 1);
    expect(fill.totalCostBp).toBeGreaterThan(0);
  });

  it("returns zero notional/commission for a zero-size order without dividing by zero", () => {
    const fill = computeFill("SPX", "buy", 0, 2);
    expect(fill.commission).toBe(0);
    expect(fill.grossPnl).toBe(0);
    expect(Number.isFinite(fill.netPnl)).toBe(true);
  });
});

// executions.ts dispatches a plain DOM event on every write (the same
// CHANGE_EVENT mechanism lib/storage.ts uses) — a real EventTarget behind
// the fake window, not just a plain object, so addEventListener/
// dispatchEvent actually work for the "notifies listeners" test below. Node
// has had a global EventTarget/Event since well before this project's
// minimum supported version.
function fakeWindow() {
  const target = new EventTarget() as EventTarget & { localStorage: ReturnType<typeof fakeLocalStorage> };
  target.localStorage = fakeLocalStorage();
  return target;
}

describe("order blotter persistence (lib/executions.ts)", () => {
  beforeEach(() => {
    vi.stubGlobal("window", fakeWindow());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function leg(assetId: string, side: "buy" | "sell", notional: number, pricePct: number, label: string): ExecutionLeg {
    return { ...computeFill(assetId, side, notional, pricePct), label };
  }

  it("round-trips a single-leg order through place/loadAll", () => {
    const l = leg("SPX", "buy", 500_000, 2, "Buy US Large Cap");
    const order = place("single", [l], "Custom scenario", 12, 1_000);
    expect(order.netPnl).toBeCloseTo(l.netPnl, 10);

    const all = loadAll();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(order.id);
    expect(all[0].legs).toHaveLength(1);
  });

  it("sums leg-level gross/commission/net into the order totals for a pair order", () => {
    const longLeg = leg("UST10Y", "buy", 500_000, 1.1, "Long UST 10Y");
    const shortLeg = leg("SPX", "sell", 500_000, 2.3, "Short US Large Cap");
    const order = place("pair", [longLeg, shortLeg], "Credit Shortage", 6, 2_000);

    expect(order.grossPnl).toBeCloseTo(longLeg.grossPnl + shortLeg.grossPnl, 10);
    expect(order.commission).toBeCloseTo(longLeg.commission + shortLeg.commission, 10);
    expect(order.netPnl).toBeCloseTo(longLeg.netPnl + shortLeg.netPnl, 10);
  });

  it("lists newest first", () => {
    place("single", [leg("SPX", "buy", 100_000, 1, "Buy US Large Cap")], "Custom scenario", 12, 1_000);
    place("single", [leg("GOLD", "buy", 100_000, 1, "Buy Gold")], "Custom scenario", 12, 2_000);
    const all = loadAll();
    expect(all).toHaveLength(2);
    expect(all[0].ts).toBe(2_000);
    expect(all[1].ts).toBe(1_000);
  });

  it("removes a single order by id and leaves the rest untouched", () => {
    const a = place("single", [leg("SPX", "buy", 100_000, 1, "Buy US Large Cap")], "Custom scenario", 12, 1_000);
    const b = place("single", [leg("GOLD", "buy", 100_000, 1, "Buy Gold")], "Custom scenario", 12, 2_000);
    const remaining = remove(a.id);
    expect(remaining.map((o) => o.id)).toEqual([b.id]);
    expect(loadAll().map((o) => o.id)).toEqual([b.id]);
  });

  it("clearAll empties the blotter", () => {
    place("single", [leg("SPX", "buy", 100_000, 1, "Buy US Large Cap")], "Custom scenario", 12, 1_000);
    clearAll();
    expect(loadAll()).toEqual([]);
  });

  it("drops malformed records instead of throwing", () => {
    window.localStorage.setItem("msp.executions.v1", "{not json");
    expect(() => loadAll()).not.toThrow();
    expect(loadAll()).toEqual([]);
  });

  it("dispatches a change event on every write", () => {
    const handler = vi.fn();
    window.addEventListener("msp:executions-changed", handler);
    place("single", [leg("SPX", "buy", 100_000, 1, "Buy US Large Cap")], "Custom scenario", 12, 1_000);
    expect(handler).toHaveBeenCalledTimes(1);
    window.removeEventListener("msp:executions-changed", handler);
  });
});
