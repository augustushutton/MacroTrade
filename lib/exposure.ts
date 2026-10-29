// Desk-risk summary: aggregate factor exposure per allocation, and a
// model-implied cross-asset correlation matrix. Two different kinds of
// "math correct" apply here, and they are not solved the same way.
//
// EXPOSURE (rate DV01, credit spread DV01, FX delta, equity beta) needs no
// new data or assumptions — every number is a direct function of fields this
// app already ships and already tests: Sleeve weights (lib/portfolios.ts),
// Asset.duration (lib/assets.ts), and DERIVED_EQUITY's beta-to-SPX
// (lib/elasticities.ts). Nothing here is fitted or guessed.
//
// CORRELATION is the harder problem, and worth being honest about: this
// engine has no historical price series and no covariance model (see
// PnlTab.tsx's own comment on why VaR/Sharpe are omitted for the same
// reason) — so there is no dataset to compute a realised correlation FROM.
// Hand-typing a plausible-looking matrix instead would be exactly the kind
// of invented number this file is trying to avoid.
//
// What the engine DOES have is lib/elasticities.ts: a full set of betas from
// every one of the 46 input variables to every asset, already expressed in
// comparable "per one normalised shock" units (see that file's own header)
// and already the single source every other number in this app — Derivation,
// Sensitivity, P&L — is computed from. That is a legitimate basis for a
// MODEL-IMPLIED correlation: shock each variable by exactly one normalised
// unit, one at a time, holding everything else at baseline, and read off how
// much each asset's price moves (AssetResult.pricePct, already a common %
// unit across every asset kind — see that field's own comment). Two assets
// whose 46-length response vectors point the same way are assets this model
// believes move together; two that point oppositely are assets it believes
// diversify. Correlation is the cosine similarity of those two vectors.
//
// This is a real, named technique (a factor-model-implied covariance, same
// family as a fundamental/APT risk model: Cov(i,j) = beta_i' * beta_j under
// unit-variance, uncorrelated factors) rather than a house invention, and it
// inherits every piece of economic reasoning already encoded in
// elasticities.ts (SPX's riskPremium channel pricing off credit spreads is
// why equities and high-yield correlate below; EAFE/EM/RTY/etc. literally
// carrying `sources.SPX * beta` — see engine.ts's DERIVED_EQUITY loop — is
// why every satellite equity sleeve correlates with US Large Cap). It is
// NOT a realised/historical correlation and does not claim to be one: it is
// conditional on which regime's multiplier table is active (REGIMES in
// lib/regimes.ts already documents that correlation itself is regime-
// dependent — financial_stress's own gist literally says so), which is why
// callers pass the CURRENTLY DETECTED regime rather than a fixed one, so the
// matrix moves with the live scenario instead of freezing an arbitrary
// baseline assumption.

import { VARIABLES, baselineState, type VarState } from "./vars";
import { ASSET_BY_ID, type AssetGroup } from "./assets";
import { DERIVED_EQUITY, SECOND_ROUND } from "./elasticities";
import { EQUITY_SLEEVE, BOND_SLEEVE, PORTFOLIOS, portfolioWeights, type Portfolio } from "./portfolios";
import { runScenario, type ScenarioInput } from "./engine";
import type { RegimeId } from "./regimes";

// ---------------------------------------------------------------------------
// Factor exposure.
// ---------------------------------------------------------------------------

export interface FactorExposure {
  portfolioId: string;
  label: string;
  /** $ P&L for a +1bp parallel move in Treasury yields. */
  rateDv01: number;
  /** $ P&L for a +1bp move in credit spreads. */
  creditDv01: number;
  /** $ P&L for a +1% move in the broad dollar. */
  fxDelta: number;
  /** Whole-book beta to US Large Cap (equity weight x the equity sleeve's own weighted beta). */
  equityBeta: number;
}

/** Equity-sleeve beta to SPX, dollar-weighted — a fixed property of
 *  EQUITY_SLEEVE's composition (held constant across all four allocations,
 *  see portfolios.ts's own header), not of any one portfolio. SPX itself is
 *  beta 1 to itself by definition; it has no entry in DERIVED_EQUITY because
 *  that table is "beta to SPX" for everything that ISN'T SPX. */
function equitySleeveBeta(): number {
  let total = 0;
  for (const s of EQUITY_SLEEVE) {
    const beta = s.asset === "SPX" ? 1 : DERIVED_EQUITY[s.asset]?.beta ?? 0;
    total += (s.w / 100) * beta;
  }
  return total;
}

/** DV01 ($ per 1bp) for one leg of the bond sleeve, filtered by Asset.kind —
 *  "rate" isolates the four pure Treasuries, "credit" isolates MBS/IG/HY.
 *  Mirrors PnlTab.tsx's portfolioDuration() exactly (same sleeve, same
 *  weight x duration product), just split by kind and left in dollars
 *  rather than collapsed into a single blended year figure. */
function bondDv01(p: Portfolio, notional: number, kind: "rate" | "credit"): number {
  let dv01 = 0;
  for (const s of BOND_SLEEVE) {
    const a = ASSET_BY_ID[s.asset];
    if (!a || a.kind !== kind || a.duration === undefined) continue;
    const dollarWeight = (p.bond / 100) * (s.w / 100) * notional;
    dv01 += dollarWeight * a.duration * 0.0001;
  }
  return dv01;
}

/** $ P&L for a +1% broad-dollar (USD/CAD, the engine's one latent dollar
 *  factor — see elasticities.ts's FX header) move. Two legs, both computed
 *  generically off fields this app already ships rather than hardcoded:
 *
 *  1. Direct FX/Commodity sleeve weight. None of the four model portfolios
 *     hold any (EQUITY_SLEEVE/BOND_SLEEVE — see portfolios.ts), so this leg
 *     is 0 today, same as before this function grew a second leg.
 *
 *  2. Currency TRANSLATION already priced into the international equity
 *     sleeve. EAFE and EM are unhedged developed/EM equity, and
 *     elasticities.ts's SECOND_ROUND already carries a real USD/CAD ->
 *     EAFE/EM beta for exactly that reason ("Translation of unhedged
 *     developed-market equity into USD" / "EM equity carries the dollar
 *     twice: translation and funding") — the same beta every other number
 *     in this app derived from EAFE/EM's own pricePct (P&L, Derivation,
 *     Sensitivity) already includes. Before this leg existed, FX Delta only
 *     summed leg 1, so it read a flat $0 for every allocation regardless of
 *     how much real currency risk that allocation carried through its
 *     international equity weight — a 60/40 with 30% of its equity sleeve
 *     in EAFE+EM is not currency-neutral, and this column should not have
 *     implied it was. Only USD/CAD "price"-channel links are read (the only
 *     kind that exist against a held asset today), so an unrelated
 *     SECOND_ROUND entry can never silently leak into this sum. */
function fxDelta(p: Portfolio, notional: number): number {
  let delta = 0;
  for (const w of portfolioWeights(p)) {
    const a = ASSET_BY_ID[w.asset];
    const group: AssetGroup | undefined = a?.group;
    const dollarWeight = (w.w / 100) * notional;
    if (group === "FX" || group === "Commodities") {
      delta += dollarWeight * 0.01;
      continue;
    }
    const translation = SECOND_ROUND.find(
      (s) => s.from === "USDCAD" && s.to === w.asset && s.channel === "price",
    );
    if (translation) delta += dollarWeight * (translation.b / 100);
  }
  return delta;
}

/** Factor exposure for all four allocations, at a given notional. Pure and
 *  scenario-independent — none of these four quantities depend on which
 *  macro variables are currently shocked, only on sleeve composition,
 *  duration, and beta, so this needs no memoization keyed on live state. */
export function factorExposures(notional: number): FactorExposure[] {
  const sleeveBeta = equitySleeveBeta();
  return PORTFOLIOS.map((p) => ({
    portfolioId: p.id,
    label: p.label,
    rateDv01: bondDv01(p, notional, "rate"),
    creditDv01: bondDv01(p, notional, "credit"),
    fxDelta: fxDelta(p, notional),
    equityBeta: (p.equity / 100) * sleeveBeta,
  }));
}

// ---------------------------------------------------------------------------
// Model-implied correlation.
// ---------------------------------------------------------------------------

/** Each instrument's price-impact (%) to a +1 normalised-unit shock in every
 *  one of the 46 input variables, one variable at a time, everything else
 *  held at baseline. Same units (AssetResult.pricePct) across every asset
 *  kind, so these vectors are directly comparable without any unit
 *  conversion of their own. Pinned to one `regime` for every one of the 46
 *  calibration runs — regime multipliers are real (lib/regimes.ts) and
 *  letting each variable auto-detect its OWN regime in isolation would
 *  compare unit shocks evaluated under different multiplier tables, which
 *  is the actual econometric issue to avoid, not a simplification. */
export function unitShockResponses(
  instrumentIds: string[],
  regime: RegimeId | null,
): Record<string, number[]> {
  const base = baselineState();
  const vectors: Record<string, number[]> = {};
  for (const id of instrumentIds) vectors[id] = [];

  for (const v of VARIABLES) {
    const state: VarState = { ...base, [v.id]: v.base + v.norm };
    const input: ScenarioInput = {
      state,
      regimeOverride: regime,
      // path/horizon/steps don't affect AssetResult.pricePct at all — the
      // engine's own runScenario never reads input.path/horizon/steps (they
      // only drive the delivery-timeline chart and horizonLadder elsewhere)
      // — so these three are structurally inert for this calculation and
      // any valid placeholder value is equally correct.
      path: "immediate",
      horizon: 12,
      steps: 1,
      notional: 1,
    };
    const r = runScenario(input);
    for (const id of instrumentIds) vectors[id].push(r.assets[id]?.pricePct ?? 0);
  }
  return vectors;
}

/** Cosine similarity of two instruments' unit-shock response vectors — see
 *  this file's header for why that is the correlation this app can
 *  honestly compute. Clamped to [-1, 1] to absorb floating-point drift
 *  (a vector's similarity with itself can land at 1.0000000002). An
 *  instrument with a literal zero vector (no modelled sensitivity to any of
 *  the 46 variables) returns 1 against itself and 0 against everything
 *  else, rather than the undefined 0/0 a raw division would produce. */
export function correlationMatrix(instrumentIds: string[], regime: RegimeId | null): number[][] {
  const vectors = unitShockResponses(instrumentIds, regime);
  const n = instrumentIds.length;
  const norms = instrumentIds.map((id) => Math.sqrt(vectors[id].reduce((s, x) => s + x * x, 0)));
  const out: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) {
        out[i][j] = 1;
        continue;
      }
      if (norms[i] < 1e-9 || norms[j] < 1e-9) {
        out[i][j] = 0;
        continue;
      }
      const vi = vectors[instrumentIds[i]];
      const vj = vectors[instrumentIds[j]];
      const dot = vi.reduce((s, x, k) => s + x * vj[k], 0);
      out[i][j] = Math.max(-1, Math.min(1, dot / (norms[i] * norms[j])));
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Risk tiers.
// ---------------------------------------------------------------------------

export interface AssetRisk {
  id: string;
  label: string;
  /** L2 norm of the instrument's 46-length unit-shock response vector — the
   *  same per-variable pricePct values the correlation matrix above turns
   *  into cosine similarities, just reduced to a single magnitude instead of
   *  a pairwise angle. "How much does this instrument move, in aggregate,
   *  across every one of the model's macro shocks" rather than "which other
   *  instrument does it move with." Same honesty constraint as correlation:
   *  this is model-implied from elasticities.ts's real betas, not a fitted
   *  or historical volatility figure. */
  norm: number;
  tier: "high" | "medium" | "low";
}

/** Ranks instruments by aggregate macro sensitivity and splits them into
 *  three tiers by RANK (terciles: top third / middle third / bottom third of
 *  the sorted list), not by a fixed magnitude cutoff. A fixed threshold
 *  ("anything over 2.0% is High risk") would be exactly the kind of invented
 *  constant this file's header warns against, and would silently misclassify
 *  everything as "High" or "Low" the moment the regime multiplier or the
 *  instrument set changes its overall scale. A rank-based split has no such
 *  constant, stays well-defined for any instrument set/regime, and still
 *  answers the question a desk actually asks — "which names carry the most
 *  risk RELATIVE TO EACH OTHER right now." */
export function assetRiskRanking(instrumentIds: string[], regime: RegimeId | null): AssetRisk[] {
  const vectors = unitShockResponses(instrumentIds, regime);
  const ranked = instrumentIds
    .map((id) => ({
      id,
      label: ASSET_BY_ID[id]?.label ?? id,
      norm: Math.sqrt(vectors[id].reduce((s, x) => s + x * x, 0)),
    }))
    .sort((a, b) => b.norm - a.norm);

  const n = ranked.length;
  const hiCut = Math.ceil(n / 3);
  const medCut = Math.ceil((2 * n) / 3);
  return ranked.map((r, i) => ({
    ...r,
    tier: i < hiCut ? "high" : i < medCut ? "medium" : "low",
  }));
}

/** A cross-asset desk's correlation matrix, not the full priced universe —
 *  three passes, each with a different criterion:
 *
 *  1. Widened from an original 8-instrument subset to the full 29-
 *     instrument TOP_LEVEL_ASSETS set (request: "wider").
 *  2. Trimmed 29 -> 20 by MEASURED statistical redundancy: computed the full
 *     29x29 correlationMatrix() at baseline and cut one representative from
 *     every pair at |corr| >= 0.95 (WTI/BRENT/NATGAS, COPPER/IRON,
 *     SPX/HCARE/SEMI/TECHX/RTY, EAFE/EM, UST5Y+UST10Y/MBS) — see git history
 *     for the exact pairwise values; that reasoning doesn't repeat here
 *     because pass 3 below replaced its conclusion.
 *  3. Trimmed 20 -> 11 by a DIFFERENT criterion (request: "assets that are
 *     commonly correlated with each other on many finance platforms...
 *     remove excess things a trader wouldn't necessarily want to look at").
 *     This isn't a redundancy cut — every survivor of pass 2 was already
 *     below 0.95 pairwise, so there was no more statistical duplication
 *     left to remove. It's a SCOPE cut: a desk's cross-asset correlation
 *     grid (the kind on a Bloomberg CRAM screen or a sell-side cross-asset
 *     note) carries one or two representative instruments per asset class,
 *     not every tenor/tranche/pair that happens to be priced. Rates keeps
 *     the two curve points that frame its shape (UST2Y front end, UST10Y
 *     long end) and drops the interior/far end (UST5Y, UST30Y) a cross-
 *     asset reader doesn't need to see the curve's shape. Credit keeps the
 *     standard IG/HY two-bucket split and drops HY_BCCC, a stress-only
 *     tranche. Equities keep the three-region split every macro desk
 *     already thinks in (SPX domestic, EAFE developed-ex-US, EM — the one
 *     "niche" addition kept because EM risk sentiment is its own common
 *     cross-asset signal) and drop the sector tilts/small cap, which belong
 *     on an equity-specific screen, not a cross-asset one. Commodities keep
 *     oil and gold, the two every cross-asset matrix carries, and drop the
 *     base metals/ags, which are a commodities desk's granularity, not a
 *     generalist's. FX keeps EUR/USD and USD/JPY, the world's two most-
 *     watched pairs, and drops the regional ones (CAD/CNY/MXN/CHF/GBP) —
 *     niche by cross-asset-dashboard convention even though some of them
 *     are individually liquid. assetRiskRanking() above still ranks the
 *     FULL 29 — which names move the most is a different question from
 *     which names belong on a correlation screen, and the dropped ones
 *     (UST5Y, RTY, HY_BCCC, COPPER, USDCAD, etc.) are still real rows
 *     there. */
export const CORRELATION_INSTRUMENTS = [
  "UST2Y", "UST10Y",
  "IG", "HY_BB",
  "SPX", "EAFE", "EM",
  "WTI", "GOLD",
  "EURUSD", "USDJPY",
];

// ---------------------------------------------------------------------------
// Concentration.
// ---------------------------------------------------------------------------

export interface PositionWeight {
  portfolioId: string;
  portfolioLabel: string;
  /** 1-based rank within this portfolio, 1 = single largest position. */
  rank: number;
  assetId: string;
  assetLabel: string;
  /** Percent of the whole book (0-100), not of the sleeve it sits in — a
   *  60/40's 26% IG weight-of-sleeve is 60% x 26% = 15.6% of the BOOK, and
   *  it's the book figure that answers "how concentrated is this
   *  portfolio," not the sleeve-relative one. */
  weightPct: number;
  /** $ exposure at the given notional — weightPct expressed in dollars,
   *  nothing else. */
  dollar: number;
}

/** The N largest individual positions in each of the four allocations, by
 *  $ weight — distinct from the Exposure table above, which is already
 *  aggregated into four risk FACTORS (rate/credit DV01, FX delta, equity
 *  beta) spanning many positions each. This answers a different question:
 *  not "how much rate risk does the book carry in total" but "what is the
 *  single biggest individual bet in it." Built straight off
 *  portfolioWeights() (lib/portfolios.ts) — the same flattened per-asset
 *  weights portfolioDuration() (PnlTab.tsx) and fxDelta() above both sum
 *  over — just sorted and sliced instead of aggregated, so nothing new is
 *  fitted or assumed here either.
 *
 *  RiskTab's "Concentration Ranking" panel (the one caller of this) was
 *  removed by request ("remove concentration ranking tab"). This function,
 *  PositionWeight, and its tests in tests/exposure.test.ts are left on disk
 *  unused rather than deleted — same reversibility convention as
 *  lib/montecarlo.ts and lib/format.ts's unused heatGradient/
 *  signFillGradient. */
export function topPositions(notional: number, n = 3): PositionWeight[] {
  const out: PositionWeight[] = [];
  for (const p of PORTFOLIOS) {
    const ranked = portfolioWeights(p)
      .filter((w) => w.w > 0)
      .sort((a, b) => b.w - a.w)
      .slice(0, n);
    ranked.forEach((w, i) => {
      out.push({
        portfolioId: p.id,
        portfolioLabel: p.label,
        rank: i + 1,
        assetId: w.asset,
        assetLabel: ASSET_BY_ID[w.asset]?.label ?? w.asset,
        weightPct: w.w,
        dollar: (w.w / 100) * notional,
      });
    });
  }
  return out;
}
