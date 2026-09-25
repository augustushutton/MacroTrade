import { VAR_BY_ID, type VarState } from "./vars";

// Reference models: a small set of well-established PUBLISHED macro
// relationships, run as DIAGNOSTIC CROSS-CHECKS against the user's own
// scenario assumptions. They are deliberately NOT wired into runScenario —
// the betas in lib/elasticities.ts are calibrated jointly across this
// model's whole cross-asset universe (see engine.ts's own comments on
// collinearity and cross-tier shrinkage), which is a different exercise from
// a single-equation textbook coefficient estimated on a different sample,
// with different variable definitions, over a different period. Swapping
// one in for the other would not make the pricing more "real" — it would
// make it internally inconsistent.
//
// What this module gives instead: "does the scenario's OWN inflation/growth/
// unemployment story imply a policy rate (or inflation path) consistent with
// itself?" using named, cited, published estimates — not values fit to data
// in this app, since this sandbox has no live macro-data access (see the
// repository notes on FRED being network-policy-blocked here). Every
// coefficient below is presented as ONE point estimate from a literature
// that disagrees about the exact number, not as ground truth; the `citation`
// and `note` fields exist so a reader can look the number up and disagree
// with it rather than take it on faith.

export interface ReferenceModel {
  id: string;
  label: string;
  citation: string;
  formula: string;
  /** What the published relationship implies, given the scenario's own inputs. */
  impliedLabel: string;
  implied: number;
  /** What the user actually set for the same quantity. */
  actualLabel: string;
  actual: number;
  unit: string;
  note: string;
}

function get(state: VarState, id: string): number {
  return state[id] ?? VAR_BY_ID[id]?.base ?? 0;
}

/**
 * Taylor (1993) rule: i* = r* + π + 0.5(π − π*) + 0.5(output gap).
 *
 * Taylor, John B. (1993), "Discretionary versus Policy Rules in Practice,"
 * Carnegie-Rochester Conference Series on Public Policy 39: 195–214. The
 * original coefficients (0.5 on both the inflation gap and the output gap,
 * π* = 2%, r* = 2%) are used essentially unchanged in most textbook
 * treatments; r* here is lowered to 0.5%, in line with more recent
 * neutral-real-rate estimates (e.g. the Laubach–Williams framework, Laubach,
 * Thomas and John C. Williams (2003), "Measuring the Natural Rate of
 * Interest," Review of Economics and Statistics 85(4)) — r* is itself a
 * genuinely time-varying, disputed estimate, not a constant, so this is a
 * representative recent value rather than a precise one.
 *
 * This model has no direct output-gap series, so real GDP growth relative to
 * potential growth (~1.8%, roughly the CBO's recent longer-run estimate) is
 * used as the output-gap term — a standard practical substitution, but a
 * substitution, which is why it is spelled out here rather than left silent.
 */
export function taylorRule(state: VarState): ReferenceModel {
  const RSTAR = 0.5; // recent neutral real rate estimates, ~0%–1%
  const PI_STAR = 2.0; // Fed's stated inflation target
  const POTENTIAL_GROWTH = 1.8; // CBO long-run potential real GDP growth, approx.
  const pi = get(state, "cpiCore");
  const g = get(state, "gdpGrowth");
  const implied = RSTAR + pi + 0.5 * (pi - PI_STAR) + 0.5 * (g - POTENTIAL_GROWTH);
  return {
    id: "taylor",
    label: "Taylor Rule",
    citation: "Taylor (1993), Carnegie-Rochester Conf. Series on Public Policy 39",
    formula: "i* = r* + π + 0.5(π − π*) + 0.5(g − g_potential), r*=0.5%, π*=2.0%, g_potential=1.8%",
    impliedLabel: "Rule-implied Fed Funds",
    implied,
    actualLabel: "Scenario Fed Funds",
    actual: get(state, "fedFunds"),
    unit: "%",
    note: "Real GDP growth stands in for the output gap this model does not carry as its own series.",
  };
}

/**
 * Okun's Law (difference version): Δu ≈ −β(g − g_potential).
 *
 * Okun, Arthur M. (1962), "Potential GNP: Its Measurement and Significance,"
 * Cowles Foundation Paper 190. Okun's original "gap" coefficient was near
 * 3:1 (three points of output per one point of unemployment); the
 * difference-rule coefficient commonly cited in textbooks (e.g. Mankiw,
 * Macroeconomics) is closer to 0.5, reflecting a roughly 2:1 relationship
 * between growth above potential and the resulting fall in unemployment.
 * Estimates of this coefficient move with the sample period and have been
 * both above and below 0.5 across different decades of US data.
 */
export function okunsLaw(state: VarState): ReferenceModel {
  const BETA = 0.5;
  const POTENTIAL_GROWTH = 1.8;
  const UNEMPLOYMENT_BASE = VAR_BY_ID.unemployment.base;
  const g = get(state, "gdpGrowth");
  const impliedChange = -BETA * (g - POTENTIAL_GROWTH);
  const actualChange = get(state, "unemployment") - UNEMPLOYMENT_BASE;
  return {
    id: "okun",
    label: "Okun's Law",
    citation: "Okun (1962), Cowles Foundation Paper 190",
    formula: "Δu ≈ −0.5 × (g − g_potential), g_potential=1.8%",
    impliedLabel: "Implied change in unemployment",
    implied: impliedChange,
    actualLabel: "Scenario change in unemployment",
    actual: actualChange,
    unit: "pp",
    note: "Checks whether the scenario's own GDP growth and unemployment assumptions are mutually consistent, not whether either is correct.",
  };
}

/**
 * Reduced-form Phillips curve: π ≈ π_trend + κ(u* − u).
 *
 * The slope κ is the single most contested parameter in this list. Post-
 * 1990s estimates in the literature are commonly described as much flatter
 * than the 1960s–70s curve; see Hooper, Peter, Frederic S. Mishkin, and
 * Amir Sufi (2020), "Prospects for Inflation in a High Pressure Economy: Is
 * the Phillips Curve Dead or is It Just Hibernating?," NBER Working Paper
 * 27439, which surveys modern slope estimates broadly in the 0.02–0.3 range
 * depending on specification. κ=0.08 here is a representative mid-range
 * value, not a consensus figure — reasonable economists estimate this
 * number very differently. u* (NAIRU) uses the CBO's recent natural-rate
 * range (~4.0%–4.5%); 4.2% matches this model's own unemployment baseline
 * (see lib/vars.ts), so this reference model reads as "flat" at baseline by
 * construction.
 */
export function phillipsCurve(state: VarState): ReferenceModel {
  const KAPPA = 0.08;
  const PI_TREND = 2.0;
  const U_STAR = 4.2; // CBO-range NAIRU estimate, matched to this model's own baseline
  const u = get(state, "unemployment");
  const implied = PI_TREND + KAPPA * (U_STAR - u);
  return {
    id: "phillips",
    label: "Phillips Curve",
    citation: "Hooper, Mishkin & Sufi (2020), NBER Working Paper 27439",
    formula: "π ≈ π_trend + κ(u* − u), π_trend=2.0%, κ=0.08, u*=4.2%",
    impliedLabel: "Curve-implied core inflation",
    implied,
    actualLabel: "Scenario core CPI",
    actual: get(state, "cpiCore"),
    unit: "%",
    note: "The slope κ is genuinely disputed in the literature (commonly cited range ≈0.02–0.3); this is a representative mid-range value, not a fitted one.",
  };
}

export function referenceModels(state: VarState): ReferenceModel[] {
  return [taylorRule(state), okunsLaw(state), phillipsCurve(state)];
}
