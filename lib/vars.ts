// The input universe: 42 macro variables in six groups.
//
// Two fields here do the heavy lifting and are worth reading before the list.
//
// `base` is the state the engine treats as "no shock". Every impact in the app
// is computed off the DIFFERENCE between a variable's set value and its base,
// never off the level, so the baseline is a real modelling input rather than a
// default for the slider to sit at. It is a plausible late-cycle starting point,
// not a live quote — nothing in this app touches a network.
//
// `norm` is the size of one standard shock in the variable's own units. Every
// elasticity in lib/elasticities.ts is expressed per ONE normalised unit, which
// is what makes a table of betas comparable across variables measured in
// percentage points, basis points, index points and multiples. Without it a
// 100bp hike and a 100-point DXY move would carry the same coefficient weight,
// which is the single easiest way to build a macro model that is confidently
// wrong. Changing a `norm` rescales every elasticity that touches the variable,
// so it is not a cosmetic knob.
export type VarGroupId = "monetary" | "inflation" | "growth" | "financial" | "fx" | "fiscal";

export interface VarGroup {
  id: VarGroupId;
  label: string;
  /** Groups the reader is most likely to touch open on load; the rest collapse. */
  defaultOpen: boolean;
}

export const VAR_GROUPS: VarGroup[] = [
  { id: "monetary", label: "Monetary Policy", defaultOpen: true },
  { id: "inflation", label: "Inflation & Expectations", defaultOpen: true },
  { id: "growth", label: "Growth & Labour", defaultOpen: false },
  { id: "financial", label: "Financial Conditions", defaultOpen: false },
  { id: "fx", label: "FX & External", defaultOpen: false },
  { id: "fiscal", label: "Fiscal & Structural", defaultOpen: false },
];

export interface Variable {
  id: string;
  label: string;
  group: VarGroupId;
  /** Rendered verbatim in the value column. Kept to a token, not a sentence. */
  unit: string;
  base: number;
  min: number;
  max: number;
  step: number;
  /** One normalised shock unit, in this variable's own units. See header. */
  norm: number;
  /** Decimal places for display. */
  dp: number;
  /**
   * The FX pairs are inputs AND outputs. When a pair is shocked here the engine
   * PINS the output leg to the assumption instead of computing it, because a
   * model that quietly disagrees with an assumption the user typed is a model
   * nobody can audit. Marked in the output table so the distinction is visible.
   */
  pinsAsset?: string;
}

export const VARIABLES: Variable[] = [
  // ---- Monetary policy -----------------------------------------------------
  { id: "fedFunds", label: "Fed Funds Target", group: "monetary", unit: "%", base: 4.0, min: 0, max: 10, step: 0.25, norm: 1.0, dp: 2 },
  { id: "ecbDepo", label: "ECB Deposit Rate", group: "monetary", unit: "%", base: 2.25, min: -1, max: 7, step: 0.25, norm: 1.0, dp: 2 },
  { id: "bojPolicy", label: "BoJ Policy Rate", group: "monetary", unit: "%", base: 0.75, min: -0.5, max: 4, step: 0.1, norm: 0.5, dp: 2 },
  { id: "boeBank", label: "BoE Bank Rate", group: "monetary", unit: "%", base: 3.75, min: 0, max: 9, step: 0.25, norm: 1.0, dp: 2 },
  { id: "fedBalanceSheet", label: "Fed Balance Sheet", group: "monetary", unit: "% GDP", base: 22, min: 10, max: 40, step: 0.5, norm: 5, dp: 1 },
  { id: "forwardGuidance", label: "Forward Guidance", group: "monetary", unit: "idx", base: 0, min: -3, max: 3, step: 0.25, norm: 1.0, dp: 2 },
  { id: "qtPace", label: "QT Pace", group: "monetary", unit: "$bn/mo", base: 40, min: -120, max: 150, step: 5, norm: 25, dp: 0 },

  // ---- Inflation & expectations -------------------------------------------
  { id: "cpiHeadline", label: "Headline CPI YoY", group: "inflation", unit: "%", base: 2.8, min: -2, max: 15, step: 0.1, norm: 1.0, dp: 2 },
  { id: "cpiCore", label: "Core CPI YoY", group: "inflation", unit: "%", base: 3.0, min: 0, max: 12, step: 0.1, norm: 1.0, dp: 2 },
  { id: "pceCore", label: "Core PCE YoY", group: "inflation", unit: "%", base: 2.7, min: 0, max: 10, step: 0.1, norm: 1.0, dp: 2 },
  { id: "be5y", label: "5y Breakeven", group: "inflation", unit: "%", base: 2.35, min: 0, max: 6, step: 0.05, norm: 0.25, dp: 2 },
  { id: "be10y", label: "10y Breakeven", group: "inflation", unit: "%", base: 2.3, min: 0, max: 6, step: 0.05, norm: 0.25, dp: 2 },
  { id: "wageGrowth", label: "Wage Growth YoY", group: "inflation", unit: "%", base: 4.0, min: 0, max: 12, step: 0.1, norm: 1.0, dp: 2 },

  // ---- Growth & labour -----------------------------------------------------
  { id: "gdpGrowth", label: "Real GDP QoQ SAAR", group: "growth", unit: "%", base: 2.0, min: -8, max: 8, step: 0.1, norm: 1.0, dp: 2 },
  { id: "pmiMfg", label: "ISM Manufacturing", group: "growth", unit: "idx", base: 49.5, min: 30, max: 65, step: 0.5, norm: 5, dp: 1 },
  { id: "pmiSvcs", label: "ISM Services", group: "growth", unit: "idx", base: 53.0, min: 30, max: 68, step: 0.5, norm: 5, dp: 1 },
  { id: "unemployment", label: "Unemployment Rate", group: "growth", unit: "%", base: 4.2, min: 2.5, max: 14, step: 0.1, norm: 0.5, dp: 2 },
  { id: "participation", label: "Participation Rate", group: "growth", unit: "%", base: 62.6, min: 58, max: 68, step: 0.1, norm: 0.5, dp: 2 },
  { id: "productivity", label: "Productivity Growth", group: "growth", unit: "%", base: 1.5, min: -3, max: 6, step: 0.1, norm: 1.0, dp: 2 },
  { id: "regionalFed", label: "Regional Fed Composite", group: "growth", unit: "idx", base: 0, min: -40, max: 40, step: 1, norm: 10, dp: 0 },

  // ---- Financial conditions ------------------------------------------------
  { id: "igSpread", label: "IG Corporate OAS", group: "financial", unit: "bp", base: 95, min: 45, max: 700, step: 5, norm: 25, dp: 0 },
  { id: "hyBBSpread", label: "HY BB OAS", group: "financial", unit: "bp", base: 220, min: 120, max: 900, step: 10, norm: 50, dp: 0 },
  { id: "hyBCCCSpread", label: "HY B/CCC OAS", group: "financial", unit: "bp", base: 520, min: 250, max: 2200, step: 10, norm: 100, dp: 0 },
  { id: "fwdPE", label: "S&P Forward P/E", group: "financial", unit: "x", base: 20.5, min: 8, max: 32, step: 0.1, norm: 1.0, dp: 2 },
  { id: "trailingPE", label: "S&P Trailing P/E", group: "financial", unit: "x", base: 24.0, min: 9, max: 40, step: 0.1, norm: 1.0, dp: 2 },
  { id: "earningsGrowth", label: "Fwd Earnings Growth", group: "financial", unit: "%", base: 9.0, min: -35, max: 30, step: 0.5, norm: 5, dp: 1 },
  { id: "earningsRevisions", label: "Revision Breadth", group: "financial", unit: "net %", base: 0, min: -60, max: 40, step: 1, norm: 5, dp: 0 },
  { id: "vix", label: "VIX", group: "financial", unit: "idx", base: 15, min: 8, max: 80, step: 0.5, norm: 5, dp: 1 },
  { id: "realRate10y", label: "10y Real Rate", group: "financial", unit: "%", base: 1.9, min: -2, max: 5, step: 0.05, norm: 0.25, dp: 2 },
  { id: "fciComposite", label: "FCI Composite", group: "financial", unit: "sd", base: 0, min: -3, max: 5, step: 0.1, norm: 0.5, dp: 2 },

  // ---- FX & external -------------------------------------------------------
  { id: "dxy", label: "DXY", group: "fx", unit: "idx", base: 103, min: 80, max: 130, step: 0.5, norm: 5, dp: 1, pinsAsset: "DXY" },
  { id: "eurusd", label: "EUR/USD", group: "fx", unit: "px", base: 1.08, min: 0.8, max: 1.45, step: 0.005, norm: 0.05, dp: 3, pinsAsset: "EURUSD" },
  { id: "usdjpy", label: "USD/JPY", group: "fx", unit: "px", base: 150, min: 90, max: 200, step: 1, norm: 10, dp: 1, pinsAsset: "USDJPY" },
  { id: "usdcny", label: "USD/CNY", group: "fx", unit: "px", base: 7.2, min: 6, max: 8.5, step: 0.01, norm: 0.2, dp: 3, pinsAsset: "USDCNY" },
  { id: "gbpusd", label: "GBP/USD", group: "fx", unit: "px", base: 1.27, min: 0.95, max: 1.6, step: 0.005, norm: 0.05, dp: 3, pinsAsset: "GBPUSD" },
  { id: "usdmxn", label: "USD/MXN", group: "fx", unit: "px", base: 18.0, min: 13, max: 30, step: 0.1, norm: 1.0, dp: 2, pinsAsset: "USDMXN" },
  { id: "usdbrl", label: "USD/BRL", group: "fx", unit: "px", base: 5.4, min: 3.5, max: 9, step: 0.05, norm: 0.5, dp: 2, pinsAsset: "USDBRL" },
  { id: "emStress", label: "EM Stress Index", group: "fx", unit: "idx", base: 3, min: 0, max: 10, step: 0.25, norm: 2, dp: 2 },
  { id: "termsOfTrade", label: "US Terms of Trade", group: "fx", unit: "%", base: 0, min: -20, max: 20, step: 0.5, norm: 5, dp: 1 },
  // Energy is an OUTPUT of this model, so a supply-driven oil spike has no
  // input to enter through — every other route into the barrel here is a demand
  // channel, and a demand shock and a supply shock move equities in opposite
  // directions. This variable is that missing exogenous term. Positive = supply
  // withdrawn.
  { id: "energySupply", label: "Energy Supply Shock", group: "fx", unit: "%", base: 0, min: -20, max: 40, step: 1, norm: 5, dp: 0 },

  // ---- Fiscal & structural -------------------------------------------------
  { id: "deficitGdp", label: "Federal Deficit", group: "fiscal", unit: "% GDP", base: 6.2, min: 0, max: 16, step: 0.1, norm: 1.0, dp: 2 },
  { id: "debtGdp", label: "Federal Debt", group: "fiscal", unit: "% GDP", base: 122, min: 60, max: 200, step: 1, norm: 10, dp: 0 },
  { id: "currentAccount", label: "Current Account", group: "fiscal", unit: "% GDP", base: -3.3, min: -10, max: 4, step: 0.1, norm: 1.0, dp: 2 },
];

export const VAR_BY_ID: Record<string, Variable> = Object.fromEntries(
  VARIABLES.map((v) => [v.id, v]),
);

// ---------------------------------------------------------------------------
// Collinearity groups.
//
// The variable list is deliberately redundant: headline CPI, core CPI, core PCE
// and wage growth are four ways of observing one inflation impulse, and a
// scenario that raises all four is making ONE assumption, not four. Summing four
// elasticities against it counts the same shock four times, and because every
// realistic scenario moves whole blocks of correlated variables at once, that
// error compounds until a bad-but-survivable world prints a 90% drawdown.
//
// Each group carries an assumed average pairwise correlation. The sum of the
// group's contributions is scaled by 1 / (1 + rho(n-1)), the standard effective-
// sample-size adjustment for n exchangeable series: one moved variable is
// untouched, and each additional correlated one adds real but sharply
// diminishing information. Groups are per-channel, so a driver that only appears
// in one leg is not discounted by company it does not keep there.
//
// Anything not listed is its own group and is never discounted.
// ---------------------------------------------------------------------------
export interface VarFactor {
  id: string;
  label: string;
  /** Assumed average pairwise correlation of the members. */
  rho: number;
  members: string[];
}

export const FACTORS: VarFactor[] = [
  { id: "inflLevel", label: "Realised inflation", rho: 0.88, members: ["cpiHeadline", "cpiCore", "pceCore", "wageGrowth"] },
  { id: "inflExp", label: "Inflation expectations", rho: 0.9, members: ["be5y", "be10y"] },
  { id: "policyUS", label: "US policy stance", rho: 0.75, members: ["fedFunds", "forwardGuidance"] },
  { id: "policyFgn", label: "Foreign policy stance", rho: 0.6, members: ["ecbDepo", "bojPolicy", "boeBank"] },
  { id: "balance", label: "Balance sheet", rho: 0.85, members: ["fedBalanceSheet", "qtPace"] },
  { id: "activity", label: "Activity surveys", rho: 0.82, members: ["gdpGrowth", "pmiMfg", "pmiSvcs", "regionalFed"] },
  { id: "labour", label: "Labour market", rho: 0.55, members: ["unemployment", "participation"] },
  { id: "credit", label: "Credit spreads", rho: 0.9, members: ["igSpread", "hyBBSpread", "hyBCCCSpread"] },
  { id: "valuation", label: "Equity valuation", rho: 0.9, members: ["fwdPE", "trailingPE"] },
  { id: "earnings", label: "Earnings", rho: 0.78, members: ["earningsGrowth", "earningsRevisions"] },
  { id: "risk", label: "Risk appetite", rho: 0.8, members: ["vix", "fciComposite", "emStress"] },
  { id: "realRates", label: "Real rates", rho: 0.7, members: ["realRate10y"] },
  { id: "fiscal", label: "Fiscal stance", rho: 0.8, members: ["deficitGdp", "debtGdp"] },
  { id: "usdPairs", label: "Dollar pairs", rho: 0.72, members: ["dxy", "eurusd", "usdjpy", "gbpusd", "usdcny", "usdmxn", "usdbrl"] },
];

export const FACTOR_BY_ID: Record<string, VarFactor> = Object.fromEntries(FACTORS.map((f) => [f.id, f]));

export const FACTOR_OF: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  for (const f of FACTORS) for (const v of f.members) m[v] = f.id;
  return m;
})();

/** 1 / (1 + rho(n-1)). Returns 1 for an ungrouped variable or a lone mover. */
export function collinearityShrink(varId: string, movedInFactor: number): number {
  const fid = FACTOR_OF[varId];
  if (!fid || movedInFactor <= 1) return 1;
  const rho = FACTOR_BY_ID[fid].rho;
  return 1 / (1 + rho * (movedInFactor - 1));
}

// A second tier, because the factors themselves are not independent either. The
// 10y nominal yield is real rate plus breakeven by construction, and a scenario
// that raises realised inflation, breakevens, the real rate AND the funds rate
// has moved four factors but told one story. The identity is the clearest case:
// setting the real rate and the breakeven already determines the nominal yield,
// so the CPI series behind them must not be allowed to price it a third time.
//
// Correlation ACROSS factors is far weaker than within one, so the theme rho is
// small. It is not zero, and at five moving factors the difference between rho 0
// and rho 0.42 is the difference between a 10y that prints +200bp on a
// stagflation and one that prints +130bp.
export interface VarTheme {
  id: string;
  label: string;
  rho: number;
  factors: string[];
}

export const THEMES: VarTheme[] = [
  { id: "nominal", label: "Rates and inflation", rho: 0.42, factors: ["inflLevel", "inflExp", "realRates", "policyUS", "balance"] },
  { id: "cycle", label: "Growth cycle", rho: 0.42, factors: ["activity", "labour", "earnings"] },
  { id: "stress", label: "Risk and credit", rho: 0.45, factors: ["credit", "risk", "valuation"] },
];

export const THEME_BY_ID: Record<string, VarTheme> = Object.fromEntries(THEMES.map((t) => [t.id, t]));

export const THEME_OF: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  for (const t of THEMES) for (const f of t.factors) m[f] = t.id;
  return m;
})();

/** Same form as collinearityShrink, one level up: n is the count of DISTINCT
 *  factors from the theme that moved in this sum. */
export function themeShrink(varId: string, movedFactorsInTheme: number): number {
  const fid = FACTOR_OF[varId];
  const tid = fid ? THEME_OF[fid] : undefined;
  if (!tid || movedFactorsInTheme <= 1) return 1;
  const rho = THEME_BY_ID[tid].rho;
  return 1 / (1 + rho * (movedFactorsInTheme - 1));
}

// The third and last tier, and the one that matters most in a tail scenario.
//
// A channel is fed from two directions: variables the user set, and other
// assets the engine has already priced. Those two legs are not independent
// observations. The VIX rising and the S&P falling are one event seen twice, so
// a credit spread that takes a widening from `vix` AND a widening from the
// modelled equity drawdown has priced the same risk-off impulse twice. Left
// uncorrected this is where the largest overshoot in the whole model lived: at
// an S&P of -58% the equity->CCC link alone printed +580bp on top of a direct
// leg that had already widened the tier on the same information.
//
// The correction is the rule used at the two tiers above. The larger leg leads
// at full weight; the smaller corroborates and is discounted. Legs that
// DISAGREE are left alone, because opposing evidence is real information and
// shrinking it would quietly manufacture confidence the inputs do not support.
export const CROSS_TIER_RHO = 0.7;

/** Weight for the smaller of two same-signed legs feeding one channel. */
export const crossTierShrink = 1 / (1 + CROSS_TIER_RHO);

export type VarState = Record<string, number>;

export function baselineState(): VarState {
  const s: VarState = {};
  for (const v of VARIABLES) s[v.id] = v.base;
  return s;
}

/** Shock in NORMALISED units: (value - base) / norm. Zero when untouched. */
export function shock(state: VarState, id: string): number {
  const v = VAR_BY_ID[id];
  if (!v) return 0;
  const raw = state[id];
  if (raw === undefined || !Number.isFinite(raw)) return 0;
  return (raw - v.base) / v.norm;
}

/** Raw move in the variable's own units, for display in the audit trail. */
export function rawMove(state: VarState, id: string): number {
  const v = VAR_BY_ID[id];
  if (!v) return 0;
  const raw = state[id];
  if (raw === undefined || !Number.isFinite(raw)) return 0;
  return raw - v.base;
}

export function movedVars(state: VarState): Variable[] {
  return VARIABLES.filter((v) => Math.abs(rawMove(state, v.id)) > 1e-9);
}
