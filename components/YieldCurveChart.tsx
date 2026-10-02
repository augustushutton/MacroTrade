"use client";

import React from "react";
import { VAR_BY_ID, type VarState } from "@/lib/vars";
import type { AssetResult } from "@/lib/engine";
import { fmtBp, signColor } from "@/lib/format";
import { CHART_PAD_LEFT, CHART_PAD_RIGHT, CHART_W, TREASURY_CURVE_POINTS, xOf } from "@/lib/curveChart";
import { Panel } from "./ui";

// A draggable Treasury par curve, in the register of a TWS/Bloomberg yield
// curve tool. Four square handles (never circles — see tailwind.config.ts's
// borderRadius note, no rounded anything anywhere in this app) drag
// lib/vars.ts's ust{2,5,10,30}yYield — variables that exist ONLY to be
// pinned here (see their own comment in vars.ts and the Treasury-curve loop
// in lib/engine.ts). Dragging a tenor sets that point's yield directly,
// overriding whatever the macro variables above would have implied for that
// one tenor — the same "assumption you typed wins" rule every other pinned
// input in this app already follows (an FX pair, a credit OAS).
//
// Tenor list (assetId/varId/maturity/label) lives in lib/curveChart.ts,
// shared with ScenarioComparisonChart below on the page so both draw the
// same four tenors off one definition rather than two that could drift.
const CURVE_POINTS = TREASURY_CURVE_POINTS;

const W = CHART_W;
const H = 300;
const PAD = { left: CHART_PAD_LEFT, right: CHART_PAD_RIGHT, top: 34, bottom: 40 };
const PLOT_H = H - PAD.top - PAD.bottom;

/** Display/drag precision — 1bp — independent of pointer-pixel jitter. */
function round1bp(n: number): number {
  return Math.round(n * 100) / 100;
}

/** signColor (lib/format.ts) returns a `text-*` class for ordinary DOM text,
 *  where colour is painted through CSS `color`. An SVG `<text>` element
 *  paints through `fill` instead — `color`/`text-*` has no effect on it — so
 *  reusing signColor's class as-is here would silently render every delta
 *  label in the default (near-invisible) fill. Swapping the prefix is all
 *  that differs; the up/down/dead-zone logic itself stays shared with every
 *  other delta in the app rather than forking its own copy. */
function svgSignFill(v: number, dead = 0.005): string {
  return signColor(v, dead).replace(/^text-/, "fill-");
}

interface ChartPoint {
  key: string;
  varId: string;
  maturity: number;
  label: string;
  base: number;
  current: number;
  shockBp: number;
  pinned: boolean;
  min: number;
  max: number;
  step: number;
}

export default function YieldCurveChart({
  state,
  onChange,
  onResetGroup,
  assets,
}: {
  state: VarState;
  onChange: (id: string, v: number) => void;
  onResetGroup: (group: string) => void;
  assets: Record<string, AssetResult>;
}) {
  const svgRef = React.useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = React.useState<string | null>(null);

  const points: ChartPoint[] = CURVE_POINTS.map((p) => {
    const v = VAR_BY_ID[p.varId];
    const base = v.base;
    // yieldBp is this tenor's shock vs base, in bp — whatever the live
    // scenario implies, pinned or not (see lib/engine.ts's Treasury-curve
    // loop). Converting it back onto `base` is what makes the "current"
    // curve agree with every other number this app shows for the same
    // tenor (P&L's Asset Detail, Derivation's channel breakdown, etc).
    const shockBp = assets[p.assetId]?.yieldBp ?? 0;
    const current = base + shockBp / 100;
    const pinned = assets[p.assetId]?.pinned ?? false;
    return {
      key: p.label,
      varId: p.varId,
      maturity: p.maturity,
      label: p.label,
      base,
      current,
      shockBp,
      pinned,
      min: v.min,
      max: v.max,
      step: v.step,
    };
  });

  const anyPinned = points.some((p) => p.pinned);

  const allY = points.flatMap((p) => [p.base, p.current]);
  const TICK = 0.5;
  const yMin = Math.floor((Math.min(...allY) - 0.4) / TICK) * TICK;
  const yMax = Math.ceil((Math.max(...allY) + 0.4) / TICK) * TICK;
  const ticks: number[] = [];
  for (let t = yMin; t <= yMax + 1e-9; t += TICK) ticks.push(Math.round(t * 100) / 100);

  function yOf(yieldPct: number): number {
    return PAD.top + (1 - (yieldPct - yMin) / (yMax - yMin)) * PLOT_H;
  }

  function valueAtClientY(clientY: number): number {
    const svg = svgRef.current;
    if (!svg) return yMin;
    const rect = svg.getBoundingClientRect();
    // The SVG scales responsively (width: 100%) while its viewBox stays
    // fixed at W x H, so a client-pixel delta has to be rescaled into
    // viewBox units before it means anything against PAD/PLOT_H.
    const scale = H / rect.height;
    const localY = (clientY - rect.top) * scale;
    const frac = 1 - (localY - PAD.top) / PLOT_H;
    return yMin + frac * (yMax - yMin);
  }

  function dragTo(varId: string, min: number, max: number, clientY: number) {
    onChange(varId, Math.min(max, Math.max(min, round1bp(valueAtClientY(clientY)))));
  }

  return (
    <Panel
      title="Yield Curve"
      right={
        <div className="flex items-center gap-3">
          <span className="text-th normal-case tracking-normal text-term-muted">Drag a point to set that tenor directly</span>
          {anyPinned ? (
            <button type="button" onClick={() => onResetGroup("curve")} className="text-th text-term-muted hover:text-down">
              <span aria-hidden className="mr-0.5">
                &#8634;
              </span>
              Reset
            </button>
          ) : null}
        </div>
      }
    >
      <div className="p-2">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full select-none"
          style={{ height: 300, touchAction: "none" }}
          role="img"
          aria-label="UST yield curve by tenor, draggable per point"
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={yOf(t)} y2={yOf(t)} className="stroke-term-line" strokeWidth={1} />
              <text x={PAD.left - 8} y={yOf(t)} fontSize={11} textAnchor="end" dominantBaseline="middle" className="fill-term-muted font-mono tnum">
                {t.toFixed(2)}%
              </text>
            </g>
          ))}

          <line x1={PAD.left} x2={PAD.left} y1={PAD.top} y2={H - PAD.bottom} className="stroke-term-edge" strokeWidth={1.25} />
          <line x1={PAD.left} x2={W - PAD.right} y1={H - PAD.bottom} y2={H - PAD.bottom} className="stroke-term-edge" strokeWidth={1.25} />

          {/* Base curve: the static resting shape, always visible so a drag
              reads as a deviation FROM something, not a number in a void. */}
          <polyline
            points={points.map((p) => `${xOf(p.maturity)},${yOf(p.base)}`).join(" ")}
            fill="none"
            className="stroke-term-sub"
            strokeWidth={1.25}
            strokeDasharray="5 4"
          />

          {/* Current curve — the live scenario's shape. */}
          <polyline
            points={points.map((p) => `${xOf(p.maturity)},${yOf(p.current)}`).join(" ")}
            fill="none"
            className="stroke-term-text"
            strokeWidth={1.5}
          />

          {points.map((p, idx) => {
            const x = xOf(p.maturity);
            const yCur = yOf(p.current);
            const yBase = yOf(p.base);
            const isDragging = dragging === p.varId;
            // Flip the printed labels below the point once there isn't
            // enough headroom above it (a tenor dragged near the top of the
            // plot), rather than letting them run off the chart.
            const placeAbove = yCur - PAD.top > 40;
            const yieldLabelY = placeAbove ? yCur - 12 : yCur + 20;
            const deltaLabelY = placeAbove ? yCur - 25 : yCur + 33;
            // The first/last point sits exactly on the plot's left/right
            // edge (xOf(2Y) === PAD.left, xOf(30Y) === W - PAD.right) — a
            // center-anchored label there runs half off the chart and, on
            // the left, straight into the y-axis tick labels. Anchoring
            // outward from the edge instead keeps every label fully inside
            // the plot without needing extra side padding that would waste
            // space for the inner tenors.
            const isFirst = idx === 0;
            const isLast = idx === points.length - 1;
            const labelAnchor = isFirst ? "start" : isLast ? "end" : "middle";
            const labelX = isFirst ? x + 6 : isLast ? x - 6 : x;

            return (
              <g key={p.key}>
                {/* Base marker: a small hollow square — "the rest point,"
                    never competing with the live one below it. */}
                <rect x={x - 3} y={yBase - 3} width={6} height={6} className="fill-term-panel stroke-term-sub" strokeWidth={1.25} />

                {/* Live marker. The one accent colour (--info) takes over
                    the instant this point is set directly — never a
                    per-tenor colour, the same "colour is status, not
                    identity" rule every other chart in this app follows. */}
                <rect
                  x={x - 4}
                  y={yCur - 4}
                  width={8}
                  height={8}
                  className={p.pinned || isDragging ? "fill-info stroke-info" : "fill-term-text stroke-term-edge"}
                  strokeWidth={1.25}
                  style={{ pointerEvents: "none" }}
                />

                {/* Oversized, invisible hit area — the 8px marker above is
                    far too small a pointer target on its own, let alone on
                    touch. Also the keyboard entry point: Up/Down nudges by
                    the variable's own step, same as every stepper in
                    VarForm. */}
                <rect
                  x={x - 16}
                  y={Math.min(yCur, yBase) - 16}
                  width={32}
                  height={Math.abs(yCur - yBase) + 32}
                  fill="transparent"
                  style={{ cursor: "ns-resize", pointerEvents: "all" }}
                  tabIndex={0}
                  role="slider"
                  aria-label={`${p.label} yield`}
                  aria-valuemin={p.min}
                  aria-valuemax={p.max}
                  aria-valuenow={Math.round(p.current * 100) / 100}
                  aria-orientation="vertical"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    (e.currentTarget as Element).setPointerCapture(e.pointerId);
                    setDragging(p.varId);
                    dragTo(p.varId, p.min, p.max, e.clientY);
                  }}
                  onPointerMove={(e) => {
                    if (e.buttons === 0) return;
                    dragTo(p.varId, p.min, p.max, e.clientY);
                  }}
                  onPointerUp={(e) => {
                    try {
                      (e.currentTarget as Element).releasePointerCapture(e.pointerId);
                    } catch {
                      /* capture already released */
                    }
                    setDragging(null);
                  }}
                  onPointerCancel={() => setDragging(null)}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowUp") {
                      e.preventDefault();
                      onChange(p.varId, Math.min(p.max, round1bp((state[p.varId] ?? p.base) + p.step)));
                    } else if (e.key === "ArrowDown") {
                      e.preventDefault();
                      onChange(p.varId, Math.max(p.min, round1bp((state[p.varId] ?? p.base) - p.step)));
                    }
                  }}
                />

                <text x={x} y={H - PAD.bottom + 20} fontSize={11} textAnchor="middle" className="fill-term-sub font-mono">
                  {p.label}
                </text>

                <text
                  x={labelX}
                  y={yieldLabelY}
                  fontSize={11}
                  fontWeight={600}
                  textAnchor={labelAnchor}
                  className="fill-term-text font-mono tnum"
                  style={{ pointerEvents: "none" }}
                >
                  {p.current.toFixed(2)}%
                </text>
                {Math.abs(p.shockBp) > 0.5 ? (
                  <text
                    x={labelX}
                    y={deltaLabelY}
                    fontSize={10}
                    textAnchor={labelAnchor}
                    className={`font-mono tnum ${svgSignFill(p.shockBp, 0.5)}`}
                    style={{ pointerEvents: "none" }}
                  >
                    {fmtBp(p.shockBp)}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>
    </Panel>
  );
}
