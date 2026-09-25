import type { Channel } from "./regimes";

// Two different things are called "time" in a scenario, and conflating them is
// the usual way a horizon control ends up doing nothing.
//
//   PATH       how the SHOCK arrives. A 100bp hike delivered on day one and the
//              same 100bp phased over a year are different assumptions about the
//              input, not different presentations of one.
//   RESPONSE   how fast the MARKET finishes reacting to a shock it has already
//              received, and how much of that reaction survives. The front end
//              reprices a hike in an afternoon; earnings estimates take three
//              quarters to admit it; a risk premium gives most of it back.
//
// The engine convolves them. An increment of shock delivered at month s has had
// only (T - s) months to transmit by the horizon T, so a linear path into a
// slow channel lands materially smaller than an immediate one — which is the
// honest answer and is not reproducible by multiplying two scalars.

export type PathShape = "immediate" | "linear" | "scurve" | "meanRevert" | "staged";
export type Horizon = 3 | 6 | 12 | 24;

export interface PathDef {
  id: PathShape;
  label: string;
  /** One line, shown next to the control. Not a paragraph. */
  gist: string;
  /** t in [0,1] -> fraction of the terminal shock delivered. */
  f: (t: number) => number;
}

export const PATHS: PathDef[] = [
  { id: "immediate", label: "Immediate", gist: "Full shock at t=0, held", f: () => 1 },
  { id: "linear", label: "Linear", gist: "Even delivery to terminal", f: (t) => t },
  {
    id: "scurve",
    label: "S-Curve",
    gist: "Slow start, fast middle, tapering finish",
    // Logistic centred at the midpoint, rescaled so f(0)=0 and f(1)=1 exactly.
    // Without the rescale the curve starts at 0.018 and ends at 0.982, which
    // quietly shaves 2% off every terminal number in the app.
    f: (t) => {
      const k = 8;
      const raw = (x: number) => 1 / (1 + Math.exp(-k * (x - 0.5)));
      const lo = raw(0);
      const hi = raw(1);
      return (raw(t) - lo) / (hi - lo);
    },
  },
  {
    id: "meanRevert",
    label: "Mean Reverting",
    gist: "Overshoots to 1.35x near 35%, settles at 0.55x",
    // Peaks early and decays. Terminal is deliberately NOT 1: the point of this
    // shape is that the shock does not fully stick, and a path that ends where
    // `linear` ends is just a slower linear.
    f: (t) => {
      const peak = 0.35;
      if (t <= peak) return (t / peak) * 1.35;
      const u = (t - peak) / (1 - peak);
      return 1.35 - ((1.35 - 0.55) * (1 - Math.exp(-3 * u))) / (1 - Math.exp(-3));
    },
  },
  {
    id: "staged",
    label: "Staged",
    gist: "Three discrete steps at 25% / 55% / 85% of horizon",
    f: (t) => (t < 0.25 ? 0 : t < 0.55 ? 1 / 3 : t < 0.85 ? 2 / 3 : 1),
  },
];

export const PATH_BY_ID: Record<PathShape, PathDef> = Object.fromEntries(
  PATHS.map((p) => [p.id, p]),
) as Record<PathShape, PathDef>;

export const HORIZONS: Horizon[] = [3, 6, 12, 24];
export const HORIZON_LABEL: Record<Horizon, string> = { 3: "3M", 6: "6M", 12: "1Y", 24: "2Y" };
export const STEP_CHOICES = [4, 6, 8, 12] as const;

/**
 * Transmission time constant, in months: the channel's response to an
 * instantaneous shock completes as 1 - exp(-u/TAU).
 *
 * The earnings row is the one that changes conclusions. Estimates move on a
 * quarterly reporting cadence, so under half of an earnings shock is in
 * consensus at three months — which is exactly why a recession looks survivable
 * at 3M and does not at 1Y, and why a model that transmits every channel
 * instantly gets the SHAPE of a downturn wrong even when it gets the size right.
 */
export const TAU: Record<Channel, number> = {
  rate: 0.5,
  spread: 1.0,
  price: 2.0,
  multiple: 1.2,
  earnings: 6.0,
  riskPremium: 0.7,
};

/**
 * Reversion time constant, in months: the surviving fraction of a completed
 * response decays as exp(-u/LAMBDA).
 *
 * Every elasticity in this app is a short-to-medium-horizon regularity, and
 * quoting one at two years as though it held with full force is the most common
 * way a stress model overstates a tail — policy responds, positioning resets,
 * capital reallocates. Risk premium reverts hardest and fastest, which is why a
 * 2Y panic scenario should not print the same equity number as a 3M one.
 */
export const LAMBDA: Record<Channel, number> = {
  rate: 120,
  spread: 90,
  price: 96,
  multiple: 96,
  earnings: 240,
  riskPremium: 20,
};

/** Fraction of a channel's terminal elasticity live u months after a shock lands. */
export function responseKernel(channel: Channel, u: number): number {
  if (u <= 0) return 0;
  return (1 - Math.exp(-u / TAU[channel])) * Math.exp(-u / LAMBDA[channel]);
}

export interface PathPoint {
  /** Months from t=0. */
  month: number;
  /** Fraction of the terminal shock delivered by this point. */
  frac: number;
}

/** Sampled path for the chart and the step table. Always includes t=0 and t=1. */
export function samplePath(shape: PathShape, horizon: Horizon, steps: number): PathPoint[] {
  const f = PATH_BY_ID[shape].f;
  const n = clampSteps(steps);
  const out: PathPoint[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    out.push({ month: +(t * horizon).toFixed(2), frac: +f(t).toFixed(4) });
  }
  return out;
}

export function clampSteps(steps: number): number {
  if (!Number.isFinite(steps)) return 8;
  return Math.max(2, Math.min(24, Math.round(steps)));
}

/**
 * The convolution. Each increment of shock delivered between two sample points
 * is credited at the midpoint of that interval and given (T - s) months to
 * transmit; the sum is the multiplier applied to every elasticity in the
 * channel.
 *
 * The midpoint rather than the interval start is not a rounding detail: crediting
 * at the start hands every increment extra transmission time it has not had, and
 * with 4 steps over a 3-month horizon that is a 12% overstatement of a fast
 * channel. The step count is a display control everywhere else in this app; here
 * it is a quadrature resolution, so it must not change the answer much, and
 * midpoint is what keeps it from doing so.
 */
export function responseWeight(
  channel: Channel,
  shape: PathShape,
  horizon: Horizon,
  steps: number,
): number {
  const f = PATH_BY_ID[shape].f;
  const n = clampSteps(steps);
  let w = 0;
  for (let i = 1; i <= n; i++) {
    const t0 = (i - 1) / n;
    const t1 = i / n;
    const df = f(t1) - f(t0);
    if (df === 0) continue;
    const sMid = ((t0 + t1) / 2) * horizon;
    w += df * responseKernel(channel, horizon - sMid);
  }
  // `immediate` delivers everything at t=0, which the loop above sees as a jump
  // in the first interval rather than as a level at the origin. Crediting it at
  // the interval midpoint would shave the first fraction of the horizon off the
  // one path whose defining property is that the shock is already there.
  if (shape === "immediate") return responseKernel(channel, horizon);
  return w;
}

/**
 * Generalises `responseWeight` to an evaluation point BEFORE the terminal
 * horizon, for sampling the path a scenario actually takes rather than only
 * its endpoint (see `runScenario`'s `evalMonths` parameter in engine.ts).
 *
 * The shock's own delivery schedule is unchanged — `f` is still evaluated
 * against the FULL horizon, so a "Staged" path's steps land at the same
 * months regardless of where we stop looking. What changes is how much
 * transmission time each already-delivered increment has had: instead of
 * `horizon - sMid` (time to the terminal horizon), it is `evalMonths - sMid`
 * (time to this earlier point). `responseKernel` already returns 0 for a
 * non-positive argument, so an increment that has not landed yet by
 * `evalMonths` contributes nothing, with no separate branch needed for it.
 *
 * `responseWeight(channel, shape, horizon, steps)` is exactly
 * `responseWeightAt(channel, shape, horizon, steps, horizon)` — asserted in
 * tests/engine.test.ts so the two cannot silently drift apart.
 */
export function responseWeightAt(
  channel: Channel,
  shape: PathShape,
  horizon: number,
  steps: number,
  evalMonths: number,
): number {
  const f = PATH_BY_ID[shape].f;
  const n = clampSteps(steps);
  let w = 0;
  for (let i = 1; i <= n; i++) {
    const t0 = (i - 1) / n;
    const t1 = i / n;
    const df = f(t1) - f(t0);
    if (df === 0) continue;
    const sMid = ((t0 + t1) / 2) * horizon;
    w += df * responseKernel(channel, evalMonths - sMid);
  }
  if (shape === "immediate") return responseKernel(channel, evalMonths);
  return w;
}
