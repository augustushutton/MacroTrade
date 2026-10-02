// The input universe: 42 macro variables in six groups, laid out on the
// Builder page as a fixed 3-column x 2-row grid of group cards (see
// VarForm.tsx — it no longer needs the height-balancing bin-packer that
// used to live there, because the six groups are now close enough in size
// that a plain grid holds its own) — plus four more in a seventh, chart-only
// group ("curve") that VarForm deliberately never renders as a card; see
// that group's own comment below.
//
// Sizes: Monetary 7, Inflation 7, Growth 7, Financial 7, FX 7, Fiscal 7 — an
// even 3x2 grid, 42 variables across six rendered groups (46 counting the
// four curve-only ones). Fiscal briefly ran one row short of the other five
// after FCI Composite and EM Stress Index were removed from the app
// altogether (see that section's note); Education Investment below is what
// now fills the seventh slot, added on its own economic merits (a genuine,
// previously-missing human-capital channel — see its own comment) rather
// than to round out the grid.
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
// 100bp hike and a nickel move in USD/CAD would carry the same coefficient
// weight, which is the single easiest way to build a macro model that is
// confidently wrong. Changing a `norm` rescales every elasticity that touches
// the variable, so it is not a cosmetic knob.
export type VarGroupId = "monetary" | "inflation" | "growth" | "financial" | "fx" | "fiscal" | "curve";

export interface VarGroup {
  id: VarGroupId;
  label: string;
  /** All six default open now that every card is close enough in size that
   *  leaving one collapsed would be the only thing left to break the grid's
   *  alignment. */
  defaultOpen: boolean;
}

// Order here is also GRID order — VarForm renders these six, in this
// sequence, into a fixed 3-column layout, so this array IS the 3x2 map:
// row 1 = Monetary / Inflation / Growth, row 2 = Financial / FX / Fiscal.
export const VAR_GROUPS: VarGroup[] = [
  { id: "monetary", label: "Monetary Policy", defaultOpen: true },
  { id: "inflation", label: "Inflation & Expectations", defaultOpen: true },
  { id: "growth", label: "Growth & Labour", defaultOpen: true },
  { id: "financial", label: "Financial Conditions", defaultOpen: true },
  { id: "fx", label: "FX & External", defaultOpen: true },
  { id: "fiscal", label: "Fiscal & Structural", defaultOpen: true },
  // Not one of VarForm's six group cards — deliberately excluded from the
  // grid it builds (see VarForm's `groups` filter). This group exists so its
  // four members get the SAME generic state/save/reset/audit-trail plumbing
  // as every other variable (baselineState, resetGroup, movedVars, scenario
  // save/load) for free, without that plumbing needing a special case. Their
  // one and only editor is YieldCurveChart on the Builder page.
  { id: "curve", label: "Yield Curve", defaultOpen: true },
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
  // 10y Real Rate moved in from Financial Conditions: the nominal 10y
  // yield is real rate plus breakeven inflation BY CONSTRUCTION (see the
  // THEMES comment further down), so it belongs next to the two breakevens
  // above as the other half of that identity, not filed as a market-pricing
  // variable somewhere else.
  { id: "realRate10y", label: "10y Real Rate", group: "inflation", unit: "%", base: 1.9, min: -2, max: 5, step: 0.05, norm: 0.25, dp: 2 },

  // ---- Growth & labour -----------------------------------------------------
  { id: "gdpGrowth", label: "Real GDP QoQ SAAR", group: "growth", unit: "%", base: 2.0, min: -8, max: 8, step: 0.1, norm: 1.0, dp: 2 },
  { id: "pmiMfg", label: "ISM Manufacturing", group: "growth", unit: "idx", base: 49.5, min: 30, max: 65, step: 0.5, norm: 5, dp: 1 },
  { id: "pmiSvcs", label: "ISM Services", group: "growth", unit: "idx", base: 53.0, min: 30, max: 68, step: 0.5, norm: 5, dp: 1 },
  { id: "unemployment", label: "Unemployment Rate", group: "growth", unit: "%", base: 4.2, min: 2.5, max: 14, step: 0.1, norm: 0.5, dp: 2 },
  { id: "participation", label: "Participation Rate", group: "growth", unit: "%", base: 62.6, min: 58, max: 68, step: 0.1, norm: 0.5, dp: 2 },
  { id: "regionalFed", label: "Regional Fed Composite", group: "growth", unit: "idx", base: 0, min: -40, max: 40, step: 1, norm: 10, dp: 0 },
  // Fwd Earnings Growth moved in from Financial Conditions below: the
  // engine's own THEMES table already files the "earnings" collinearity
  // factor under the same "growth cycle" theme as activity and labour
  // (see THEMES further down), so this is where the model already treats
  // it as belonging, not just a row-count move. Productivity Growth moved
  // OUT to "Fiscal & structural" below — the textbook structural/potential-
  // growth variable (it sets trend GDP, not a quarter's cyclical read),
  // unlike everything else in this section.
  { id: "earningsGrowth", label: "Fwd Earnings Growth", group: "growth", unit: "%", base: 9.0, min: -35, max: 30, step: 0.5, norm: 5, dp: 1 },

  // ---- Financial conditions --------------------------------------------------
  { id: "igSpread", label: "IG Corporate OAS", group: "financial", unit: "bp", base: 95, min: 45, max: 700, step: 5, norm: 25, dp: 0 },
  { id: "hyBBSpread", label: "HY BB OAS", group: "financial", unit: "bp", base: 220, min: 120, max: 900, step: 10, norm: 50, dp: 0 },
  { id: "hyBCCCSpread", label: "HY B/CCC OAS", group: "financial", unit: "bp", base: 520, min: 250, max: 2200, step: 10, norm: 100, dp: 0 },
  { id: "fwdPE", label: "S&P Forward P/E", group: "financial", unit: "x", base: 20.5, min: 8, max: 32, step: 0.1, norm: 1.0, dp: 2 },
  { id: "trailingPE", label: "S&P Trailing P/E", group: "financial", unit: "x", base: 24.0, min: 9, max: 40, step: 0.1, norm: 1.0, dp: 2 },
  { id: "earningsRevisions", label: "Revision Breadth", group: "financial", unit: "net %", base: 0, min: -60, max: 40, step: 1, norm: 5, dp: 0 },
  { id: "vix", label: "VIX", group: "financial", unit: "idx", base: 15, min: 8, max: 80, step: 0.5, norm: 5, dp: 1 },
  // 10y Real Rate moved to "Inflation & expectations" above (the other half
  // of the real-rate-plus-breakeven identity). FCI Composite used to be
  // here too; it has since been removed from the app entirely (see the
  // "Fiscal & structural" section's note).

  // ---- FX & external -------------------------------------------------------
  // USD/CAD now stands in for the old broad dollar index (DXY) as the one
  // latent dollar factor the other six pairs, the dollar-priced commodities,
  // and the unhedged developed/EM equity legs all inherit — see "FX" in
  // lib/elasticities.ts for the full reasoning. Unit changes from "idx" to
  // "px" (and min/max/step/norm/dp are recalibrated to an actual exchange
  // rate's scale, not an index level) because USD/CAD is a quoted price, not
  // a constructed basket score.
  { id: "usdcad", label: "USD/CAD", group: "fx", unit: "px", base: 1.36, min: 0.95, max: 1.65, step: 0.005, norm: 0.05, dp: 3, pinsAsset: "USDCAD" },
  { id: "eurusd", label: "EUR/USD", group: "fx", unit: "px", base: 1.08, min: 0.8, max: 1.45, step: 0.005, norm: 0.05, dp: 3, pinsAsset: "EURUSD" },
  { id: "usdjpy", label: "USD/JPY", group: "fx", unit: "px", base: 150, min: 90, max: 200, step: 1, norm: 10, dp: 1, pinsAsset: "USDJPY" },
  { id: "usdcny", label: "USD/CNY", group: "fx", unit: "px", base: 7.2, min: 6, max: 8.5, step: 0.01, norm: 0.2, dp: 3, pinsAsset: "USDCNY" },
  { id: "gbpusd", label: "GBP/USD", group: "fx", unit: "px", base: 1.27, min: 0.95, max: 1.6, step: 0.005, norm: 0.05, dp: 3, pinsAsset: "GBPUSD" },
  { id: "usdmxn", label: "USD/MXN", group: "fx", unit: "px", base: 18.0, min: 13, max: 30, step: 0.1, norm: 1.0, dp: 2, pinsAsset: "USDMXN" },
  { id: "usdchf", label: "USD/CHF", group: "fx", unit: "px", base: 0.88, min: 0.65, max: 1.15, step: 0.005, norm: 0.05, dp: 3, pinsAsset: "USDCHF" },
  // US Terms of Trade and the Energy Supply Shock moved to "Fiscal &
  // structural" below: neither is a currency quote, and the first reads
  // naturally next to the Current Account line it helps explain. EM Stress
  // Index used to be here too; it has since been removed from the app
  // entirely (see the "Fiscal & structural" section's note).

  // ---- Fiscal & structural -------------------------------------------------
  // Every member here describes the government's balance sheet (deficit,
  // debt), what the country owes the rest of the world (current account,
  // terms of trade), or the economy's supply-side capacity (energy,
  // productivity) — never a cyclical read or a market price. FCI Composite
  // and EM Stress Index, the two broad risk/financing-condition gauges that
  // used to be filed here as a numeric fit rather than a real one, have been
  // removed from the app entirely (Builder, Derivation, P&L, Sensitivity,
  // the elasticity tables, regime triggers, and every preset scenario that
  // set them) rather than kept just to round this group out.
  { id: "deficitGdp", label: "Federal Deficit", group: "fiscal", unit: "% GDP", base: 6.2, min: 0, max: 16, step: 0.1, norm: 1.0, dp: 2 },
  { id: "debtGdp", label: "Federal Debt", group: "fiscal", unit: "% GDP", base: 122, min: 60, max: 200, step: 1, norm: 10, dp: 0 },
  { id: "currentAccount", label: "Current Account", group: "fiscal", unit: "% GDP", base: -3.3, min: -10, max: 4, step: 0.1, norm: 1.0, dp: 2 },
  { id: "termsOfTrade", label: "US Terms of Trade", group: "fiscal", unit: "%", base: 0, min: -20, max: 20, step: 0.5, norm: 5, dp: 1 },
  // Energy is an OUTPUT of this model, so a supply-driven oil spike has no
  // input to enter through — every other route into the barrel here is a demand
  // channel, and a demand shock and a supply shock move equities in opposite
  // directions. This variable is that missing exogenous term. Positive = supply
  // withdrawn.
  { id: "energySupply", label: "Energy Supply Shock", group: "fiscal", unit: "%", base: 0, min: -20, max: 40, step: 1, norm: 5, dp: 0 },
  // The textbook structural/potential-growth variable: it sets trend GDP
  // rather than describing one quarter's cyclical activity, which is what
  // separates it from every variable left in Growth & Labour above.
  { id: "productivity", label: "Productivity Growth", group: "fiscal", unit: "%", base: 1.5, min: -3, max: 6, step: 0.1, norm: 1.0, dp: 2 },
  // Public investment in education (primary through tertiary, all levels of
  // government), % of GDP. Base 5.0 sits near the OECD average of public
  // education spending; the US, most European states and the advanced-Asia
  // economies this model otherwise draws its curve/credit/FX assumptions
  // from all cluster in a 4-7% band, so the range here (2-9) spans a real
  // austerity-to-Nordic-style spectrum without needing an unrealistic
  // extreme to reach either tail.
  //
  // This is deliberately its OWN variable, not a re-styling of Productivity
  // Growth above, because the two describe different things on different
  // clocks. Productivity Growth is a REALISED, already-arrived trend print;
  // this is a POLICY INPUT whose growth payoff is both lagged (human capital
  // accumulates over a school career plus a working-life phase-in — a decade
  // or more, not a quarter) and uncertain (implementation quality, political
  // durability, and crowding-out all vary). Treating a spending commitment as
  // if it were an already-realised productivity print would be the model
  // pricing a promise as a fact.
  //
  // The betas below (lib/elasticities.ts) instead implement a standard
  // augmented-Solow / human-capital growth channel (Mankiw, Romer & Weil
  // 1992; the cross-country skills-to-growth estimates in Hanushek &
  // Woessmann 2008 support a similar order of magnitude): a sustained rise
  // in education investment raises long-run trend productivity, but a
  // forward-looking market only capitalises a FRACTION of that distant,
  // conditional payoff today. Every equity/rates beta this variable carries
  // is calibrated as roughly 25-35% of Productivity Growth's own beta on the
  // same channel — never the same size, and never by copying its
  // coefficients outright — which is what keeps the two variables from
  // double-counting the same structural growth story when a scenario moves
  // both at once (see the FACTORS/THEMES note below on why they are also
  // deliberately left uncorrelated).
  {
    id: "eduInvestment",
    label: "Education Investment",
    group: "fiscal",
    unit: "% GDP",
    base: 5.0,
    min: 2,
    max: 9,
    step: 0.1,
    norm: 1.0,
    dp: 2,
  },

  // ---- Yield curve (chart-only overrides) -----------------------------------
  // Every other variable above drives the Treasury curve indirectly, through
  // RATE_BETAS (lib/elasticities.ts) — set Fed Funds, inflation, growth, and
  // the four tenors below move by whatever that factor model implies. These
  // four are the exception: each PINS one tenor directly to a yield level the
  // user dragged on YieldCurveChart, the same "set directly as an assumption"
  // convention the FX pairs (pinsAsset above) and OAS spreads already use
  // elsewhere, via lib/engine.ts's findPinVar. Dragging a point overrides the
  // factor model for that tenor only — it does not ADD to it — exactly like
  // typing a EUR/USD level overrides its own factor-implied estimate.
  //
  // Base values are a plausible, internally-consistent static curve shape
  // (not a live quote, same disclaimer as every other base in this file): a
  // touch of front-end inversion (2Y above 5Y) easing into a normal upward
  // slope out to 30Y. The 10Y base (4.20%) is deliberately exactly
  // realRate10y.base + be10y.base (1.90 + 2.30) — the same real-rate-plus-
  // breakeven identity the Inflation & Expectations section's own comment
  // documents — so the chart's resting curve agrees with that identity
  // instead of asserting a second, independent number for the same yield.
  //
  // `group: "curve"` keeps these four out of VarForm's six group cards (see
  // VAR_GROUPS above) — their only editor is the chart itself, not a numeric
  // row in a square.
  { id: "ust2yYield", label: "UST 2Y Yield", group: "curve", unit: "%", base: 4.30, min: 0, max: 9, step: 0.01, norm: 0.25, dp: 2, pinsAsset: "UST2Y" },
  { id: "ust5yYield", label: "UST 5Y Yield", group: "curve", unit: "%", base: 4.05, min: 0, max: 9, step: 0.01, norm: 0.25, dp: 2, pinsAsset: "UST5Y" },
  { id: "ust10yYield", label: "UST 10Y Yield", group: "curve", unit: "%", base: 4.20, min: 0, max: 9, step: 0.01, norm: 0.25, dp: 2, pinsAsset: "UST10Y" },
  { id: "ust30yYield", label: "UST 30Y Yield", group: "curve", unit: "%", base: 4.55, min: 0, max: 9, step: 0.01, norm: 0.25, dp: 2, pinsAsset: "UST30Y" },
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
  // The "risk appetite" factor (vix + FCI Composite + EM Stress Index) was
  // removed along with the latter two variables — vix alone isn't a
  // collinearity group, it's just one variable, so there's nothing left
  // here to discount.
  { id: "realRates", label: "Real rates", rho: 0.7, members: ["realRate10y"] },
  { id: "fiscal", label: "Fiscal stance", rho: 0.8, members: ["deficitGdp", "debtGdp"] },
  { id: "usdPairs", label: "Dollar pairs", rho: 0.72, members: ["usdcad", "eurusd", "usdjpy", "gbpusd", "usdcny", "usdmxn", "usdchf"] },
  // Productivity Growth and Education Investment are BOTH left ungrouped
  // here on purpose, even though they tell a related structural-growth
  // story. A collinearity factor discounts variables that are different
  // observations of the SAME already-arrived shock (four inflation prints
  // moving together, say); a realised productivity print and a multi-year
  // spending commitment are not that — one is observed today, the other
  // pays off (if it does) over the next decade, so moving both is two
  // separate assumptions about two different time horizons, not one
  // assumption stated twice. Discounting them against each other would
  // manufacture a correlation this model has no basis for asserting.
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
  // "risk" (vix + FCI Composite + EM Stress Index) was removed along with
  // the latter two variables (see FACTORS above), so this theme is now just
  // credit and valuation.
  { id: "stress", label: "Credit and valuation", rho: 0.45, factors: ["credit", "valuation"] },
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
