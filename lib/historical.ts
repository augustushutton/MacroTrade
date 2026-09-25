import { ASSET_BY_ID } from "./assets";
import { priceFromYield, runScenario, type ScenarioInput } from "./engine";
import type { Horizon, PathShape } from "./paths";
import type { RegimeId } from "./regimes";
import { baselineState, shock, movedVars, VAR_BY_ID, type VarState } from "./vars";

// Historical analog matching and backtesting.
//
// Three documented episodes, each set as ABSOLUTE end-of-period variable
// levels in this model's own variable set — the same convention
// lib/scenarios.ts's PRESETS use. The figures are recalled, rounded,
// order-of-magnitude approximations of widely reported macro series (Fed
// funds target, headline/core CPI, unemployment, VIX, credit spreads, the
// 10y yield, S&P 500 returns), not values fetched from a live source: this
// sandbox has no network access to FRED or any other macro-data provider
// (see the repository notes), and pretending otherwise would be worse than
// saying so. Every episode carries a `citation` describing the figures'
// provenance and precision, and the exact numbers should be treated as
// "roughly what happened," not decimal-precise history.
//
// The point of running these through the model at all is to ask an
// honestly falsifiable question: fed the documented MACRO inputs from a
// real episode, does this model's own machinery (regime detection, betas,
// second-round links) reproduce anything like the REALIZED asset outcome
// from that episode? `backtestEpisode` runs that comparison directly rather
// than asserting an accuracy claim.

export interface RealizedOutcome {
  label: string;
  /** Maps to this model's own asset id, when there is a clean one, so the
   *  backtest can compare like with like. Omitted where no direct asset
   *  correspondence exists. */
  assetId?: string;
  /** Realized % price return over the episode window, OR — when
   *  `yieldChangeBp` is set instead — omit this and use that. */
  pct?: number;
  /** Documented yield change in bp; converted to a price return using this
   *  model's own duration convention for the mapped asset (priceFromYield),
   *  so a "how much did the 10y actually return" figure is on the exact
   *  same footing as the model's own output. */
  yieldChangeBp?: number;
}

export interface HistoricalEpisode {
  id: string;
  label: string;
  dateRange: string;
  gist: string;
  set: Partial<VarState>;
  path: PathShape;
  horizon: Horizon;
  realized: RealizedOutcome[];
  citation: string;
}

export const HISTORICAL_EPISODES: HistoricalEpisode[] = [
  {
    id: "hiking_2004_2006",
    label: "2004–2006 Fed Hiking Cycle",
    dateRange: "Jun 2004 – Jun 2006",
    gist: "17 consecutive 25bp hikes to 5.25%; the long end barely moved (Greenspan's 'conundrum') while growth and equities stayed firm.",
    set: {
      fedFunds: 5.25,
      forwardGuidance: 1.0,
      realRate10y: 2.3,
      cpiCore: 2.6,
      cpiHeadline: 3.5,
      gdpGrowth: 3.0,
      unemployment: 4.6,
      vix: 13,
      igSpread: 85,
      dxy: 85,
      // Corporate earnings grew robustly through this cycle (double-digit S&P
      // EPS growth in most years of the window) — set explicitly so the
      // backtest tests this model's rate/valuation channels against a
      // realistic earnings backdrop rather than an implicit zero.
      earningsGrowth: 12,
      earningsRevisions: 8,
    },
    path: "linear",
    horizon: 24,
    realized: [
      { label: "S&P 500 (price return)", assetId: "SPX", pct: 25 },
      { label: "UST 10Y (price return)", assetId: "UST10Y", yieldChangeBp: 50 },
    ],
    citation:
      "Fed funds target path and CPI/unemployment levels are FOMC/BLS series as widely reported; the ~25% S&P figure and ~50bp 10y yield rise are rounded approximations of the 2004–2006 window, not decimal-precise history.",
  },
  {
    id: "gfc_2008",
    label: "2008–09 Global Financial Crisis (acute phase)",
    dateRange: "Sep 2008 – Mar 2009",
    gist: "Lehman, the credit-market seizure, and the Fed's move to the zero lower bound. Equities and credit collapsed together; Treasuries rallied hard.",
    set: {
      vix: 65,
      igSpread: 450,
      hyBBSpread: 850,
      hyBCCCSpread: 2000,
      fedFunds: 0.25,
      forwardGuidance: -2.5,
      gdpGrowth: -4.5,
      unemployment: 7.5,
      fciComposite: 2.8,
      emStress: 8,
      dxy: 88,
      // Earnings estimates were cut sharply through the acute crisis window.
      earningsGrowth: -30,
      earningsRevisions: -45,
    },
    path: "immediate",
    horizon: 6,
    realized: [
      { label: "S&P 500 (price return)", assetId: "SPX", pct: -45 },
      { label: "UST 10Y (price return)", assetId: "UST10Y", yieldChangeBp: -160 },
    ],
    citation:
      "VIX closed near 80 intraday in Nov 2008 (a widely reported record); credit-spread and GDP figures are rounded approximations of the acute Sep 2008–Mar 2009 window, not decimal-precise history.",
  },
  {
    id: "hiking_2022",
    label: "2022 Fed Hiking Cycle",
    dateRange: "Jan 2022 – Dec 2022",
    gist: "The fastest tightening pace since the early 1980s; headline CPI peaked near 9% while the labour market stayed historically tight.",
    set: {
      fedFunds: 4.5,
      forwardGuidance: 2.0,
      cpiHeadline: 6.5,
      cpiCore: 5.7,
      realRate10y: 1.6,
      gdpGrowth: 1.0,
      unemployment: 3.5,
      vix: 22,
      igSpread: 130,
      dxy: 103,
      be10y: 2.3,
      // 2022 is the textbook "multiple compression, not an earnings
      // recession" year: forward P/E fell from roughly 21.5x to roughly 17x
      // while earnings still grew modestly. fwdPE pins SPX's multiple
      // channel directly (see runScenario's SPX step) rather than letting
      // the model re-derive a re-rating from the other inputs, which is the
      // right call precisely because the re-rating itself is the
      // well-documented fact here, not something to infer.
      fwdPE: 17,
      earningsGrowth: 6,
    },
    path: "staged",
    horizon: 12,
    realized: [
      { label: "S&P 500 (price return)", assetId: "SPX", pct: -19 },
      { label: "UST 10Y (price return)", assetId: "UST10Y", yieldChangeBp: 240 },
    ],
    citation:
      "Fed funds path and CPI prints (headline peaking ~9.1% YoY in Jun 2022) are widely reported; the -19% S&P and +240bp 10y figures are rounded approximations of calendar-2022, not decimal-precise history.",
  },
];

export const HISTORICAL_EPISODE_BY_ID: Record<string, HistoricalEpisode> = Object.fromEntries(
  HISTORICAL_EPISODES.map((e) => [e.id, e]),
);

/** An episode applied to a clean baseline — mirrors lib/scenarios.ts's
 *  presetState, kept local (rather than importing it) so this module has no
 *  dependency on the preset-library's Preset type. Exported for tests and
 *  any caller that wants an episode's full state without also running it. */
export function episodeState(ep: HistoricalEpisode): VarState {
  const s = baselineState();
  for (const [k, v] of Object.entries(ep.set)) {
    if (VAR_BY_ID[k] && typeof v === "number") s[k] = v;
  }
  return s;
}

export interface EpisodeMatch {
  episode: HistoricalEpisode;
  /** Cosine similarity of the two scenarios' NORMALISED shock vectors, over
   *  the union of variables either one moved — so it compares SHAPE and
   *  direction, not overall size. Ranges -1 (opposite) to +1 (identical
   *  direction and relative proportions); 0 when there is nothing to
   *  compare (nothing moved on-screen, or the episode shares no variable
   *  with what moved). Signed, not clamped to zero, because a scenario that
   *  moves in the OPPOSITE direction from a real episode is a genuine (and
   *  useful) match: it explains why "correlated with the wrong sign" shows
   *  up as clearly negative rather than lost among the low-similarity noise.
   */
  similarity: number;
}

export function matchEpisodes(state: VarState): EpisodeMatch[] {
  const movedIds = movedVars(state).map((v) => v.id);
  return HISTORICAL_EPISODES.map((ep) => {
    const epState = episodeState(ep);
    const ids = Array.from(new Set([...movedIds, ...Object.keys(ep.set)]));
    if (ids.length === 0) return { episode: ep, similarity: 0 };
    const a = ids.map((id) => shock(state, id));
    const b = ids.map((id) => shock(epState, id));
    const dot = a.reduce((s, x, i) => s + x * b[i], 0);
    const na = Math.sqrt(a.reduce((s, x) => s + x * x, 0));
    const nb = Math.sqrt(b.reduce((s, x) => s + x * x, 0));
    const similarity = na > 1e-9 && nb > 1e-9 ? dot / (na * nb) : 0;
    return { episode: ep, similarity };
  }).sort((x, y) => y.similarity - x.similarity);
}

export interface BacktestComparison {
  label: string;
  modelPct: number;
  realizedPct: number;
  diffPp: number;
}

export interface BacktestResult {
  episode: HistoricalEpisode;
  /** Regime this model's own detection assigns to the episode's documented
   *  inputs — a real, falsifiable check of whether the auto-detector reads
   *  a known historical episode the way history actually characterised it. */
  regime: RegimeId;
  comparisons: BacktestComparison[];
  portfolioModelPct: Record<string, number>;
}

export function backtestEpisode(ep: HistoricalEpisode, notional = 1_000_000): BacktestResult {
  const state = episodeState(ep);
  const r = runScenario({
    state,
    regimeOverride: null,
    horizon: ep.horizon,
    path: ep.path,
    steps: 8,
    notional,
  });

  const comparisons: BacktestComparison[] = ep.realized.map((real) => {
    const modelPct = real.assetId ? r.assets[real.assetId]?.pricePct ?? NaN : NaN;
    const realizedPct =
      real.pct !== undefined
        ? real.pct
        : real.yieldChangeBp !== undefined && real.assetId
          ? priceFromYield(ASSET_BY_ID[real.assetId]?.duration ?? 0, real.yieldChangeBp)
          : NaN;
    return { label: real.label, modelPct, realizedPct, diffPp: modelPct - realizedPct };
  });

  const portfolioModelPct: Record<string, number> = {};
  for (const p of r.portfolios) portfolioModelPct[p.id] = p.pct;

  return { episode: ep, regime: r.regime.active, comparisons, portfolioModelPct };
}
