import { ASSET_BY_ID, type Asset } from "./assets";

// Fill / transaction-cost model for the Trading/Execution tabs. Nothing here
// is a real quoted spread or a broker's actual commission schedule — there
// is no market data feed behind this app (see montecarlo.ts's and
// assets.ts's own disclosures for the same discipline applied to volatility
// and duration). It is a documented, internally-consistent set of
// assumptions, built once per asset class and applied the same way to every
// order, so a trade's modelled cost is always traceable to a fixed,
// inspectable rule rather than an invented one-off number.
//
// Three cost components, in order of how a real fill actually forms:
//   1. Spread  — half the bid/ask, paid just for crossing, independent of size.
//   2. Impact  — the ADDITIONAL cost of moving a large order through the book,
//      modelled as linear in notional (bp per $1mm) rather than the
//      square-root impact curve a real TCA desk would fit to trade data —
//      a deliberate simplification (see assets.ts's duration-vs-convexity
//      comment for the same kind of trade-off made elsewhere in this app).
//   3. Commission — a flat all-in rate (bp of notional) with a minimum
//      ticket charge, the same shape IB's own cost-plus pricing takes.
// Spread and impact both work AGAINST the trade direction (a buy always
// fills worse than the arrival mid, a sell always fills worse than the
// arrival mid in the other direction) — friction is never a tailwind.

export interface CostProfile {
  /** Half-spread cost, in bp of price, paid regardless of size. */
  spreadBp: number;
  /** Additional bp of adverse price move per $1mm of notional traded. */
  impactBpPerMM: number;
  /** All-in commission rate, bp of notional. */
  commissionBp: number;
  /** Minimum commission per ticket, $. */
  commissionMin: number;
}

function creditProfile(asset: Asset): CostProfile {
  if (asset.sub === "Securitised") return { spreadBp: 1.5, impactBpPerMM: 0.15, commissionBp: 0.3, commissionMin: 10 };
  if (asset.id === "IG") return { spreadBp: 3, impactBpPerMM: 0.3, commissionBp: 0.5, commissionMin: 15 };
  if (asset.id === "HY_BB") return { spreadBp: 6, impactBpPerMM: 0.6, commissionBp: 1.0, commissionMin: 15 };
  return { spreadBp: 10, impactBpPerMM: 1.0, commissionBp: 1.5, commissionMin: 15 }; // HY B/CCC
}

function equityProfile(asset: Asset): CostProfile {
  if (asset.sub === "Emerging") return { spreadBp: 3, impactBpPerMM: 0.4, commissionBp: 0.5, commissionMin: 1 };
  if (asset.sub === "Sector Tilts" || asset.sub === "S&P Sectors") {
    return { spreadBp: 1.5, impactBpPerMM: 0.3, commissionBp: 0.35, commissionMin: 1 };
  }
  return { spreadBp: 1, impactBpPerMM: 0.2, commissionBp: 0.35, commissionMin: 1 }; // Developed indices
}

function fxProfile(asset: Asset): CostProfile {
  if (asset.sub === "Asia" || asset.sub === "LatAm") return { spreadBp: 0.5, impactBpPerMM: 0.08, commissionBp: 0, commissionMin: 0 };
  return { spreadBp: 0.2, impactBpPerMM: 0.02, commissionBp: 0, commissionMin: 0 }; // Dollar, Majors
}

export function costProfile(assetId: string): CostProfile {
  const asset = ASSET_BY_ID[assetId];
  if (!asset) return { spreadBp: 2, impactBpPerMM: 0.3, commissionBp: 0.5, commissionMin: 10 };
  switch (asset.kind) {
    case "rate":
      return { spreadBp: 0.5, impactBpPerMM: 0.05, commissionBp: 0.1, commissionMin: 5 };
    case "credit":
      return creditProfile(asset);
    case "equity":
      return equityProfile(asset);
    case "commodity":
      return { spreadBp: 2, impactBpPerMM: 0.25, commissionBp: 0.4, commissionMin: 10 };
    case "fx":
      return fxProfile(asset);
    default:
      return { spreadBp: 2, impactBpPerMM: 0.3, commissionBp: 0.5, commissionMin: 10 };
  }
}

export type OrderSide = "buy" | "sell";

export interface FillResult {
  assetId: string;
  side: OrderSide;
  notional: number;
  /** Zero-cost, signed-for-direction price return — what the leg would have
   *  captured against the modelled arrival mid before any trading friction. */
  arrivalPct: number;
  /** spreadBp + size-scaled impactBp — always a cost, never a credit. */
  totalCostBp: number;
  /** arrivalPct less totalCostBp, i.e. what the position actually realises. */
  fillPct: number;
  /** All-in commission, $, already floored at the profile's minimum ticket. */
  commission: number;
  /** notional × arrivalPct / 100 — before any cost is deducted. */
  grossPnl: number;
  /** notional × fillPct / 100, minus commission. */
  netPnl: number;
}

/** Prices a single-leg fill. `pricePct` is the asset's own modelled price
 *  return from the engine (ScenarioInput → AssetResult.pricePct) — the raw,
 *  unsigned market move; `side` applies the direction (a sell captures the
 *  negative of the modelled move, a buy captures it as-is). */
export function computeFill(assetId: string, side: OrderSide, notional: number, pricePct: number): FillResult {
  const profile = costProfile(assetId);
  const totalCostBp = profile.spreadBp + profile.impactBpPerMM * (notional / 1_000_000);
  const arrivalPct = side === "buy" ? pricePct : -pricePct;
  const fillPct = arrivalPct - totalCostBp / 100;
  const commission = notional > 0 ? Math.max(profile.commissionMin, (notional * profile.commissionBp) / 10_000) : 0;
  const grossPnl = (notional * arrivalPct) / 100;
  const netPnl = (notional * fillPct) / 100 - commission;
  return { assetId, side, notional, arrivalPct, totalCostBp, fillPct, commission, grossPnl, netPnl };
}
