import { describe, expect, it } from "vitest";
import { SECOND_ROUND, DERIVED_COMMODITY, DERIVED_EQUITY, RATE_BETAS, SPREAD_BETAS, COMMODITY_BETAS, USDCAD_BETAS, EQUITY_CHANNELS, FX_PAIRS } from "@/lib/elasticities";
import { ASSET_BY_ID, ASSETS } from "@/lib/assets";
import { VAR_BY_ID, baselineState, collinearityShrink, crossTierShrink, themeShrink } from "@/lib/vars";
import { saturateMultiplier } from "@/lib/regimes";
import { cumulativeInflation, factorAttribution, horizonLadder, realReturn, runScenario, sensitivity, type ScenarioInput } from "@/lib/engine";
import { PATHS, responseKernel, responseWeight, responseWeightAt, samplePath } from "@/lib/paths";
import { PORTFOLIOS, portfolioWeights } from "@/lib/portfolios";
import { PRESETS, presetState } from "@/lib/scenarios";
import { decodeSnapshot, encodeSnapshot, fromDelta, toDelta } from "@/lib/storage";

const base: ScenarioInput = {
  state: baselineState(),
  regimeOverride: null,
  horizon: 12,
  path: "immediate",
  steps: 8,
  notional: 1_000_000,
};

// The evaluation order the engine sweeps in. A second-round link may only read
// a source produced at or before its own stage.
const STAGE: Record<string, number> = {
  UST2Y: 1, UST5Y: 1, UST10Y: 1, UST30Y: 1, CURVE_2S10S: 1,
  USDCAD: 2,
  WTI: 3, NATGAS: 3, GOLD: 3, COPPER: 3, IRON: 3, AGS: 3, BRENT: 3.5,
  EURUSD: 4, USDJPY: 4, GBPUSD: 4, USDCNY: 4, USDMXN: 4,
  // USDCHF reads EURUSD via a SECOND_ROUND link (see lib/elasticities.ts),
  // not just USDCAD like the other pairs — engine.ts's FX loop (step 4) folds
  // each pair's result into `sources` as it goes in FX_PAIRS's own object
  // order (EURUSD is listed before USDCHF there), so USDCHF genuinely does
  // see a non-stale EURUSD by the time it runs. 4.5 says "still the FX
  // stage, but strictly after EURUSD" — same device as BRENT: 3.5 above for
  // WTI/BRENT's own intra-commodity ordering.
  USDCHF: 4.5,
  SPX: 5,
  RTY: 6, EAFE: 6, EM: 6, SEMI: 6, HCARE: 6, TECHX: 6,
  SEC_TECH: 6, SEC_FINS: 6, SEC_ENGY: 6, SEC_UTIL: 6, SEC_INDU: 6, SEC_HLTH: 6, SEC_CONS: 6,
  MBS: 7, IG: 7, HY_BB: 7, HY_BCCC: 7,
};

describe("second-round graph", () => {
  it("is acyclic under the engine's fixed sweep order", () => {
    for (const l of SECOND_ROUND) {
      expect(STAGE[l.from], `unknown source ${l.from}`).toBeDefined();
      expect(STAGE[l.to], `unknown target ${l.to}`).toBeDefined();
      expect(STAGE[l.from], `${l.from} -> ${l.to} points backwards`).toBeLessThan(STAGE[l.to]);
    }
  });

  it("only references assets that exist", () => {
    for (const l of SECOND_ROUND) {
      if (l.from !== "CURVE_2S10S") expect(ASSET_BY_ID[l.from]).toBeDefined();
      expect(ASSET_BY_ID[l.to]).toBeDefined();
    }
  });
});

describe("coefficient tables", () => {
  it("references only declared variables", () => {
    const tables = [
      ...Object.values(RATE_BETAS).flat(),
      ...Object.values(SPREAD_BETAS).flat(),
      ...Object.values(COMMODITY_BETAS).flat(),
      ...USDCAD_BETAS,
      ...Object.values(FX_PAIRS).flatMap((p) => p.own),
      ...Object.values(DERIVED_EQUITY).flatMap((d) => d.own),
      ...Object.values(DERIVED_COMMODITY).flatMap((d) => d.own),
      ...Object.values(EQUITY_CHANNELS).flatMap((c) => [...c.multiple, ...c.earnings, ...c.riskPremium]),
    ];
    for (const b of tables) expect(VAR_BY_ID[b.v], `unknown variable ${b.v}`).toBeDefined();
  });

  it("routes policy to the equity multiple through exactly one path", () => {
    // No rate variable may appear directly in the multiple channel: the only
    // route is the UST10Y second-round link. Two routes would double-count.
    const direct = EQUITY_CHANNELS.SPX.multiple.map((b) => b.v);
    for (const id of ["fedFunds", "realRate10y"]) expect(direct).not.toContain(id);
    expect(SECOND_ROUND.filter((l) => l.to === "SPX" && l.channel === "multiple" && l.from === "UST10Y")).toHaveLength(1);
  });

  it("gives every non-derived asset a way to move", () => {
    for (const a of ASSETS) {
      const covered =
        RATE_BETAS[a.id] || SPREAD_BETAS[a.id] || COMMODITY_BETAS[a.id] ||
        DERIVED_EQUITY[a.id] || DERIVED_COMMODITY[a.id] || FX_PAIRS[a.id] ||
        EQUITY_CHANNELS[a.id] || a.id === "USDCAD";
      expect(covered, `${a.id} has no elasticity source`).toBeTruthy();
    }
  });
});

describe("baseline", () => {
  it("prices flat when nothing is shocked", () => {
    const r = runScenario(base);
    for (const p of r.portfolios) expect(Math.abs(p.pct)).toBeLessThan(1e-9);
    for (const a of Object.values(r.assets)) expect(Math.abs(a.pricePct)).toBeLessThan(1e-9);
  });

  it("falls back to soft landing with no trigger fired", () => {
    expect(runScenario(base).regime.active).toBe("soft_landing");
  });
});

describe("directional sanity", () => {
  const hike: ScenarioInput = { ...base, state: { ...base.state, fedFunds: 5.0, realRate10y: 2.4 } };

  it("sells duration on a hike", () => {
    const r = runScenario(hike);
    expect(r.assets.UST2Y.yieldBp!).toBeGreaterThan(0);
    expect(r.assets.UST10Y.pricePct).toBeLessThan(0);
    expect(r.assets.UST30Y.pricePct).toBeLessThan(r.assets.UST2Y.pricePct);
  });

  it("hurts the bond-heavy portfolio more than the equity-heavy one in a pure rate shock", () => {
    const r = runScenario(hike);
    const p2080 = r.portfolios.find((p) => p.id === "p2080")!;
    const p8020 = r.portfolios.find((p) => p.id === "p8020")!;
    expect(p2080.bondPct).toBeLessThan(0);
    expect(Math.abs(p2080.bondPct)).toBeGreaterThan(Math.abs(p8020.bondPct));
  });

  it("widens credit and drops equity in a stress state", () => {
    const r = runScenario({ ...base, state: { ...base.state, vix: 42, hyBCCCSpread: 950, igSpread: 190 } });
    expect(r.regime.active).toBe("financial_stress");
    expect(r.assets.SPX.pricePct).toBeLessThan(0);
    expect(r.assets.HY_BCCC.pricePct).toBeLessThan(r.assets.IG.pricePct);
  });

  it("does not rally Treasuries on a stagflationary vol spike", () => {
    const st = { ...base.state, cpiCore: 5.2, cpiHeadline: 5.5, gdpGrowth: 0.4, wageGrowth: 5.6, productivity: 0.3, vix: 26 };
    const r = runScenario({ ...base, state: st });
    expect(r.regime.active).toBe("stagflation");
    expect(r.assets.UST10Y.yieldBp!).toBeGreaterThan(0);
  });

  it("lets earnings dominate in a recession", () => {
    const st = { ...base.state, gdpGrowth: -2.0, unemployment: 6.0, pmiMfg: 42, pmiSvcs: 46, earningsGrowth: -18 };
    const r = runScenario({ ...base, state: st });
    expect(r.regime.active).toBe("recession");
    const spx = r.assets.SPX;
    const earn = spx.channels.find((c) => c.channel === "earnings")!.value;
    const mult = spx.channels.find((c) => c.channel === "multiple")!.value;
    expect(earn).toBeLessThan(0);
    expect(Math.abs(earn)).toBeGreaterThan(Math.abs(mult));
  });
});

describe("pins", () => {
  it("uses the typed FX level instead of the modelled one", () => {
    const r = runScenario({ ...base, state: { ...base.state, usdjpy: 165 } });
    expect(r.assets.USDJPY.pinned).toBe(true);
    expect(r.assets.USDJPY.pricePct).toBeCloseTo((15 / 150) * 100, 6);
  });

  it("uses the typed OAS instead of the modelled one", () => {
    const r = runScenario({ ...base, state: { ...base.state, igSpread: 145 } });
    expect(r.assets.IG.pinned).toBe(true);
    expect(r.assets.IG.spreadBp).toBeCloseTo(50, 6);
  });

  it("replaces the modelled re-rating when forward P/E is set", () => {
    const r = runScenario({ ...base, state: { ...base.state, fwdPE: 18.5 } });
    const mult = r.assets.SPX.channels.find((c) => c.channel === "multiple")!;
    expect(mult.pinned).toBe(true);
    expect(mult.value).toBeCloseTo((-2 / 20.5) * 100, 6);
  });

  it("pins one Treasury tenor to a dragged yield-curve level, leaving the others modelled", () => {
    // UST10Y base is 4.20 (realRate10y.base + be10y.base, by construction —
    // see lib/vars.ts). Dragging it to 4.70 should print exactly +50bp,
    // independent of whatever RATE_BETAS would otherwise have implied.
    const r = runScenario({ ...base, state: { ...base.state, ust10yYield: 4.7 } });
    expect(r.assets.UST10Y.pinned).toBe(true);
    expect(r.assets.UST10Y.yieldBp).toBeCloseTo(50, 6);

    // A macro shock that WOULD otherwise move UST10Y is fully overridden once
    // pinned — the pin replaces the factor model's estimate, it doesn't add
    // to it.
    const r2 = runScenario({ ...base, state: { ...base.state, fedFunds: 5.5, ust10yYield: 4.7 } });
    expect(r2.assets.UST10Y.yieldBp).toBeCloseTo(50, 6);

    // The three untouched tenors stay fully macro-modelled (unpinned).
    const r3 = runScenario({ ...base, state: { ...base.state, fedFunds: 5.5, ust10yYield: 4.7 } });
    expect(r3.assets.UST2Y.pinned).toBe(false);
    expect(r3.assets.UST5Y.pinned).toBe(false);
    expect(r3.assets.UST30Y.pinned).toBe(false);
    expect(r3.assets.UST2Y.yieldBp).not.toBeCloseTo(0, 6);
  });
});

describe("time paths", () => {
  it("delivers exactly the terminal shock for every shape except mean reversion", () => {
    for (const p of PATHS) {
      expect(p.f(0)).toBeCloseTo(p.id === "immediate" ? 1 : 0, 6);
      if (p.id !== "meanRevert") expect(p.f(1)).toBeCloseTo(1, 6);
    }
    expect(PATH_F("meanRevert", 1)).toBeCloseTo(0.55, 6);
  });

  it("makes a phased shock land smaller in a slow channel", () => {
    // Earnings take about three quarters to reprice, so a shock still being
    // delivered at the horizon has not finished arriving in consensus.
    const st = { ...base.state, gdpGrowth: -2.5, earningsGrowth: -20, unemployment: 6.0 };
    const now = runScenario({ ...base, state: st, path: "immediate" });
    const later = runScenario({ ...base, state: st, path: "linear" });
    const earn = (r: typeof now) => r.assets.SPX.channels.find((c) => c.channel === "earnings")!.value;
    expect(Math.abs(earn(later))).toBeLessThan(Math.abs(earn(now)));
  });

  it("leaves a phased rate shock slightly larger than an immediate one at the horizon", () => {
    // The curve reprices in weeks, so by the horizon both are complete and the
    // only live difference is reversion: the immediate shock has had the full
    // horizon to decay, the phased one has not. This is the model behaving as
    // specified rather than a sign error, so it is pinned here on purpose.
    const st = { ...base.state, fedFunds: 5.5, realRate10y: 2.6 };
    const now = runScenario({ ...base, state: st, path: "immediate" });
    const later = runScenario({ ...base, state: st, path: "linear" });
    const ratio = later.assets.UST10Y.yieldBp! / now.assets.UST10Y.yieldBp!;
    expect(ratio).toBeGreaterThan(1);
    expect(ratio).toBeLessThan(1.08);
  });

  it("gives back more of a risk-premium shock at two years than at three months", () => {
    const st = { ...base.state, vix: 40 };
    const rp = (h: 3 | 24) =>
      runScenario({ ...base, state: st, horizon: h }).assets.SPX.channels.find(
        (c) => c.channel === "riskPremium",
      )!.value;
    expect(Math.abs(rp(24))).toBeLessThan(Math.abs(rp(3)));
  });

  it("is stable across quadrature resolution", () => {
    const a = responseWeight("earnings", "scurve", 12, 4);
    const b = responseWeight("earnings", "scurve", 12, 24);
    expect(Math.abs(a - b)).toBeLessThan(0.03);
  });

  it("transmits earnings more slowly than rates", () => {
    expect(responseKernel("earnings", 3)).toBeLessThan(responseKernel("rate", 3));
  });

  it("samples a path that starts and ends on the horizon", () => {
    const pts = samplePath("linear", 12, 6);
    expect(pts[0].month).toBe(0);
    expect(pts[pts.length - 1].month).toBe(12);
  });
});

function PATH_F(id: string, t: number): number {
  return PATHS.find((p) => p.id === id)!.f(t);
}

describe("portfolios", () => {
  it("weights sum to 100 for every allocation", () => {
    for (const p of PORTFOLIOS) {
      const sum = portfolioWeights(p).reduce((s, x) => s + x.w, 0);
      expect(sum).toBeCloseTo(100, 6);
    }
  });

  it("adds up: the total is the sum of the lines", () => {
    const r = runScenario({ ...base, state: { ...base.state, gdpGrowth: -1.5, vix: 30 } });
    for (const p of r.portfolios) {
      const sum = p.lines.reduce((s, l) => s + l.contribPct, 0);
      expect(sum).toBeCloseTo(p.pct, 9);
      expect(p.equityPct + p.bondPct).toBeCloseTo(p.pct, 9);
    }
  });
});

describe("presets", () => {
  it("all reference real variables and produce a finite result", () => {
    for (const p of PRESETS) {
      for (const id of Object.keys(p.set)) expect(VAR_BY_ID[id], `${p.id}: ${id}`).toBeDefined();
      const st = presetState(p);
      for (const [id, v] of Object.entries(p.set)) {
        const spec = VAR_BY_ID[id];
        expect(v! >= spec.min && v! <= spec.max, `${p.id}: ${id}=${v} outside [${spec.min}, ${spec.max}]`).toBe(true);
      }
      const r = runScenario({ ...base, state: st, path: p.path, horizon: p.horizon, regimeOverride: p.regime ?? null });
      for (const port of r.portfolios) expect(Number.isFinite(port.pct)).toBe(true);
    }
  });

  it("moves at least one variable each", () => {
    for (const p of PRESETS) expect(Object.keys(p.set).length).toBeGreaterThan(0);
  });
});

describe("sensitivity", () => {
  it("attributes roughly the whole move in a single-variable scenario", () => {
    const st = { ...base.state, fedFunds: 5.0 };
    const bars = sensitivity({ ...base, state: st }, "p6040");
    const total = runScenario({ ...base, state: st }).portfolios.find((p) => p.id === "p6040")!.pct;
    expect(bars).toHaveLength(1);
    expect(bars[0].delta).toBeCloseTo(total, 9);
  });

  it("returns nothing at baseline", () => {
    expect(sensitivity(base, "p6040")).toHaveLength(0);
  });
});

describe("storage round trip", () => {
  it("stores deltas only", () => {
    const st = { ...baselineState(), vix: 30 };
    expect(Object.keys(toDelta(st))).toEqual(["vix"]);
    expect(fromDelta({ vix: 30 }).fedFunds).toBe(VAR_BY_ID.fedFunds.base);
  });

  it("survives an encode/decode cycle", () => {
    const snap = {
      state: { ...baselineState(), vix: 33, gdpGrowth: -1 },
      horizon: 6 as const,
      path: "scurve" as const,
      steps: 12,
      notional: 2_500_000,
      regimeOverride: null,
    };
    const back = decodeSnapshot(encodeSnapshot(snap));
    expect(back).not.toBeNull();
    expect(back!.state.vix).toBe(33);
    expect(back!.state.gdpGrowth).toBe(-1);
    expect(back!.horizon).toBe(6);
    expect(back!.path).toBe("scurve");
    expect(back!.notional).toBe(2_500_000);
  });
});

// ---------------------------------------------------------------------------
// Magnitude discipline.
//
// The engine once printed -119% on an equity index and -85% on an 80/20
// portfolio for a stagflation assumption, because every correlated driver was
// summed additively and percent returns were added rather than compounded. Both
// defects are silent: the layout looks right, the derivation adds up, and only a
// reader who knows what a bad year costs can tell the model is broken. These
// tests are the reader.
// ---------------------------------------------------------------------------
describe("magnitudes", () => {
  function runPreset(id: string) {
    const p = PRESETS.find((x) => x.id === id)!;
    return runScenario({
      state: presetState(p),
      regimeOverride: p.regime ?? null,
      horizon: p.horizon,
      path: p.path,
      steps: 8,
      notional: 1_000_000,
    });
  }

  it("never prints a loss an asset cannot take", () => {
    for (const p of PRESETS) {
      const r = runPreset(p.id);
      for (const a of Object.values(r.assets)) {
        expect(a.pricePct, `${p.id} / ${a.id}`).toBeGreaterThan(-100);
        expect(Number.isFinite(a.pricePct), `${p.id} / ${a.id}`).toBe(true);
      }
      for (const pf of r.portfolios) {
        expect(pf.pct, `${p.id} / ${pf.id}`).toBeGreaterThan(-100);
      }
    }
  });

  it("keeps every preset inside a defensible drawdown band", () => {
    // The floor is the worst real 12-month outcome the allocation has produced
    // in the modern era, with room to spare. A preset outside it is a
    // calibration error, not a scenario.
    for (const p of PRESETS) {
      const r = runPreset(p.id);
      const eq = r.portfolios.find((x) => x.id === "p8020")!.pct;
      const bd = r.portfolios.find((x) => x.id === "p2080")!.pct;
      expect(eq, `${p.id} 80/20`).toBeGreaterThan(-40);
      expect(bd, `${p.id} 20/80`).toBeGreaterThan(-25);
      expect(r.assets.SPX.pricePct, `${p.id} SPX`).toBeGreaterThan(-52);
    }
  });

  it("prices the headline stress cases the way a risk committee would", () => {
    const stag = runPreset("stagflation");
    expect(stag.portfolios.find((p) => p.id === "p6040")!.pct).toBeGreaterThan(-32);
    expect(stag.portfolios.find((p) => p.id === "p6040")!.pct).toBeLessThan(-14);
    // Duration fails to hedge: the whole point of the regime.
    expect(stag.assets.UST10Y.yieldBp!).toBeGreaterThan(60);
    expect(stag.assets.UST10Y.yieldBp!).toBeLessThan(220);

    const rec = runPreset("recession_labour");
    // Bonds pay for the equity loss here, so the balanced book beats the equity one.
    expect(rec.assets.UST10Y.yieldBp!).toBeLessThan(0);
    expect(rec.portfolios.find((p) => p.id === "p2080")!.pct).toBeGreaterThan(
      rec.portfolios.find((p) => p.id === "p8020")!.pct,
    );

    // 2008 is the reference: the S&P roughly halved, an 80/20 book lost about a
    // third, and a bond-heavy book came out close to flat because the flight to
    // quality paid for the credit loss. A model that cannot reproduce the one
    // crisis every reader has memorised will not be believed about any other.
    const cc = runPreset("credit_crisis");
    expect(cc.assets.SPX.pricePct).toBeLessThan(-35);
    expect(cc.assets.SPX.pricePct).toBeGreaterThan(-55);
    expect(cc.portfolios.find((p) => p.id === "p8020")!.pct).toBeGreaterThan(-40);
    expect(cc.assets.UST10Y.yieldBp!).toBeLessThan(-100);
    expect(cc.portfolios.find((p) => p.id === "p2080")!.pct).toBeGreaterThan(-8);
  });
});

// ---------------------------------------------------------------------------
// The two corrections that made those magnitudes reachable. Both are easy to
// delete by accident during a refactor and neither shows up as a crash, so each
// gets a test that fails loudly rather than quietly doubling a tail.
// ---------------------------------------------------------------------------
describe("regime saturation", () => {
  it("leaves a one-unit shock alone and fades a large one toward the raw beta", () => {
    expect(saturateMultiplier(2.1, 1)).toBeCloseTo(2.1, 9);
    expect(saturateMultiplier(2.1, -1)).toBeCloseTo(2.1, 9);
    expect(saturateMultiplier(2.1, 0.4)).toBeCloseTo(2.1, 9);
    const big = saturateMultiplier(2.1, 11.3);
    expect(big).toBeLessThan(1.4);
    expect(big).toBeGreaterThan(1);
  });

  it("fades a damping multiplier the same way and is continuous through 1", () => {
    expect(saturateMultiplier(0.5, 11.3)).toBeGreaterThan(0.5);
    expect(saturateMultiplier(0.5, 11.3)).toBeLessThan(1);
    expect(saturateMultiplier(1, 40)).toBeCloseTo(1, 9);
  });

  it("is monotone in shock size, so a bigger input never prices as a smaller one", () => {
    const sizes = [1, 2, 4, 8, 16, 32];
    for (let i = 1; i < sizes.length; i++) {
      expect(saturateMultiplier(2.1, sizes[i])).toBeLessThan(saturateMultiplier(2.1, sizes[i - 1]));
    }
    // The response itself must still grow: saturation damps the multiplier, not
    // the shock. Doubling an input can never reduce the answer.
    const mild = { ...baselineState(), vix: 26 };
    const wild = { ...baselineState(), vix: 52 };
    const a = runScenario({ ...base, state: mild }).assets.SPX.pricePct;
    const b = runScenario({ ...base, state: wild }).assets.SPX.pricePct;
    expect(b).toBeLessThan(a);
  });
});

describe("cross-tier merge", () => {
  it("discounts a second-round move that restates what the variables already price", () => {
    // A pure equity drawdown drives the distressed tier through SECOND_ROUND
    // alone. Adding an explicit VIX shock adds a second, agreeing view of the
    // same event, so the tier must widen further but by less than the sum.
    const eqOnly = { ...baselineState(), earningsRevisions: -30, gdpGrowth: -1.0 };
    const both = { ...eqOnly, vix: 40 };
    const s1 = runScenario({ ...base, state: eqOnly }).assets.HY_BCCC.spreadBp!;
    const s2 = runScenario({ ...base, state: both }).assets.HY_BCCC.spreadBp!;
    expect(s2).toBeGreaterThan(s1);
    expect(crossTierShrink).toBeLessThan(1);
    expect(crossTierShrink).toBeGreaterThan(0.5);
  });

  it("leaves disagreeing legs to net out in full", () => {
    // Cheaper oil tightens the distressed tier while nothing else moves, so the
    // second-round leg stands alone at full weight and the tier tightens.
    const s = runScenario({ ...base, state: { ...baselineState(), energySupply: -2.0 } });
    expect(Number.isFinite(s.assets.HY_BCCC.spreadBp!)).toBe(true);
  });
});

describe("collinearity shrinkage", () => {
  it("returns 1 for a lone mover and shrinks with company", () => {
    expect(collinearityShrink("cpiCore", 1)).toBe(1);
    expect(collinearityShrink("productivity", 4)).toBe(1); // ungrouped
    expect(collinearityShrink("cpiCore", 2)).toBeCloseTo(1 / 1.88, 9);
    expect(collinearityShrink("cpiCore", 4)).toBeLessThan(collinearityShrink("cpiCore", 2));
  });

  it("prices four views of one inflation impulse below four independent ones", () => {
    const one = { ...baselineState(), cpiCore: 5.0 };
    const four = { ...baselineState(), cpiCore: 5.0, cpiHeadline: 4.8, pceCore: 4.7, wageGrowth: 6.0 };
    const y1 = runScenario({ ...base, state: one }).assets.UST10Y.yieldBp!;
    const y4 = runScenario({ ...base, state: four }).assets.UST10Y.yieldBp!;
    // More information still moves the yield further, but nothing like 4x.
    expect(y4).toBeGreaterThan(y1);
    expect(y4).toBeLessThan(y1 * 2.6);
  });

  it("never flips the sign of a contribution", () => {
    for (const n of [1, 2, 3, 4, 8]) {
      expect(collinearityShrink("cpiCore", n)).toBeGreaterThan(0);
      expect(themeShrink("cpiCore", n)).toBeGreaterThan(0);
    }
  });
});

describe("compounding", () => {
  it("makes an asset's price the exponentiated sum of its channels", () => {
    const st = { ...baselineState(), vix: 34, earningsRevisions: -25, gdpGrowth: -1.5 };
    const spx = runScenario({ ...base, state: st }).assets.SPX;
    const logSum = spx.channels.reduce((s, c) => s + c.value, 0);
    expect(spx.pricePct).toBeCloseTo((Math.exp(logSum / 100) - 1) * 100, 9);
    // Compounding is a loss-reducer on the downside, never a loss-amplifier.
    expect(spx.pricePct).toBeGreaterThan(logSum);
  });

  it("bounds an arbitrarily severe shock above a total loss", () => {
    const st = {
      ...baselineState(),
      vix: 80, igSpread: 400, hyBBSpread: 900, hyBCCCSpread: 2200,
      gdpGrowth: -8, unemployment: 14, earningsRevisions: -60, earningsGrowth: -35,
    };
    const r = runScenario({ ...base, state: st });
    for (const a of Object.values(r.assets)) expect(a.pricePct).toBeGreaterThan(-100);
  });
});

describe("sub-horizon evaluation (responseWeightAt)", () => {
  const CHANNELS = ["rate", "spread", "multiple", "earnings", "riskPremium", "price"] as const;

  it("matches responseWeight exactly when evaluated at the terminal horizon", () => {
    for (const p of PATHS) {
      for (const c of CHANNELS) {
        const a = responseWeight(c, p.id, 12, 8);
        const b = responseWeightAt(c, p.id, 12, 8, 12);
        expect(b).toBeCloseTo(a, 9);
      }
    }
  });

  it("runScenario(input, input.horizon) reproduces runScenario(input) exactly", () => {
    const st = { ...base.state, gdpGrowth: -1.8, vix: 27, igSpread: 150 };
    const input = { ...base, state: st, path: "scurve" as const };
    const a = runScenario(input);
    const b = runScenario(input, input.horizon);
    for (const id of Object.keys(a.assets)) {
      expect(b.assets[id].pricePct).toBeCloseTo(a.assets[id].pricePct, 9);
    }
  });

  it("returns zero weight for a point before any shock has had time to transmit", () => {
    // At month 0 nothing delivered can have transmitted yet, for any channel
    // or path shape — responseKernel's own zero-at-zero guard should carry
    // straight through.
    for (const c of CHANNELS) expect(responseWeightAt(c, "immediate", 12, 8, 0)).toBe(0);
  });
});

describe("factor attribution", () => {
  it("sums back to exactly the portfolio's own pct", () => {
    const scenarios: Array<Record<string, number>> = [
      { gdpGrowth: -1.8, vix: 30, igSpread: 165, hyBBSpread: 420, fedFunds: 2.75 }, // recession-ish
      { cpiCore: 5.4, wageGrowth: 5.8, fedFunds: 5.0, gdpGrowth: 0.3 }, // stagflation-ish
      { fedFunds: 5.5, realRate10y: 2.6 }, // a single policy move
    ];
    for (const set of scenarios) {
      const r = runScenario({ ...base, state: { ...base.state, ...set } });
      for (const p of PORTFOLIOS) {
        const attrib = factorAttribution(r, p.id);
        const sum = attrib.reduce((s, f) => s + f.contribPct, 0);
        const actual = r.portfolios.find((x) => x.id === p.id)!.pct;
        expect(sum).toBeCloseTo(actual, 6);
      }
    }
  });

  it("returns nothing at baseline", () => {
    const r = runScenario(base);
    for (const p of PORTFOLIOS) expect(factorAttribution(r, p.id)).toEqual([]);
  });

  it("books a lone monetary-policy move to rates-related categories", () => {
    const r = runScenario({ ...base, state: { ...base.state, fedFunds: 5.5 } });
    const attrib = factorAttribution(r, "p6040");
    const monetary = attrib.find((f) => f.label === "Monetary Policy")?.contribPct ?? 0;
    const assetBonds = attrib.find((f) => f.label === "Rates (priced assets)")?.contribPct ?? 0;
    const total = attrib.reduce((s, f) => s + Math.abs(f.contribPct), 0);
    // Over half the 60/40's bond sleeve is credit (IG/MBS/HY), whose rate leg
    // is priced off already-priced Treasury assets rather than off fedFunds
    // directly (see AssetRow's rateLegs) — one-hop attribution correctly
    // books that to "Rates (priced assets)", not "Monetary Policy", even
    // though fedFunds is the only thing that moved. The two rates-related
    // buckets together should still account for most of a fedFunds-only
    // scenario; a category unrelated to rates (e.g. Fiscal) should not.
    expect((Math.abs(monetary) + Math.abs(assetBonds)) / total).toBeGreaterThan(0.6);
    expect(attrib.find((f) => f.label === "Fiscal & Structural")).toBeUndefined();
  });

  it("books a pinned assumption to Direct Assumptions, not to a modelled category", () => {
    // Setting the forward P/E directly pins SPX's "multiple" channel (see
    // runScenario's SPX step): the modelled re-rating is discarded in favour
    // of the level the user typed. With nothing else moved, SPX's earnings
    // and risk-premium channels stay at zero, so essentially all of SPX's
    // (and therefore the portfolio's) P&L should land in Direct Assumptions.
    // SPX is 62% of the equity sleeve; the rest (RTY/EAFE/EM) carry a beta OFF
    // SPX (an asset-sourced term, "Equities (priced assets)") rather than
    // repeating the pin, so Direct Assumptions should be the largest bucket
    // without being the only one.
    const r = runScenario({ ...base, state: { ...base.state, fwdPE: 24 } });
    expect(r.assets.SPX.pinned).toBe(true);
    const attrib = factorAttribution(r, "p8020");
    const total = attrib.reduce((s, f) => s + Math.abs(f.contribPct), 0);
    expect(attrib[0]?.label).toBe("Direct assumptions");
    expect(Math.abs(attrib[0]!.contribPct) / total).toBeGreaterThan(0.5);
  });
});

describe("cumulativeInflation", () => {
  it("is zero over any horizon at a zero rate", () => {
    expect(cumulativeInflation(0, 24)).toBeCloseTo(0, 9);
  });

  it("compounds the annual rate over the horizon's own fraction of a year", () => {
    expect(cumulativeInflation(4, 12)).toBeCloseTo(4, 9);
    expect(cumulativeInflation(4, 24)).toBeCloseTo((1.04 * 1.04 - 1) * 100, 9);
  });

  it("is what realReturn divides the nominal leg by", () => {
    const nominalPct = 8;
    const cpi = 3.5;
    const months = 18;
    const viaHelper = ((1 + nominalPct / 100) / (1 + cumulativeInflation(cpi, months) / 100) - 1) * 100;
    expect(realReturn(nominalPct, cpi, months)).toBeCloseTo(viaHelper, 9);
  });
});

describe("realReturn", () => {
  it("equals nominal when the deflator is zero", () => {
    expect(realReturn(6.3, 0, 12)).toBeCloseTo(6.3, 9);
  });

  it("matches the Fisher-equation deflation by hand", () => {
    // (1.10 / 1.05) - 1, as a percent.
    expect(realReturn(10, 5, 12)).toBeCloseTo(4.761904761904767, 9);
  });

  it("only compounds the annual rate over the horizon's own fraction of a year", () => {
    // A 6-month horizon should deflate by sqrt(1 + annual), not by the full
    // annual rate outright.
    const sixMonth = realReturn(0, 4, 6);
    const oneYear = realReturn(0, 4, 12);
    expect(sixMonth).toBeGreaterThan(oneYear); // less erosion at half the horizon
    expect(sixMonth).toBeCloseTo((1 / Math.sqrt(1.04) - 1) * 100, 9);
  });

  it("shows erosion (a negative real return) on a flat nominal return whenever CPI is positive", () => {
    expect(realReturn(0, 2.8, 12)).toBeLessThan(0);
  });
});

describe("horizonLadder", () => {
  it("every rung's realPct matches realReturn on that rung's own nominal pct and horizon", () => {
    const st = { ...base.state, fedFunds: 5.5, cpiHeadline: 5.0 };
    const ladder = horizonLadder({ ...base, state: st }, "p6040");
    expect(ladder).toHaveLength(6);
    for (const rung of ladder) {
      expect(rung.cpiUsed).toBe(5.0);
      expect(rung.realPct).toBeCloseTo(realReturn(rung.pct, 5.0, rung.horizon), 9);
    }
  });

  it("deflates by the scenario's own CPI even when CPI itself was not the thing shocked", () => {
    // At baseline nothing moves, so nominal is flat (0%) at every horizon —
    // but the model's baseline Headline CPI YoY is still 2.8%, and "what did
    // this do net of inflation" is a real question even for a do-nothing
    // scenario, so real should still read negative here.
    const ladder = horizonLadder(base, "p6040");
    for (const rung of ladder) {
      expect(rung.pct).toBeCloseTo(0, 9);
      expect(rung.realPct).toBeLessThan(0);
    }
  });
});

