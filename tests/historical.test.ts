import { describe, expect, it } from "vitest";
import { HISTORICAL_EPISODES, HISTORICAL_EPISODE_BY_ID, backtestEpisode, episodeState, matchEpisodes } from "@/lib/historical";
import { baselineState, VAR_BY_ID } from "@/lib/vars";
import { runScenario } from "@/lib/engine";

describe("historical episodes", () => {
  it("all reference real variables and stay within each one's valid range", () => {
    for (const ep of HISTORICAL_EPISODES) {
      for (const id of Object.keys(ep.set)) expect(VAR_BY_ID[id], `${ep.id}: ${id}`).toBeDefined();
      for (const [id, v] of Object.entries(ep.set)) {
        const spec = VAR_BY_ID[id];
        expect(v! >= spec.min && v! <= spec.max, `${ep.id}: ${id}=${v} outside [${spec.min}, ${spec.max}]`).toBe(true);
      }
    }
  });

  it("moves at least one variable and produces a finite result for every portfolio", () => {
    for (const ep of HISTORICAL_EPISODES) {
      expect(Object.keys(ep.set).length).toBeGreaterThan(0);
      const bt = backtestEpisode(ep);
      for (const pct of Object.values(bt.portfolioModelPct)) expect(Number.isFinite(pct)).toBe(true);
    }
  });

  it("every realized outcome resolves to a finite comparison", () => {
    for (const ep of HISTORICAL_EPISODES) {
      const bt = backtestEpisode(ep);
      expect(bt.comparisons.length).toBe(ep.realized.length);
      for (const c of bt.comparisons) {
        expect(Number.isFinite(c.modelPct), `${ep.id}: ${c.label} modelPct`).toBe(true);
        expect(Number.isFinite(c.realizedPct), `${ep.id}: ${c.label} realizedPct`).toBe(true);
        expect(c.diffPp).toBeCloseTo(c.modelPct - c.realizedPct, 9);
      }
    }
  });

  it("the model's own regime detection reads each documented episode the way history characterised it", () => {
    // A real, falsifiable check: fed nothing but the documented macro levels
    // (no episode is told which regime to assume — regimeOverride is null),
    // does auto-detection land on a regime consistent with how the episode
    // is actually described? This is pinned to the model's ACTUAL output,
    // not an assumption, so it breaks loudly if a future change to the
    // regime thresholds silently stops recognising 2008 as financial stress.
    expect(backtestEpisode(HISTORICAL_EPISODE_BY_ID["hiking_2004_2006"]).regime).toBe("soft_landing");
    expect(backtestEpisode(HISTORICAL_EPISODE_BY_ID["gfc_2008"]).regime).toBe("financial_stress");
    expect(backtestEpisode(HISTORICAL_EPISODE_BY_ID["hiking_2022"]).regime).toBe("stagflation");
  });

  it("gets 2022's equity decline within a few points of the realized -19%", () => {
    // The one episode where this model's inputs (fwdPE pinned to the
    // documented ~17x multiple compression, modest earnings growth) line up
    // closely with what actually happened — not true of every episode here,
    // and that is disclosed rather than cherry-picked away (see the GFC case
    // below).
    const bt = backtestEpisode(HISTORICAL_EPISODE_BY_ID["hiking_2022"]);
    const spx = bt.comparisons.find((c) => c.label.startsWith("S&P"))!;
    expect(Math.abs(spx.diffPp)).toBeLessThan(5);
  });

  it("documents that the 2008 backtest overshoots the realized equity decline", () => {
    // Fed VIX/spread inputs this extreme, the model's compounding regime
    // multipliers (equity beta x1.35, risk premium x2.1 under financial
    // stress — see lib/regimes.ts) produce a larger decline than the
    // specific realized figure for this window. That gap is real model
    // behaviour, pinned here so it shows up as data in the UI rather than
    // being silently smoothed over; it is not a bug this test is meant to
    // catch, it is the honest result this test exists to keep visible.
    const bt = backtestEpisode(HISTORICAL_EPISODE_BY_ID["gfc_2008"]);
    const spx = bt.comparisons.find((c) => c.label.startsWith("S&P"))!;
    expect(spx.modelPct).toBeLessThan(spx.realizedPct); // model: a deeper loss than what was realized
    expect(Math.abs(spx.diffPp)).toBeGreaterThan(10);
  });
});

describe("episode similarity matching", () => {
  it("scores 0 against every episode at baseline (nothing moved, nothing to compare)", () => {
    const matches = matchEpisodes(baselineState());
    for (const m of matches) expect(m.similarity).toBe(0);
  });

  it("scores a scenario identical to an episode's own inputs at ~1.0 similarity, and ranks it first", () => {
    for (const ep of HISTORICAL_EPISODES) {
      const st = episodeState(ep);
      const matches = matchEpisodes(st);
      expect(matches[0].episode.id).toBe(ep.id);
      expect(matches[0].similarity).toBeCloseTo(1, 6);
    }
  });

  it("sorts by similarity descending", () => {
    const st = { ...baselineState(), vix: 50, igSpread: 300, hyBCCCSpread: 1500, gdpGrowth: -3 };
    const matches = matchEpisodes(st);
    for (let i = 1; i < matches.length; i++) expect(matches[i].similarity).toBeLessThanOrEqual(matches[i - 1].similarity);
  });

  it("a scenario that moves nothing in common with an episode scores 0 against it", () => {
    // termsOfTrade and currentAccount appear in no historical episode's set.
    const st = { ...baselineState(), termsOfTrade: 10, currentAccount: -6 };
    const matches = matchEpisodes(st);
    // Every episode's score is computed over the UNION of variables, so a
    // scenario with no overlap at all still contributes zero numerator
    // (dot product) against every episode's own moved variables — similarity
    // should be 0 for all of them here since nothing shared moved together.
    for (const m of matches) expect(m.similarity).toBe(0);
  });
});

describe("consistency with the live engine", () => {
  it("a historical episode is just another scenario the same runScenario() prices", () => {
    // No parallel code path: backtestEpisode builds a normal VarState and
    // calls the same runScenario every other tab in the app uses.
    const ep = HISTORICAL_EPISODES[0];
    const bt = backtestEpisode(ep);
    const st = episodeState(ep);
    const r = runScenario({ state: st, regimeOverride: null, horizon: ep.horizon, path: ep.path, steps: 8, notional: 1_000_000 });
    expect(bt.portfolioModelPct.p6040).toBeCloseTo(r.portfolios.find((p) => p.id === "p6040")!.pct, 9);
  });
});
