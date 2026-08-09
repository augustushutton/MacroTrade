"use client";

import React from "react";
import { heatGrid, horizonLadder, sensitivity, type ScenarioInput } from "@/lib/engine";
import { HORIZON_LABEL } from "@/lib/paths";
import { VAR_BY_ID, movedVars } from "@/lib/vars";
import { fmtPct, fmtSigned, heatBg, heatFg, signColor, unitLabel } from "@/lib/format";
import { Cap, Panel, Select, Td, Th } from "./ui";

// Three views of the same scenario: which variable carries it, how it behaves
// across a two-variable surface, and how it re-prices as the horizon extends.

export default function SensitivityTab({
  input,
  portfolioId,
}: {
  input: ScenarioInput;
  portfolioId: string;
}) {
  const moved = movedVars(input.state);
  const bars = React.useMemo(() => sensitivity(input, portfolioId), [input, portfolioId]);
  const ladder = React.useMemo(() => horizonLadder(input, portfolioId), [input, portfolioId]);

  const [xVar, setXVar] = React.useState<string>("");
  const [yVar, setYVar] = React.useState<string>("");
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
                <Th className="w-[220px]">Variable</Th>
                <Th align="right" className="w-[110px]">
                  Move
                </Th>
                <Th align="right" className="w-[90px]">
                  Impact %
                </Th>
                <Th align="right" className="w-[70px]">
                  Share
                </Th>
              </tr>
            </thead>
            <tbody>
              {bars.map((b) => {
                const total = bars.reduce((s, z) => s + Math.abs(z.delta), 0) || 1;
                return (
                  <tr key={b.varId} className="border-b border-term-line even:bg-term-zebra">
                    <Td className="text-term-text">{b.label}</Td>
                    <Td align="right" mono className={signColor(b.rawMove, 10 ** -VAR_BY_ID[b.varId].dp / 2)}>
                      {fmtSigned(b.rawMove, VAR_BY_ID[b.varId].dp)} {b.unit}
                    </Td>
                    <Td align="right" mono className={`font-medium ${signColor(b.delta)}`}>
                      {fmtPct(b.delta)}
                    </Td>
                    <Td align="right" mono className="text-term-muted">
                      {((Math.abs(b.delta) / total) * 100).toFixed(0)}%
                    </Td>
                  </tr>
                );
              })}
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
    </div>
  );
}
