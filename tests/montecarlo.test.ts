import { describe, expect, it } from "vitest";
import { monteCarloVaR } from "@/lib/montecarlo";
import { baselineState } from "@/lib/vars";
import type { ScenarioInput } from "@/lib/engine";

const base: ScenarioInput = {
  state: baselineState(),
  regimeOverride: null,
  horizon: 12,
  path: "immediate",
  steps: 8,
  notional: 1_000_000,
};

describe("Monte Carlo scenario-uncertainty VaR", () => {
  it("is exactly reproducible for the same seed and inputs", () => {
    const st = { ...base.state, gdpGrowth: -2.0, vix: 32, igSpread: 180 };
    const input = { ...base, state: st };
    const a = monteCarloVaR(input, "p6040", { runs: 300, noisePct: 0.25, seed: 7 });
    const b = monteCarloVaR(input, "p6040", { runs: 300, noisePct: 0.25, seed: 7 });
    expect(a.outcomes).toEqual(b.outcomes);
    expect(a.var95).toBe(b.var95);
    expect(a.cvar95).toBe(b.cvar95);
  });

  it("returns a flat distribution (all zero) at baseline: nothing moved, nothing to perturb", () => {
    const r = monteCarloVaR(base, "p6040", { runs: 200 });
    expect(r.outcomes.every((x) => x === 0)).toBe(true);
    expect(r.mean).toBe(0);
    expect(r.stdev).toBe(0);
    expect(r.var95).toBe(0);
    expect(r.cvar95).toBe(0);
  });

  it("sorts outcomes ascending", () => {
    const st = { ...base.state, gdpGrowth: -1.5, vix: 28 };
    const r = monteCarloVaR({ ...base, state: st }, "p6040", { runs: 300 });
    for (let i = 1; i < r.outcomes.length; i++) expect(r.outcomes[i]).toBeGreaterThanOrEqual(r.outcomes[i - 1]);
  });

  it("CVaR is at least as extreme as its own VaR threshold (the tail average, not just the cutoff)", () => {
    const st = { ...base.state, gdpGrowth: -2.2, vix: 34, igSpread: 190, hyBBSpread: 480 };
    const r = monteCarloVaR({ ...base, state: st }, "p2080", { runs: 800, noisePct: 0.3 });
    expect(r.cvar95).toBeLessThanOrEqual(r.var95 + 1e-9);
    expect(r.cvar99).toBeLessThanOrEqual(r.var99 + 1e-9);
    // The 1st percentile sits further into the loss tail than the 5th.
    expect(r.var99).toBeLessThanOrEqual(r.var95 + 1e-9);
  });

  it("more input-uncertainty (noisePct) widens the outcome distribution", () => {
    const st = { ...base.state, gdpGrowth: -1.8, vix: 30, igSpread: 165 };
    const tight = monteCarloVaR({ ...base, state: st }, "p6040", { runs: 800, noisePct: 0.05, seed: 3 });
    const wide = monteCarloVaR({ ...base, state: st }, "p6040", { runs: 800, noisePct: 0.6, seed: 3 });
    expect(wide.stdev).toBeGreaterThan(tight.stdev);
  });

  it("clamps out-of-range options rather than misbehaving", () => {
    const st = { ...base.state, vix: 25 };
    const r = monteCarloVaR({ ...base, state: st }, "p6040", { runs: 999999, noisePct: -1 });
    expect(r.runs).toBe(4000);
    expect(r.noisePct).toBe(0);
    expect(r.outcomes.length).toBe(4000);
  });

  it("a loss-only stress scenario centres the distribution below zero", () => {
    const st = { ...base.state, gdpGrowth: -3.0, vix: 40, igSpread: 220, hyBBSpread: 550, unemployment: 5.5 };
    const r = monteCarloVaR({ ...base, state: st }, "p8020", { runs: 800, noisePct: 0.25 });
    expect(r.mean).toBeLessThan(0);
    expect(r.var95).toBeLessThan(r.mean);
  });
});
