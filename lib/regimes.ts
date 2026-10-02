import { VAR_BY_ID, type VarGroupId, type VarState } from "./vars";
import type { AssetKind } from "./assets";

// A regime is not a label on the output — it selects which elasticity set runs.
// The same 100bp hike is a different trade in a stagflation than in a soft
// landing, and a model that prices it identically in both is a spreadsheet with
// extra steps. Detection is threshold-based and every trigger that fired is
// reported, because an auto-detected regime the reader cannot audit is worse
// than one they picked themselves.

export type RegimeId = "goldilocks" | "soft_landing" | "stagflation" | "recession" | "financial_stress";

export type Channel = "rate" | "spread" | "multiple" | "earnings" | "riskPremium" | "price";

export interface MultRule {
  /** Any of these narrows the rule. Omitted field = matches everything. */
  kinds?: AssetKind[];
  assets?: string[];
  channels?: Channel[];
  drivers?: string[];
  groups?: VarGroupId[];
  m: number;
  why: string;
}

export interface RegimeTrigger {
  label: string;
  w: number;
  test: (s: VarState) => boolean;
}

export interface Regime {
  id: RegimeId;
  label: string;
  /** Direction tone for the tag. Colour is level-band only, never decorative. */
  tone: "up" | "down" | "warn" | "info" | "neutral";
  /** One line. The narrative tab carries the argument; the banner does not. */
  gist: string;
  triggers: RegimeTrigger[];
  mult: MultRule[];
  /** Rank breaks ties: stress states win over benign ones at equal score. */
  priority: number;
}

const v = (s: VarState, id: string) => (s[id] ?? VAR_BY_ID[id]?.base ?? 0);

export const REGIMES: Regime[] = [
  {
    id: "financial_stress",
    label: "Financial Stress",
    tone: "down",
    gist: "Liquidity and credit dominate fundamentals; cross-asset correlation rises toward one.",
    priority: 5,
    triggers: [
      { label: "VIX ≥ 28", w: 2, test: (s) => v(s, "vix") >= 28 },
      { label: "B/CCC OAS ≥ 800bp", w: 2, test: (s) => v(s, "hyBCCCSpread") >= 800 },
      { label: "IG OAS ≥ 160bp", w: 1.5, test: (s) => v(s, "igSpread") >= 160 },
    ],
    mult: [
      { kinds: ["rate"], groups: ["growth", "inflation"], m: 0.6, why: "Fundamental drivers of the curve are crowded out by the haven bid" },
      { kinds: ["rate"], drivers: ["vix", "hyBCCCSpread"], m: 1.9, why: "Flight to quality is the dominant term in the curve" },
      { kinds: ["equity"], m: 1.35, why: "Beta to every driver rises as dispersion collapses" },
      { channels: ["riskPremium"], m: 2.1, why: "Equity risk premium does most of the work in a stress state" },
      { kinds: ["credit"], m: 1.8, why: "Spread convexity: widening feeds on itself" },
      { assets: ["GOLD"], drivers: ["realRate10y"], m: 0.5, why: "Real-rate beta weakens; haven demand sets the price" },
      { assets: ["GOLD"], drivers: ["vix"], m: 2.0, why: "Haven demand" },
      { assets: ["USDCAD", "USDJPY", "USDCNY", "USDMXN", "USDCHF", "EURUSD", "GBPUSD"], drivers: ["vix"], m: 1.9, why: "Dollar funding squeeze" },
      { assets: ["EM", "RTY", "SEMI"], m: 1.4, why: "Highest-beta equity sleeves lead the drawdown" },
    ],
  },
  {
    id: "stagflation",
    label: "Stagflation",
    tone: "warn",
    gist: "Inflation drivers dominate; weak growth no longer rallies duration. Stock/bond correlation positive.",
    priority: 4,
    triggers: [
      { label: "Core CPI ≥ 4% with GDP ≤ 1%", w: 3, test: (s) => v(s, "cpiCore") >= 4 && v(s, "gdpGrowth") <= 1 },
      { label: "Headline CPI ≥ 4.5% with GDP ≤ 2.5%", w: 1.5, test: (s) => v(s, "cpiHeadline") >= 4.5 && v(s, "gdpGrowth") <= 2.5 },
      { label: "Wages ≥ 5% with productivity ≤ 1%", w: 1.5, test: (s) => v(s, "wageGrowth") >= 5 && v(s, "productivity") <= 1 },
      { label: "5y breakeven ≥ 2.8% with GDP ≤ 2.5%", w: 1, test: (s) => v(s, "be5y") >= 2.8 && v(s, "gdpGrowth") <= 2.5 },
    ],
    mult: [
      { kinds: ["rate"], groups: ["inflation"], m: 1.45, why: "Inflation pass-through to the curve is the live channel" },
      { kinds: ["rate"], groups: ["growth"], m: 0.65, why: "Weak growth does not buy duration when inflation is the constraint" },
      { kinds: ["rate"], drivers: ["vix"], m: 0.3, why: "Risk-off no longer rallies Treasuries; the defining stagflation feature" },
      { channels: ["multiple"], m: 1.55, why: "De-rating is the primary equity channel: higher discount rate, no growth offset" },
      { channels: ["earnings"], m: 1.15, why: "Margin compression from input and wage costs" },
      { kinds: ["commodity"], groups: ["inflation"], m: 1.35, why: "Commodities are the transmission mechanism, not a passenger" },
      { assets: ["GOLD"], m: 1.4, why: "Real-asset bid" },
      { assets: ["SEC_UTIL", "SEC_TECH", "TECHX", "SEMI"], m: 1.3, why: "Long-duration equity is most exposed to the discount-rate move" },
      { assets: ["SEC_ENGY"], m: 1.25, why: "Direct beneficiary of the input-cost shock" },
    ],
  },
  {
    id: "recession",
    label: "Recession",
    tone: "down",
    gist: "Earnings, not multiples, drive equity. Duration rallies hard; credit does the damage.",
    priority: 3,
    triggers: [
      { label: "GDP ≤ 0%", w: 2, test: (s) => v(s, "gdpGrowth") <= 0 },
      { label: "Unemployment ≥ 5.2%", w: 2, test: (s) => v(s, "unemployment") >= 5.2 },
      { label: "ISM Mfg ≤ 45", w: 1.5, test: (s) => v(s, "pmiMfg") <= 45 },
      { label: "ISM Svcs ≤ 48", w: 1.5, test: (s) => v(s, "pmiSvcs") <= 48 },
      { label: "Fwd earnings growth ≤ −5%", w: 1, test: (s) => v(s, "earningsGrowth") <= -5 },
      { label: "Regional Fed ≤ −15", w: 0.5, test: (s) => v(s, "regionalFed") <= -15 },
    ],
    mult: [
      { kinds: ["rate"], groups: ["growth"], m: 1.5, why: "The curve trades the growth data point for point" },
      { kinds: ["rate"], groups: ["inflation"], m: 0.7, why: "Inflation prints are discounted as backward-looking" },
      { channels: ["earnings"], m: 1.8, why: "Earnings do the damage; this is the channel to watch" },
      { channels: ["multiple"], m: 0.75, why: "Multiples are supported by the rate rally; the classic recession offset" },
      { kinds: ["credit"], m: 1.7, why: "Default cycle: spread widening outruns the rate rally in low quality" },
      { assets: ["HY_BCCC"], m: 1.35, why: "Distressed tier prices default risk, not duration" },
      { kinds: ["commodity"], groups: ["growth"], m: 1.45, why: "Demand destruction is the price mechanism" },
      { assets: ["GOLD"], m: 1.2, why: "Rate cuts and haven demand both help" },
      { assets: ["SEC_ENGY", "SEC_FINS", "SEC_INDU"], m: 1.3, why: "Cyclical sectors carry the earnings hit" },
      { assets: ["SEC_HLTH", "SEC_UTIL", "HCARE"], m: 0.7, why: "Defensive earnings streams" },
    ],
  },
  {
    id: "goldilocks",
    label: "Goldilocks",
    tone: "up",
    gist: "Growth without inflation; multiple expansion available and credit spreads pinned near the floor.",
    priority: 1,
    triggers: [
      { label: "Core CPI ≤ 2.5% with GDP ≥ 2%", w: 3, test: (s) => v(s, "cpiCore") <= 2.5 && v(s, "gdpGrowth") >= 2 },
      { label: "Unemployment ≤ 4.5%", w: 1, test: (s) => v(s, "unemployment") <= 4.5 },
      { label: "ISM Svcs ≥ 54", w: 1, test: (s) => v(s, "pmiSvcs") >= 54 },
      { label: "Revision breadth ≥ +5", w: 1, test: (s) => v(s, "earningsRevisions") >= 5 },
    ],
    mult: [
      { channels: ["multiple"], m: 1.25, why: "Multiple expansion is available when inflation is not the binding constraint" },
      { channels: ["riskPremium"], m: 0.7, why: "Risk premium is already compressed; little left to give" },
      { kinds: ["credit"], m: 0.6, why: "Spreads are pinned near the cycle floor; the move is asymmetric and this is the tight side" },
      { kinds: ["rate"], m: 0.85, why: "Curve is anchored by a credible policy path" },
      { assets: ["EM", "RTY", "SEMI"], m: 1.2, why: "High-beta sleeves lead when the dollar and rates are calm" },
    ],
  },
  {
    id: "soft_landing",
    label: "Soft Landing",
    tone: "info",
    gist: "Baseline elasticity set. No channel is amplified or damped.",
    priority: 2,
    triggers: [
      { label: "Core CPI ≤ 3.2% with GDP 0–2.5%", w: 2, test: (s) => v(s, "cpiCore") <= 3.2 && v(s, "gdpGrowth") > 0 && v(s, "gdpGrowth") < 2.5 },
      { label: "Unemployment ≤ 5.0%", w: 1, test: (s) => v(s, "unemployment") <= 5.0 },
      { label: "VIX ≤ 20", w: 0.5, test: (s) => v(s, "vix") <= 20 },
    ],
    mult: [],
  },
];

export const REGIME_BY_ID: Record<RegimeId, Regime> = Object.fromEntries(
  REGIMES.map((r) => [r.id, r]),
) as Record<RegimeId, Regime>;

export interface RegimeScore {
  id: RegimeId;
  score: number;
  fired: string[];
}

export interface RegimeDetection {
  active: RegimeId;
  /** True when the reader overrode detection. The banner says which. */
  overridden: boolean;
  scores: RegimeScore[];
}

export function scoreRegimes(state: VarState): RegimeScore[] {
  return REGIMES.map((r) => {
    const fired: string[] = [];
    let score = 0;
    for (const t of r.triggers) {
      if (t.test(state)) {
        fired.push(t.label);
        score += t.w;
      }
    }
    return { id: r.id, score, fired };
  }).sort((a, b) => {
    if (Math.abs(b.score - a.score) > 1e-9) return b.score - a.score;
    return REGIME_BY_ID[b.id].priority - REGIME_BY_ID[a.id].priority;
  });
}

export function detectRegime(state: VarState, override?: RegimeId | null): RegimeDetection {
  const scores = scoreRegimes(state);
  // Nothing firing at all means the inputs sit inside the benign middle, which
  // IS the soft-landing case rather than an undefined one.
  const top = scores[0];
  const detected: RegimeId = top && top.score > 0 ? top.id : "soft_landing";
  return {
    active: override ?? detected,
    overridden: !!override && override !== detected,
    scores,
  };
}

export interface MultResult {
  m: number;
  reasons: string[];
}

/**
 * Multipliers COMPOUND. Two rules that both match multiply, they do not pick a
 * winner, because a stress-state equity beta and a risk-premium channel
 * amplification are separate statements about the same number and both are
 * true. Every factor that applied is returned so the drill-down can print the
 * arithmetic rather than a final coefficient with no provenance.
 */
export function regimeMultiplier(
  regimeId: RegimeId,
  ctx: { assetId: string; kind: AssetKind; channel: Channel; driver?: string; group?: VarGroupId },
): MultResult {
  const regime = REGIME_BY_ID[regimeId];
  let m = 1;
  const reasons: string[] = [];
  if (!regime) return { m, reasons };
  for (const rule of regime.mult) {
    if (rule.kinds && !rule.kinds.includes(ctx.kind)) continue;
    if (rule.assets && !rule.assets.includes(ctx.assetId)) continue;
    if (rule.channels && !rule.channels.includes(ctx.channel)) continue;
    if (rule.drivers && (!ctx.driver || !rule.drivers.includes(ctx.driver))) continue;
    if (rule.groups && (!ctx.group || !rule.groups.includes(ctx.group))) continue;
    m *= rule.m;
    reasons.push(`x${rule.m.toFixed(2)} ${rule.why}`);
  }
  return { m, reasons };
}

/** Normalised size above which a regime multiplier begins to lose force. */
const SATURATION_SCALE = 3;

/**
 * A regime multiplier is a statement about the TRANSITION from a calm world to
 * a stressed one: the same 5-point move on the VIX does more damage when
 * spreads are already widening than when they are not. It is not a licence to
 * scale an arbitrarily large shock by an arbitrarily large coefficient.
 *
 * That distinction only matters at the tail, and the tail is where it mattered
 * a great deal. A credit-crisis input set puts the distressed-tier OAS eleven
 * normalised units wide; multiplying THAT by the 2.1x the credit-stress regime
 * assigns to risk-premium terms priced the transition a second time, on a move
 * that had already completed it, and one line of a six-line channel came out at
 * -38% on the S&P by itself.
 *
 * So the excess above 1 decays hyperbolically in the size of the shock it is
 * applied to: at one normalised unit the regime speaks in full; by four
 * roughly half of the excess has faded; by eleven about three-quarters has,
 * leaving a still-visible ~23% of the original amplification, which is
 * intentional — a genuine tail input should not be priced as if the regime
 * were entirely absent. It keeps fading, slower and slower, and only
 * approaches (never reaches) 1 as the shock grows without bound. A multiplier
 * BELOW 1 fades the same way, for the same reason, and the function is
 * continuous through m = 1.
 */
export function saturateMultiplier(m: number, normalisedShock: number): number {
  const excess = Math.max(0, Math.abs(normalisedShock) - 1);
  return 1 + (m - 1) * (SATURATION_SCALE / (SATURATION_SCALE + excess));
}
