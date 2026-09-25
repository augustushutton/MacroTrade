import { runScenario, type ScenarioInput } from "./engine";
import { movedVars, rawMove } from "./vars";

// Scenario-uncertainty VaR/CVaR via Monte Carlo.
//
// PnlTab deliberately omits VaR/Sharpe: "the engine has no covariance model,
// so neither figure would be backed by a real computation" (see PnlTab.tsx).
// That principle is respected here, not overridden — this is a DIFFERENT
// question from the one PnlTab declined to answer. PnlTab was asked for the
// portfolio's real-world statistical risk, which this app has no historical
// return series to estimate (this sandbox also has no live market-data
// access — see the repo notes on FRED being network-policy-blocked here).
// What follows instead asks: "given how precisely the SCENARIO's own inputs
// are known, how much does that uncertainty alone move the portfolio
// outcome?" — a sensitivity measure, computed by actually re-running the
// real deterministic engine under repeated random perturbations of the
// scenario's own assumptions, not a number asserted from an unfitted model.
// It is not a substitute for a real covariance-based VaR and is labelled
// throughout as scenario/parameter uncertainty, never as "portfolio risk".
//
// The noise model is deliberately simple and stated up front rather than
// hidden inside a black-box percentage: each variable the user moved from
// baseline gets independent multiplicative Gaussian noise on the SIZE of its
// own move (a variable set at +100bp is treated as if it could plausibly
// have been set anywhere near +100bp x (1 +/- noisePct) at one standard
// deviation), clamped to the variable's own valid range. Variables within
// the same collinearity factor are not given correlated noise — that would
// need an estimated covariance matrix between the noise terms themselves,
// which does not exist any more than a return-covariance matrix does — so
// this systematically UNDERSTATES the true dispersion a fully joint
// treatment would show. That is disclosed in the UI, not smoothed over.

/** Deterministic PRNG (mulberry32) so a run is exactly reproducible given the
 *  same seed — required for tests, and so re-opening this panel does not
 *  silently show a different VaR each time for the same inputs. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal draw via Box-Muller. */
function gaussian(rand: () => number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export interface MonteCarloOptions {
  /** Number of engine re-runs. Clamped to [100, 4000] — enough for a stable
   *  5th percentile without making the tab noticeably slow to open. */
  runs?: number;
  /** One-sigma relative (multiplicative) noise on each moved variable's own
   *  shock size. 0.25 = ±25% at one standard deviation. Clamped to [0, 2]. */
  noisePct?: number;
  seed?: number;
}

export interface MonteCarloResult {
  runs: number;
  noisePct: number;
  /** Ascending portfolio-return outcomes, in percentage points. */
  outcomes: number[];
  mean: number;
  stdev: number;
  /** The return such that only 5%/1% of simulated outcomes were worse.
   *  Reported as an actual return (negative = a loss), consistent with
   *  every other pct figure in this app — not flipped to a positive
   *  "amount at risk". */
  var95: number;
  var99: number;
  /** Conditional VaR / Expected Shortfall: the average of the worst 5%/1%. */
  cvar95: number;
  cvar99: number;
}

export function monteCarloVaR(
  input: ScenarioInput,
  portfolioId: string,
  opts: MonteCarloOptions = {},
): MonteCarloResult {
  const runs = Math.max(100, Math.min(4000, Math.round(opts.runs ?? 1000)));
  const noisePct = Math.max(0, Math.min(2, opts.noisePct ?? 0.25));
  const seed = opts.seed ?? 20240501;
  const rand = mulberry32(seed);
  const moved = movedVars(input.state);

  const outcomes: number[] = new Array(runs);
  for (let i = 0; i < runs; i++) {
    const st = { ...input.state };
    for (const v of moved) {
      const raw = rawMove(input.state, v.id);
      const perturbedRaw = raw * (1 + noisePct * gaussian(rand));
      st[v.id] = Math.max(v.min, Math.min(v.max, v.base + perturbedRaw));
    }
    const r = runScenario({ ...input, state: st });
    outcomes[i] = r.portfolios.find((p) => p.id === portfolioId)?.pct ?? 0;
  }
  outcomes.sort((a, b) => a - b);

  const mean = outcomes.reduce((s, x) => s + x, 0) / outcomes.length;
  const variance = outcomes.reduce((s, x) => s + (x - mean) ** 2, 0) / outcomes.length;
  const stdev = Math.sqrt(variance);

  const percentile = (p: number) => outcomes[Math.min(outcomes.length - 1, Math.max(0, Math.floor(p * outcomes.length)))];
  const tailAverage = (p: number) => {
    const n = Math.max(1, Math.floor(p * outcomes.length));
    let s = 0;
    for (let i = 0; i < n; i++) s += outcomes[i];
    return s / n;
  };

  return {
    runs,
    noisePct,
    outcomes,
    mean,
    stdev,
    var95: percentile(0.05),
    var99: percentile(0.01),
    cvar95: tailAverage(0.05),
    cvar99: tailAverage(0.01),
  };
}
