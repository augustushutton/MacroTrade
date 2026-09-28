import { ASSETS, ASSET_BY_ID, type Asset, type AssetKind } from "./assets";
import {
  COMMODITY_BETAS,
  DERIVED_COMMODITY,
  DERIVED_EQUITY,
  DXY_BETAS,
  EQUITY_CHANNELS,
  FX_PAIRS,
  MULTIPLE_PIN_VAR,
  RATE_BETAS,
  SECOND_ROUND,
  SPREAD_BETAS,
  SPREAD_PINS,
  type Beta,
} from "./elasticities";
import { detectRegime, regimeMultiplier, saturateMultiplier, type Channel, type RegimeDetection, type RegimeId } from "./regimes";
import { HORIZONS, responseWeight, responseWeightAt, type Horizon, type PathShape } from "./paths";
import { PORTFOLIOS, portfolioWeights, DEFAULT_NOTIONAL, type Portfolio } from "./portfolios";
import {
  FACTOR_BY_ID,
  FACTOR_OF,
  THEME_BY_ID,
  THEME_OF,
  VAR_BY_ID,
  VAR_GROUPS,
  collinearityShrink,
  crossTierShrink,
  rawMove,
  shock,
  themeShrink,
  type VarGroupId,
  type VarState,
} from "./vars";

// The whole model is ONE forward pass in a fixed order:
//
//   curve -> dollar -> commodities -> FX pairs -> equity -> derived equity
//         -> credit -> sectors -> bond prices -> portfolios
//
// Nothing in lib/elasticities.ts SECOND_ROUND points backwards along that
// order, which is what lets the engine be a single sweep with no iteration
// count, no convergence tolerance, and no possibility of a feedback loop that
// amplifies until it explodes. tests/engine.test.ts asserts the acyclicity so
// the next second-round link added cannot quietly introduce one.

export interface Term {
  driver: string;
  label: string;
  source: "var" | "asset";
  /** Normalised shock for a variable; native move (bp or %) for an asset. */
  shock: number;
  beta: number;
  /** Regime multiplier x time-response weight x collinearity shrink, combined. */
  mult: number;
  /** Collinearity shrink applied to this term. 1 when the driver moved alone. */
  shrink?: number;
  /** Contribution in the channel's own units. */
  value: number;
  reasons: string[];
}

export interface ChannelResult {
  channel: Channel;
  label: string;
  value: number;
  terms: Term[];
  pinned: boolean;
  pinNote?: string;
}

export interface AssetResult {
  id: string;
  label: string;
  group: Asset["group"];
  sub: string;
  kind: AssetKind;
  parent?: string;
  channels: ChannelResult[];
  /** Rates and credit only. */
  rateLegBp?: number;
  spreadBp?: number;
  yieldBp?: number;
  duration?: number;
  /** Every asset ends in a price return. This is the number the portfolio uses. */
  pricePct: number;
  pinned: boolean;
}

export interface PortfolioLine {
  asset: string;
  label: string;
  w: number;
  pricePct: number;
  contribPct: number;
}

export interface PortfolioResult {
  id: string;
  label: string;
  pct: number;
  dollars: number;
  equityPct: number;
  bondPct: number;
  lines: PortfolioLine[];
}

export interface ScenarioInput {
  state: VarState;
  regimeOverride?: RegimeId | null;
  horizon: Horizon;
  path: PathShape;
  steps: number;
  notional: number;
}

export interface EngineResult {
  regime: RegimeDetection;
  assets: Record<string, AssetResult>;
  order: string[];
  portfolios: PortfolioResult[];
  /** Channel weights actually used, surfaced so the narrative can print them. */
  weights: Record<Channel, number>;
}

const CHANNEL_LABEL: Record<Channel, string> = {
  rate: "Yield",
  spread: "Spread",
  multiple: "Multiple",
  earnings: "Earnings",
  riskPremium: "Risk Premium",
  price: "Price",
};

function varLabel(id: string): string {
  return VAR_BY_ID[id]?.label ?? id;
}

interface SumCtx {
  assetId: string;
  kind: AssetKind;
  channel: Channel;
  regime: RegimeId;
  weight: number;
}

// Correlated drivers are discounted before they are summed. Six inflation series
// moving together are one inflation assumption observed six ways, not six
// independent shocks, and an additive sum of all six betas prices it six times.
//
// The rule inside a factor is LEAD PLUS CORROBORATION. The single largest
// contribution carries full weight, because that much of the story is real, and
// every additional member of the same factor is discounted by the effective-
// sample-size factor 1 / (1 + rho(n-1)). A lone mover is therefore untouched,
// corroborating evidence still moves the number in the same direction, and no
// amount of it can multiply the shock.
//
// A plain 1/(1+rho(n-1)) on the whole group was tried first and rejected: with
// unequal betas it drives the group toward its MEAN, so adding a weakly-loaded
// series to a strongly-loaded one made the yield move less. Corroboration must
// never subtract.
//
// The same rule runs a level up across factors within a theme, and counting is
// done per beta list rather than globally, because the double count only exists
// where two members of a factor land in the SAME sum.
interface Raw {
  v: string;
  b: number;
  s: number;
  m: number;
  reasons: string[];
  fid?: string;
  tid?: string;
  raw: number;
}

function sumVarBetas(betas: Beta[], state: VarState, ctx: SumCtx): { value: number; terms: Term[] } {
  const raws: Raw[] = [];
  for (const { v, b } of betas) {
    const s = shock(state, v);
    if (s === 0) continue;
    const { m: rawM, reasons } = regimeMultiplier(ctx.regime, {
      assetId: ctx.assetId,
      kind: ctx.kind,
      channel: ctx.channel,
      driver: v,
      group: VAR_BY_ID[v]?.group,
    });
    const m = saturateMultiplier(rawM, s);
    if (Math.abs(m - rawM) > 5e-3) {
      reasons.push(
        `Regime adjustment fades from ${rawM.toFixed(2)}x to ${m.toFixed(2)}x at a shock of ${Math.abs(s).toFixed(1)} normalised units`,
      );
    }
    const fid = FACTOR_OF[v];
    raws.push({ v, b, s, m, reasons, fid, tid: fid ? THEME_OF[fid] : undefined, raw: b * s * m * ctx.weight });
  }

  // Tier 1. Per factor: how many members moved, and which one leads.
  const nInFactor: Record<string, number> = {};
  const leadOfFactor: Record<string, string> = {};
  for (const r of raws) {
    if (!r.fid) continue;
    nInFactor[r.fid] = (nInFactor[r.fid] ?? 0) + 1;
    const cur = leadOfFactor[r.fid];
    if (!cur || Math.abs(r.raw) > Math.abs(raws.find((x) => x.v === cur)!.raw)) leadOfFactor[r.fid] = r.v;
  }
  const factorScale = (r: Raw): number => {
    if (!r.fid) return 1;
    const n = nInFactor[r.fid] ?? 1;
    if (n <= 1 || leadOfFactor[r.fid] === r.v) return 1;
    return collinearityShrink(r.v, n);
  };

  // Tier 2. Per theme, over the factor totals that survived tier 1.
  const factorTotal: Record<string, number> = {};
  for (const r of raws) {
    if (!r.fid) continue;
    factorTotal[r.fid] = (factorTotal[r.fid] ?? 0) + r.raw * factorScale(r);
  }
  const factorsInTheme: Record<string, string[]> = {};
  for (const fid of Object.keys(factorTotal)) {
    const tid = THEME_OF[fid];
    if (tid) (factorsInTheme[tid] ??= []).push(fid);
  }
  const themeLead: Record<string, string> = {};
  for (const [tid, fids] of Object.entries(factorsInTheme)) {
    themeLead[tid] = fids.reduce((a, b) => (Math.abs(factorTotal[b]) > Math.abs(factorTotal[a]) ? b : a));
  }
  const themeScaleOf = (r: Raw): number => {
    if (!r.fid || !r.tid) return 1;
    const k = factorsInTheme[r.tid]?.length ?? 1;
    if (k <= 1 || themeLead[r.tid] === r.fid) return 1;
    return themeShrink(r.v, k);
  };

  let value = 0;
  const terms: Term[] = [];
  for (const r of raws) {
    const sf = factorScale(r);
    const st = themeScaleOf(r);
    const shrink = sf * st;
    const mult = r.m * ctx.weight * shrink;
    const contribution = r.b * r.s * mult;
    value += contribution;
    const why = [...r.reasons];
    if (sf < 1 && r.fid) {
      const f = FACTOR_BY_ID[r.fid];
      why.push(
        `Corroborates ${varLabel(leadOfFactor[r.fid])} within ${f.label}, ${nInFactor[r.fid]} moved at rho ${f.rho.toFixed(2)}, weighted ${sf.toFixed(3)}x`,
      );
    }
    if (st < 1 && r.tid) {
      const t = THEME_BY_ID[r.tid];
      why.push(
        `${FACTOR_BY_ID[r.fid!].label} follows ${FACTOR_BY_ID[themeLead[r.tid]].label} within ${t.label}, weighted ${st.toFixed(3)}x`,
      );
    }
    terms.push({
      driver: r.v,
      label: varLabel(r.v),
      source: "var",
      shock: r.s,
      beta: r.b,
      mult,
      shrink,
      value: contribution,
      reasons: why,
    });
  }
  return { value, terms };
}

function sumSecondRound(
  sources: Record<string, number>,
  targetId: string,
  channel: Channel,
  ctx: { kind: AssetKind; regime: RegimeId; weight: number },
): { value: number; terms: Term[] } {
  let value = 0;
  const terms: Term[] = [];
  for (const link of SECOND_ROUND) {
    if (link.to !== targetId || link.channel !== channel) continue;
    const src = sources[link.from];
    if (src === undefined || src === 0) continue;
    const { m: rawM, reasons } = regimeMultiplier(ctx.regime, {
      assetId: targetId,
      kind: ctx.kind,
      channel,
    });
    // The source is an asset move, not a normalised variable shock, so it is
    // put on the same footing before saturation: ten percent of price, or fifty
    // basis points of yield, is one unit.
    const m = saturateMultiplier(rawM, link.unit === "bp" ? src / 50 : src / 10);
    if (Math.abs(m - rawM) > 5e-3) {
      reasons.push(`Regime adjustment fades from ${rawM.toFixed(2)}x to ${m.toFixed(2)}x at this size of source move`);
    }
    const mult = m * ctx.weight;
    const contribution = link.b * src * mult;
    value += contribution;
    terms.push({
      driver: link.from,
      label: ASSET_BY_ID[link.from]?.label ?? (link.from === "CURVE_2S10S" ? "UST 2s10s" : link.from),
      source: "asset",
      shock: src,
      beta: link.b,
      mult,
      value: contribution,
      reasons: [link.why, ...reasons],
    });
  }
  return { value, terms };
}

/** Third-tier collinearity correction. See CROSS_TIER_RHO in lib/vars.ts.
 *
 *  `varLeg` is what the user's variables say about this channel; `assetLeg` is
 *  what the already-priced assets say. When they agree they are one impulse
 *  observed twice, so the larger leads at full weight and the smaller is
 *  discounted. When they disagree both stand: an equity drawdown pushing a
 *  spread wider while a falling oil price pushes it tighter is a genuine
 *  offset, and netting it honestly is the point of modelling both. */
function mergeTiers(
  varLeg: { value: number; terms: Term[] },
  assetLeg: { value: number; terms: Term[] },
): { value: number; terms: Term[] } {
  const a = varLeg.value;
  const b = assetLeg.value;
  if (a === 0 || b === 0 || a * b < 0) {
    return { value: a + b, terms: [...varLeg.terms, ...assetLeg.terms] };
  }
  const follower = Math.abs(a) >= Math.abs(b) ? assetLeg : varLeg;
  const leader = follower === assetLeg ? varLeg : assetLeg;
  const k = crossTierShrink;
  const note =
    follower === assetLeg
      ? `Second-round move restates the same impulse the variables already price, weighted ${k.toFixed(3)}x`
      : `Variables restate the impulse the second-round move already prices, weighted ${k.toFixed(3)}x`;
  const scaled = follower.terms.map((t) => ({
    ...t,
    mult: t.mult * k,
    shrink: (t.shrink ?? 1) * k,
    value: t.value * k,
    reasons: [...t.reasons, note],
  }));
  return {
    value: leader.value + follower.value * k,
    terms: follower === assetLeg ? [...leader.terms, ...scaled] : [...scaled, ...leader.terms],
  };
}

function channelOf(
  channel: Channel,
  value: number,
  terms: Term[],
  pin?: { value: number; note: string },
): ChannelResult {
  if (pin) {
    return {
      channel,
      label: CHANNEL_LABEL[channel],
      value: pin.value,
      terms,
      pinned: true,
      pinNote: pin.note,
    };
  }
  return { channel, label: CHANNEL_LABEL[channel], value, terms, pinned: false };
}

function blank(a: Asset): AssetResult {
  return {
    id: a.id,
    label: a.label,
    group: a.group,
    sub: a.sub,
    kind: a.kind,
    parent: a.parent,
    channels: [],
    duration: a.duration,
    pricePct: 0,
    pinned: false,
  };
}

// Channel contributions are LOG responses; the printed return compounds them.
//
// Adding percent returns is only safe for small moves. Added straight, a stress
// scenario in which three channels each take 40% off an index prints -120%,
// which is not a bad outcome but an impossible one. Treating each channel as a
// continuously compounded response and exponentiating the sum keeps every
// contribution linear and separable in the derivation table, keeps the ORDER of
// the drivers intact, and makes -100% an asymptote no combination of shocks can
// cross. It is the same reason a bond's true reprice is convex: the linear
// duration approximation overstates the loss precisely where the loss is large.
function compound(logPct: number): number {
  return (Math.exp(logPct / 100) - 1) * 100;
}

/** Inverse, for folding a directly-set assumption into a sum of log responses. */
function toLog(pct: number): number {
  return 100 * Math.log(Math.max(0.01, 1 + pct / 100));
}

/** Compounds an asset's price channels. A pinned channel carries a simple return
 *  the user asserted, so it is converted before it joins the sum. */
function priceOf(channels: ChannelResult[]): number {
  let logSum = 0;
  for (const c of channels) logSum += c.pinned ? toLog(c.value) : c.value;
  return compound(logSum);
}

/** Price return implied by a yield move. The duration leg is the log response,
 *  so compounding it recovers most of what ignoring convexity would have cost. */
function priceFromYield(duration: number, yieldBp: number): number {
  return compound(-duration * (yieldBp / 100));
}

/**
 * `evalMonths` lets a caller ask "what did this scenario look like at month
 * u" for u short of the full horizon, by feeding `responseWeightAt` instead
 * of `responseWeight` — everything else about the sweep (regime detection,
 * betas, collinearity shrink, second-round links) is identical, because
 * those describe the SIZE of an already-arrived shock, not how much time it
 * has had to transmit. Omitted, this reproduces the original single-argument
 * `runScenario` exactly (tests/engine.test.ts checks the equivalence
 * directly). No caller passes it today; kept as engine-level infrastructure
 * for any future sub-horizon query.
 */
export function runScenario(input: ScenarioInput, evalMonths?: number): EngineResult {
  const { state, horizon, path, steps } = input;
  const regime = detectRegime(state, input.regimeOverride ?? null);
  const R = regime.active;

  const weights = {} as Record<Channel, number>;
  for (const c of ["rate", "spread", "multiple", "earnings", "riskPremium", "price"] as Channel[]) {
    weights[c] =
      evalMonths === undefined
        ? responseWeight(c, path, horizon, steps)
        : responseWeightAt(c, path, horizon, steps, evalMonths);
  }

  const out: Record<string, AssetResult> = {};
  for (const a of ASSETS) out[a.id] = blank(a);

  // Sources accumulate as the sweep proceeds. A second-round link can only read
  // a source that an EARLIER stage wrote, which is the acyclicity guarantee.
  const sources: Record<string, number> = {};

  // ---- 1. Treasury curve --------------------------------------------------
  for (const id of ["UST2Y", "UST5Y", "UST10Y", "UST30Y"]) {
    const a = ASSET_BY_ID[id];
    const { value, terms } = sumVarBetas(RATE_BETAS[id], state, {
      assetId: id,
      kind: "rate",
      channel: "rate",
      regime: R,
      weight: weights.rate,
    });
    const r = out[id];
    r.channels = [channelOf("rate", value, terms)];
    r.yieldBp = value;
    r.rateLegBp = value;
    r.pricePct = priceFromYield(a.duration ?? 0, value);
    sources[id] = value;
  }
  sources.CURVE_2S10S = (sources.UST10Y ?? 0) - (sources.UST2Y ?? 0);

  // ---- 2. Dollar ----------------------------------------------------------
  {
    const { value, terms } = sumVarBetas(DXY_BETAS, state, {
      assetId: "DXY",
      kind: "fx",
      channel: "price",
      regime: R,
      weight: weights.price,
    });
    const moved = rawMove(state, "dxy");
    const base = VAR_BY_ID.dxy.base;
    const pin = moved !== 0 ? { value: (moved / base) * 100, note: "Set directly as an assumption" } : undefined;
    const r = out.DXY;
    r.channels = [channelOf("price", value, terms, pin)];
    r.pinned = !!pin;
    r.pricePct = priceOf(r.channels);
    sources.DXY = r.pricePct;
  }

  // ---- 3. Commodities -----------------------------------------------------
  for (const id of ["WTI", "NATGAS", "GOLD", "COPPER", "IRON", "AGS"]) {
    const direct = sumVarBetas(COMMODITY_BETAS[id], state, {
      assetId: id,
      kind: "commodity",
      channel: "price",
      regime: R,
      weight: weights.price,
    });
    const second = sumSecondRound(sources, id, "price", {
      kind: "commodity",
      regime: R,
      weight: weights.price,
    });
    const r = out[id];
    const merged = mergeTiers(direct, second);
    r.channels = [channelOf("price", merged.value, merged.terms)];
    r.pricePct = priceOf(r.channels);
    sources[id] = r.pricePct;
  }
  for (const [id, def] of Object.entries(DERIVED_COMMODITY)) {
    const own = sumVarBetas(def.own, state, {
      assetId: id,
      kind: "commodity",
      channel: "price",
      regime: R,
      weight: weights.price,
    });
    const carried = (sources[def.from] ?? 0) * def.beta;
    const terms: Term[] = [
      {
        driver: def.from,
        label: ASSET_BY_ID[def.from]?.label ?? def.from,
        source: "asset",
        shock: sources[def.from] ?? 0,
        beta: def.beta,
        mult: 1,
        value: carried,
        reasons: ["Priced off the reference grade"],
      },
      ...own.terms,
    ];
    const r = out[id];
    r.channels = [channelOf("price", carried + own.value, terms)];
    r.pricePct = priceOf(r.channels);
    sources[id] = r.pricePct;
  }

  // ---- 4. FX pairs --------------------------------------------------------
  for (const [id, def] of Object.entries(FX_PAIRS)) {
    const own = sumVarBetas(def.own, state, {
      assetId: id,
      kind: "fx",
      channel: "price",
      regime: R,
      weight: weights.price,
    });
    const second = sumSecondRound(sources, id, "price", { kind: "fx", regime: R, weight: weights.price });
    const dollarLeg = (sources.DXY ?? 0) * def.dxyBeta;
    // As with the index beta below, the dollar leg is a decomposition rather
    // than a corroborating view, so it stands outside the shrinkage.
    const mergedFx = mergeTiers(own, second);
    const terms: Term[] = [
      {
        driver: "DXY",
        label: "DXY",
        source: "asset",
        shock: sources.DXY ?? 0,
        beta: def.dxyBeta,
        mult: 1,
        value: dollarLeg,
        reasons: ["Latent dollar factor, signed by the pair's quote convention"],
      },
      ...mergedFx.terms,
    ];
    const modelled = dollarLeg + mergedFx.value;
    const pinVar = ASSETS.find((a) => a.id === id) ? findPinVar(id) : undefined;
    let pin: { value: number; note: string } | undefined;
    if (pinVar) {
      const moved = rawMove(state, pinVar);
      if (moved !== 0) {
        pin = { value: (moved / VAR_BY_ID[pinVar].base) * 100, note: "Set directly as an assumption" };
      }
    }
    const r = out[id];
    r.channels = [channelOf("price", modelled, terms, pin)];
    r.pinned = !!pin;
    r.pricePct = priceOf(r.channels);
    sources[id] = r.pricePct;
  }

  // ---- 5. US Large Cap, decomposed ---------------------------------------
  {
    const ch = EQUITY_CHANNELS.SPX;
    const mult = sumVarBetas(ch.multiple, state, {
      assetId: "SPX",
      kind: "equity",
      channel: "multiple",
      regime: R,
      weight: weights.multiple,
    });
    const multSecond = sumSecondRound(sources, "SPX", "multiple", {
      kind: "equity",
      regime: R,
      weight: weights.multiple,
    });
    const peMove = rawMove(state, MULTIPLE_PIN_VAR);
    const pePin =
      peMove !== 0
        ? {
            value: (peMove / VAR_BY_ID[MULTIPLE_PIN_VAR].base) * 100,
            note: "Forward P/E set directly; modelled re-rating replaced",
          }
        : undefined;
    const earn = sumVarBetas(ch.earnings, state, {
      assetId: "SPX",
      kind: "equity",
      channel: "earnings",
      regime: R,
      weight: weights.earnings,
    });
    const rp = sumVarBetas(ch.riskPremium, state, {
      assetId: "SPX",
      kind: "equity",
      channel: "riskPremium",
      regime: R,
      weight: weights.riskPremium,
    });
    const r = out.SPX;
    r.channels = [
      (() => {
        const m = mergeTiers(mult, multSecond);
        return channelOf("multiple", m.value, m.terms, pePin);
      })(),
      channelOf("earnings", earn.value, earn.terms),
      channelOf("riskPremium", rp.value, rp.terms),
    ];
    r.pinned = !!pePin;
    r.pricePct = priceOf(r.channels);
    sources.SPX = r.pricePct;
  }

  // ---- 6. Derived equity (sleeves and sectors) ---------------------------
  for (const [id, def] of Object.entries(DERIVED_EQUITY)) {
    const own = sumVarBetas(def.own, state, {
      assetId: id,
      kind: "equity",
      channel: "price",
      regime: R,
      weight: weights.price,
    });
    const second = sumSecondRound(sources, id, "price", { kind: "equity", regime: R, weight: weights.price });
    const carried = (sources.SPX ?? 0) * def.beta;
    // The index beta is a decomposition, not a second opinion, so it is not a
    // candidate for cross-tier shrinkage; only the residual legs are.
    const merged = mergeTiers(own, second);
    const terms: Term[] = [
      {
        driver: "SPX",
        label: "US Large Cap",
        source: "asset",
        shock: sources.SPX ?? 0,
        beta: def.beta,
        mult: 1,
        value: carried,
        reasons: ["Index beta"],
      },
      ...merged.terms,
    ];
    const r = out[id];
    const total = carried + merged.value;
    r.channels = [channelOf("price", total, terms)];
    r.pricePct = priceOf(r.channels);
    sources[id] = r.pricePct;
  }

  // ---- 7. Credit ----------------------------------------------------------
  for (const id of ["MBS", "IG", "HY_BB", "HY_BCCC"]) {
    const a = ASSET_BY_ID[id];
    const direct = sumVarBetas(SPREAD_BETAS[id], state, {
      assetId: id,
      kind: "credit",
      channel: "spread",
      regime: R,
      weight: weights.spread,
    });
    const second = sumSecondRound(sources, id, "spread", {
      kind: "credit",
      regime: R,
      weight: weights.spread,
    });
    const pinVar = Object.entries(SPREAD_PINS).find(([, asset]) => asset === id)?.[0];
    let pin: { value: number; note: string } | undefined;
    if (pinVar) {
      const moved = rawMove(state, pinVar);
      if (moved !== 0) pin = { value: moved, note: "OAS set directly as an assumption" };
    }
    const merged = mergeTiers(direct, second);
    const spreadCh = channelOf("spread", merged.value, merged.terms, pin);

    const rateLegBp = (a.rateLegs ?? []).reduce((s, leg) => s + (sources[leg.asset] ?? 0) * leg.w, 0);
    const rateTerms: Term[] = (a.rateLegs ?? []).map((leg) => ({
      driver: leg.asset,
      label: ASSET_BY_ID[leg.asset]?.label ?? leg.asset,
      source: "asset" as const,
      shock: sources[leg.asset] ?? 0,
      beta: leg.w,
      mult: 1,
      value: (sources[leg.asset] ?? 0) * leg.w,
      reasons: ["Key-rate weight of the index"],
    }));

    const r = out[id];
    r.channels = [channelOf("rate", rateLegBp, rateTerms), spreadCh];
    r.pinned = !!pin;
    r.rateLegBp = rateLegBp;
    r.spreadBp = spreadCh.value;
    r.yieldBp = rateLegBp + spreadCh.value;
    r.pricePct = priceFromYield(a.duration ?? 0, r.yieldBp);
    sources[id] = r.yieldBp;
  }

  // ---- 8. Portfolios ------------------------------------------------------
  const notional = Number.isFinite(input.notional) && input.notional > 0 ? input.notional : DEFAULT_NOTIONAL;
  const portfolios = PORTFOLIOS.map((p) => buildPortfolio(p, out, notional));

  return { regime, assets: out, order: ASSETS.map((a) => a.id), portfolios, weights };
}

function findPinVar(assetId: string): string | undefined {
  for (const key of Object.keys(VAR_BY_ID)) {
    if (VAR_BY_ID[key].pinsAsset === assetId) return key;
  }
  return undefined;
}

function buildPortfolio(p: Portfolio, assets: Record<string, AssetResult>, notional: number): PortfolioResult {
  const lines: PortfolioLine[] = [];
  let equityPct = 0;
  let bondPct = 0;
  for (const { asset, w } of portfolioWeights(p)) {
    const a = assets[asset];
    if (!a) continue;
    const contribPct = (w / 100) * a.pricePct;
    if (a.group === "Equities") equityPct += contribPct;
    else bondPct += contribPct;
    lines.push({ asset, label: a.label, w, pricePct: a.pricePct, contribPct });
  }
  const pct = equityPct + bondPct;
  return { id: p.id, label: p.label, pct, dollars: (pct / 100) * notional, equityPct, bondPct, lines };
}

// ---------------------------------------------------------------------------
// Sensitivity. A tornado bar is the portfolio impact WITH the variable minus the
// impact with that variable alone reset to baseline — a leave-one-out
// contribution, not a re-run of the variable in isolation.
//
// The distinction is the whole value of the chart in a non-linear model. Run in
// isolation, every variable is measured in the baseline regime; left out, each
// is measured in the regime the full scenario actually produced. A shock that
// only bites because the scenario has already tipped into financial stress shows
// its true weight one way and almost none the other.
// ---------------------------------------------------------------------------
export interface SensitivityBar {
  varId: string;
  label: string;
  /** Percentage points of portfolio impact attributable to this variable. */
  delta: number;
  rawMove: number;
  unit: string;
}

export function sensitivity(input: ScenarioInput, portfolioId: string): SensitivityBar[] {
  const full = runScenario(input);
  const base = full.portfolios.find((x) => x.id === portfolioId)?.pct ?? 0;
  const bars: SensitivityBar[] = [];
  for (const [id, v] of Object.entries(VAR_BY_ID)) {
    const move = rawMove(input.state, id);
    if (Math.abs(move) < 1e-9) continue;
    const without = { ...input.state, [id]: v.base };
    const r = runScenario({ ...input, state: without });
    const pct = r.portfolios.find((x) => x.id === portfolioId)?.pct ?? 0;
    bars.push({ varId: id, label: v.label, delta: base - pct, rawMove: move, unit: v.unit });
  }
  return bars.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

export interface HeatCell {
  x: number;
  y: number;
  pct: number;
}

export interface HeatGrid {
  xVar: string;
  yVar: string;
  xs: number[];
  ys: number[];
  cells: HeatCell[];
  min: number;
  max: number;
}

/** Smallest "nice" round step (1/2/2.5/5 × 10^k) at or above a rough target —
 *  the standard tick-generation trick (Heckbert's "nice numbers") so an axis
 *  snaps to steps a trader actually expects (Fed Funds at 1.00% or 0.50%
 *  increments, not an arbitrary evenly-divided fraction like 1.17). */
function niceStep(roughStep: number): number {
  if (!Number.isFinite(roughStep) || roughStep <= 0) return 1;
  const exp = Math.floor(Math.log10(roughStep));
  const base = Math.pow(10, exp);
  const frac = roughStep / base;
  const niceFracs = [1, 2, 2.5, 5, 10];
  const niceFrac = niceFracs.find((nf) => frac <= nf) ?? 10;
  return niceFrac * base;
}

/** Two-variable surface over the portfolio return. Grid is odd-sized so the
 *  current setting sits exactly on the centre cell rather than between two. */
export function heatGrid(
  input: ScenarioInput,
  portfolioId: string,
  xVar: string,
  yVar: string,
  n = 7,
): HeatGrid {
  const vx = VAR_BY_ID[xVar];
  const vy = VAR_BY_ID[yVar];
  const size = n % 2 === 0 ? n + 1 : n;
  // Range is sized to fit inside [min, max] BEFORE spacing points, not after —
  // clamping each point individually (the previous approach) collapses the
  // top end of the axis to a repeated boundary value whenever `current` sits
  // closer to one bound than 4 norm units, which is exactly the case for a
  // variable already pushed toward its limit in an extreme scenario.
  //
  // Ticks are then snapped to a nice round step, not spaced by evenly
  // dividing that raw window — an even division prints ticks like
  // 0.00/1.17/2.33/3.50 for Fed Funds Target, which is not how anyone reads
  // a policy-rate grid. The window shifts (not clamps per-point) to stay
  // inside [min, max] once snapped, which keeps every tick a clean multiple
  // of `step` instead of collapsing boundary ticks onto a repeated value.
  const axis = (v: typeof vx, current: number) => {
    const rawLo = Math.max(v.min, current - 4 * v.norm);
    const rawHi = Math.min(v.max, current + 4 * v.norm);
    const totalRange = Math.max(v.max - v.min, 1e-9);
    let step = niceStep((rawHi - rawLo) / (size - 1));
    for (let i = 0; i < 12 && step * (size - 1) > totalRange; i++) {
      step = niceStep(step / 2);
    }
    if (step * (size - 1) > totalRange) step = totalRange / (size - 1);

    let lo = Math.floor(rawLo / step) * step;
    let hi = lo + step * (size - 1);
    if (hi > v.max) {
      lo -= hi - v.max;
      hi = v.max;
    }
    if (lo < v.min) {
      hi += v.min - lo;
      lo = v.min;
    }
    const out: number[] = [];
    for (let i = 0; i < size; i++) out.push(+(lo + i * step).toFixed(6));
    return out;
  };
  const xs = axis(vx, input.state[xVar] ?? vx.base);
  const ys = axis(vy, input.state[yVar] ?? vy.base);
  const cells: HeatCell[] = [];
  let min = Infinity;
  let max = -Infinity;
  for (const y of ys) {
    for (const x of xs) {
      const st = { ...input.state, [xVar]: x, [yVar]: y };
      const r = runScenario({ ...input, state: st });
      const pct = r.portfolios.find((p) => p.id === portfolioId)?.pct ?? 0;
      cells.push({ x, y, pct });
      if (pct < min) min = pct;
      if (pct > max) max = pct;
    }
  }
  return { xVar, yVar, xs, ys, cells, min, max };
}

/** Same scenario priced at all four horizons, for the term-structure strip. */
export function horizonLadder(input: ScenarioInput, portfolioId: string): Array<{ horizon: Horizon; pct: number }> {
  return HORIZONS.map((h) => {
    const r = runScenario({ ...input, horizon: h });
    return { horizon: h, pct: r.portfolios.find((p) => p.id === portfolioId)?.pct ?? 0 };
  });
}

// ---------------------------------------------------------------------------
// Factor attribution: which macro category actually drove a portfolio's P&L.
//
// This is a PROPORTIONAL DECOMPOSITION of the exact number already on
// screen, not a separate estimate — it introduces no new coefficients or
// data. It relies on an invariant that already holds everywhere in this
// file: every ChannelResult's `value` equals the sum of its own `terms[].value`
// (both sumVarBetas and mergeTiers are built to preserve this; see their own
// comments). That means an asset's channels can be split into log-value
// shares that sum to exactly 1, and each channel's terms can be split into
// value shares that also sum to exactly 1 — so multiplying the asset's ACTUAL
// (already-compounded) pricePct through those shares, then weighting by
// portfolio allocation, always sums back to exactly the portfolio's own pct.
// A pinned channel has no terms to attribute (the modelled decomposition was
// discarded in favour of the user's direct assumption — see priceOf), so its
// whole share is booked to "Direct Assumptions" rather than invented.
// ---------------------------------------------------------------------------
export interface FactorContribution {
  id: string;
  label: string;
  /** Percentage points of the selected portfolio's return attributed to this category. */
  contribPct: number;
}

const VAR_GROUP_LABEL: Record<VarGroupId, string> = Object.fromEntries(
  VAR_GROUPS.map((g) => [g.id, g.label]),
) as Record<VarGroupId, string>;

const ASSET_DRIVER_CATEGORY: Record<string, string> = {
  Bonds: "Rates (priced assets)",
  Equities: "Equities (priced assets)",
  Commodities: "Commodities (priced assets)",
  FX: "FX (priced assets)",
};

const CROSS_ASSET_LABEL = "Cross-asset propagation";
const ASSUMPTION_LABEL = "Direct assumptions";

/** Which bucket a single term's driver belongs to. A term driven by a
 *  variable goes to that variable's input group; a term driven by an
 *  already-priced asset (a second-round link, an index beta, a key-rate
 *  leg) goes to that asset's own class, since first-order attribution one
 *  hop back is what stays auditable — re-deriving the ultimate variable
 *  behind an already-priced asset would double-count against that asset's
 *  own attribution elsewhere in the same portfolio. */
function categoryOfTerm(t: Term): { id: string; label: string } {
  if (t.source === "var") {
    const g = VAR_BY_ID[t.driver]?.group;
    if (g) return { id: g, label: VAR_GROUP_LABEL[g] };
  }
  if (t.driver === "CURVE_2S10S") return { id: "assetBonds", label: ASSET_DRIVER_CATEGORY.Bonds };
  const a = ASSET_BY_ID[t.driver];
  if (a) return { id: `asset${a.group}`, label: ASSET_DRIVER_CATEGORY[a.group] ?? CROSS_ASSET_LABEL };
  return { id: "crossAsset", label: CROSS_ASSET_LABEL };
}

export function factorAttribution(r: EngineResult, portfolioId: string): FactorContribution[] {
  const port = r.portfolios.find((p) => p.id === portfolioId);
  if (!port) return [];
  const totals: Record<string, { label: string; v: number }> = {};
  const add = (id: string, label: string, v: number) => {
    const cur = totals[id];
    totals[id] = { label, v: (cur?.v ?? 0) + v };
  };

  for (const line of port.lines) {
    const asset = r.assets[line.asset];
    if (!asset || Math.abs(asset.pricePct) < 1e-9 || asset.channels.length === 0) continue;
    const w = line.w / 100;
    if (Math.abs(w) < 1e-9) continue;

    const channelLogVals = asset.channels.map((c) => (c.pinned ? toLog(c.value) : c.value));
    const totalLog = channelLogVals.reduce((s, v) => s + v, 0);
    if (Math.abs(totalLog) < 1e-9) continue;

    asset.channels.forEach((c, ci) => {
      const chShareOfAsset = channelLogVals[ci] / totalLog;
      const chContribPct = asset.pricePct * chShareOfAsset * w;
      if (Math.abs(chContribPct) < 1e-9) return;

      if (c.pinned) {
        add("assumption", ASSUMPTION_LABEL, chContribPct);
        return;
      }
      const termTotal = c.terms.reduce((s, t) => s + t.value, 0);
      if (Math.abs(termTotal) < 1e-9) {
        add("crossAsset", CROSS_ASSET_LABEL, chContribPct);
        return;
      }
      for (const t of c.terms) {
        const cat = categoryOfTerm(t);
        add(cat.id, cat.label, chContribPct * (t.value / termTotal));
      }
    });
  }

  return Object.entries(totals)
    .filter(([, { v }]) => Math.abs(v) > 1e-6)
    .map(([id, { label, v }]) => ({ id, label, contribPct: v }))
    .sort((a, b) => Math.abs(b.contribPct) - Math.abs(a.contribPct));
}
