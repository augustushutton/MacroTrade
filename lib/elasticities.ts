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
    { v: "deficitGdp", b: 5 },
    { v: "debtGdp", b: 3 },
    // Education Investment: see the term-premium note above UST10Y below —
    // same mechanism, smaller weight at the shorter end of the curve.
    { v: "eduInvestment", b: 1 },
  ],
  // Education Investment enters UST5Y/10Y/30Y (never UST2Y — a financing
  // decision moves the term premium the front end barely carries) at roughly
  // a fifth of deficitGdp's own beta at each tenor. That fraction is doing
  // two jobs at once: it is a smaller near-term fiscal impulse than the
  // headline deficit already prices (this is one program, not the whole
  // budget — sizing it at deficitGdp's full beta would double-count against
  // whatever the reader has separately set there), and it nets a real
  // financing-cost-today against a growth-dividend-tomorrow that a forward-
  // looking bond market partially discounts against each other. The
  // corresponding growth benefit shows up on the other side of the ledger,
  // in EQUITY_CHANNELS.SPX and DERIVED_EQUITY below.
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
    { v: "igSpread", b: -5 },
    { v: "deficitGdp", b: 9 },
    { v: "debtGdp", b: 6 },
    { v: "eduInvestment", b: 2 },
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
    { v: "deficitGdp", b: 14 },
    { v: "debtGdp", b: 9 },
    { v: "currentAccount", b: -5 },
    { v: "eduInvestment", b: 3 },
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
    { v: "qtPace", b: 4 },
    { v: "fedBalanceSheet", b: -6 },
    { v: "unemployment", b: 2 },
  ],
  IG: [
    { v: "vix", b: 9 },
    { v: "gdpGrowth", b: -5 },
    { v: "unemployment", b: 6 },
    { v: "earningsGrowth", b: -3 },
    { v: "earningsRevisions", b: -2 },
    { v: "fedBalanceSheet", b: -4 },
    { v: "pmiMfg", b: -2 },
  ],
  HY_BB: [
    { v: "vix", b: 22 },
    { v: "gdpGrowth", b: -13 },
    { v: "unemployment", b: 16 },
    { v: "earningsGrowth", b: -9 },
    { v: "earningsRevisions", b: -5 },
    { v: "pmiMfg", b: -6 },
    { v: "fedBalanceSheet", b: -8 },
  ],
  HY_BCCC: [
    { v: "vix", b: 52 },
    { v: "gdpGrowth", b: -32 },
    { v: "unemployment", b: 40 },
    { v: "earningsGrowth", b: -24 },
    { v: "earningsRevisions", b: -12 },
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
//
// Education Investment (lib/vars.ts) rides along on both the multiple and
// earnings legs, at roughly 25-35% of Productivity Growth's own beta on each
// — never the same size, and never copied outright. The fraction stands in
// for two things a static, single-period model cannot represent directly:
// the multi-year lag between a spending commitment and the human-capital
// payoff actually arriving (school years plus a working-life phase-in, not
// a quarter), and the execution/political-durability risk a forward-looking
// market prices against a policy input that a realised productivity print
// does not carry. See lib/vars.ts's eduInvestment entry for the full
// citation trail (Mankiw-Romer-Weil 1992; Hanushek & Woessmann 2008).
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
      { v: "forwardGuidance", b: -1.4 },
      { v: "fedBalanceSheet", b: 2.0 },
      { v: "qtPace", b: -0.8 },
      { v: "productivity", b: 1.6 },
      // ~30% of Productivity Growth's own multiple beta — see the Education
      // Investment note under EQUITY_CHANNELS below for why it is sized this
      // way rather than copied outright.
      { v: "eduInvestment", b: 0.5 },
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
      { v: "eduInvestment", b: 0.4 },
    ],
    riskPremium: [
      { v: "vix", b: -3.2 },
      { v: "igSpread", b: -1.5 },
      { v: "hyBBSpread", b: -1.4 },
      { v: "hyBCCCSpread", b: -1.6 },
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
      { v: "usdcny", b: -1.2 },
      { v: "fedFunds", b: -1.3 },
    ],
  },
  SEC_TECH: {
    beta: 1.15,
    own: [
      { v: "productivity", b: 1.4 },
      { v: "earningsRevisions", b: 0.8 },
      // The STEM talent pipeline is this sector's most direct line to
      // education policy of anything in the book — see the Education
      // Investment note above SEMI below.
      { v: "eduInvestment", b: 0.4 },
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
      // A smaller, more speculative echo of the wageGrowth beta just above:
      // a better-educated future workforce commands higher long-run wages,
      // which eventually shows up in consumer spending power — a second,
      // even-further-off step than the productivity/earnings channel this
      // variable already carries elsewhere, so it gets the smallest weight
      // of any beta this variable holds in the book.
      { v: "eduInvestment", b: 0.15 },
    ],
  },

  // ---- Sector tilts (real, weighted positions — see EQUITY_SLEEVE) --------
  // Same "beta to the index plus its own drivers" shape as the sectors above,
  // not a new mechanism — these three just also carry a portfolio weight.
  SEMI: {
    // The highest beta in the book: semis carry more operating leverage to
    // the capex/AI cycle than SEC_TECH's broad tech-sector slice of SPX, and
    // the export-control/China channel (usdcny) is a real, distinct exposure
    // no other equity here has a direct line to. Of everything in this
    // model, semis lean hardest on a deep STEM talent pipeline, so Education
    // Investment carries its largest single equity beta right here — still
    // only ~30% of this row's own productivity beta, per the fractional-
    // capitalisation logic in lib/vars.ts's eduInvestment entry.
    beta: 1.35,
    own: [
      { v: "productivity", b: 1.8 },
      { v: "earningsRevisions", b: 1.1 },
      { v: "pmiMfg", b: 1.0 },
      { v: "usdcny", b: -1.0 },
      { v: "eduInvestment", b: 0.55 },
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
      { v: "eduInvestment", b: 0.45 },
    ],
  },
};

// ---------------------------------------------------------------------------
// Commodities. Modelled in percent, driven by demand and by the dollar. The
// dollar leg is NOT here — it arrives through SECOND_ROUND off the computed
// USD/CAD so that a dollar shock and a growth shock cannot disagree about
// which way oil went.
// ---------------------------------------------------------------------------
export const COMMODITY_BETAS: Record<string, Beta[]> = {
  WTI: [
    { v: "energySupply", b: 9.0 },
    { v: "gdpGrowth", b: 4.5 },
    { v: "pmiMfg", b: 3.2 },
    { v: "pmiSvcs", b: 1.1 },
    { v: "unemployment", b: -2.2 },
    { v: "cpiHeadline", b: 2.0 },
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
    { v: "usdcny", b: -2.0 },
  ],
  AGS: [
    { v: "energySupply", b: 1.5 },
    { v: "cpiHeadline", b: 2.2 },
    { v: "termsOfTrade", b: 0.8 },
    { v: "gdpGrowth", b: 0.8 },
  ],
};

/** Brent is priced off WTI plus its own external premium, not independently. */
export const DERIVED_COMMODITY: Record<string, { from: string; beta: number; own: Beta[] }> = {
  BRENT: { from: "WTI", beta: 0.96, own: [] },
};

// ---------------------------------------------------------------------------
// FX. A single latent dollar factor is priced first (USD/CAD, below — it
// replaces a broad trade-weighted dollar index by request, but keeps that
// index's exact architectural job) and every pair inherits it through a beta
// whose SIGN comes from the pair's quote convention in lib/assets.ts.
// Modelling seven pairs independently is how a model ends up printing a
// stronger dollar against the euro and a weaker one against sterling out of
// the same shock.
// ---------------------------------------------------------------------------
export const USDCAD_BETAS: Beta[] = [
  { v: "fedFunds", b: 2.8 },
  { v: "forwardGuidance", b: 1.3 },
  { v: "realRate10y", b: 1.0 },
  { v: "qtPace", b: 0.4 },
  { v: "fedBalanceSheet", b: -1.2 },
  { v: "deficitGdp", b: -0.3 },
  { v: "debtGdp", b: -0.5 },
  { v: "currentAccount", b: 0.6 },
  { v: "termsOfTrade", b: 0.7 },
  // Bumped from the old basket's 0.8: CAD is a single higher-beta
  // risk/commodity currency, not an average across majors, so it sells off
  // harder than a basket would in the same flight-to-quality episode.
  { v: "vix", b: 1.0 },
  // SIGN FLIPPED from the old basket's +0.9. For a trade-weighted index,
  // strong US growth read as "US exceptionalism" and pulled the dollar up
  // broadly. For this one bilateral pair specifically, US-Canada trade
  // integration dominates instead — roughly three-quarters of Canadian
  // exports go to the US, so strong US demand pulls Canadian exports (and
  // the loonie) up with it, which pulls USD/CAD down.
  { v: "gdpGrowth", b: -0.4 },
  // NEW, and the single defining feature a bilateral CAD pair needs that a
  // broad basket never had to capture: Canada is a major oil exporter, the
  // same petrocurrency dynamic already modelled for USD/MXN's WTI link
  // below. This is a direct bet on the ENERGY SUPPLY SHOCK input (positive
  // = a shortage, oil price up), not a second-round link off WTI's own
  // priced move the way USDMXN's oil term is — USD/CAD is computed in the
  // "2. Dollar" stage of lib/engine.ts, BEFORE commodities price in stage 3,
  // so a WTI -> USDCAD second-round link would read a not-yet-computed
  // price and silently no-op (and would fail tests/engine.test.ts's acyclic-
  // sweep-order check if it somehow didn't). Reading the same root-cause
  // variable WTI's own beta already uses keeps both prices honest about the
  // same shock without needing the one to be computed before the other.
  // Negative sign: a shortage (oil price up) strengthens the petrocurrency,
  // which pulls USD/CAD down.
  { v: "energySupply", b: -0.2 },
  // ECB/BoJ/BoE policy terms from the old broad-basket version are dropped
  // entirely here — they described how a trade-weighted index responds to
  // its OTHER constituent currencies' central banks, which has no direct
  // bearing on a single USD/CAD cross.
];

export interface FxPair {
  /** Percent move in the pair per 1% move in USD/CAD. Sign carries the convention. */
  usdcadBeta: number;
  own: Beta[];
}

export const FX_PAIRS: Record<string, FxPair> = {
  EURUSD: { usdcadBeta: -1.05, own: [{ v: "ecbDepo", b: 1.6 }] },
  USDJPY: { usdcadBeta: 1.15, own: [{ v: "bojPolicy", b: -3.2 }, { v: "vix", b: -1.2 }] },
  GBPUSD: { usdcadBeta: -0.95, own: [{ v: "boeBank", b: 1.4 }, { v: "vix", b: -0.6 }] },
  USDCNY: { usdcadBeta: 0.35, own: [] },
  USDMXN: { usdcadBeta: 1.25, own: [{ v: "vix", b: 1.8 }] },
  // CHF is a G10 haven, not an EM currency — the opposite sign from
  // USDMXN's own VIX term above. A dollar-funding squeeze sells EM FX
  // (positive beta: USDMXN rises, the peso weakens) but buys CHF (negative
  // beta: USDCHF falls, the franc strengthens), the same flight-to-quality
  // bid that already drives USDJPY's own VIX term above. usdcadBeta is damped
  // relative to JPY's — SNB intervention against excessive appreciation and
  // CHF's own tight EUR/CHF linkage (see the EURUSD -> USDCHF SECOND_ROUND
  // link below) decouple it somewhat from generic broad-dollar momentum.
  //
  // Must stay listed after EURUSD above: engine.ts's FX pairs loop (step 4)
  // computes each pair in this object's iteration order and folds the result
  // straight into `sources` for the next one, so the EURUSD -> USDCHF
  // SECOND_ROUND link below only sees a non-stale EURUSD move if EURUSD's
  // own entry runs first.
  USDCHF: { usdcadBeta: 0.55, own: [{ v: "vix", b: -1.0 }] },
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

  // The dollar into everything priced in it. USD/CAD carries this leg now
  // (it replaced the old broad dollar index, DXY, as the one latent dollar
  // factor — see the "FX" section below) rather than a trade-weighted
  // basket, but the economic story each line tells is unchanged: these are
  // all still a generic "the dollar moved" effect, not anything specific to
  // Canada.
  { from: "USDCAD", to: "WTI", channel: "price", unit: "pct", b: -0.55, why: "Dollar leg of a dollar-priced barrel" },
  { from: "USDCAD", to: "GOLD", channel: "price", unit: "pct", b: -0.85, why: "Dollar leg" },
  { from: "USDCAD", to: "COPPER", channel: "price", unit: "pct", b: -0.75, why: "Dollar leg" },
  { from: "USDCAD", to: "AGS", channel: "price", unit: "pct", b: -0.45, why: "Dollar leg" },
  { from: "USDCAD", to: "IRON", channel: "price", unit: "pct", b: -0.65, why: "Dollar leg" },
  { from: "USDCAD", to: "NATGAS", channel: "price", unit: "pct", b: -0.25, why: "Dollar leg, damped by regional pricing" },
  { from: "USDCAD", to: "EAFE", channel: "price", unit: "pct", b: -0.70, why: "Translation of unhedged developed-market equity into USD" },
  { from: "USDCAD", to: "EM", channel: "price", unit: "pct", b: -1.35, why: "EM equity carries the dollar twice: translation and funding" },

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
  // CHF is not a commodity-exporter currency, so it has no terms-of-trade
  // link the way USDMXN/the old USDBRL did. What actually anchors USD/CHF
  // day to day is EUR/CHF: Switzerland's economy and trade are tied tightly
  // to the Eurozone, and the SNB has a long history of actively managing
  // that cross (most visibly the 2011-2015 1.20 floor) to keep it stable.
  // A euro-specific move (via ecbDepo, not a generic dollar move already
  // captured by USDCHF's own usdcadBeta above) passes through to the franc:
  // EUR/USD up (the euro strengthens) pulls USD/CHF down (the franc also
  // strengthens), hence the negative sign.
  { from: "EURUSD", to: "USDCHF", channel: "price", unit: "pct", b: -0.55, why: "EUR/CHF co-movement — the SNB manages this cross tightly" },
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
