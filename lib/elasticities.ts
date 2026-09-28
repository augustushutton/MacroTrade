// Every coefficient in this file is hardcoded, deliberate, and inspectable in
// the app. Nothing here is fitted at runtime and nothing is user-editable —
// the reader's job is to audit the assumptions, not to tune them until the
// output agrees with them.
//
// UNITS, which are the thing to get right before reading a single number:
//   RATE_BETAS, SPREAD_BETAS      basis points of yield/spread per 1 normalised shock
//   EQUITY_CHANNELS, COMMODITY,
//   FX_BETAS, sector `own`        percent price change per 1 normalised shock
//   SECOND_ROUND                  target units per 1 unit of the source asset's move
//
// "1 normalised shock" is defined by `norm` in lib/vars.ts: 100bp on Fed Funds,
// 1pp on core CPI, 25bp on a breakeven, 5 points on the VIX, and so on. That is
// what makes these betas comparable to each other.
//
// The sign convention is worth stating once: for rates and spreads a POSITIVE
// beta means the yield or spread RISES, which is a price LOSS. The engine
// applies -duration to convert, so the loss shows up correctly downstream and
// no coefficient here needs a defensive minus sign.

export interface Beta {
  /** Variable id from lib/vars.ts */
  v: string;
  b: number;
}

// ---------------------------------------------------------------------------
// Treasury curve. Policy pass-through decays along the curve while term-premium
// drivers (deficit, debt, balance sheet) do the opposite, which is what makes
// the 2s30s response to a hike differ in SIGN from the 2y response and is the
// whole reason the four tenors are modelled separately rather than as one
// "duration" line with a multiplier.
// ---------------------------------------------------------------------------
export const RATE_BETAS: Record<string, Beta[]> = {
  UST2Y: [
    { v: "energySupply", b: 4 },
    { v: "fedFunds", b: 85 },
    { v: "forwardGuidance", b: 32 },
    { v: "qtPace", b: 3 },
    { v: "fedBalanceSheet", b: -8 },
    { v: "cpiCore", b: 26 },
    { v: "cpiHeadline", b: 8 },
    { v: "pceCore", b: 16 },
    { v: "be5y", b: 9 },
    { v: "wageGrowth", b: 12 },
    { v: "gdpGrowth", b: 18 },
    { v: "pmiMfg", b: 8 },
    { v: "pmiSvcs", b: 11 },
    { v: "unemployment", b: -30 },
    { v: "productivity", b: -4 },
    { v: "regionalFed", b: 5 },
    { v: "vix", b: -10 },
    { v: "realRate10y", b: 14 },
    { v: "emStress", b: -6 },
  ],
  UST5Y: [
    { v: "energySupply", b: 5 },
    { v: "fedFunds", b: 62 },
    { v: "forwardGuidance", b: 26 },
    { v: "qtPace", b: 5 },
    { v: "fedBalanceSheet", b: -15 },
    { v: "cpiCore", b: 30 },
    { v: "cpiHeadline", b: 10 },
    { v: "pceCore", b: 18 },
    { v: "be5y", b: 18 },
    { v: "be10y", b: 6 },
    { v: "wageGrowth", b: 14 },
    { v: "gdpGrowth", b: 19 },
    { v: "pmiMfg", b: 10 },
    { v: "pmiSvcs", b: 12 },
    { v: "unemployment", b: -28 },
    { v: "productivity", b: -6 },
    { v: "regionalFed", b: 5 },
    { v: "vix", b: -12 },
    { v: "realRate10y", b: 20 },
    { v: "emStress", b: -7 },
    { v: "deficitGdp", b: 5 },
    { v: "debtGdp", b: 3 },
  ],
  UST10Y: [
    { v: "energySupply", b: 5 },
    { v: "fedFunds", b: 45 },
    { v: "forwardGuidance", b: 18 },
    { v: "qtPace", b: 6 },
    { v: "fedBalanceSheet", b: -22 },
    { v: "cpiCore", b: 30 },
    { v: "cpiHeadline", b: 12 },
    { v: "pceCore", b: 18 },
    { v: "be5y", b: 8 },
    { v: "be10y", b: 22 },
    { v: "wageGrowth", b: 14 },
    { v: "gdpGrowth", b: 16 },
    { v: "pmiMfg", b: 10 },
    { v: "pmiSvcs", b: 12 },
    { v: "unemployment", b: -22 },
    { v: "productivity", b: -6 },
    { v: "regionalFed", b: 5 },
    { v: "vix", b: -12 },
    { v: "realRate10y", b: 25 },
    { v: "emStress", b: -8 },
    { v: "igSpread", b: -5 },
    { v: "deficitGdp", b: 9 },
    { v: "debtGdp", b: 6 },
    { v: "fciComposite", b: 3 },
  ],
  UST30Y: [
    { v: "energySupply", b: 6 },
    { v: "fedFunds", b: 25 },
    { v: "forwardGuidance", b: 10 },
    { v: "qtPace", b: 8 },
    { v: "fedBalanceSheet", b: -26 },
    { v: "cpiCore", b: 26 },
    { v: "cpiHeadline", b: 14 },
    { v: "pceCore", b: 15 },
    { v: "be10y", b: 24 },
    { v: "wageGrowth", b: 12 },
    { v: "gdpGrowth", b: 12 },
    { v: "pmiMfg", b: 7 },
    { v: "pmiSvcs", b: 8 },
    { v: "unemployment", b: -16 },
    { v: "productivity", b: -8 },
    { v: "vix", b: -12 },
    { v: "realRate10y", b: 26 },
    { v: "emStress", b: -9 },
    { v: "deficitGdp", b: 14 },
    { v: "debtGdp", b: 9 },
    { v: "currentAccount", b: -5 },
  ],
};

// ---------------------------------------------------------------------------
// Credit spreads. Quality tiers are not one curve scaled — B/CCC carries roughly
// 2.3x BB's beta and roughly 6x IG's beta to the same growth shock because it is
// pricing default probability rather than duration, and that escalation across
// tiers is the point of splitting them. Spread inputs are excluded here on purpose: when the reader sets an OAS
// directly, the engine PINS the leg (see lib/engine.ts) rather than adding the
// assumption to a modelled move and double-counting it.
// ---------------------------------------------------------------------------
export const SPREAD_BETAS: Record<string, Beta[]> = {
  MBS: [
    { v: "vix", b: 6 },
    { v: "fciComposite", b: 5 },
    { v: "qtPace", b: 4 },
    { v: "fedBalanceSheet", b: -6 },
    { v: "unemployment", b: 2 },
  ],
  IG: [
    { v: "vix", b: 9 },
    { v: "fciComposite", b: 7 },
    { v: "gdpGrowth", b: -5 },
    { v: "unemployment", b: 6 },
    { v: "earningsGrowth", b: -3 },
    { v: "earningsRevisions", b: -2 },
    { v: "emStress", b: 4 },
    { v: "fedBalanceSheet", b: -4 },
    { v: "pmiMfg", b: -2 },
  ],
  HY_BB: [
    { v: "vix", b: 22 },
    { v: "fciComposite", b: 16 },
    { v: "gdpGrowth", b: -13 },
    { v: "unemployment", b: 16 },
    { v: "earningsGrowth", b: -9 },
    { v: "earningsRevisions", b: -5 },
    { v: "emStress", b: 9 },
    { v: "pmiMfg", b: -6 },
    { v: "fedBalanceSheet", b: -8 },
  ],
  HY_BCCC: [
    { v: "vix", b: 52 },
    { v: "fciComposite", b: 38 },
    { v: "gdpGrowth", b: -32 },
    { v: "unemployment", b: 40 },
    { v: "earningsGrowth", b: -24 },
    { v: "earningsRevisions", b: -12 },
    { v: "emStress", b: 18 },
    { v: "pmiMfg", b: -14 },
    { v: "fedBalanceSheet", b: -14 },
  ],
};

/** Which input pins which spread leg when the reader moves it directly. */
export const SPREAD_PINS: Record<string, string> = {
  igSpread: "IG",
  hyBBSpread: "HY_BB",
  hyBCCCSpread: "HY_BCCC",
};

// ---------------------------------------------------------------------------
// Equity, decomposed into the three things that actually move an index. Keeping
// them separate is what lets the narrative say WHY a drawdown happened: a
// recession and a rate shock can produce the same headline number with opposite
// compositions, and the portfolio implications are not the same.
//
//   multiple     re-rating of the discount rate and policy backdrop
//   earnings     the expected cash flows themselves
//   riskPremium  what the market charges to hold the risk
//
// The rate-to-multiple channel is NOT listed here. It arrives through
// SECOND_ROUND off the computed 10y, so the curve model is the single path from
// policy to equity valuation and a hike cannot be counted twice.
// ---------------------------------------------------------------------------
export interface EquityChannels {
  multiple: Beta[];
  earnings: Beta[];
  riskPremium: Beta[];
}

export const EQUITY_CHANNELS: Record<string, EquityChannels> = {
  SPX: {
    multiple: [
      { v: "be10y", b: -1.1 },
      { v: "vix", b: -2.6 },
      { v: "fciComposite", b: -2.2 },
      { v: "forwardGuidance", b: -1.4 },
      { v: "fedBalanceSheet", b: 2.0 },
      { v: "qtPace", b: -0.8 },
      { v: "productivity", b: 1.6 },
    ],
    earnings: [
      { v: "earningsGrowth", b: 3.6 },
      { v: "earningsRevisions", b: 2.2 },
      { v: "gdpGrowth", b: 2.4 },
      { v: "pmiMfg", b: 1.5 },
      { v: "pmiSvcs", b: 2.0 },
      { v: "unemployment", b: -1.9 },
      { v: "wageGrowth", b: -1.5 },
      { v: "cpiCore", b: -0.5 },
      { v: "cpiHeadline", b: -0.35 },
      { v: "productivity", b: 1.2 },
      { v: "regionalFed", b: 0.7 },
      { v: "termsOfTrade", b: 0.4 },
      { v: "energySupply", b: -0.7 },
    ],
    riskPremium: [
      { v: "vix", b: -3.2 },
      { v: "igSpread", b: -1.5 },
      { v: "hyBBSpread", b: -1.4 },
      { v: "hyBCCCSpread", b: -1.6 },
      { v: "emStress", b: -1.1 },
      { v: "fciComposite", b: -1.3 },
      { v: "debtGdp", b: -0.4 },
      { v: "deficitGdp", b: -0.25 },
    ],
  },
};

/** The reader's forward P/E assumption pins the multiple channel outright. */
export const MULTIPLE_PIN_VAR = "fwdPE";

// ---------------------------------------------------------------------------
// Everything else that trades off the index — the other three sleeves and the
// seven sectors — is modelled as a beta to US Large Cap plus its OWN drivers.
// This is deliberate: writing a full independent channel set for eleven more
// instruments would multiply the number of coefficients to audit by four
// without adding a single relationship that is not already captured by "moves
// with the market, plus these specific things".
// ---------------------------------------------------------------------------
export interface DerivedEquity {
  /** Beta to the SPX total move. */
  beta: number;
  own: Beta[];
}

export const DERIVED_EQUITY: Record<string, DerivedEquity> = {
  RTY: {
    beta: 1.18,
    own: [
      { v: "hyBBSpread", b: -2.2 },
      { v: "gdpGrowth", b: 1.2 },
      { v: "unemployment", b: -0.8 },
      { v: "regionalFed", b: 0.4 },
      { v: "fedFunds", b: -1.1 },
    ],
  },
  EAFE: {
    beta: 0.88,
    own: [
      { v: "ecbDepo", b: -1.6 },
      { v: "boeBank", b: -0.5 },
      { v: "bojPolicy", b: -0.4 },
      { v: "termsOfTrade", b: -0.3 },
    ],
  },
  EM: {
    beta: 1.15,
    own: [
      { v: "emStress", b: -4.5 },
      { v: "usdcny", b: -1.2 },
      { v: "fedFunds", b: -1.3 },
    ],
  },
  SEC_TECH: {
    beta: 1.15,
    own: [
      { v: "productivity", b: 1.4 },
      { v: "earningsRevisions", b: 0.8 },
    ],
  },
  SEC_FINS: {
    beta: 1.08,
    own: [
      { v: "igSpread", b: -1.2 },
      { v: "unemployment", b: -1.0 },
    ],
  },
  SEC_ENGY: {
    beta: 0.82,
    own: [{ v: "cpiHeadline", b: 0.6 }],
  },
  SEC_UTIL: {
    beta: 0.55,
    own: [{ v: "be10y", b: -0.9 }],
  },
  SEC_INDU: {
    beta: 1.05,
    own: [
      { v: "pmiMfg", b: 1.3 },
      { v: "regionalFed", b: 0.5 },
    ],
  },
  SEC_HLTH: {
    beta: 0.72,
    own: [],
  },
  SEC_CONS: {
    beta: 0.95,
    own: [
      { v: "wageGrowth", b: 0.5 },
      { v: "cpiHeadline", b: -0.9 },
      { v: "unemployment", b: -1.4 },
      { v: "energySupply", b: -0.8 },
    ],
  },

  // ---- Sector tilts (real, weighted positions — see EQUITY_SLEEVE) --------
  // Same "beta to the index plus its own drivers" shape as the sectors above,
  // not a new mechanism — these three just also carry a portfolio weight.
  SEMI: {
    // The highest beta in the book: semis carry more operating leverage to
    // the capex/AI cycle than SEC_TECH's broad tech-sector slice of SPX, and
    // the export-control/China channel (usdcny) is a real, distinct exposure
    // no other equity here has a direct line to.
    beta: 1.35,
    own: [
      { v: "productivity", b: 1.8 },
      { v: "earningsRevisions", b: 1.1 },
      { v: "pmiMfg", b: 1.0 },
      { v: "usdcny", b: -1.0 },
    ],
  },
  HCARE: {
    // Defensive, same family as SEC_HLTH (beta 0.72, no direct own drivers):
    // earnings are demand-inelastic, so the position's own volatility is
    // mostly wage-cost margin pressure, plus a small flight-to-quality bid
    // when risk appetite deteriorates (positive VIX beta, the one sector
    // tilt here that moves the RIGHT way when the market is selling off).
    beta: 0.72,
    own: [
      { v: "wageGrowth", b: -0.4 },
      { v: "vix", b: 0.5 },
    ],
  },
  TECHX: {
    // A concentrated growth/duration tilt: higher beta than SPX, a bigger
    // discount-rate leg than SEC_TECH's (see the UST10Y second-round link
    // below), and the same productivity/earnings-revisions drivers as the
    // sector slice, sized for a standalone position rather than a decomposed
    // share of the index.
    beta: 1.25,
    own: [
      { v: "productivity", b: 1.5 },
      { v: "earningsRevisions", b: 1.0 },
      { v: "be10y", b: -0.4 },
    ],
  },
};

// ---------------------------------------------------------------------------
// Commodities. Modelled in percent, driven by demand and by the dollar. The
// dollar leg is NOT here — it arrives through SECOND_ROUND off the computed DXY
// so that a dollar shock and a growth shock cannot disagree about which way oil
// went.
// ---------------------------------------------------------------------------
export const COMMODITY_BETAS: Record<string, Beta[]> = {
  WTI: [
    { v: "energySupply", b: 9.0 },
    { v: "gdpGrowth", b: 4.5 },
    { v: "pmiMfg", b: 3.2 },
    { v: "pmiSvcs", b: 1.1 },
    { v: "unemployment", b: -2.2 },
    { v: "cpiHeadline", b: 2.0 },
    { v: "emStress", b: -1.5 },
    { v: "termsOfTrade", b: -0.6 },
  ],
  NATGAS: [
    { v: "energySupply", b: 7.0 },
    { v: "gdpGrowth", b: 2.5 },
    { v: "pmiMfg", b: 2.0 },
    { v: "cpiHeadline", b: 1.5 },
    { v: "unemployment", b: -1.2 },
  ],
  GOLD: [
    { v: "realRate10y", b: -3.4 },
    { v: "be10y", b: 1.6 },
    { v: "vix", b: 2.2 },
    { v: "emStress", b: 1.8 },
    { v: "debtGdp", b: 1.4 },
    { v: "deficitGdp", b: 0.8 },
    { v: "fedBalanceSheet", b: 2.0 },
    { v: "fedFunds", b: -1.2 },
  ],
  COPPER: [
    { v: "gdpGrowth", b: 4.0 },
    { v: "pmiMfg", b: 3.8 },
    { v: "pmiSvcs", b: 1.0 },
    { v: "unemployment", b: -1.5 },
    { v: "emStress", b: -1.8 },
    { v: "usdcny", b: -1.4 },
  ],
  // Same base-metal shape as Copper, weighted even more heavily toward
  // manufacturing/construction activity and China (steel is what iron ore is
  // actually for), which is why both its PMI and usdcny betas run a bit
  // larger than Copper's rather than being copy-pasted from it.
  IRON: [
    { v: "gdpGrowth", b: 3.6 },
    { v: "pmiMfg", b: 4.2 },
    { v: "unemployment", b: -1.3 },
    { v: "emStress", b: -2.5 },
    { v: "usdcny", b: -2.0 },
  ],
  AGS: [
    { v: "energySupply", b: 1.5 },
    { v: "cpiHeadline", b: 2.2 },
    { v: "termsOfTrade", b: 0.8 },
    { v: "gdpGrowth", b: 0.8 },
    { v: "emStress", b: -0.5 },
  ],
};

/** Brent is priced off WTI plus its own external premium, not independently. */
export const DERIVED_COMMODITY: Record<string, { from: string; beta: number; own: Beta[] }> = {
  BRENT: { from: "WTI", beta: 0.96, own: [{ v: "emStress", b: -0.8 }] },
};

// ---------------------------------------------------------------------------
// FX. A single latent dollar factor is priced first and every pair inherits it
// through a beta whose SIGN comes from the pair's quote convention in
// lib/assets.ts. Modelling seven pairs independently is how a model ends up
// printing a stronger dollar against the euro and a weaker one against sterling
// out of the same shock.
// ---------------------------------------------------------------------------
export const DXY_BETAS: Beta[] = [
  { v: "fedFunds", b: 2.8 },
  { v: "ecbDepo", b: -2.2 },
  { v: "bojPolicy", b: -1.1 },
  { v: "boeBank", b: -0.7 },
  { v: "forwardGuidance", b: 1.3 },
  { v: "realRate10y", b: 1.0 },
  { v: "gdpGrowth", b: 0.9 },
  { v: "vix", b: 0.8 },
  { v: "emStress", b: 1.2 },
  { v: "currentAccount", b: 0.6 },
  { v: "deficitGdp", b: -0.3 },
  { v: "debtGdp", b: -0.5 },
  { v: "qtPace", b: 0.4 },
  { v: "fedBalanceSheet", b: -1.2 },
  { v: "termsOfTrade", b: 0.7 },
];

export interface FxPair {
  /** Percent move in the pair per 1% move in DXY. Sign carries the convention. */
  dxyBeta: number;
  own: Beta[];
}

export const FX_PAIRS: Record<string, FxPair> = {
  EURUSD: { dxyBeta: -1.05, own: [{ v: "ecbDepo", b: 1.6 }, { v: "emStress", b: -0.3 }] },
  USDJPY: { dxyBeta: 1.15, own: [{ v: "bojPolicy", b: -3.2 }, { v: "vix", b: -1.2 }] },
  GBPUSD: { dxyBeta: -0.95, own: [{ v: "boeBank", b: 1.4 }, { v: "vix", b: -0.6 }] },
  USDCNY: { dxyBeta: 0.35, own: [{ v: "emStress", b: 0.8 }] },
  USDMXN: { dxyBeta: 1.25, own: [{ v: "emStress", b: 3.2 }, { v: "vix", b: 1.8 }] },
  USDBRL: { dxyBeta: 1.35, own: [{ v: "emStress", b: 3.6 }, { v: "vix", b: 1.6 }] },
};

// ---------------------------------------------------------------------------
// Second-round propagation: computed asset moves driving other assets. Applied
// once, in a fixed order (rates, commodities, FX, equity, credit, sectors), so
// the model has no feedback loop to converge and no hidden iteration count.
// A cycle here would be a bug, not a feature — nothing in this list points
// backwards.
//
// `unit` says what the target receives: "bp" for a yield or spread leg, "pct"
// for a price channel. `b` is target units per 1 unit of source move.
// ---------------------------------------------------------------------------
export interface SecondRound {
  from: string;
  /** Synthetic source "CURVE_2S10S" is 10y minus 2y, in bp. */
  to: string;
  channel: "spread" | "multiple" | "price";
  unit: "bp" | "pct";
  b: number;
  why: string;
}

export const SECOND_ROUND: SecondRound[] = [
  // Rates into equity valuation. This is the single path from policy to
  // multiples; there is no direct rate term in EQUITY_CHANNELS.multiple.
  { from: "UST10Y", to: "SPX", channel: "multiple", unit: "pct", b: -0.075, why: "Discount rate: 10y into the equity multiple" },

  // The dollar into everything priced in it.
  { from: "DXY", to: "WTI", channel: "price", unit: "pct", b: -0.55, why: "Dollar leg of a dollar-priced barrel" },
  { from: "DXY", to: "GOLD", channel: "price", unit: "pct", b: -0.85, why: "Dollar leg" },
  { from: "DXY", to: "COPPER", channel: "price", unit: "pct", b: -0.75, why: "Dollar leg" },
  { from: "DXY", to: "AGS", channel: "price", unit: "pct", b: -0.45, why: "Dollar leg" },
  { from: "DXY", to: "IRON", channel: "price", unit: "pct", b: -0.65, why: "Dollar leg" },
  { from: "DXY", to: "NATGAS", channel: "price", unit: "pct", b: -0.25, why: "Dollar leg, damped by regional pricing" },
  { from: "DXY", to: "EAFE", channel: "price", unit: "pct", b: -0.70, why: "Translation of unhedged developed-market equity into USD" },
  { from: "DXY", to: "EM", channel: "price", unit: "pct", b: -1.35, why: "EM equity carries the dollar twice: translation and funding" },

  // Equity into credit. The dominant second-round link in any stress scenario.
  { from: "SPX", to: "IG", channel: "spread", unit: "bp", b: -1.6, why: "Equity drawdown into IG spread" },
  { from: "SPX", to: "HY_BB", channel: "spread", unit: "bp", b: -4.5, why: "Equity drawdown into BB spread" },
  { from: "SPX", to: "HY_BCCC", channel: "spread", unit: "bp", b: -11.0, why: "Equity drawdown into distressed-tier spread" },
  { from: "SPX", to: "MBS", channel: "spread", unit: "bp", b: -0.5, why: "Risk-off widening in securitised" },
  { from: "UST10Y", to: "MBS", channel: "spread", unit: "bp", b: 0.10, why: "Negative convexity: higher yields widen the mortgage basis" },

  // Energy into the issuers and the pairs that trade off it.
  { from: "WTI", to: "HY_BB", channel: "spread", unit: "bp", b: -0.35, why: "Energy issuer weight in BB" },
  { from: "WTI", to: "HY_BCCC", channel: "spread", unit: "bp", b: -0.90, why: "Energy issuer weight in the distressed tier" },
  { from: "WTI", to: "SEC_ENGY", channel: "price", unit: "pct", b: 0.35, why: "Sector earnings track the barrel" },
  { from: "WTI", to: "USDMXN", channel: "price", unit: "pct", b: -0.15, why: "Oil exporter terms of trade" },
  { from: "COPPER", to: "USDBRL", channel: "price", unit: "pct", b: -0.12, why: "Commodity exporter terms of trade" },
  { from: "COPPER", to: "SEC_INDU", channel: "price", unit: "pct", b: 0.10, why: "Industrial demand read-through" },
  { from: "IRON", to: "SEC_INDU", channel: "price", unit: "pct", b: 0.08, why: "Industrial demand read-through" },

  // Curve shape into the banks. A parallel shift and an inversion are not the
  // same event for a lender, and only the shape term captures the difference.
  { from: "CURVE_2S10S", to: "SEC_FINS", channel: "price", unit: "pct", b: 0.040, why: "Net interest margin tracks 2s10s, not the level" },
  { from: "CURVE_2S10S", to: "RTY", channel: "price", unit: "pct", b: 0.015, why: "Small-cap funding costs track the front end against the long end" },

  // Long-duration equity carries an extra rate term beyond its index beta.
  { from: "UST10Y", to: "SEC_TECH", channel: "price", unit: "pct", b: -0.030, why: "Long-duration cash flows" },
  { from: "UST10Y", to: "SEC_UTIL", channel: "price", unit: "pct", b: -0.045, why: "Bond proxy" },
  { from: "UST10Y", to: "TECHX", channel: "price", unit: "pct", b: -0.040, why: "Long-duration cash flows, a bigger share of this book than the broad sector slice" },
  { from: "UST10Y", to: "SEMI", channel: "price", unit: "pct", b: -0.045, why: "Long-duration capex-driven cash flows" },
  { from: "UST10Y", to: "GOLD", channel: "price", unit: "pct", b: -0.020, why: "Carry cost of a zero-coupon asset" },
  { from: "UST10Y", to: "USDJPY", channel: "price", unit: "pct", b: 0.050, why: "Rate differential drives the carry trade" },
];
