// Four fixed allocations. They differ ONLY in the equity/bond split — the
// composition of each sleeve is held constant across all four, which is what
// makes the four numbers comparable. If the 20/80 also held a different bond
// mix, the difference between it and the 60/40 would be two changes at once and
// the reader could not attribute the result to the split.

export interface Sleeve {
  asset: string;
  /** Percent of the sleeve, summing to 100. */
  w: number;
}

/**
 * A cap-weighted global sleeve with a home bias, which is what the portfolios
 * being modelled actually hold. Sectors are excluded on purpose: they are a
 * decomposition of US Large Cap, not an addition to it, and including them
 * would count the same exposure twice.
 */
export const EQUITY_SLEEVE: Sleeve[] = [
  { asset: "SPX", w: 62 },
  { asset: "RTY", w: 8 },
  { asset: "EAFE", w: 20 },
  { asset: "EM", w: 10 },
];

/**
 * An aggregate-index-shaped bond sleeve with a small high-yield tail. The
 * duration this implies (~7.0y) is the reason a 60/40 loses money in a rate
 * shock even when equities are flat, and it is a real property of the sleeve
 * rather than a parameter.
 */
export const BOND_SLEEVE: Sleeve[] = [
  { asset: "UST2Y", w: 8 },
  { asset: "UST5Y", w: 14 },
  { asset: "UST10Y", w: 18 },
  { asset: "UST30Y", w: 8 },
  { asset: "MBS", w: 16 },
  { asset: "IG", w: 26 },
  { asset: "HY_BB", w: 8 },
  { asset: "HY_BCCC", w: 2 },
];

export interface Portfolio {
  id: string;
  label: string;
  equity: number;
  bond: number;
}

export const PORTFOLIOS: Portfolio[] = [
  { id: "p8020", label: "80/20", equity: 80, bond: 20 },
  { id: "p6040", label: "60/40", equity: 60, bond: 40 },
  { id: "p4060", label: "40/60", equity: 40, bond: 60 },
  { id: "p2080", label: "20/80", equity: 20, bond: 80 },
];

export const DEFAULT_NOTIONAL = 1_000_000;

/** Flattened asset weights for a portfolio, in percent of total. */
export function portfolioWeights(p: Portfolio): Array<{ asset: string; w: number }> {
  const out: Array<{ asset: string; w: number }> = [];
  for (const s of EQUITY_SLEEVE) out.push({ asset: s.asset, w: (p.equity * s.w) / 100 });
  for (const s of BOND_SLEEVE) out.push({ asset: s.asset, w: (p.bond * s.w) / 100 });
  return out;
}
