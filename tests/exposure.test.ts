import { describe, expect, it } from "vitest";
import {
  factorExposures,
  correlationMatrix,
  unitShockResponses,
  assetRiskRanking,
  topPositions,
  CORRELATION_INSTRUMENTS,
} from "@/lib/exposure";
import { PORTFOLIOS, BOND_SLEEVE, EQUITY_SLEEVE, portfolioWeights } from "@/lib/portfolios";
import { ASSET_BY_ID, TOP_LEVEL_ASSETS } from "@/lib/assets";
import { SECOND_ROUND } from "@/lib/elasticities";

// ---------------------------------------------------------------------------
// Factor exposure. Every assertion here cross-checks against an
// independently-written computation (not a copy of exposure.ts's own
// formula) or a structural invariant, so a bug in exposure.ts's arithmetic
// can't also be baked into the test that's supposed to catch it.
// ---------------------------------------------------------------------------
describe("factorExposures", () => {
  const notional = 1_000_000;
  const exp = factorExposures(notional);

  it("returns one row per portfolio, in PORTFOLIOS order", () => {
    expect(exp.map((e) => e.portfolioId)).toEqual(PORTFOLIOS.map((p) => p.id));
  });

  it("rateDv01 + creditDv01 together equal the sleeve's total duration dollars — an independent recomputation, not exposure.ts's own formula reused", () => {
    for (const e of exp) {
      const p = PORTFOLIOS.find((x) => x.id === e.portfolioId)!;
      let totalDv01 = 0;
      for (const s of BOND_SLEEVE) {
        const a = ASSET_BY_ID[s.asset];
        if (!a?.duration) continue;
        totalDv01 += (p.bond / 100) * (s.w / 100) * notional * a.duration * 0.0001;
      }
      expect(e.rateDv01 + e.creditDv01).toBeCloseTo(totalDv01, 6);
    }
  });

  it("rateDv01 and creditDv01 scale exactly linearly with bond weight (20/40/60/80 -> 1/2/3/4x)", () => {
    const byId = Object.fromEntries(exp.map((e) => [e.portfolioId, e]));
    const unit = byId.p8020.rateDv01 / 20;
    expect(byId.p6040.rateDv01).toBeCloseTo(unit * 40, 6);
    expect(byId.p4060.rateDv01).toBeCloseTo(unit * 60, 6);
    expect(byId.p2080.rateDv01).toBeCloseTo(unit * 80, 6);
  });

  it("fxDelta is exactly the EAFE/EM currency-translation P&L of a +1% USD/CAD move — an independent recomputation off EQUITY_SLEEVE weights and SECOND_ROUND's own published betas, not exposure.ts's own formula reused. No model portfolio holds FX or Commodity weight directly (see portfolios.ts), so this is the WHOLE of fxDelta, not one leg of it.", () => {
    const eafeW = EQUITY_SLEEVE.find((s) => s.asset === "EAFE")!.w;
    const emW = EQUITY_SLEEVE.find((s) => s.asset === "EM")!.w;
    const eafeBeta = SECOND_ROUND.find((s) => s.from === "USDCAD" && s.to === "EAFE" && s.channel === "price")!.b;
    const emBeta = SECOND_ROUND.find((s) => s.from === "USDCAD" && s.to === "EM" && s.channel === "price")!.b;
    for (const e of exp) {
      const p = PORTFOLIOS.find((x) => x.id === e.portfolioId)!;
      const eafeDollar = (p.equity / 100) * (eafeW / 100) * notional;
      const emDollar = (p.equity / 100) * (emW / 100) * notional;
      const expected = eafeDollar * (eafeBeta / 100) + emDollar * (emBeta / 100);
      expect(e.fxDelta).toBeCloseTo(expected, 6);
    }
  });

  it("fxDelta is nonzero for every allocation with nonzero equity weight and scales exactly linearly with it", () => {
    const byId = Object.fromEntries(exp.map((e) => [e.portfolioId, e]));
    for (const e of exp) {
      if (PORTFOLIOS.find((p) => p.id === e.portfolioId)!.equity === 0) continue;
      expect(e.fxDelta).not.toBe(0);
    }
    const unit = byId.p2080.fxDelta / 20;
    expect(byId.p8020.fxDelta).toBeCloseTo(unit * 80, 6);
    expect(byId.p6040.fxDelta).toBeCloseTo(unit * 60, 6);
    expect(byId.p4060.fxDelta).toBeCloseTo(unit * 40, 6);
  });

  it("equityBeta scales exactly linearly with equity weight (80/60/40/20 -> 4/3/2/1x)", () => {
    const byId = Object.fromEntries(exp.map((e) => [e.portfolioId, e]));
    const unit = byId.p2080.equityBeta / 20;
    expect(byId.p8020.equityBeta).toBeCloseTo(unit * 80, 6);
    expect(byId.p6040.equityBeta).toBeCloseTo(unit * 60, 6);
    expect(byId.p4060.equityBeta).toBeCloseTo(unit * 40, 6);
  });

  it("equityBeta sits in a plausible band (0 < beta < 2) for every allocation with nonzero equity weight", () => {
    for (const e of exp) {
      if (e.equityBeta === 0) continue;
      expect(e.equityBeta).toBeGreaterThan(0);
      expect(e.equityBeta).toBeLessThan(2);
    }
  });

  it("is a pure function of notional — doubling notional exactly doubles every dollar figure, beta unchanged", () => {
    const double = factorExposures(notional * 2);
    for (let i = 0; i < exp.length; i++) {
      expect(double[i].rateDv01).toBeCloseTo(exp[i].rateDv01 * 2, 6);
      expect(double[i].creditDv01).toBeCloseTo(exp[i].creditDv01 * 2, 6);
      expect(double[i].equityBeta).toBeCloseTo(exp[i].equityBeta, 10);
    }
  });
});

// ---------------------------------------------------------------------------
// Model-implied correlation. This is NOT a historical/realised correlation —
// see lib/exposure.ts's own header for why none exists in this app — so the
// tests below check what a model-implied matrix actually must satisfy
// (mathematical validity, and directional sanity against the real beta
// relationships elasticities.ts encodes) rather than asserting it matches
// some external "true" correlation this app has no data to compute.
// ---------------------------------------------------------------------------
describe("correlationMatrix", () => {
  const instruments = CORRELATION_INSTRUMENTS;
  const corr = correlationMatrix(instruments, null);

  it("is square with one row/column per instrument", () => {
    expect(corr.length).toBe(instruments.length);
    for (const row of corr) expect(row.length).toBe(instruments.length);
  });

  it("has an exact 1.0 diagonal", () => {
    for (let i = 0; i < instruments.length; i++) expect(corr[i][i]).toBe(1);
  });

  it("is symmetric", () => {
    for (let i = 0; i < instruments.length; i++) {
      for (let j = 0; j < instruments.length; j++) {
        expect(corr[i][j]).toBeCloseTo(corr[j][i], 9);
      }
    }
  });

  it("every entry is within [-1, 1]", () => {
    for (const row of corr) {
      for (const v of row) {
        expect(v).toBeGreaterThanOrEqual(-1);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  // Directional sanity checks, each tied to a specific, auditable mechanism
  // in lib/elasticities.ts / lib/engine.ts — not a number picked because it
  // "looked right" when the probe script ran.
  const idx = (id: string) => instruments.indexOf(id);
  const at = (a: string, b: string) => corr[idx(a)][idx(b)];

  it("UST10Y and UST2Y correlate strongly positive — RATE_BETAS gives both the same-signed beta on every shared driver (fedFunds, forwardGuidance, cpiCore, unemployment, ...)", () => {
    expect(at("UST10Y", "UST2Y")).toBeGreaterThan(0.6);
  });

  it("IG correlates strongly positive with UST10Y — SPREAD_BETAS' own rateLegs blend a Treasury leg directly into every credit asset's price", () => {
    expect(at("IG", "UST10Y")).toBeGreaterThan(0.5);
  });

  it("SPX and EAFE correlate strongly positive — DERIVED_EQUITY.EAFE literally carries 0.88x of SPX's own computed move (engine.ts's derived-equity loop)", () => {
    expect(at("SPX", "EAFE")).toBeGreaterThan(0.8);
  });

  it("SPX and HY_BCCC correlate positive — SPX's riskPremium channel prices off the same hyBCCCSpread that drives HY_BCCC itself", () => {
    // HY_BCCC itself was dropped from CORRELATION_INSTRUMENTS (request: "assets
    // that are commonly correlated with each other on many finance platforms...
    // remove excess things a trader wouldn't necessarily want to look at" — a
    // stress-only credit tranche isn't on a cross-asset desk's correlation
    // screen), so this directional check runs its own independent pair rather
    // than indexing into `instruments`/`corr` above.
    const pair = correlationMatrix(["SPX", "HY_BCCC"], null);
    expect(pair[0][1]).toBeGreaterThan(0.4);
  });

  it("USD/JPY correlates negative with Gold — COMMODITY_BETAS/USDCAD_BETAS price gold and the dollar on opposite sides of the same haven-demand drivers", () => {
    expect(at("USDJPY", "GOLD")).toBeLessThan(-0.3);
  });

  it("is regime-conditional, as lib/regimes.ts documents (financial_stress's own gist: \"cross-asset correlation rises toward one\")", () => {
    const goldilocks = correlationMatrix(instruments, "goldilocks");
    const stress = correlationMatrix(instruments, "financial_stress");
    // Not every pair necessarily rises under stress (stress's own multiplier
    // table also crowds OUT some fundamental drivers — see its mult rules),
    // but the matrix as a whole must not be regime-INVARIANT, or regime
    // would be a no-op input and the comparability claim above would be
    // false advertising.
    let anyDifferent = false;
    for (let i = 0; i < instruments.length; i++) {
      for (let j = 0; j < instruments.length; j++) {
        if (Math.abs(goldilocks[i][j] - stress[i][j]) > 0.02) anyDifferent = true;
      }
    }
    expect(anyDifferent).toBe(true);
  });

  it("an instrument with no modelled sensitivity to any of the 46 variables returns 1 against itself and 0 against everything else, not NaN", () => {
    const vectors = unitShockResponses(["__NONEXISTENT__", "SPX"], null);
    expect(vectors.__NONEXISTENT__.every((v) => v === 0)).toBe(true);
    const m = correlationMatrix(["__NONEXISTENT__", "SPX"], null);
    expect(m[0][0]).toBe(1);
    expect(m[0][1]).toBe(0);
    expect(Number.isNaN(m[0][1])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Risk tiers. Same model-implied basis as correlationMatrix (see its own
// describe block above) — these tests check the RANKING and TIER-SPLIT
// mechanics specifically, independent of correlationMatrix's own tests.
// ---------------------------------------------------------------------------
describe("assetRiskRanking", () => {
  const ids = TOP_LEVEL_ASSETS.map((a) => a.id);
  const ranked = assetRiskRanking(ids, null);

  it("returns one row per instrument, with every input id present exactly once", () => {
    expect(ranked.length).toBe(ids.length);
    expect(new Set(ranked.map((r) => r.id))).toEqual(new Set(ids));
  });

  it("norm matches an independent recomputation (L2 norm of the unit-shock vector), not exposure.ts's own formula reused", () => {
    const vectors = unitShockResponses(ids, null);
    for (const r of ranked) {
      let sumSq = 0;
      for (const v of vectors[r.id]) sumSq += v * v;
      expect(r.norm).toBeCloseTo(Math.sqrt(sumSq), 9);
    }
  });

  it("is sorted strictly descending by norm", () => {
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i].norm).toBeLessThanOrEqual(ranked[i - 1].norm);
    }
  });

  it("splits into terciles by RANK, not by a fixed magnitude cutoff: the tier boundaries land exactly at ceil(n/3) and ceil(2n/3)", () => {
    const n = ranked.length;
    const hiCut = Math.ceil(n / 3);
    const medCut = Math.ceil((2 * n) / 3);
    ranked.forEach((r, i) => {
      const expected = i < hiCut ? "high" : i < medCut ? "medium" : "low";
      expect(r.tier).toBe(expected);
    });
  });

  it("every tier is non-empty for a realistic instrument count", () => {
    const tiers = new Set(ranked.map((r) => r.tier));
    expect(tiers).toEqual(new Set(["high", "medium", "low"]));
  });

  it("an instrument with zero sensitivity to all 46 variables always lands in the lowest tier (rank-last, norm 0)", () => {
    const withDud = assetRiskRanking([...ids, "__NONEXISTENT__"], null);
    const dud = withDud.find((r) => r.id === "__NONEXISTENT__")!;
    expect(dud.norm).toBe(0);
    expect(dud.tier).toBe("low");
  });

  it("is regime-conditional, same as correlationMatrix — the ranking is not required to be identical, but the norms must not be regime-invariant", () => {
    const goldilocks = assetRiskRanking(ids, "goldilocks");
    const stress = assetRiskRanking(ids, "financial_stress");
    const byIdGold = Object.fromEntries(goldilocks.map((r) => [r.id, r.norm]));
    const byIdStress = Object.fromEntries(stress.map((r) => [r.id, r.norm]));
    let anyDifferent = false;
    for (const id of ids) {
      if (Math.abs(byIdGold[id] - byIdStress[id]) > 1e-9) anyDifferent = true;
    }
    expect(anyDifferent).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Concentration. Every assertion cross-checks against an independent sort
// over portfolioWeights() (lib/portfolios.ts) rather than reusing
// topPositions()'s own sort/slice, so a bug in its ranking logic can't also
// be baked into the test that's supposed to catch it.
// ---------------------------------------------------------------------------
describe("topPositions", () => {
  const notional = 1_000_000;
  const top3 = topPositions(notional, 3);

  it("returns exactly n rows per portfolio, ranked 1..n", () => {
    for (const p of PORTFOLIOS) {
      const rows = top3.filter((r) => r.portfolioId === p.id);
      expect(rows.map((r) => r.rank)).toEqual([1, 2, 3]);
    }
  });

  it("rank 1 in every portfolio matches an independent max over portfolioWeights()", () => {
    for (const p of PORTFOLIOS) {
      const independentMax = Math.max(...portfolioWeights(p).map((w) => w.w));
      const rank1 = top3.find((r) => r.portfolioId === p.id && r.rank === 1)!;
      expect(rank1.weightPct).toBeCloseTo(independentMax, 9);
    }
  });

  it("is sorted strictly non-increasing by weightPct within each portfolio", () => {
    for (const p of PORTFOLIOS) {
      const rows = top3.filter((r) => r.portfolioId === p.id);
      for (let i = 1; i < rows.length; i++) {
        expect(rows[i].weightPct).toBeLessThanOrEqual(rows[i - 1].weightPct);
      }
    }
  });

  it("dollar is exactly weightPct/100 * notional, nothing else folded in", () => {
    for (const r of top3) {
      expect(r.dollar).toBeCloseTo((r.weightPct / 100) * notional, 6);
    }
  });

  it("is a pure function of notional — doubling notional exactly doubles every dollar figure, weightPct and ranking unchanged", () => {
    const double = topPositions(notional * 2, 3);
    for (let i = 0; i < top3.length; i++) {
      expect(double[i].assetId).toBe(top3[i].assetId);
      expect(double[i].weightPct).toBeCloseTo(top3[i].weightPct, 9);
      expect(double[i].dollar).toBeCloseTo(top3[i].dollar * 2, 6);
    }
  });

  it("respects a smaller n", () => {
    const top1 = topPositions(notional, 1);
    expect(top1.length).toBe(PORTFOLIOS.length);
    for (const p of PORTFOLIOS) {
      expect(top1.filter((r) => r.portfolioId === p.id).map((r) => r.rank)).toEqual([1]);
    }
  });
});
