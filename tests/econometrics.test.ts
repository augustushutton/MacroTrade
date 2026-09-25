import { describe, expect, it } from "vitest";
import { okunsLaw, phillipsCurve, referenceModels, taylorRule } from "@/lib/econometrics";
import { baselineState } from "@/lib/vars";

// These are diagnostic cross-checks against published formulas (see
// lib/econometrics.ts's own citations), run alongside the pricing engine but
// never feeding into it. The tests pin the exact arithmetic against
// hand-computed values so a future edit to a coefficient is a visible,
// deliberate change rather than a silent drift.

describe("reference models", () => {
  it("computes the Taylor rule exactly: r* + π + 0.5(π-π*) + 0.5(g-g_potential)", () => {
    const st = { ...baselineState(), cpiCore: 3.0, gdpGrowth: 2.0, fedFunds: 4.0 };
    const r = taylorRule(st);
    // 0.5 + 3.0 + 0.5*(3.0-2.0) + 0.5*(2.0-1.8) = 4.1
    expect(r.implied).toBeCloseTo(4.1, 9);
    expect(r.actual).toBeCloseTo(4.0, 9);
  });

  it("Taylor rule's implied rate rises 1.5x as fast as core inflation", () => {
    // d(implied)/d(pi) = 1 (direct) + 0.5 (inflation-gap term) = 1.5
    const a = taylorRule({ ...baselineState(), cpiCore: 3.0 });
    const b = taylorRule({ ...baselineState(), cpiCore: 4.0 });
    expect(b.implied - a.implied).toBeCloseTo(1.5, 9);
  });

  it("computes Okun's law exactly: -0.5 x (g - g_potential)", () => {
    const st = { ...baselineState(), gdpGrowth: 2.0, unemployment: 4.2 };
    const r = okunsLaw(st);
    expect(r.implied).toBeCloseTo(-0.5 * (2.0 - 1.8), 9);
    expect(r.actual).toBeCloseTo(0, 9); // unemployment at its own baseline
  });

  it("Okun's law: faster growth implies a larger fall in unemployment", () => {
    const slow = okunsLaw({ ...baselineState(), gdpGrowth: 1.0 });
    const fast = okunsLaw({ ...baselineState(), gdpGrowth: 4.0 });
    expect(fast.implied).toBeLessThan(slow.implied);
  });

  it("computes the Phillips curve exactly: pi_trend + kappa(u* - u)", () => {
    const st = { ...baselineState(), unemployment: 4.2, cpiCore: 3.0 };
    const r = phillipsCurve(st);
    expect(r.implied).toBeCloseTo(2.0, 9); // u sits at u*, so curve reads flat at trend
    expect(r.actual).toBeCloseTo(3.0, 9);
  });

  it("Phillips curve: higher unemployment implies lower inflation", () => {
    const tight = phillipsCurve({ ...baselineState(), unemployment: 3.5 });
    const slack = phillipsCurve({ ...baselineState(), unemployment: 6.0 });
    expect(slack.implied).toBeLessThan(tight.implied);
  });

  it("referenceModels returns all three, each finite", () => {
    const models = referenceModels(baselineState());
    expect(models.map((m) => m.id)).toEqual(["taylor", "okun", "phillips"]);
    for (const m of models) {
      expect(Number.isFinite(m.implied)).toBe(true);
      expect(Number.isFinite(m.actual)).toBe(true);
      expect(m.citation.length).toBeGreaterThan(0);
    }
  });
});
