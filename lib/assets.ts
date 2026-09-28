// The output universe. Nothing is trimmed: every tenor, every credit bucket,
// every sector and every pair the input side can move is priced.
//
// The unit an asset is modelled in is not cosmetic. Rates and credit are
// modelled in BASIS POINTS OF YIELD and converted to a price return through
// duration; equities, commodities and FX are modelled directly in PERCENT.
// Mixing those two would silently turn a 40bp selloff into a 40% one, so the
// discriminant lives on the asset and the engine switches on it rather than on
// a naming convention.
export type AssetKind = "rate" | "credit" | "equity" | "commodity" | "fx";
export type AssetGroup = "Bonds" | "Equities" | "Commodities" | "FX";

export interface Asset {
  id: string;
  label: string;
  group: AssetGroup;
  /** Sub-heading inside the group. Bonds split granularly, per spec. */
  sub: string;
  kind: AssetKind;
  /**
   * Effective duration. Used to turn a yield move into a price return
   * (-D x dY) for rates and credit. Ignoring convexity is a deliberate
   * simplification and it matters most at the 30y, where a 100bp move
   * understates the price gain and overstates the loss by roughly 1pp.
   */
  duration?: number;
  /**
   * Credit is priced off a Treasury leg plus a spread leg. The weights blend
   * tenors to match the index's actual key-rate profile rather than pinning an
   * index with a 7-year duration to a single point on the curve.
   */
  rateLegs?: Array<{ asset: string; w: number }>;
  /** Sectors nest under their index and are hidden until expanded. */
  parent?: string;
  /**
   * FX quote convention, and the reason the sign of every FX number in this app
   * is trustworthy. "usd-base" means a rise is a STRONGER dollar (USD/JPY);
   * "usd-quote" means a rise is a WEAKER dollar (EUR/USD). The engine models a
   * single latent dollar factor and applies it through this field, so a
   * dollar-positive shock cannot print EUR/USD and USD/JPY moving the same way.
   */
  fxConvention?: "usd-base" | "usd-quote";
}

export const ASSETS: Asset[] = [
  // ---- Treasuries ----------------------------------------------------------
  { id: "UST2Y", label: "UST 2Y", group: "Bonds", sub: "Treasuries", kind: "rate", duration: 1.9 },
  { id: "UST5Y", label: "UST 5Y", group: "Bonds", sub: "Treasuries", kind: "rate", duration: 4.6 },
  { id: "UST10Y", label: "UST 10Y", group: "Bonds", sub: "Treasuries", kind: "rate", duration: 8.4 },
  { id: "UST30Y", label: "UST 30Y", group: "Bonds", sub: "Treasuries", kind: "rate", duration: 19.5 },

  // ---- Spread product ------------------------------------------------------
  {
    id: "MBS", label: "Agency MBS", group: "Bonds", sub: "Securitised", kind: "credit", duration: 5.5,
    rateLegs: [{ asset: "UST5Y", w: 0.5 }, { asset: "UST10Y", w: 0.5 }],
  },
  {
    id: "IG", label: "IG Corporate", group: "Bonds", sub: "Credit", kind: "credit", duration: 7.0,
    rateLegs: [{ asset: "UST5Y", w: 0.35 }, { asset: "UST10Y", w: 0.5 }, { asset: "UST30Y", w: 0.15 }],
  },
  {
    id: "HY_BB", label: "HY BB", group: "Bonds", sub: "Credit", kind: "credit", duration: 4.2,
    rateLegs: [{ asset: "UST5Y", w: 0.7 }, { asset: "UST10Y", w: 0.3 }],
  },
  {
    id: "HY_BCCC", label: "HY B/CCC", group: "Bonds", sub: "Credit", kind: "credit", duration: 3.4,
    rateLegs: [{ asset: "UST2Y", w: 0.3 }, { asset: "UST5Y", w: 0.7 }],
  },

  // ---- Equity indices ------------------------------------------------------
  { id: "SPX", label: "US Large Cap", group: "Equities", sub: "Developed", kind: "equity" },
  { id: "RTY", label: "US Small Cap", group: "Equities", sub: "Developed", kind: "equity" },
  { id: "EAFE", label: "Intl Developed", group: "Equities", sub: "Developed", kind: "equity" },
  { id: "EM", label: "Emerging Markets", group: "Equities", sub: "Emerging", kind: "equity" },

  // ---- Sector tilts (top-level holdings, NOT the SPX decomposition below) --
  // These are real satellite positions the portfolio holds outright, funded
  // out of the US Large Cap sleeve (see EQUITY_SLEEVE in lib/portfolios.ts) —
  // unlike SEC_TECH/SEC_HLTH just below, which only decompose SPX and carry no
  // weight of their own. Labelled distinctly from those two sector rows
  // ("Healthcare"/"Tech" vs. "Health Care"/"Technology") so the two different
  // things — a read-only breakdown of an index vs. an actual concentrated
  // position — are never mistaken for each other in the P&L table.
  { id: "SEMI", label: "Semiconductors", group: "Equities", sub: "Sector Tilts", kind: "equity" },
  { id: "HCARE", label: "Healthcare", group: "Equities", sub: "Sector Tilts", kind: "equity" },
  { id: "TECHX", label: "Tech", group: "Equities", sub: "Sector Tilts", kind: "equity" },

  // ---- Sectors (children of SPX) ------------------------------------------
  { id: "SEC_TECH", label: "Technology", group: "Equities", sub: "S&P Sectors", kind: "equity", parent: "SPX" },
  { id: "SEC_FINS", label: "Financials", group: "Equities", sub: "S&P Sectors", kind: "equity", parent: "SPX" },
  { id: "SEC_ENGY", label: "Energy", group: "Equities", sub: "S&P Sectors", kind: "equity", parent: "SPX" },
  { id: "SEC_UTIL", label: "Utilities", group: "Equities", sub: "S&P Sectors", kind: "equity", parent: "SPX" },
  { id: "SEC_INDU", label: "Industrials", group: "Equities", sub: "S&P Sectors", kind: "equity", parent: "SPX" },
  { id: "SEC_HLTH", label: "Health Care", group: "Equities", sub: "S&P Sectors", kind: "equity", parent: "SPX" },
  { id: "SEC_CONS", label: "Consumer", group: "Equities", sub: "S&P Sectors", kind: "equity", parent: "SPX" },

  // ---- Commodities ---------------------------------------------------------
  { id: "WTI", label: "WTI Crude", group: "Commodities", sub: "Energy", kind: "commodity" },
  { id: "BRENT", label: "Brent Crude", group: "Commodities", sub: "Energy", kind: "commodity" },
  { id: "NATGAS", label: "Natural Gas", group: "Commodities", sub: "Energy", kind: "commodity" },
  { id: "GOLD", label: "Gold", group: "Commodities", sub: "Metals", kind: "commodity" },
  { id: "COPPER", label: "Copper", group: "Commodities", sub: "Metals", kind: "commodity" },
  { id: "IRON", label: "Iron Ore", group: "Commodities", sub: "Metals", kind: "commodity" },
  { id: "AGS", label: "Agriculture Basket", group: "Commodities", sub: "Agriculture", kind: "commodity" },

  // ---- FX ------------------------------------------------------------------
  { id: "DXY", label: "DXY", group: "FX", sub: "Dollar", kind: "fx", fxConvention: "usd-base" },
  { id: "EURUSD", label: "EUR/USD", group: "FX", sub: "Majors", kind: "fx", fxConvention: "usd-quote" },
  { id: "USDJPY", label: "USD/JPY", group: "FX", sub: "Majors", kind: "fx", fxConvention: "usd-base" },
  { id: "GBPUSD", label: "GBP/USD", group: "FX", sub: "Majors", kind: "fx", fxConvention: "usd-quote" },
  { id: "USDCNY", label: "USD/CNY", group: "FX", sub: "Asia", kind: "fx", fxConvention: "usd-base" },
  { id: "USDMXN", label: "USD/MXN", group: "FX", sub: "LatAm", kind: "fx", fxConvention: "usd-base" },
  { id: "USDBRL", label: "USD/BRL", group: "FX", sub: "LatAm", kind: "fx", fxConvention: "usd-base" },
];

export const ASSET_BY_ID: Record<string, Asset> = Object.fromEntries(
  ASSETS.map((a) => [a.id, a]),
);

export const GROUP_ORDER: AssetGroup[] = ["Bonds", "Equities", "Commodities", "FX"];

/** Sectors are a drill-down, not a row in the default table. */
export const TOP_LEVEL_ASSETS = ASSETS.filter((a) => !a.parent);
export const SECTORS = ASSETS.filter((a) => a.parent === "SPX");
