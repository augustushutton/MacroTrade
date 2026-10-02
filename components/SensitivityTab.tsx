"use client";

import React from "react";
import { cumulativeInflation, heatGrid, horizonLadder, realReturn, sensitivity, type ScenarioInput } from "@/lib/engine";
import { HORIZON_LABEL } from "@/lib/paths";
import { VAR_BY_ID, movedVars } from "@/lib/vars";
import { fmtPct, heatBg, heatFg, signColor, unitLabel } from "@/lib/format";
import { Cap, Panel, Select, Td, Th } from "./ui";

/**
 * Lets a reader override the one inflation input the Real Return table below
 * depends on (see cumulativeInflation/realReturn in lib/engine.ts) without
 * touching the scenario itself — "what if CPI actually compounds at 6%, not
 * whatever this scenario happens to set Headline CPI YoY to" is a question
 * about the deflator, not a restatement of the macro scenario, so it lives
 * as local component state (cpiOverride in SensitivityTab) rather than a
 * write into the shared VarState every other control on this page reads
 * from. null means "use the scenario's own Headline CPI YoY," matching the
 * engine's own default (see horizonLadder) — overriding and resetting are
 * symmetric, not "pick a number vs. pick a different number."
 *
 * Deliberately just the stepper — no caption explaining what it does — and
 * centred rather than stretched to the panel's 260px width: the Panel title
 * already says what it is, and the Real Return panel below gains its own
 * "using assumed CPI" note the moment this is actually overridden, so this
 * control doesn't need to carry that explanation itself.
 */
function InflationAssumption({
  scenarioCpi,
  override,
  setOverride,
}: {
  scenarioCpi: number;
  override: number | null;
  setOverride: (v: number | null) => void;
}) {
  const v = VAR_BY_ID.cpiHeadline;
  const value = override ?? scenarioCpi;
  const isOverridden = override !== null;

  function clamp(n: number): number {
    return Math.min(v.max, Math.max(v.min, n));
  }
  function bump(sign: 1 | -1, mods: { shiftKey?: boolean }) {
    const amt = mods.shiftKey ? v.step * 10 : v.step;
    setOverride(clamp(Math.round((value + sign * amt) * 100) / 100));
  }

  return (
    <Panel title="Inflation Assumption">
      <div className="flex flex-col items-center gap-1 px-2 py-2">
        <div className="flex items-stretch gap-dense">
          <button
            type="button"
            onClick={(e) => bump(-1, e)}
            className="w-5 shrink-0 border border-term-edge bg-term-raised font-mono text-[11px] leading-none text-term-muted hover:bg-term-line/30 hover:text-term-sub"
          >
            &minus;
          </button>
          <input
            type="number"
            min={v.min}
            max={v.max}
            step={v.step}
            value={value.toFixed(v.dp)}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n)) setOverride(clamp(n));
            }}
            className={`w-14 shrink-0 border px-1 py-hair text-right font-mono text-[11px] tnum ${
              isOverridden
                ? "border-warn bg-warn text-term-bg font-medium"
                : "border-term-edge bg-term-input text-term-text"
            }`}
          />
          <button
            type="button"
            onClick={(e) => bump(1, e)}
            className="w-5 shrink-0 border border-term-edge bg-term-raised font-mono text-[11px] leading-none text-term-muted hover:bg-term-line/30 hover:text-term-sub"
          >
            +
          </button>
          <Cap className="flex shrink-0 items-center">%</Cap>
        </div>
        {/* Always rendered, not conditionally — reserving this line's height
            whether or not it's active keeps the panel (and the Horizon
            Ladder above it, which claims whatever leftover height this
            column doesn't use — see its own flex-1 comment) at the same
            size in both states, on request: toggling the override used to
            grow the panel by one line and visibly shrink the ladder's rows
            to compensate. invisible + pointer-events-none takes it out of
            the visual/interaction picture without taking it out of layout. */}
        <button
          type="button"
          onClick={() => setOverride(null)}
          tabIndex={isOverridden ? 0 : -1}
          aria-hidden={!isOverridden}
          className={`text-th text-term-muted hover:text-down ${isOverridden ? "" : "invisible pointer-events-none"}`}
        >
          <span aria-hidden className="mr-0.5">
            &#8634;
          </span>
          Reset
        </button>
      </div>
    </Panel>
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

  // null = no override, Real Return below uses the scenario's own cpiUsed
  // (ladder[].cpiUsed, already Headline CPI YoY — see horizonLadder in
  // lib/engine.ts) exactly as it always has. Reset switches it back here
  // rather than snapping to whatever the scenario's current value is, so a
  // later scenario change doesn't silently resurrect a stale typed number.
  const [cpiOverride, setCpiOverride] = React.useState<number | null>(null);
  const scenarioCpi = input.state.cpiHeadline ?? VAR_BY_ID.cpiHeadline.base;
  const assumedCpi = cpiOverride ?? scenarioCpi;

  // Defense-in-depth: a persisted xVar/yVar can reference a variable id that
  // no longer exists (e.g. removed/renamed in a later release). Treat an
  // unknown id the same as "none selected" rather than trusting it blindly —
  // VAR_BY_ID[x]/[y] are looked up unguarded below and elsewhere in this file.
  const safeXVar = xVar && VAR_BY_ID[xVar] ? xVar : "";
  const safeYVar = yVar && VAR_BY_ID[yVar] ? yVar : "";
  const x = safeXVar || moved[0]?.id || "fedFunds";
  const y = safeYVar || moved[1]?.id || (x === "cpiCore" ? "gdpGrowth" : "cpiCore");
  const grid = React.useMemo(
    () => heatGrid(input, portfolioId, x, y, 7),
    [input, portfolioId, x, y],
  );

  const heatMax = Math.max(Math.abs(grid.min), Math.abs(grid.max), 0.0001);
  // Same heatBg/heatFg scaling as the Two-Variable Surface just below this
  // panel, applied to the one column that is itself a value rather than a
  // label (Variable/Move identify the row; Impact % is the thing being
  // measured) — scaled off this table's OWN largest |Impact %|, not the
  // surface's heatMax, since the two panels show different quantities over
  // different ranges and sharing one scale would wash this one out or
  // saturate it depending on which happened to be larger.
  const loHeatMax = Math.max(...bars.map((b) => Math.abs(b.delta)), 0.0001);

  return (
    <div className="space-y-0">
      <Panel title="Leave-One-Out Attribution">
        {bars.length === 0 ? (
          <div className="px-3 py-4">
            <Cap>No variable moved from baseline</Cap>
          </div>
        ) : (
          <div className="overflow-x-auto">
          {/* table-fixed with every column explicitly widthed: on a very wide
              monitor, plain table-auto layout does NOT keep unconstrained
              columns pinned at their content width — it stretches them, and
              unevenly across columns of different header-text length, which
              is what used to strand a "Move" or "Impact %" figure far from
              its row with a dead gap in front of it. table-fixed scales every
              column by the SAME ratio instead, so the table grows evenly at
              any width rather than breaking at some of them. See
              app/providers.tsx for the page-width side of this fix. */}
          <table className="w-full table-fixed border-collapse text-[11px]">
            <thead>
              <tr className="sticky top-0 z-10 bg-term-raised">
                <Th className="w-[60%]">Variable</Th>
                <Th align="right" className="w-[40%]">
                  Impact %
                </Th>
              </tr>
            </thead>
            <tbody>
              {/* Sorted by |delta| already (see sensitivity() in lib/engine.ts) —
                  the biggest driver is always first, so the ranking that a
                  tornado bar used to show at a glance is already carried by row
                  order. The Move column (the raw input shock behind each
                  figure) was removed by request — this table is about the
                  impact each variable had, not what was moved to produce it,
                  and that input-side detail already lives in the Builder/
                  Derivation pages. The single signed Impact % figure left
                  carries the whole story: its own heatBg/heatFg fill (the
                  same treatment as the Two-Variable Surface below, scaled off
                  this table's own largest |Impact %| — see loHeatMax above)
                  turns the ranking already carried by row order into
                  something scannable as a column of colour, the way a
                  one-column heatmap reads at a glance. */}
              {bars.map((b) => (
                <tr key={b.varId} className="border-b border-term-line even:bg-term-zebra">
                  <Td className="text-term-text">{b.label}</Td>
                  <Td
                    align="right"
                    mono
                    className="font-medium"
                    style={{ background: heatBg(b.delta, loHeatMax), color: heatFg(b.delta, loHeatMax) }}
                  >
                    {fmtPct(b.delta)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </Panel>

      <div className="grid grid-cols-[1fr_260px] gap-0">
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
          <div className="flex items-center border-t border-term-line px-2 py-1">
            <Cap>
              {VAR_BY_ID[x].label} across {VAR_BY_ID[y].label}
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

        {/* A plain flex column, not a second grid-template column of its own —
            it just needs to stack Horizon Ladder above Inflation Assumption
            at the SAME 260px width the grid track already gives this cell,
            on request ("match its width"). The grid's default stretch
            alignment already sizes this div to the row's full height (set by
            Two-Variable Surface, the taller sibling), which is what lets
            Horizon Ladder's own flex-1 below claim all the space Inflation
            Assumption doesn't need. */}
        <div className="flex flex-col">
          {/* flex-1 + flex flex-col on the Panel itself (not just its
              children) is what actually claims the leftover height the grid
              gives this column — Panel's own box already stretches to match
              Two-Variable Surface via the grid's default alignment, but
              nothing inside it grows to fill that box without this. */}
          <Panel title="Horizon Ladder" className="flex flex-1 flex-col">
            {/* Plain flex rows, not a <table> — a real <tr>/<td> can't be
                told to grow (display:table-row ignores flex-grow), and that
                growth is the whole point here: four rows evenly filling
                whatever height Two-Variable Surface's taller content leaves
                this column, instead of leaving dead panel background below
                the last row. */}
            <div className="flex items-center justify-between border-b border-term-edge bg-term-raised px-2 py-dense text-th font-medium uppercase leading-[13px] tracking-wide text-term-muted">
              <span>Horizon</span>
              <span>Return (%)</span>
            </div>
            <div className="flex flex-1 flex-col">
              {ladder.map((l, i) => (
                <div
                  key={l.horizon}
                  className={`flex flex-1 items-center justify-between px-2 leading-[14px] ${
                    i < ladder.length - 1 ? "border-b border-term-line" : ""
                  } ${i % 2 === 1 ? "bg-term-zebra" : ""}`}
                >
                  <span className="text-[11px] text-term-sub">{HORIZON_LABEL[l.horizon]}</span>
                  <span className={`font-mono text-[11px] tnum font-medium ${signColor(l.pct)}`}>
                    {fmtPct(l.pct)}
                  </span>
                </div>
              ))}
            </div>
          </Panel>

          <InflationAssumption scenarioCpi={scenarioCpi} override={cpiOverride} setOverride={setCpiOverride} />
        </div>
      </div>

      {/* "Scenario Uncertainty (Monte Carlo)" — the histogram + VaR/CVaR
          table re-running the engine under random shock perturbation — was
          removed by request. lib/montecarlo.ts and tests/montecarlo.test.ts
          are left on disk, untouched and simply unused, same reversibility
          convention as the rest of this codebase's removed-by-request
          features. */}

      {/* Its own full-width section, not squeezed into the Horizon Ladder's
          260px sidebar column — CPI's effect on a scenario is real enough to
          read at its own width, not a footnote crammed next to it. Nominal
          is the scenario's own figure (ladder[].pct, unaffected by the
          Inflation Assumption override above); Cumulative CPI and Real are
          both recomputed here off `assumedCpi` (cumulativeInflation/
          realReturn in lib/engine.ts) rather than read off ladder[].cpiUsed/
          realPct directly, so overriding the assumption above actually
          changes what this table shows instead of only labelling the same
          scenario-locked numbers differently. Inflation Drag is just Real
          minus Nominal, restated as its own column because "how many points
          did inflation cost this scenario" is the number a reader actually
          wants without doing that subtraction themselves. */}
      <Panel title="Real Return (Inflation-Adjusted)">
        <div className="overflow-x-auto">
          <table className="w-full table-fixed border-collapse text-[11px]">
            <thead>
              <tr className="bg-term-raised">
                <Th className="w-[16%]">Horizon</Th>
                <Th align="right" className="w-[20%] border-r border-term-line">
                  Nominal (%)
                </Th>
                <Th align="right" className="w-[26%] border-r border-term-line">
                  Cumulative CPI Assumed (%)
                </Th>
                <Th align="right" className="w-[18%] border-r border-term-line">
                  Real (%)
                </Th>
                <Th align="right" className="w-[20%]">
                  Inflation Drag (pp)
                </Th>
              </tr>
            </thead>
            <tbody>
              {ladder.map((l) => {
                const cumCpi = cumulativeInflation(assumedCpi, l.horizon);
                const realPct = realReturn(l.pct, assumedCpi, l.horizon);
                const drag = realPct - l.pct;
                return (
                  <tr key={l.horizon} className="border-b border-term-line even:bg-term-zebra">
                    <Td className="text-term-sub">{HORIZON_LABEL[l.horizon]}</Td>
                    <Td align="right" mono className={`border-r border-term-line font-medium ${signColor(l.pct)}`}>
                      {fmtPct(l.pct)}
                    </Td>
                    <Td align="right" mono className="border-r border-term-line text-term-muted">
                      {fmtPct(cumCpi)}
                    </Td>
                    <Td align="right" mono className={`border-r border-term-line font-medium ${signColor(realPct)}`}>
                      {fmtPct(realPct)}
                    </Td>
                    <Td align="right" mono className={signColor(drag)}>
                      {fmtPct(drag)}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
