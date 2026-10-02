"use client";

import { VAR_BY_ID, type VarState } from "@/lib/vars";
import type { AssetResult } from "@/lib/engine";
import { fmtBp, fmtPct, signColor } from "@/lib/format";
import { CHART_PAD_LEFT, CHART_PAD_RIGHT, CHART_W, xOf } from "@/lib/curveChart";
import { Panel, Tooltip } from "./ui";

// The nominal curve above is only half the picture a rates desk actually
// trades: TIPS break down every nominal yield into a real yield plus
// compensation for expected inflation, and the SLOPE of each of those two
// pieces carries information the nominal number alone hides (two curves can
// show the same nominal 5s10s steepness for opposite reasons — rising real
// growth expectations vs. rising inflation expectations — and a desk cares
// which).
//
// This app has no TIPS assets and no 2Y/30Y breakevens, so rather than
// inventing tenors the model doesn't price, this panel sticks to the two
// maturities it actually has inputs for — 5Y and 10Y (be5y, be10y in
// Inflation & Expectations) — and derives the real yield at each from the
// textbook identity every rates desk itself uses: real yield = nominal
// yield − breakeven. At 10Y that identity is exact by construction (see
// vars.ts's comment on realRate10y); at 5Y it is the standard market
// definition of an "implied" real yield where no real-rate input exists
// directly. Nothing here is a new assumption — it's the same two numbers
// already sitting in Inflation & Expectations and the nominal curve above,
// recombined the way a TIPS desk reads them.
//
// Entirely read-only: be5y/be10y/realRate10y are ordinary VarForm variables
// (not curve-only pins), so VarForm above is their one editor — this panel
// only displays what they imply, the same division of labour the nominal
// chart keeps with the curve-only pin variables.

const TENORS = [5, 10] as const;

const W = CHART_W;
const H = 170;
const PAD = { left: CHART_PAD_LEFT, right: CHART_PAD_RIGHT, top: 18, bottom: 26 };
const PLOT_H = H - PAD.top - PAD.bottom;

export default function RealYieldPanel({ state, assets }: { state: VarState; assets: Record<string, AssetResult> }) {
  const be5Base = VAR_BY_ID.be5y.base;
  const be10Base = VAR_BY_ID.be10y.base;
  const be5Now = state.be5y ?? be5Base;
  const be10Now = state.be10y ?? be10Base;

  // Nominal yields come from the live engine result (assets[...].yieldBp is
  // the shock vs base, in bp — see YieldCurveChart's own comment on why
  // reading it this way keeps every chart in the app agreeing on the same
  // number for the same tenor), not recomputed locally.
  const nom5Base = VAR_BY_ID.ust5yYield.base;
  const nom10Base = VAR_BY_ID.ust10yYield.base;
  const nom5Now = nom5Base + (assets.UST5Y?.yieldBp ?? 0) / 100;
  const nom10Now = nom10Base + (assets.UST10Y?.yieldBp ?? 0) / 100;

  const real5Base = nom5Base - be5Base;
  const real10Base = nom10Base - be10Base;
  const real5Now = nom5Now - be5Now;
  const real10Now = nom10Now - be10Now;

  const realRate10Input = state.realRate10y ?? VAR_BY_ID.realRate10y.base;

  const steepBaseBp = (be10Base - be5Base) * 100;
  const steepNowBp = (be10Now - be5Now) * 100;
  const impliedBaseBp = real10Base * 100;
  const impliedNowBp = real10Now * 100;
  // How far the 10Y real yield implied by nominal-minus-breakeven has
  // drifted from the direct "10y Real Rate" input. Zero whenever the
  // scenario only ever moves the curve through realRate10y/be10y/be5y
  // themselves; nonzero the moment something else — Fed Funds, a Treasury
  // pin on the chart above, any of the other Treasury betas — pushes the
  // nominal yield somewhere the real-rate-plus-breakeven identity no longer
  // explains on its own. That gap is itself a real signal: it's exactly the
  // "what's priced in beyond growth and inflation" residual a rates desk
  // calls term premium.
  const divergenceBp = (real10Now - realRate10Input) * 100;

  const allY = [be5Base, be10Base, be5Now, be10Now, real5Base, real10Base, real5Now, real10Now];
  const TICK = 0.5;
  const yMin = Math.floor((Math.min(...allY) - 0.3) / TICK) * TICK;
  const yMax = Math.ceil((Math.max(...allY) + 0.3) / TICK) * TICK;
  const ticks: number[] = [];
  for (let t = yMin; t <= yMax + 1e-9; t += TICK) ticks.push(Math.round(t * 100) / 100);

  function yOf(v: number): number {
    return PAD.top + (1 - (v - yMin) / (yMax - yMin)) * PLOT_H;
  }

  const beBasePts = TENORS.map((t) => `${xOf(t)},${yOf(t === 5 ? be5Base : be10Base)}`).join(" ");
  const beNowPts = TENORS.map((t) => `${xOf(t)},${yOf(t === 5 ? be5Now : be10Now)}`).join(" ");
  const realBasePts = TENORS.map((t) => `${xOf(t)},${yOf(t === 5 ? real5Base : real10Base)}`).join(" ");
  const realNowPts = TENORS.map((t) => `${xOf(t)},${yOf(t === 5 ? real5Now : real10Now)}`).join(" ");

  return (
    <Panel
      title="Real Rates & Breakevens"
      right={
        <span className="text-th normal-case tracking-normal text-term-muted">
          Derived from Inflation &amp; Expectations above — not draggable here
        </span>
      }
    >
      <div className="grid grid-cols-3 border-b border-term-edge">
        <Tooltip
          content="Steepness of the breakeven-inflation curve itself: 10Y breakeven minus 5Y. A desk reads this as the market's view on whether today's inflation impulse is near-term or persistent — not the same question as the nominal 5s10s above."
          className="flex min-w-0 flex-col border-r border-term-edge px-2 py-1.5"
        >
          <div className="w-full">
            <div className="truncate text-th uppercase tracking-wide text-term-muted">5s10s BE Steepness</div>
            <div className="font-mono tnum text-[13px] font-semibold text-term-text">{fmtBp(steepNowBp)}</div>
            {Math.abs(steepNowBp - steepBaseBp) > 0.5 ? (
              <div className={`font-mono tnum text-th ${signColor(steepNowBp - steepBaseBp, 0.5)}`}>
                {fmtBp(steepNowBp - steepBaseBp)} vs base
              </div>
            ) : (
              <div className="text-th text-term-edge">unchanged</div>
            )}
          </div>
        </Tooltip>
        <Tooltip
          content="Nominal 10Y yield minus 10Y breakeven — the TIPS-equivalent real yield a rates desk would actually see quoted, computed the same way the market computes it rather than read off a single input."
          className="flex min-w-0 flex-col border-r border-term-edge px-2 py-1.5"
        >
          <div className="w-full">
            <div className="truncate text-th uppercase tracking-wide text-term-muted">10Y Real Yield (Implied)</div>
            <div className="font-mono tnum text-[13px] font-semibold text-term-text">{fmtPct(real10Now)}</div>
            {Math.abs(impliedNowBp - impliedBaseBp) > 0.5 ? (
              <div className={`font-mono tnum text-th ${signColor(impliedNowBp - impliedBaseBp, 0.5)}`}>
                {fmtBp(impliedNowBp - impliedBaseBp)} vs base
              </div>
            ) : (
              <div className="text-th text-term-edge">unchanged</div>
            )}
          </div>
        </Tooltip>
        <Tooltip
          content="Implied 10Y real yield (nominal minus breakeven) minus the direct 10y Real Rate input above. Zero whenever the scenario only moves through realRate10y/be10y/be5y; any gap is the rest of the curve's betas — Fed Funds, a pin on the chart above, anything else — pricing something the real-rate-plus-breakeven identity alone doesn't explain. That residual is what a desk calls term premium."
          className="flex min-w-0 flex-col px-2 py-1.5"
        >
          <div className="w-full">
            <div className="truncate text-th uppercase tracking-wide text-term-muted">Implied vs Input Gap</div>
            <div className={`font-mono tnum text-[13px] font-semibold ${Math.abs(divergenceBp) > 0.5 ? signColor(divergenceBp, 0.5) : "text-term-text"}`}>
              {fmtBp(divergenceBp)}
            </div>
            <div className="text-th text-term-edge">term premium / other betas</div>
          </div>
        </Tooltip>
      </div>

      <div className="p-2">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full select-none"
          style={{ height: H }}
          role="img"
          aria-label="5Y and 10Y breakeven inflation and implied real yield, current vs base"
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={yOf(t)} y2={yOf(t)} className="stroke-term-line" strokeWidth={1} />
              <text x={PAD.left - 8} y={yOf(t)} fontSize={10} textAnchor="end" dominantBaseline="middle" className="fill-term-muted font-mono tnum">
                {t.toFixed(2)}%
              </text>
            </g>
          ))}
          <line x1={PAD.left} x2={PAD.left} y1={PAD.top} y2={H - PAD.bottom} className="stroke-term-edge" strokeWidth={1.25} />
          <line x1={PAD.left} x2={W - PAD.right} y1={H - PAD.bottom} y2={H - PAD.bottom} className="stroke-term-edge" strokeWidth={1.25} />

          {/* Breakeven curve: the muted reference series, same tone as every
              other "base/secondary" line on these charts. */}
          <polyline points={beBasePts} fill="none" className="stroke-term-sub" strokeWidth={1.25} strokeDasharray="5 4" />
          <polyline points={beNowPts} fill="none" className="stroke-term-sub" strokeWidth={1.5} />

          {/* Implied real yield: the primary series, same visual weight the
              nominal curve above gives its own current line. */}
          <polyline points={realBasePts} fill="none" className="stroke-term-edge" strokeWidth={1.25} strokeDasharray="5 4" />
          <polyline points={realNowPts} fill="none" className="stroke-term-text" strokeWidth={1.5} />

          {TENORS.map((t) => {
            const x = xOf(t);
            const beY = yOf(t === 5 ? be5Now : be10Now);
            const realY = yOf(t === 5 ? real5Now : real10Now);
            const isLast = t === TENORS[TENORS.length - 1];
            const anchor = isLast ? "end" : "start";
            const lx = isLast ? x - 6 : x + 6;
            return (
              <g key={t}>
                <rect x={x - 3} y={beY - 3} width={6} height={6} className="fill-term-panel stroke-term-sub" strokeWidth={1.25} />
                <text x={lx} y={beY - 8} fontSize={10} textAnchor={anchor} className="fill-term-sub font-mono tnum">
                  {(t === 5 ? be5Now : be10Now).toFixed(2)}%
                </text>
                <rect x={x - 3.5} y={realY - 3.5} width={7} height={7} className="fill-term-text stroke-term-edge" strokeWidth={1.25} />
                <text x={lx} y={realY + 16} fontSize={10} fontWeight={600} textAnchor={anchor} className="fill-term-text font-mono tnum">
                  {(t === 5 ? real5Now : real10Now).toFixed(2)}%
                </text>
                <text x={x} y={H - PAD.bottom + 18} fontSize={11} textAnchor="middle" className="fill-term-sub font-mono">
                  {t}Y
                </text>
              </g>
            );
          })}

          <text x={PAD.left + 4} y={PAD.top + 10} fontSize={10} className="fill-term-sub font-mono">
            □ Breakeven
          </text>
          <text x={PAD.left + 4} y={PAD.top + 22} fontSize={10} className="fill-term-text font-mono">
            ■ Real yield (implied)
          </text>
        </svg>
      </div>
    </Panel>
  );
}
