"use client";

import React from "react";
import type { ScenarioInput } from "@/lib/engine";
import { fmtUsd, fmtNum, heatBg, heatFg, heatText } from "@/lib/format";
import {
  factorExposures,
  correlationMatrix,
  assetRiskRanking,
  CORRELATION_INSTRUMENTS,
} from "@/lib/exposure";
import { detectRegime } from "@/lib/regimes";
import { TOP_LEVEL_ASSETS } from "@/lib/assets";
import { Panel, Td, Th } from "./ui";
import { ScrollHint } from "./ScrollHint";

// Desk risk: how exposed is the book, what moves together, and which names
// carry the most macro risk right now. Asset Correlation and Exposure used
// to live at the top of the Sensitivity tab; both moved here, unchanged, once
// this got its own dedicated page — see lib/exposure.ts for what each number
// actually is and why it's computed the way it is (nothing here is fitted or
// invented; see that file's own header for the full reasoning).

const TIER_LABEL: Record<"high" | "low", string> = {
  high: "High Risk",
  low: "Low Risk",
};

/** Short display symbol for the Asset Correlation matrix only (Asset Risk
 *  Ranking above keeps ASSET_BY_ID's full "Emerging Markets"/"US Large Cap"
 *  labels — a 2-column list has room for them and they read better there).
 *  Every CORRELATION_INSTRUMENTS id is already a short, conventional ticker
 *  on its own (UST10Y, SPX, EAFE, EM, WTI, GOLD, EURUSD, USDJPY, IG) — the
 *  only one that doesn't read cleanly as-is is HY_BB, whose underscore is
 *  a code-identifier artifact, not part of the symbol a desk would
 *  actually write ("HY BB"). Swapping that one character is what lets
 *  every column in the matrix below share one width without any label
 *  wrapping or truncating — see that Panel's own comment. */
function ticker(id: string): string {
  return id.replace(/_/g, " ");
}

export default function RiskTab({
  input,
  portfolioId,
}: {
  input: ScenarioInput;
  portfolioId: string;
}) {
  // detectRegime() itself is cheap (threshold tests over the state object,
  // not an engine run) and safe to call on every render; correlationMatrix()
  // and assetRiskRanking() are NOT cheap (46 runScenario calls apiece), so
  // both are memoized on the regime id alone — they only ever need to
  // recompute when the DETECTED regime actually changes, not on every
  // keystroke that doesn't flip the regime.
  const regimeId = detectRegime(input.state, input.regimeOverride ?? null).active;
  const corr = React.useMemo(() => correlationMatrix(CORRELATION_INSTRUMENTS, regimeId), [regimeId]);
  const exposures = React.useMemo(() => factorExposures(input.notional), [input.notional]);
  const rateDv01Max = Math.max(...exposures.map((e) => Math.abs(e.rateDv01)), 0.0001);
  const creditDv01Max = Math.max(...exposures.map((e) => Math.abs(e.creditDv01)), 0.0001);
  const fxDeltaMax = Math.max(...exposures.map((e) => Math.abs(e.fxDelta)), 0.0001);
  const betaMax = Math.max(...exposures.map((e) => Math.abs(e.equityBeta)), 0.0001);

  // Every priced top-level instrument (sector children of SPX excluded —
  // they're a read-only decomposition of SPX, not a distinct position a desk
  // would rank on its own, same TOP_LEVEL_ASSETS convention the P&L tab's
  // default table uses). assetRiskRanking() itself still returns all 29,
  // tercile-tagged, exactly as before (lib/exposure.ts and its tests are
  // unchanged) — the panel below just takes the top/bottom 10 off that
  // already-sorted-descending-by-norm list (confirmed by
  // tests/exposure.test.ts's own "is sorted strictly descending" case) and
  // drops the 9 in between, on request ("remove the medium risk, just make
  // it high and low risk, 10 items each"). A fixed COUNT per side, not a
  // fixed magnitude threshold — same rank-based philosophy assetRiskRanking's
  // own header argues for, just two buckets of 10 instead of three terciles.
  const riskIds = React.useMemo(() => TOP_LEVEL_ASSETS.map((a) => a.id), []);
  const ranked = React.useMemo(() => assetRiskRanking(riskIds, regimeId), [riskIds, regimeId]);
  const normMax = Math.max(...ranked.map((r) => r.norm), 0.0001);
  const tiers = {
    high: ranked.slice(0, 10),
    low: ranked.slice(ranked.length - 10),
  };

  return (
    <div className="space-y-0">
      {/* Asset Risk Ranking — a grouped list, not a dense grid: every
          priced instrument bucketed by how much it moves, in aggregate,
          across all 46 macro shocks (the same unit-shock response vectors
          Asset Correlation below reduces to a cosine similarity instead of
          a magnitude — see lib/exposure.ts's assetRiskRanking). On request
          ("rank/group by risk tier... as a simpler organized list"),
          side-by-side columns rather than an asset x variable heatmap grid.

          Cut from three terciles (High/Medium/Low, ~10/10/9) to two fixed
          buckets of 10 (request: "remove the medium risk, just make it
          high and low risk, 10 items each") — the middle 9 instruments are
          still computed (ranked above is the full 29) but no longer shown:
          a desk asking "what's riskiest" and "what's safest" doesn't need
          the unremarkable middle restated. Two columns instead of three
          means each one now claims half the panel's width instead of a
          third (request: "expand horizontally to fit"), so the same 2
          instruments-per-row budget stretches further before truncating a
          label.

          The shaded badge around the number extends to meet the row's own
          right edge, on request ("extend the green shading... so it
          completely fills to the right of the line separating the low and
          high risk sections" — and then, correcting an over-literal first
          pass that coloured the whole row, "just the little bit to the
          right of it, so it meets the rightward line... not the whole
          row"). The row `<div>` used to carry `px-2` (padding on BOTH
          sides), so even though the badge was already the rightmost flex
          child, that right-hand padding still left an 8px gap of plain
          row between the badge's own edge and the row's true right edge —
          for the High Risk column, the line "separating the low and high
          risk sections" sits exactly there, so the badge fell just short
          of it instead of meeting it. Right padding is dropped from the
          row (`px-2` → `pl-2`) and moved onto the label (`pr-2`) instead,
          so the badge itself now extends all the way to the row's content
          edge with nothing held back — touching the divider on the High
          Risk side, and symmetrically the panel's own outer border on the
          Low Risk side, since both columns render from this same row
          markup. Only the badge is tinted, same as before the
          over-correction; the label and the zebra stripe/hover tint stay
          exactly as they were.

          Badge fill dropped on request ("not do highlights, just color the
          numbers"): the number itself is now coloured by heatText (its
          magnitude-scaled --up-bright/--down-bright text colour, floored
          so a small risk figure doesn't fade to unreadable rather than
          heatBg/heatFg's filled-box pair), with no background behind it —
          the fixed w-12 box and right alignment stay, since that's keeping
          the column of digits lined up rather than drawing a highlight. */}
      <Panel title="Asset Risk Ranking">
        <div className="grid grid-cols-2 gap-0">
          {(["high", "low"] as const).map((tier, ti) => (
            <div key={tier} className={ti < 1 ? "border-r border-term-edge" : ""}>
              <div className="border-b border-term-edge bg-term-raised px-2 py-dense text-th font-medium uppercase leading-[13px] text-term-muted">
                {TIER_LABEL[tier]}
              </div>
              {tiers[tier].map((r, i) => (
                <div
                  key={r.id}
                  className={`flex items-center justify-between pl-2 leading-[22px] hover:bg-term-line/10 ${
                    i % 2 === 1 ? "bg-term-zebra" : ""
                  }`}
                >
                  <span className="truncate pr-2 text-[11px] text-term-text">{r.label}</span>
                  {/* Fixed width (not shrink-to-fit) so every badge in the
                      column is the same rectangle regardless of how many
                      digits its own number happens to have — on request
                      ("make sure all the green highlight boxes are even in
                      terms of dimensions"). A shrink-to-fit badge hugs its
                      own text, so "15.54" (5 characters) rendered visibly
                      wider than "9.75" (4 characters) one row down; sizing
                      every badge to w-12 and right-aligning the number
                      inside it instead makes the fill itself the same
                      block from row to row, with only the number's
                      position (always flush right) staying anchored. w-12
                      comfortably fits this column's widest value (XX.XX,
                      5 characters) at this font/weight with room to spare. */}
                  <span
                    className="w-12 shrink-0 px-1 text-right font-mono text-[11px] tnum font-medium"
                    style={{ color: heatText(r.norm, normMax) }}
                  >
                    {fmtNum(r.norm, 2)}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </Panel>

      {/* Asset Correlation — model-implied, not realised/historical: this
          app has no price history to compute a realised correlation from
          (same reason P&L omits VaR/Sharpe), so each cell is the cosine
          similarity of two instruments' price response to the SAME set of
          46 one-at-a-time unit shocks, using the exact betas
          (lib/elasticities.ts) that price every other number in this app —
          see lib/exposure.ts's own header for the full reasoning and why
          this is a legitimate factor-model-implied correlation rather than
          an invented figure. Tied to the scenario's own detected regime
          (regimeId above), since correlation itself is regime-dependent
          (lib/regimes.ts: financial_stress's own gist literally says
          "cross-asset correlation rises toward one") — this matrix moves
          when the live scenario's regime does, rather than freezing one
          arbitrary baseline assumption. No unit suffix on any header (on
          request) and no caption below — the Panel title is the only label
          this needs.

          Widened once (request: "wider") from an earlier 8-instrument
          subset to the full 29-instrument TOP_LEVEL_ASSETS, trimmed back to
          20 by measured statistical redundancy (request: "remove excess
          assets that are normally correlated with each other"), then
          trimmed again to the 11 that belong on a cross-asset desk's
          correlation screen by finance-platform convention rather than by
          redundancy (request: "assets that are commonly correlated with
          each other on many finance platforms... remove excess things a
          trader wouldn't necessarily want to look at") — one or two
          representative instruments per asset class (rates curve,
          IG/HY credit, the three equity regions, oil + gold, EUR/USD +
          USD/JPY) instead of every tenor/tranche/pair that happens to be
          priced. See CORRELATION_INSTRUMENTS's own comment in
          lib/exposure.ts for the full reasoning behind both cuts.

          Equal-width columns on request ("make it so that each column has
          the same width" — the previous auto-layout table sized every
          column to its own header's content, so "Emerging Markets" made
          its column visibly wider than "Gold"'s, which read as uneven
          rather than a proper matrix). table-fixed with all 12 columns
          (the row-label column plus all 11 instruments) at the same
          1/12 width is what actually enforces that — auto-layout can't,
          no matter how the labels are shortened, since it always sizes a
          column to its own longest content. That only works cleanly once
          every label is short enough to fit a twelfth of the table
          without wrapping or truncating, which is the other half of the
          request ("switching to assets with shorter names"): ticker(),
          below, reuses each instrument's own `id` (already a short,
          conventional symbol — UST10Y, SPX, EURUSD, ...) instead of
          ASSET_BY_ID's full display label ("UST 10Y", "US Large Cap",
          "EUR/USD") used everywhere else in the app, just swapping back
          HY_BB's underscore for a space. Headers, row labels, and every
          value are centred (the third lever the request named) rather
          than the row labels' old left-align and the values' old
          right-align — consistent centring is what makes 12
          equal-but-independently-aligned columns actually read as a
          uniform grid instead of a table that merely happens to measure
          the same width per column. */}
      <Panel title="Asset Correlation">
        <ScrollHint>
          <table className="w-full min-w-[760px] table-fixed border-collapse text-[11px]">
            <thead>
              <tr className="bg-term-raised">
                <th className="w-[8.3333%] whitespace-nowrap border-b border-term-edge px-1 py-dense text-th font-medium uppercase leading-[13px] text-term-muted"></th>
                {CORRELATION_INSTRUMENTS.map((id) => (
                  <th
                    key={id}
                    className="w-[8.3333%] whitespace-nowrap border-b border-term-edge px-1 py-dense text-center text-th font-medium uppercase leading-[13px] text-term-muted"
                  >
                    {ticker(id)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CORRELATION_INSTRUMENTS.map((rowId, ri) => (
                <tr key={rowId} className={`hover:bg-term-line/10 ${ri % 2 === 1 ? "bg-term-zebra" : ""}`}>
                  <Td align="center" className="w-[8.3333%] whitespace-nowrap font-medium text-term-text">
                    {ticker(rowId)}
                  </Td>
                  {CORRELATION_INSTRUMENTS.map((colId, ci) => {
                    const v = corr[ri][ci];
                    const isDiag = rowId === colId;
                    return (
                      <Td
                        key={colId}
                        align="center"
                        mono
                        className={`w-[8.3333%] ${isDiag ? "font-bold" : ""}`}
                        style={
                          isDiag
                            ? { background: "rgb(var(--term-line) / 0.25)", color: "rgb(var(--term-text))" }
                            : { background: heatBg(v, 1), color: heatFg(v, 1) }
                        }
                      >
                        {v.toFixed(2)}
                      </Td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollHint>
      </Panel>

      {/* Exposure — aggregate factor risk per allocation, distinct from
          Portfolio Impact Summary's dollar P&L view on the P&L tab (P&L is
          what the CURRENT scenario did; this is what WOULD happen to a
          $1bp/1% nudge in each factor, regardless of scenario). Every
          figure here is a direct function of real sleeve weights,
          Asset.duration, and DERIVED_EQUITY's beta-to-SPX
          (lib/exposure.ts) — nothing fitted or guessed. FX Delta used to
          read a flat $0 for every allocation (no model portfolio holds FX
          or Commodity weight directly — see portfolios.ts) — correct as
          far as it went, but it stopped at direct holdings and so missed
          the real currency-translation risk already priced into the
          international equity sleeve (EAFE/EM — see fxDelta()'s own
          comment in lib/exposure.ts for the SECOND_ROUND beta this now
          reads). Heat-scaled like the other three columns now that it's a
          real, varying figure rather than a constant.

          Fill dropped on request ("do the same for the exposure section" —
          following Asset Risk Ranking above): each cell now colours only
          its own number via heatText (magnitude-scaled --up-bright/
          --down-bright, signed the same way heatBg/heatFg already were)
          with no background block behind it. */}
      <Panel title="Exposure">
        <ScrollHint>
          <table className="w-full min-w-[640px] table-fixed border-collapse text-[11px]">
            <thead>
              <tr className="bg-term-raised">
                <Th className="w-[22%]">Allocation</Th>
                <Th align="right" className="w-[20%]">
                  Rate DV01
                </Th>
                <Th align="right" className="w-[22%]">
                  Credit Spread DV01
                </Th>
                <Th align="right" className="w-[18%]">
                  FX Delta
                </Th>
                <Th align="right" className="w-[18%]">
                  Equity Beta
                </Th>
              </tr>
            </thead>
            <tbody>
              {exposures.map((e, i) => (
                <tr key={e.portfolioId} className={`hover:bg-term-line/10 ${i % 2 === 1 ? "bg-term-zebra" : ""}`}>
                  <Td className="font-medium text-term-text">{e.label}</Td>
                  <Td
                    align="right"
                    mono
                    className="font-medium"
                    style={{ color: heatText(e.rateDv01, rateDv01Max) }}
                  >
                    {fmtUsd(e.rateDv01)}
                  </Td>
                  <Td
                    align="right"
                    mono
                    className="font-medium"
                    style={{ color: heatText(e.creditDv01, creditDv01Max) }}
                  >
                    {fmtUsd(e.creditDv01)}
                  </Td>
                  <Td
                    align="right"
                    mono
                    className="font-medium"
                    style={{ color: heatText(e.fxDelta, fxDeltaMax) }}
                  >
                    {fmtUsd(e.fxDelta)}
                  </Td>
                  <Td
                    align="right"
                    mono
                    className="font-medium"
                    style={{ color: heatText(e.equityBeta, betaMax) }}
                  >
                    {fmtNum(e.equityBeta, 2)}x
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollHint>
      </Panel>
    </div>
  );
}
