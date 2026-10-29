import type { PathShape, Horizon } from "./paths";
import type { RegimeId } from "./regimes";
import { baselineState, VAR_BY_ID, type VarState } from "./vars";

// The pre-built library. Every entry sets ABSOLUTE variable values, not deltas,
// so a preset is a complete statement of a world rather than an instruction
// that composes differently depending on what was on screen before it.
//
// Presets set several variables at once ON PURPOSE. A 100bp hike that leaves
// growth, the dollar and financial conditions at baseline is not a scenario, it
// is a partial derivative — and the model already gives that in the sensitivity
// tab. The point of the library is internally coherent worlds.

export interface Preset {
  id: string;
  label: string;
  group: string;
  /** One line. The narrative tab carries the argument. */
  gist: string;
  set: Partial<VarState>;
  path: PathShape;
  horizon: Horizon;
  /** Only set where the preset intends a regime the triggers would not pick. */
  regime?: RegimeId;
}

export const PRESET_GROUPS = [
  "Policy",
  "Inflation",
  "Growth",
  "Credit & Liquidity",
  "External",
  "Curve",
] as const;

export const PRESETS: Preset[] = [
  // ---- Policy --------------------------------------------------------------
  // The five Fed-hike/cut presets and BoE +100bp were removed by request,
  // leaving the three non-Fed policy moves: a foreign central bank tightening
  // with no Fed response (ECB), a foreign central bank normalising policy
  // (BoJ), and balance-sheet runoff with no policy-rate move at all (QT).
  {
    id: "ecb_75",
    label: "ECB +75bp",
    group: "Policy",
    gist: "Euro-area tightening with no Fed response",
    set: { ecbDepo: 3.0, eurusd: 1.12 },
    path: "staged",
    horizon: 6,
  },
  {
    id: "boj_normalise",
    label: "BoJ Normalisation",
    group: "Policy",
    gist: "Yield curve control fully unwound; carry trade reverses",
    set: { bojPolicy: 1.75, usdjpy: 136, vix: 20 },
    path: "linear",
    horizon: 12,
  },
  {
    id: "qt_accel",
    label: "QT Acceleration",
    group: "Policy",
    gist: "Runoff doubles; term premium rebuilds without a policy-rate move",
    set: { qtPace: 90, fedBalanceSheet: 19, realRate10y: 2.3 },
    path: "linear",
    horizon: 12,
  },

  // ---- Inflation -----------------------------------------------------------
  {
    id: "infl_sudden",
    label: "Sudden Inflation",
    group: "Inflation",
    gist: "Prints reaccelerate in one quarter; expectations follow",
    set: {
      cpiHeadline: 5.8,
      cpiCore: 5.0,
      pceCore: 4.6,
      be5y: 3.0,
      be10y: 2.8,
      wageGrowth: 5.2,
      fedFunds: 4.75,
      forwardGuidance: 1.25,
      realRate10y: 2.3,
      vix: 22,
    },
    path: "immediate",
    horizon: 6,
  },
  {
    id: "infl_gradual",
    label: "Gradual Inflation",
    group: "Inflation",
    gist: "Same terminal inflation, delivered over a year",
    set: {
      cpiHeadline: 5.8,
      cpiCore: 5.0,
      pceCore: 4.6,
      be5y: 3.0,
      be10y: 2.8,
      wageGrowth: 5.2,
      fedFunds: 4.75,
      forwardGuidance: 1.25,
      realRate10y: 2.3,
    },
    path: "linear",
    horizon: 12,
  },
  {
    id: "stagflation",
    label: "Stagflation",
    group: "Inflation",
    gist: "Inflation up, growth down, and duration does not hedge",
    set: {
      cpiHeadline: 6.2,
      cpiCore: 5.4,
      pceCore: 4.9,
      be5y: 3.2,
      be10y: 3.0,
      wageGrowth: 5.8,
      productivity: 0.2,
      gdpGrowth: 0.3,
      pmiMfg: 46,
      pmiSvcs: 49.5,
      unemployment: 4.9,
      earningsGrowth: -2,
      earningsRevisions: -18,
      fedFunds: 5.0,
      forwardGuidance: 1.0,
      realRate10y: 2.6,
      vix: 26,
      igSpread: 1.45,
      hyBBSpread: 3.40,
      energySupply: 8,
    },
    path: "scurve",
    horizon: 12,
  },

  // ---- Growth --------------------------------------------------------------
  // Soft Landing and Goldilocks were removed by request, leaving the two
  // recession presets plus Energy Supply Shock, moved in from External below
  // (a supply shock is a growth story here — termsOfTrade/gdpGrowth both move
  // — as much as it is an external one).
  {
    // Renamed from "Demand-Pull Recession" — "demand-pull" is a term of
    // art for an INFLATIONARY mechanism (aggregate demand outrunning
    // supply and pulling prices up), not a contraction. Everything this
    // preset actually sets — falling growth, falling CPI (cpiHeadline
    // 1.6, cpiCore 2.2, both below baseline), the Fed cutting (fedFunds
    // down, forwardGuidance negative) — describes the opposite: a
    // demand-DEFICIENT downturn, where weak orders/output disinflate the
    // economy rather than overheat it. "Demand Recession" names that
    // correctly and still sits as the orders/output-led counterpart to
    // "Labor Recession" below (consumer/labor-market-led) without
    // borrowing a word that means the opposite thing. id/gist/variable
    // set are unchanged — this was a labeling error, not a modeling one.
    id: "recession_pmi",
    label: "Demand Recession",
    group: "Growth",
    gist: "Orders and output roll first; labor follows late",
    set: {
      gdpGrowth: -1.8,
      pmiMfg: 42,
      pmiSvcs: 46,
      regionalFed: -22,
      unemployment: 5.0,
      earningsGrowth: -14,
      earningsRevisions: -35,
      cpiCore: 2.2,
      cpiHeadline: 1.6,
      fedFunds: 2.75,
      forwardGuidance: -1.75,
      realRate10y: 1.0,
      vix: 29,
      igSpread: 1.65,
      hyBBSpread: 4.20,
      hyBCCCSpread: 9.50,
    },
    path: "scurve",
    horizon: 12,
  },
  {
    id: "recession_labour",
    label: "Labor Recession",
    group: "Growth",
    gist: "Unemployment gaps higher; the consumer stops",
    set: {
      unemployment: 6.3,
      participation: 62.1,
      gdpGrowth: -2.4,
      pmiSvcs: 44,
      pmiMfg: 44,
      wageGrowth: 2.6,
      earningsGrowth: -20,
      earningsRevisions: -45,
      cpiCore: 2.0,
      cpiHeadline: 1.2,
      fedFunds: 2.0,
      forwardGuidance: -2.25,
      realRate10y: 0.6,
      vix: 33,
      igSpread: 1.90,
      hyBBSpread: 5.00,
      hyBCCCSpread: 11.50,
    },
    path: "scurve",
    horizon: 24,
  },
  {
    id: "oil_spike",
    label: "Energy Supply Shock",
    group: "Growth",
    gist: "Supply withdrawn, not demand added; equities and oil move opposite ways",
    set: {
      energySupply: 28,
      cpiHeadline: 5.4,
      cpiCore: 3.6,
      be5y: 2.85,
      termsOfTrade: -6,
      gdpGrowth: 0.8,
      vix: 26,
      fedFunds: 4.5,
      forwardGuidance: 0.75,
    },
    path: "immediate",
    horizon: 6,
  },

  // ---- Credit & liquidity --------------------------------------------------
  {
    id: "credit_crisis",
    label: "Credit Shortage",
    group: "Credit & Liquidity",
    gist: "Funding stress, not a growth forecast, sets prices",
    set: {
      vix: 44,
      igSpread: 2.60,
      hyBBSpread: 7.20,
      hyBCCCSpread: 16.50,
      gdpGrowth: -1.0,
      // pmiMfg/pmiSvcs added on audit: a -3.0pp GDP print (gdpGrowth's own
      // delta from baseline) with both ISM surveys left at an expansionary
      // baseline (49.5/53.0) was internally inconsistent — GDP and the ISM
      // surveys move together, and every other preset in this library that
      // sets a comparable or smaller GDP hit (recession_pmi, -3.8pp;
      // stagflation, -1.7pp) also pulls PMI into/near contraction. Set a
      // notch milder than recession_pmi's own 42/46, matching this
      // preset's somewhat smaller GDP delta.
      pmiMfg: 44,
      pmiSvcs: 47,
      unemployment: 5.1,
      earningsRevisions: -30,
      fedFunds: 3.0,
      forwardGuidance: -2.0,
      fedBalanceSheet: 25,
      qtPace: 0,
      // +4.85%, the same dollar-strength move the old DXY shock (103 -> 108)
      // meant, carried over onto USD/CAD's own base (1.36 -> 1.426) rather
      // than reused as a literal level that would mean something completely
      // different on this pair's scale.
      usdcad: 1.426,
    },
    path: "immediate",
    horizon: 6,
  },
  {
    id: "liquidity_squeeze",
    label: "Liquidity Shortage",
    group: "Credit & Liquidity",
    gist: "Balance-sheet withdrawal with no credit event behind it",
    // Same +4.85% dollar-strength move as Credit Shortage above.
    set: { qtPace: 130, fedBalanceSheet: 17, vix: 27, igSpread: 1.50, realRate10y: 2.5, usdcad: 1.426 },
    path: "linear",
    horizon: 12,
  },
  {
    id: "vol_shock",
    label: "Volatility Spike",
    group: "Credit & Liquidity",
    gist: "Positioning unwind; risk premium repricing with clean fundamentals",
    // hyBBSpread added on audit: IG widened +45bp and B/CCC +360bp with the
    // BB tier in between left untouched — a skipped rung in an otherwise
    // monotonic credit-quality curve. A risk-premium repricing widens every
    // tier, scaling by quality; +180bp sits where BB belongs between IG and
    // CCC's own moves here, the same tiering every other credit-touching
    // preset in this library keeps (e.g. stagflation: IG +50bp, BB +120bp;
    // credit_crisis: IG +165bp, BB +500bp, CCC +1130bp).
    set: { vix: 38, hyBBSpread: 4.00, hyBCCCSpread: 8.80, igSpread: 1.40, usdjpy: 141 },
    path: "meanRevert",
    horizon: 6,
  },

  // ---- External ------------------------------------------------------------
  // Energy Supply Shock moved to Growth above; EM Currency Crisis removed by
  // request.
  {
    id: "dollar_debasement",
    label: "Twin Deficit Shock",
    group: "External",
    gist: "Fiscal path, not growth, drives the dollar and the long end",
    set: {
      deficitGdp: 9.5,
      debtGdp: 140,
      currentAccount: -5.2,
      // -9.71%, the same dollar-weakness move the old DXY shock (103 -> 93)
      // meant, carried over onto USD/CAD's own base (1.36 -> 1.228).
      usdcad: 1.228,
      be10y: 2.9,
      realRate10y: 2.4,
      fedBalanceSheet: 26,
    },
    path: "linear",
    horizon: 24,
  },
  {
    id: "commodity_bull",
    label: "Bull Commodity Cycle",
    group: "External",
    gist: "Global capex cycle with a soft dollar",
    set: {
      gdpGrowth: 3.2,
      pmiMfg: 56,
      pmiSvcs: 56,
      usdcny: 6.85,
      // -7.77%, the same dollar-weakness move the old DXY shock (103 -> 95)
      // meant, carried over onto USD/CAD's own base (1.36 -> 1.254).
      usdcad: 1.254,
      cpiHeadline: 3.6,
      cpiCore: 3.2,
      be5y: 2.7,
      // termsOfTrade sign flipped on audit, from +4 to -2. This preset's
      // own energySupply (+6, tighter supply, pricier commodities) carries
      // the SAME sign as oil_spike's energySupply: 28, and oil_spike pairs
      // that with termsOfTrade: -6 (pricier commodities WORSEN US terms of
      // trade under this model's importer framing) — a convention
      // commodity_bear's own pairing confirms the other way (energySupply:
      // -14, cheaper commodities, with termsOfTrade: +5). +4 here had
      // rising commodity prices IMPROVING terms of trade, the opposite sign
      // of both sibling presets for the identical mechanism. -2 keeps the
      // sign consistent while staying proportionate to this preset's own
      // smaller energySupply move.
      termsOfTrade: -2,
      energySupply: 6,
    },
    path: "scurve",
    horizon: 24,
  },
  {
    id: "commodity_bear",
    label: "Bear Commodity Cycle",
    group: "External",
    gist: "Supply glut and a China demand air pocket",
    set: {
      energySupply: -14,
      usdcny: 7.6,
      pmiMfg: 46,
      gdpGrowth: 1.2,
      cpiHeadline: 1.4,
      // +3.88%, the same dollar-strength move the old DXY shock (103 -> 107)
      // meant, carried over onto USD/CAD's own base (1.36 -> 1.413).
      usdcad: 1.413,
      termsOfTrade: 5,
    },
    path: "linear",
    horizon: 12,
  },

  // ---- Curve ---------------------------------------------------------------
  {
    id: "curve_invert",
    label: "Curve Inversion",
    group: "Curve",
    gist: "Front end held high while the long end prices the slowdown",
    // unemployment: 4.5 added on audit (sub-trend growth — gdpGrowth to
    // 0.6% and ISM Mfg to 46 — left the labour market completely untouched,
    // an Okun's-law gap this preset's own sibling bull_steepen (a milder
    // growth slip, gdpGrowth to 0.4%) does NOT have, since it already bumps
    // unemployment to 5.2. +0.3pp here is the smaller, leading-indicator-
    // scaled move: this preset is an early curve-inversion warning sign,
    // not a realised downturn, so it gets a softer labour readthrough than
    // bull_steepen's larger one, not none at all. cpiHeadline is
    // deliberately left untouched, matching bull_steepen/bear_steepen in
    // the same Curve group — this family is a core-inflation/policy-rate
    // story, not an energy/headline one, and the engine has no commodity-
    // price-to-headline-CPI feedback for a preset to lean on regardless
    // (cpiHeadline is its own free-standing assumption, not derived from
    // WTI/Brent, which are themselves scenario OUTPUTS here, not inputs).
    set: { fedFunds: 5.0, forwardGuidance: 1.25, gdpGrowth: 0.6, pmiMfg: 46, unemployment: 4.5, be10y: 2.1, realRate10y: 1.7, cpiCore: 2.6 },
    path: "linear",
    horizon: 12,
  },
  {
    id: "bull_steepen",
    label: "Bull Steepening",
    group: "Curve",
    gist: "Cuts priced into the front end; long end anchored",
    set: { fedFunds: 2.75, forwardGuidance: -2.0, unemployment: 5.2, gdpGrowth: 0.4, cpiCore: 2.3, realRate10y: 1.3 },
    path: "scurve",
    horizon: 12,
  },
  {
    id: "bear_steepen",
    label: "Bear Steepening",
    group: "Curve",
    gist: "Term premium rebuilds on supply, not on growth",
    // fedFunds removed on audit: it was set to exactly 4.0, fedFunds' own
    // baseline, a no-op left over from an earlier edit (rawMove is 0, so it
    // changed nothing in either the engine's output or VarForm's own
    // "changed" styling — see movedCount in components/VarForm.tsx). The
    // Fed on hold while the long end sells off on supply is still exactly
    // this preset's story; that's already what NOT setting fedFunds means,
    // the same convention every other preset in this library uses.
    set: { deficitGdp: 9.0, debtGdp: 136, qtPace: 100, be10y: 2.85, realRate10y: 2.6, currentAccount: -4.4 },
    path: "linear",
    horizon: 24,
  },
];

export const PRESET_BY_ID: Record<string, Preset> = Object.fromEntries(PRESETS.map((p) => [p.id, p]));

/** A preset applied to a clean baseline. Presets never compose with each other. */
export function presetState(p: Preset): VarState {
  const s = baselineState();
  for (const [k, v] of Object.entries(p.set)) {
    if (VAR_BY_ID[k] && typeof v === "number") s[k] = v;
  }
  return s;
}
