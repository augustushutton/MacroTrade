"use client";

import React from "react";
import type { AssetResult } from "@/lib/engine";
import { runScenario } from "@/lib/engine";
import { loadAll, onScenariosChanged, restore, type SavedScenario } from "@/lib/storage";
import { VAR_BY_ID } from "@/lib/vars";
import { CHART_PAD_LEFT, CHART_PAD_RIGHT, CHART_W, TREASURY_CURVE_POINTS, xOf } from "@/lib/curveChart";
import { Panel } from "./ui";

// Saved scenarios overlaid on the live Treasury curve — the same "what did
// I already try" question SavedScenarios answers as a list, answered here as
// a shape instead: does Deep Cuts actually invert the curve more than
// Stagflation does, at a glance, rather than having to load each one and
// re-read the chart above.
//
// Every line on this chart (Current, Base, and each saved scenario) is drawn
// in the app's one neutral ink — colour stays reserved for direction/status,
// never "which scenario is this," the same rule YieldCurveChart's own
// pinned-point accent follows. Lines are told apart by weight and dash
// pattern instead, each one named directly at its own 30Y terminus (a
// Bloomberg-style end-of-line label) rather than through a colour-coded
// legend key a viewer has to cross-reference.
//
// Scenario curves are computed with the exact same lib/engine.ts used for
// the live scenario (runScenario on the saved version's own restored state,
// horizon, path, steps and notional — restore() is the same helper
// SavedScenarios.tsx uses to load one) — this is a read: nothing here
// mutates the saved record or the live scenario.

const MAX_SHOWN = 5;

/** Longest-dash-first so the most recently saved scenario (index 0 — loadAll
 *  sorts newest-updated-first) reads as the "densest"/most prominent line,
 *  with each older one a little sparser — a faint recency cue without
 *  spending any colour on it. */
const DASH_PATTERNS = ["4 2", "7 3", "2 3", "9 2 2 2", "3 2 7 2"];

const W = CHART_W;
const H = 260;
const PAD = { left: CHART_PAD_LEFT, right: CHART_PAD_RIGHT, top: 18, bottom: 26 };
const PLOT_H = H - PAD.top - PAD.bottom;

interface Line {
  id: string;
  name: string;
  points: { maturity: number; yieldPct: number }[];
}

function curveOf(state: Record<string, number>, assets?: Record<string, AssetResult>): { maturity: number; yieldPct: number }[] {
  return TREASURY_CURVE_POINTS.map((p) => {
    const base = VAR_BY_ID[p.varId].base;
    const shockBp = assets ? assets[p.assetId]?.yieldBp ?? 0 : 0;
    return { maturity: p.maturity, yieldPct: base + shockBp / 100 };
  });
}

export default function ScenarioComparisonChart({ assets }: { assets: Record<string, AssetResult> }) {
  const [saved, setSaved] = React.useState<SavedScenario[]>([]);

  // Read after mount, then stay live. loadAll() hits localStorage, which
  // doesn't exist during the server render pass (same reasoning as
  // SavedScenarios.tsx's own effect, and the same fix that resolved this
  // page's earlier hydration-mismatch bug: anything browser-only has to
  // arrive after hydration, never during the first render) — and because
  // this component shares no React state with SavedScenarios (the only
  // other place scenarios get saved/deleted/renamed), a save made there
  // would otherwise never be seen here without a full page reload. The
  // onScenariosChanged subscription is what keeps the two in sync.
  React.useEffect(() => {
    setSaved(loadAll());
    return onScenariosChanged(() => setSaved(loadAll()));
  }, []);

  const shown = saved.slice(0, MAX_SHOWN);

  const lines: Line[] = React.useMemo(
    () =>
      shown.map((s) => {
        const snap = restore(s.versions[0]);
        const result = runScenario({
          state: snap.state,
          regimeOverride: snap.regimeOverride,
          horizon: snap.horizon,
          path: snap.path,
          steps: snap.steps,
          notional: snap.notional,
        });
        return { id: s.id, name: s.name, points: curveOf(snap.state, result.assets) };
      }),
    [shown],
  );

  const basePoints = curveOf({});
  const curPoints = curveOf({}, assets);

  const allY = [
    ...basePoints.map((p) => p.yieldPct),
    ...curPoints.map((p) => p.yieldPct),
    ...lines.flatMap((l) => l.points.map((p) => p.yieldPct)),
  ];
  const TICK = 0.5;
  const yMin = Math.floor((Math.min(...allY) - 0.4) / TICK) * TICK;
  const yMax = Math.ceil((Math.max(...allY) + 0.4) / TICK) * TICK;
  const ticks: number[] = [];
  for (let t = yMin; t <= yMax + 1e-9; t += TICK) ticks.push(Math.round(t * 100) / 100);

  function yOf(v: number): number {
    return PAD.top + (1 - (v - yMin) / (yMax - yMin)) * PLOT_H;
  }

  function polyline(points: { maturity: number; yieldPct: number }[]): string {
    return points.map((p) => `${xOf(p.maturity)},${yOf(p.yieldPct)}`).join(" ");
  }

  const lastMaturity = TREASURY_CURVE_POINTS[TREASURY_CURVE_POINTS.length - 1].maturity;

  return (
    <Panel
      title="Scenario Comparison"
      right={
        <span className="text-th normal-case tracking-normal text-term-muted">
          Your saved scenarios, overlaid on the current curve — up to {MAX_SHOWN} most recent
        </span>
      }
    >
      {shown.length === 0 ? (
        <div className="px-2 py-3 text-[11px] text-term-edge">
          No saved scenarios to compare yet — save one from My Scenarios above.
        </div>
      ) : (
        <div className="p-2">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full select-none"
            style={{ height: H }}
            role="img"
            aria-label={`Treasury curve for the current scenario, the base case, and ${shown.length} saved scenario${shown.length === 1 ? "" : "s"}`}
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
            {TREASURY_CURVE_POINTS.map((p) => (
              <text key={p.label} x={xOf(p.maturity)} y={H - PAD.bottom + 18} fontSize={11} textAnchor="middle" className="fill-term-sub font-mono">
                {p.label}
              </text>
            ))}

            {/* Base case: the same muted dashed reference every curve chart
                on this page uses. */}
            <polyline points={polyline(basePoints)} fill="none" className="stroke-term-edge" strokeWidth={1.25} strokeDasharray="5 4">
              <title>Base case</title>
            </polyline>

            {/* Each saved scenario: thin, dash-patterned, named at its own
                30Y terminus rather than through a colour key. */}
            {lines.map((l, i) => (
              <g key={l.id}>
                <polyline
                  points={polyline(l.points)}
                  fill="none"
                  className="stroke-term-sub"
                  strokeWidth={1.25}
                  strokeDasharray={DASH_PATTERNS[i % DASH_PATTERNS.length]}
                >
                  <title>{`${l.name} — ${l.points.map((p) => `${p.maturity}Y ${p.yieldPct.toFixed(2)}%`).join(", ")}`}</title>
                </polyline>
                <text
                  x={xOf(lastMaturity) - 6}
                  y={yOf(l.points[l.points.length - 1].yieldPct) + (i % 2 === 0 ? -6 : 14)}
                  fontSize={10}
                  textAnchor="end"
                  className="fill-term-sub font-mono"
                >
                  {l.name}
                </text>
              </g>
            ))}

            {/* Current scenario: full weight, solid — the same visual
                priority the live curve gets on the chart above. */}
            <polyline points={polyline(curPoints)} fill="none" className="stroke-term-text" strokeWidth={1.75}>
              <title>Current scenario</title>
            </polyline>
            <text x={xOf(lastMaturity) + 6} y={yOf(curPoints[curPoints.length - 1].yieldPct)} fontSize={10} fontWeight={600} className="fill-term-text font-mono" dominantBaseline="middle">
              Current
            </text>
          </svg>
        </div>
      )}
    </Panel>
  );
}
