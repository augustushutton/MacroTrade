"use client";

import React from "react";
import { heatGrid, horizonLadder, sensitivity, type ScenarioInput } from "@/lib/engine";
import { monteCarloVaR, type MonteCarloResult } from "@/lib/montecarlo";
import { HORIZON_LABEL } from "@/lib/paths";
import { VAR_BY_ID, movedVars } from "@/lib/vars";
import { fmtPct, fmtSigned, heatBg, heatFg, signColor, unitLabel } from "@/lib/format";
import { Btn, Cap, Panel, Select, SignedBar, Td, Th } from "./ui";

/** Histogram of the Monte Carlo outcome distribution, with the 95% VaR
 *  threshold marked. Dense, no-library SVG in the same register as the rest
 *  of the app's charts. */
function VarHistogram({ mc }: { mc: MonteCarloResult }) {
  const w = 640;
  const h = 120;
  const padL = 2;
  const padR = 2;
  const padT = 6;
  const padB = 16;
  const min = mc.outcomes[0] ?? 0;
  const max = mc.outcomes[mc.outcomes.length - 1] ?? 0;
  const span = Math.max(max - min, 1e-6);
  const bins = 28;
  const counts = new Array(bins).fill(0);
  for (const v of mc.outcomes) {
    const idx = Math.min(bins - 1, Math.floor(((v - min) / span) * bins));
    counts[idx]++;
  }
  const maxCount = Math.max(1, ...counts);
  const binW = (w - padL - padR) / bins;
  const innerH = h - padT - padB;
  const xOf = (v: number) => padL + ((v - min) / span) * (w - padL - padR);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: h }} role="img" aria-label="Monte Carlo outcome distribution with 95% VaR marked">
      {counts.map((c, i) => {
        const binLo = min + (i / bins) * span;
        const bh = (c / maxCount) * innerH;
        const isLoss = binLo < 0;
        return (
          <rect
            key={i}
            x={padL + i * binW + 0.5}
            y={padT + innerH - bh}
            width={Math.max(binW - 1, 0.5)}
            height={bh}
            className={isLoss ? "fill-down/60" : "fill-up/60"}
          />
        );
      })}
      <line x1={xOf(mc.var95)} y1={padT} x2={xOf(mc.var95)} y2={padT + innerH} className="stroke-term-text" strokeWidth={1} strokeDasharray="3 2" />
      <text x={xOf(mc.var95)} y={h - 4} fontSize={9} textAnchor="middle" className="fill-term-text">
        VaR 95
      </text>
      <line x1={xOf(0)} y1={padT} x2={xOf(0)} y2={padT + innerH} className="stroke-term-line" strokeWidth={1} />
    </svg>
  );
}

// Three views of the same scenario: which variable carries it, how it behaves
// across a two-variable surface, and how it re-prices as the horizon extends.

export default function SensitivityTab({
  input,
  portfolioId,
  xVar,
  setXVar,
  yVar,
  setYVar,
}: {
  input: ScenarioInput;
  portfolioId: string;
  xVar: string;
  setXVar: (id: string) => void;
  yVar: string;
  setYVar: (id: string) => void;
}) {
  const moved = movedVars(input.state);
  const bars = React.useMemo(() => sensitivity(input, portfolioId), [input, portfolioId]);
  const ladder = React.useMemo(() => horizonLadder(input, portfolioId), [input, portfolioId]);

  // Transient, not persisted (same treatment as CompareTab's picked-preset
  // drill-down) — this is a "what if the inputs were less certain" dial, not
  // a saved setting.
  const [noisePct, setNoisePct] = React.useState(0.25);
  const monteCarlo = React.useMemo(
    () => monteCarloVaR(input, portfolioId, { runs: 400, noisePct }),
    [input, portfolioId, noisePct],
  );

  const x = xVar || moved[0]?.id || "fedFunds";
  const y = yVar || moved[1]?.id || (x === "cpiCore" ? "gdpGrowth" : "cpiCore");
  const grid = React.useMemo(
    () => heatGrid(input, portfolioId, x, y, 7),
    [input, portfolioId, x, y],
  );

  const heatMax = Math.max(Math.abs(grid.min), Math.abs(grid.max), 0.0001);

  return (
    <div className="space-y-2">
      <Panel title="Leave-One-Out Attribution">
        {bars.length === 0 ? (
          <div className="px-3 py-4">
            <Cap>No variable moved from baseline</Cap>
            {/* This panel is empty by design at baseline — attribution has
                nothing to attribute yet — but a single dim caption with no
                further text reads like a stalled/broken load rather than a
                deliberate empty state. A second line pointing at the actual
                next action (go move something in Builder) costs one row and
                removes the ambiguity. */}
            <div className="mt-1 text-th text-term-edge">Move a variable in Builder to see its isolated contribution here.</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr className="bg-term-raised">
                <Th className="w-[190px]">Variable</Th>
                <Th align="right" className="w-[100px]">
                  Move
                </Th>
                <Th className="w-[160px]">Impact</Th>
                <Th align="right" className="w-[80px]">
                  Impact %
                </Th>
                <Th align="right" className="w-[60px]">
                  Share
                </Th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const total = bars.reduce((s, z) => s + Math.abs(z.delta), 0) || 1;
                // Sorted by |delta| already (see sensitivity() in lib/engine.ts),
                // so the widest bar always belongs to bars[0] — the classic
                // tornado-chart layout, biggest driver on top.
                const maxAbs = Math.abs(bars[0]?.delta ?? 0);
                return bars.map((b) => (
                  <tr key={b.varId} className="border-b border-term-line even:bg-term-zebra">
                    <Td className="text-term-text">{b.label}</Td>
                    <Td align="right" mono className={signColor(b.rawMove, 10 ** -VAR_BY_ID[b.varId].dp / 2)}>
                      {fmtSigned(b.rawMove, VAR_BY_ID[b.varId].dp)} {b.unit}
                    </Td>
                    <Td className="p-0">
                      <div className="px-2 py-dense">
                        <SignedBar v={b.delta} max={maxAbs} />
                      </div>
                    </Td>
                    <Td align="right" mono className={`font-medium ${signColor(b.delta)}`}>
                      {fmtPct(b.delta)}
                    </Td>
                    <Td align="right" mono className="text-term-muted">
                      {((Math.abs(b.delta) / total) * 100).toFixed(0)}%
                    </Td>
                  </tr>
                ));
              })()}
            </tbody>
          </table>
          </div>
        )}
      </Panel>

      <div className="grid grid-cols-[1fr_260px] gap-2">
        <Panel
          title="Two-Variable Surface"
          right={
            <div className="flex items-center gap-1">
              <Cap>X</Cap>
              <Select value={x} onChange={setXVar}>
                {Object.values(VAR_BY_ID).map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </Select>
              {unitLabel(VAR_BY_ID[x].unit) ? <Cap className="text-term-edge">{unitLabel(VAR_BY_ID[x].unit)}</Cap> : null}
              <Cap className="ml-1">Y</Cap>
              <Select value={y} onChange={setYVar}>
                {Object.values(VAR_BY_ID).map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </Select>
              {unitLabel(VAR_BY_ID[y].unit) ? <Cap className="text-term-edge">{unitLabel(VAR_BY_ID[y].unit)}</Cap> : null}
            </div>
          }
        >
          <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr className="bg-term-raised">
                <Th align="right" className="w-[92px]">
                  {VAR_BY_ID[y].label}
                </Th>
                {grid.xs.map((xv, i) => (
                  <Th key={i} align="right">
                    {xv.toFixed(VAR_BY_ID[x].dp)}
                  </Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grid.ys.map((yv, yi) => (
                <tr key={yi}>
                  <Td align="right" mono className="border-r border-term-line bg-term-raised text-term-muted">
                    {yv.toFixed(VAR_BY_ID[y].dp)}
                  </Td>
                  {grid.xs.map((_, xi) => {
                    const c = grid.cells[yi * grid.xs.length + xi];
                    const centre = xi === (grid.xs.length - 1) / 2 && yi === (grid.ys.length - 1) / 2;
                    return (
                      <td
                        key={xi}
                        className={`px-1.5 py-dense text-right font-mono tnum ${
                          centre ? "outline outline-1 -outline-offset-1 outline-term-text" : ""
                        }`}
                        style={{ background: heatBg(c.pct, heatMax), color: heatFg(c.pct, heatMax) }}
                      >
                        {c.pct.toFixed(1)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <div className="flex items-center justify-between border-t border-term-line px-2 py-1">
            <Cap>
              {VAR_BY_ID[x].label} across {VAR_BY_ID[y].label}
            </Cap>
            <Cap>
              Range {grid.min.toFixed(2)} to {grid.max.toFixed(2)} pct
            </Cap>
          </div>
          {/* Colour legend: the heatmap's fill opacity is |value| / heatMax
              (see heatBg), symmetric about zero — so the truthful legend
              range is -heatMax to +heatMax, not grid.min to grid.max, which
              is usually asymmetric (a scenario rarely moves the portfolio
              equally far in both directions) and would mislabel how deep a
              boundary cell's colour actually reads relative to full
              saturation. */}
          <div className="flex items-center gap-2 border-t border-term-line px-2 py-1.5">
            <Cap className="text-down">&minus;{heatMax.toFixed(1)}%</Cap>
            <div
              className="relative h-2.5 flex-1"
              style={{
                background:
                  "linear-gradient(to right, rgb(var(--down) / 0.85), rgb(var(--down) / 0) 50%, rgb(var(--up) / 0) 50%, rgb(var(--up) / 0.85))",
              }}
            >
              <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-term-line" />
            </div>
            <Cap className="text-up">+{heatMax.toFixed(1)}%</Cap>
          </div>
        </Panel>

        <Panel title="Horizon Ladder">
          <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr className="bg-term-raised">
                <Th>Horizon</Th>
                <Th align="right">Return (%)</Th>
              </tr>
            </thead>
            <tbody>
              {ladder.map((l) => (
                <tr key={l.horizon} className="border-b border-term-line even:bg-term-zebra">
                  <Td className="text-term-sub">{HORIZON_LABEL[l.horizon]}</Td>
                  <Td align="right" mono className={`font-medium ${signColor(l.pct)}`}>
                    {fmtPct(l.pct)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </Panel>
      </div>

      <Panel
        title="Scenario Uncertainty (Monte Carlo)"
        right={
          <div className="flex items-center gap-1">
            <Cap>Shock uncertainty</Cap>
            {[0.1, 0.25, 0.5].map((n) => (
              <Btn key={n} active={noisePct === n} onClick={() => setNoisePct(n)}>
                &plusmn;{(n * 100).toFixed(0)}%
              </Btn>
            ))}
          </div>
        }
      >
        {/* PnlTab deliberately omits VaR/Sharpe because this engine has no
            covariance model to back a real-world risk figure — see its own
            comment. This is a different, narrower question: given how
            precisely the SCENARIO's own inputs are actually known, how much
            does that uncertainty alone move the outcome? It is computed by
            re-running the real engine {monteCarlo.runs} times under random
            perturbation, not asserted, but it is scenario/parameter
            uncertainty, not portfolio risk, and is labelled that way
            throughout. */}
        <div className="px-2 py-2">
          <VarHistogram mc={monteCarlo} />
        </div>
        <div className="overflow-x-auto border-t border-term-line">
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr className="bg-term-raised">
                <Th align="right">Mean</Th>
                <Th align="right">Std Dev</Th>
                <Th align="right">VaR 95</Th>
                <Th align="right">CVaR 95</Th>
                <Th align="right">VaR 99</Th>
                <Th align="right">CVaR 99</Th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <Td align="right" mono className={signColor(monteCarlo.mean)}>
                  {fmtPct(monteCarlo.mean)}
                </Td>
                <Td align="right" mono className="text-term-muted">
                  {monteCarlo.stdev.toFixed(2)}%
                </Td>
                <Td align="right" mono className={`font-medium ${signColor(monteCarlo.var95)}`}>
                  {fmtPct(monteCarlo.var95)}
                </Td>
                <Td align="right" mono className={signColor(monteCarlo.cvar95)}>
                  {fmtPct(monteCarlo.cvar95)}
                </Td>
                <Td align="right" mono className={`font-medium ${signColor(monteCarlo.var99)}`}>
                  {fmtPct(monteCarlo.var99)}
                </Td>
                <Td align="right" mono className={signColor(monteCarlo.cvar99)}>
                  {fmtPct(monteCarlo.cvar99)}
                </Td>
              </tr>
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
