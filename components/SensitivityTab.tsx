"use client";

import React from "react";
import { cumulativeInflation, heatGrid, horizonLadder, realReturn, sensitivity, type ScenarioInput } from "@/lib/engine";
import { HORIZON_LABEL } from "@/lib/paths";
import { VAR_BY_ID, movedVars } from "@/lib/vars";
import { fmtPct, heatBg, heatFg, signColor, unitLabel } from "@/lib/format";
import { Cap, Panel, Select, Td, Th } from "./ui";
import { ScrollHint } from "./ScrollHint";

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
 *
 * The −/+ buttons get their own `flex items-center justify-center` rather
 * than relying on a plain button's default text layout, on request ("fully
 * horizontally and vertically center the inflation assumption button") —
 * without it the glyph sits slightly toward the button's top edge (normal
 * inline-text baseline positioning, not true centering), which reads as
 * off-centre once you zoom in on a 20px-tall button.
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
    <Panel title="Inflation Assumption" className="flex flex-1 flex-col">
      {/* flex-1 + justify-center on both the Panel section (className
          above) and this content div — on request, again ("horizontally
          and vertically center the inflation assumption button"): the
          first pass centred it horizontally (items-center) but left it
          pinned to the top of whatever height this panel ends up with,
          which only reads as "centred" when the panel happens to be
          exactly as tall as its content. flex-1 lets the panel claim
          (its share of) any leftover column height instead of staying
          pinned to its own content size, and justify-center means
          whatever height that turns out to be, the stepper sits in the
          true middle of it instead of flush against the header.
          `relative`, because the Reset button below is now taken out of
          this flex flow (see its own comment) — this is what its
          `absolute` positioning anchors against. */}
      <div className="relative flex flex-1 flex-col items-center justify-center gap-1 px-2 py-1">
        <div className="flex items-stretch gap-dense">
          <button
            type="button"
            onClick={(e) => bump(-1, e)}
            className="flex w-5 shrink-0 items-center justify-center border border-term-edge bg-term-raised font-mono text-[11px] leading-none text-term-muted hover:bg-term-line/30 hover:text-term-sub"
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
            className="flex w-5 shrink-0 items-center justify-center border border-term-edge bg-term-raised font-mono text-[11px] leading-none text-term-muted hover:bg-term-line/30 hover:text-term-sub"
          >
            +
          </button>
          <Cap className="flex shrink-0 items-center">%</Cap>
        </div>
        {/* Always rendered, not conditionally, so the panel's height stays
            fixed across both states (toggling the override used to grow
            the panel by one line and visibly shrink the Horizon Ladder
            above it to compensate) — but `absolute` now, not a normal
            flow sibling of the stepper row. It used to sit below the
            stepper as a second flex-column child, which meant
            `justify-center` on the content div above centred the PAIR of
            them as a group — pulling the visible stepper up off true
            centre to leave this line's reserved height (invisible or not)
            below it. Taking it out of flow with `absolute` means it still
            reserves nothing and pushes nothing: the panel's size is
            unaffected either way (same as before), but the stepper is now
            the sole flex child `justify-center` is centring, so it lands
            on the panel's actual vertical centre instead of just the
            centre of "stepper + reserved reset line". */}
        <button
          type="button"
          onClick={() => setOverride(null)}
          tabIndex={isOverridden ? 0 : -1}
          aria-hidden={!isOverridden}
          className={`absolute bottom-1 left-1/2 -translate-x-1/2 text-th text-term-muted hover:text-down ${isOverridden ? "" : "invisible pointer-events-none"}`}
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
  // Which cell gets the "this is your current scenario" outline below.
  // heatGrid() centres its window on the current value by construction (see
  // its own comment in lib/engine.ts), so this is normally just the middle
  // index — but that function can still shift the window off-centre when
  // `current` sits within half a window's width of the variable's own
  // [min, max] limit, so the outline is found by nearest value, not assumed
  // from the array's geometric centre, to stay correct even then.
  const currentX = input.state[x] ?? VAR_BY_ID[x].base;
  const currentY = input.state[y] ?? VAR_BY_ID[y].base;
  const nearestIndex = (vals: number[], target: number) =>
    vals.reduce((best, v, i) => (Math.abs(v - target) < Math.abs(vals[best] - target) ? i : best), 0);
  const centreXi = React.useMemo(() => nearestIndex(grid.xs, currentX), [grid.xs, currentX]);
  const centreYi = React.useMemo(() => nearestIndex(grid.ys, currentY), [grid.ys, currentY]);

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
          <ScrollHint>
          {/* table-fixed with every column explicitly widthed: on a very wide
              monitor, plain table-auto layout does NOT keep unconstrained
              columns pinned at their content width — it stretches them, and
              unevenly across columns of different header-text length, which
              is what used to strand a "Move" or "Impact %" figure far from
              its row with a dead gap in front of it. table-fixed scales every
              column by the SAME ratio instead, so the table grows evenly at
              any width rather than breaking at some of them. See
              app/providers.tsx for the page-width side of this fix. */}
          <table className="w-full min-w-[280px] table-fixed border-collapse text-[11px]">
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
                <tr key={b.varId} className="even:bg-term-zebra">
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
          </ScrollHint>
        )}
      </Panel>

      {/* Always side-by-side at 1fr/260px — this used to stack to a single
          column below `md` so a narrow phone wasn't left with a sliver of
          heatmap, but the site now deliberately never reflows its layout
          for a narrow viewport (phone or a resized desktop window alike):
          the whole page pans as one unit instead, via `<main>`'s own
          `min-w-[1280px]` (providers.tsx) and `html`'s existing
          `overflow-x: auto` (globals.css) — not a local scroll island
          here. `min-w-0` on the Panel still matters: it's what lets that
          column settle at its 1fr share of main's 1280px floor (~960px
          here) rather than ballooning to its content's full intrinsic
          width; the ScrollHint-wrapped table inside handles anything
          beyond that on its own. */}
      <div className="grid grid-cols-[1fr_260px] gap-0">
        <Panel
          className="min-w-0"
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
              {unitLabel(VAR_BY_ID[x].unit) ? <Cap className="text-term-sub">{unitLabel(VAR_BY_ID[x].unit)}</Cap> : null}
              <Cap className="ml-1">Y</Cap>
              <Select value={y} onChange={setYVar}>
                {Object.values(VAR_BY_ID).map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </Select>
              {unitLabel(VAR_BY_ID[y].unit) ? <Cap className="text-term-sub">{unitLabel(VAR_BY_ID[y].unit)}</Cap> : null}
            </div>
          }
        >
          {/* ScrollHint added by request ("resize correctly on every
              device") — this grid has no min-w of its own (unlike the
              other tables fixed above), but it's naturally wide whenever
              the x-axis variable's grid has more than a couple of columns,
              and the probe confirmed it genuinely overflows at phone
              widths with no visual cue it was scrollable. */}
          <ScrollHint>
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
                  <Td align="right" mono className="bg-term-raised text-term-muted">
                    {yv.toFixed(VAR_BY_ID[y].dp)}
                  </Td>
                  {grid.xs.map((_, xi) => {
                    const c = grid.cells[yi * grid.xs.length + xi];
                    const centre = xi === centreXi && yi === centreYi;
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
          </ScrollHint>
        </Panel>

        {/* A plain flex column, not a second grid-template column of its own —
            it just needs to stack Timeline Returns above Inflation Assumption
            at the SAME 260px width the grid track already gives this cell,
            on request ("match its width"). The grid's default stretch
            alignment already sizes this div to the row's full height (set by
            Two-Variable Surface, the taller sibling), which is what lets
            Timeline Returns' own flex-1 below claim all the space Inflation
            Assumption doesn't need. Panel title is "Timeline Returns"; the
            underlying data/function (horizonLadder in lib/engine.ts,
            LADDER_HORIZONS in lib/paths.ts) keeps its original name — this is
            a display-label rename only. */}
        <div className="flex flex-col">
          {/* flex-1 + flex flex-col on the Panel itself (not just its
              children) is what actually claims the leftover height the grid
              gives this column — Panel's own box already stretches to match
              Two-Variable Surface via the grid's default alignment, but
              nothing inside it grows to fill that box without this. */}
          <Panel title="Timeline Returns" className="flex flex-1 flex-col">
            {/* Plain flex rows, not a <table> — a real <tr>/<td> can't be
                told to grow (display:table-row ignores flex-grow), and that
                growth is the whole point here: four rows evenly filling
                whatever height Two-Variable Surface's taller content leaves
                this column, instead of leaving dead panel background below
                the last row. */}
            <div className="flex items-center justify-between border-b border-term-edge bg-term-raised px-2 py-dense text-th font-medium uppercase leading-[13px] text-term-muted">
              <span>Horizon</span>
              <span>Return (%)</span>
            </div>
            <div className="flex flex-1 flex-col">
              {ladder.map((l, i) => (
                <div
                  key={l.horizon}
                  className={`flex flex-1 items-center justify-between px-2 leading-[14px] ${i % 2 === 1 ? "bg-term-zebra" : ""}`}
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

      {/* Its own full-width section, back at the bottom of the page on
          request (it previously sat right under Leave-One-Out for a brief
          pass, then moved back here) — not squeezed into the Horizon
          Ladder's 260px sidebar column, since CPI's effect on a scenario is
          real enough to read at its own width, not a footnote crammed next
          to it. Nominal is the scenario's own figure (ladder[].pct,
          unaffected by the Inflation Assumption override above);
          Cumulative CPI and Real are both recomputed here off `assumedCpi`
          (cumulativeInflation/realReturn in lib/engine.ts) rather than read
          off ladder[].cpiUsed/realPct directly, so overriding the
          assumption actually changes what this table shows instead of only
          labelling the same scenario-locked numbers differently. Inflation
          Drag is just Real minus Nominal, restated as its own column
          because "how many points did inflation cost this scenario" is the
          number a reader actually wants without doing that subtraction
          themselves. */}
      <Panel title="Real Return (Inflation-Adjusted)">
        {/* min-w added by request ("resize correctly on every device") —
            same fix as PnlTab's Bonds/PortfolioSummary tables: five columns
            including a long "Cumulative CPI Assumed (%)" header compressed
            illegibly at phone width instead of ever using this wrapper's
            scroll. */}
        <ScrollHint>
          <table className="w-full min-w-[520px] table-fixed border-collapse text-[11px]">
            <thead>
              <tr className="bg-term-raised">
                <Th className="w-[16%]">Horizon</Th>
                <Th align="right" className="w-[20%]">
                  Nominal (%)
                </Th>
                <Th align="right" className="w-[26%]">
                  Cumulative CPI Assumed (%)
                </Th>
                <Th align="right" className="w-[18%]">
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
                  <tr key={l.horizon} className="even:bg-term-zebra">
                    <Td className="text-term-sub">{HORIZON_LABEL[l.horizon]}</Td>
                    <Td align="right" mono className={`font-medium ${signColor(l.pct)}`}>
                      {fmtPct(l.pct)}
                    </Td>
                    <Td align="right" mono className="text-term-muted">
                      {fmtPct(cumCpi)}
                    </Td>
                    <Td align="right" mono className={`font-medium ${signColor(realPct)}`}>
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
        </ScrollHint>
      </Panel>
    </div>
  );
}
