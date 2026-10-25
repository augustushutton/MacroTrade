"use client";

import React from "react";
import { GROUP_ORDER, SECTORS, TOP_LEVEL_ASSETS, type Asset } from "@/lib/assets";
import { factorAttribution, type AssetResult, type EngineResult, type PortfolioResult } from "@/lib/engine";
import { BOND_SLEEVE, PORTFOLIOS } from "@/lib/portfolios";
import { fmtPct, fmtUsd, signColor, signFillBg, signFillFg } from "@/lib/format";
import { Cap, GroupHeader, Panel, Td, Th, Tooltip, useFlash } from "./ui";
import { ScrollHint } from "./ScrollHint";

// Factor Attribution: which macro category actually drove the selected
// portfolio's P&L, not just which asset moved. This is a proportional
// decomposition of the exact number already in Portfolio Impact Summary
// above — see factorAttribution's own comment in lib/engine.ts for how the
// split is computed and why it always sums back to that exact number.
function FactorAttributionPanel({ r, selected }: { r: EngineResult; selected: string }) {
  const attrib = React.useMemo(() => factorAttribution(r, selected), [r, selected]);
  if (attrib.length === 0) {
    return (
      <Panel title="Factor Attribution">
        <div className="px-3 py-4">
          <Cap>Nothing to attribute yet.</Cap>
        </div>
      </Panel>
    );
  }
  const total = attrib.reduce((s, f) => s + Math.abs(f.contribPct), 0) || 1;
  // The single biggest driver of this scenario's P&L gets the same amber
  // "spotlight" outline as the selected portfolio's headline return and a
  // pinned asset's headline % — the recurring cue for "this is the number
  // in this table that matters most," not a fourth colour meaning. Ties
  // (e.g. two factors both at exactly the baseline) intentionally light up
  // only the first found, matching how there's always exactly one selected
  // portfolio row.
  const maxAbs = attrib.reduce((m, f) => Math.max(m, Math.abs(f.contribPct)), 0);
  const dominantId = maxAbs > 0 ? attrib.find((f) => Math.abs(f.contribPct) === maxAbs)?.id : undefined;
  return (
    <Panel title="Factor Attribution">
      <div className="overflow-x-auto">
        {/* table-fixed, every column explicitly widthed: plain table-auto
            layout stretches unconstrained columns unevenly on a very wide
            monitor rather than leaving them at content width, which is what
            used to strand a number far from its row with a dead gap in
            front of it. Fixed layout scales every column by the same ratio
            instead. See app/providers.tsx for the page-width side of this. */}
        <table className="w-full table-fixed border-collapse text-[11px]">
          <thead>
            <tr className="bg-term-raised">
              <Th className="w-[70%]">Category</Th>
              <Th align="right" className="w-[18%]">
                P&amp;L (pp)
              </Th>
              <Th align="right" className="w-[12%]">
                Share
              </Th>
            </tr>
          </thead>
          <tbody>
            {attrib.map((f) => (
              <tr key={f.id} className="even:bg-term-zebra">
                <Td className="text-term-text">{f.label}</Td>
                <Td
                  align="right"
                  mono
                  className="font-medium"
                  style={{
                    // Same magnitude-scaled solid block as the Portfolio
                    // Impact Summary rows below — scaled against maxAbs
                    // (already computed above for the dominant-driver
                    // spotlight), so the single biggest factor in this table
                    // reads as the most saturated block, exactly like IB's
                    // own CHANGE column scales against the biggest mover in
                    // the list. White text (signFillFg) once the fill is
                    // dark enough, never near-black, since a saturated fill
                    // this dark makes near-black nearly vanish (see
                    // lib/format.ts's comment on signFillFg).
                    backgroundColor: signFillBg(f.contribPct, maxAbs),
                    color: signFillFg(f.contribPct, maxAbs),
                    boxShadow: f.id === dominantId ? "inset 0 0 0 1.5px rgb(var(--warn))" : undefined,
                  }}
                >
                  {fmtPct(f.contribPct)}
                </Td>
                <Td align="right" mono className="text-term-muted">
                  {((Math.abs(f.contribPct) / total) * 100).toFixed(0)}%
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

// Portfolio Impact Summary (one row per allocation strategy) is exported
// separately and rendered above the analytics tabs in page.tsx, since it
// applies regardless of which tab is active. The default export here is
// just the Asset Detail table — the P&L Attribution tab's content. Duration
// is aggregated from each bond's own modified duration (see
// lib/portfolios.ts), not a separate estimate. VaR and Sharpe are omitted —
// the engine has no covariance model, so neither figure would be backed by
// a real computation.

function portfolioDuration(r: EngineResult, portfolioId: string): number {
  const p = PORTFOLIOS.find((x) => x.id === portfolioId);
  if (!p) return 0;
  let dur = 0;
  for (const s of BOND_SLEEVE) {
    const ar = r.assets[s.asset];
    if (ar?.duration === undefined) continue;
    dur += (p.bond / 100) * (s.w / 100) * ar.duration;
  }
  return dur;
}

function PortfolioRow({
  r,
  p,
  isSel,
  zebra,
  onSelect,
  notional,
  hydrated,
  dollarsMax,
  pctMax,
}: {
  r: EngineResult;
  p: PortfolioResult;
  isSel: boolean;
  zebra: boolean;
  onSelect: (id: string) => void;
  notional: number;
  hydrated: boolean;
  /** Biggest |dollars| / |pct| across the four allocation rows in this same
   *  table, computed once by the parent — see signFillBg's comment for why
   *  the scale has to be relative to what's on screen together. */
  dollarsMax: number;
  pctMax: number;
}) {
  const shocked = notional + p.dollars;
  const pctFlash = useFlash(p.pct, hydrated);
  const dollarsFlash = useFlash(p.dollars, hydrated);
  const shockedFlash = useFlash(shocked, hydrated);
  return (
    <tr
      onClick={() => onSelect(p.id)}
      // Flat grey wash, on request ("remove the thick 3D highlighting...
      // just a slightly grey highlighting") — bg-term-raised carries this
      // app's global embossed bevel (globals.css's box-shadow rule on that
      // class), which reads as a physical raised button face stamped
      // across the whole row; a selected table row isn't a button, so it
      // doesn't need that treatment. bg-term-line (a flat neutral grey,
      // no box-shadow of its own) at low opacity gives the same "this row
      // is picked out" cue without the bevel. Selected sits a notch more
      // visible than hover so the two stay distinguishable.
      className={`cursor-pointer ${
        isSel ? "bg-term-line/20" : zebra ? "bg-term-zebra" : ""
      } hover:bg-term-line/10`}
    >
      <Td
        className={
          isSel
            ? "border-l-2 border-l-info font-medium text-term-text"
            : "border-l-2 border-l-transparent text-term-sub"
        }
      >
        {isSel ? <span className="text-info">&#9656;</span> : <span className="text-term-sub">&#9656;</span>} {p.label}
      </Td>
      <Td align="right" mono className="text-term-muted">
        {fmtUsd(notional)}
      </Td>
      <Td align="right" mono className={`${signColor(p.dollars)} ${shockedFlash}`}>
        {fmtUsd(shocked)}
      </Td>
      <Td
        align="right"
        mono
        className={`font-medium ${dollarsFlash}`}
        style={{ backgroundColor: signFillBg(p.dollars, dollarsMax), color: signFillFg(p.dollars, dollarsMax) }}
      >
        {fmtUsd(p.dollars)}
      </Td>
      <Td
        align="right"
        mono
        className={`font-medium ${pctFlash}`}
        style={{
          backgroundColor: signFillBg(p.pct, pctMax),
          color: signFillFg(p.pct, pctMax),
          boxShadow: isSel ? "inset 0 0 0 1.5px rgb(var(--warn))" : undefined,
        }}
      >
        {fmtPct(p.pct)}
      </Td>
      <Td align="right" mono className="text-term-muted">
        {portfolioDuration(r, p.id).toFixed(1)}y
      </Td>
    </tr>
  );
}

export function PortfolioSummary({
  r,
  selected,
  onSelect,
  notional,
  hydrated,
}: {
  r: EngineResult;
  selected: string;
  onSelect: (id: string) => void;
  notional: number;
  hydrated: boolean;
}) {
  // Computed once here, not per-row — see signFillBg's comment for why the
  // fill opacity scales against the biggest move in the SAME table rather
  // than a fixed constant. Dollars and percent get their own max since
  // they're different units; the epsilon floor keeps a flat-baseline
  // scenario (every row at exactly $0 / 0%) from dividing by zero.
  const dollarsMax = Math.max(...r.portfolios.map((p) => Math.abs(p.dollars)), 1);
  const pctMax = Math.max(...r.portfolios.map((p) => Math.abs(p.pct)), 0.01);
  return (
    <Panel title="Portfolio Impact Summary">
      <ScrollHint>
      {/* table-fixed, every column explicitly widthed — see the comment on
          FactorAttributionPanel's table above for why. min-w added
          alongside the same fix on the Bonds Asset Detail table below (see
          its comment) — six columns including two dollar values compressed
          illegibly instead of ever triggering this wrapper's scroll. */}
      <table className="w-full min-w-[600px] table-fixed border-collapse text-[11px]">
        <thead>
          <tr className="bg-term-raised">
            <Th className="w-[18%]">Allocation</Th>
            <Th align="right" className="w-[17%]">
              Baseline Value
            </Th>
            <Th align="right" className="w-[17%]">
              Shocked Value
            </Th>
            <Th align="right" className="w-[17%]">
              Net P&amp;L ($)
            </Th>
            <Th align="right" className="w-[16%]">
              Return (%)
            </Th>
            <Th align="right" className="w-[15%]">
              Duration
            </Th>
          </tr>
        </thead>
        <tbody>
          {r.portfolios.map((p, i) => (
            <PortfolioRow
              key={p.id}
              r={r}
              p={p}
              isSel={selected === p.id}
              zebra={i % 2 === 1}
              onSelect={onSelect}
              notional={notional}
              hydrated={hydrated}
              dollarsMax={dollarsMax}
              pctMax={pctMax}
            />
          ))}
        </tbody>
      </table>
      </ScrollHint>
    </Panel>
  );
}

export type SortKey = "w" | "rate" | "spread" | "yield" | "duration" | "price" | "contrib";
export type SortDir = "asc" | "desc";

function sortValue(a: Asset, ar: AssetResult, w: number | undefined, key: SortKey): number {
  const NEG = Number.NEGATIVE_INFINITY;
  switch (key) {
    case "w":
      return w === undefined ? NEG : w;
    case "rate":
      return ar.rateLegBp ?? NEG;
    case "spread":
      return ar.spreadBp ?? NEG;
    case "yield":
      return ar.yieldBp ?? NEG;
    case "duration":
      return ar.duration ?? NEG;
    case "price":
      return ar.pricePct;
    case "contrib":
      return w === undefined ? NEG : (w / 100) * ar.pricePct;
  }
}

/** Unweighted mean Price Impact % across a set of instruments — used as each
 *  compact asset-class card's footer figure, since Commodities/FX carry no
 *  portfolio weight to average by (see the AssetRowLean comment below) and a
 *  simple mean still answers "how did this asset class move, broadly." */
function avgPrice(rows: Asset[], r: EngineResult): number {
  const vals: number[] = [];
  for (const a of rows) {
    const v = r.assets[a.id]?.pricePct;
    if (v !== undefined) vals.push(v);
  }
  if (vals.length === 0) return 0;
  return vals.reduce((s, v) => s + v, 0) / vals.length;
}

/** Nested beneath its parent SPX row — SPX sectors aren't a separate
 *  holding, they're a decomposition of the one row above, so they ride on
 *  the same `bg-term-raised` family rather than the flat `bg-term-panel`
 *  everything else uses. Previously told apart only by a hairline rule
 *  between each one; now the "alternative dark black and lighter black
 *  structure" asked for elsewhere in this app does the same job here —
 *  every other sector row steps up one shade (bg-term-zebra, which already
 *  reads lighter than bg-term-raised in the dark theme) instead of a line
 *  between them. */
function SectorRow({ s, r, hydrated, zebra }: { s: Asset; r: EngineResult; hydrated: boolean; zebra: boolean }) {
  const sr = r.assets[s.id];
  const priceFlash = useFlash(sr?.pricePct ?? 0, hydrated && sr !== undefined);
  if (!sr) return null;
  return (
    <tr className={`hover:bg-term-line/10 ${zebra ? "bg-term-zebra" : "bg-term-raised"}`}>
      <Td className="pl-6 text-term-muted">{s.label}</Td>
      {/* Sectors are a decomposition of SPX, not a separate holding, so
          Weight/Rate/Spread/Yield/Duration/Contribution genuinely don't
          apply — an explicit dash in every one of those cells, not a mix of
          "n/a" text and silent blanks, so the row reads as one consistent
          "not applicable" statement rather than a table that forgot to fill
          itself in. */}
      <Td align="right" mono className="text-term-sub">
        &mdash;
      </Td>
      <Td align="right" mono className="text-term-sub">
        &mdash;
      </Td>
      <Td align="right" mono className="text-term-sub">
        &mdash;
      </Td>
      <Td align="right" mono className="text-term-sub">
        &mdash;
      </Td>
      <Td align="right" mono className="text-term-sub">
        &mdash;
      </Td>
      <Td align="right" mono className={`font-medium ${signColor(sr.pricePct)} ${priceFlash}`}>
        {fmtPct(sr.pricePct)}
      </Td>
      <Td align="right" mono className="text-term-sub">
        &mdash;
      </Td>
    </tr>
  );
}

function AssetRow({
  a,
  r,
  w,
  zebra,
  isSpx,
  openSectors,
  setOpenSectors,
  hydrated,
  pinned,
  onTogglePin,
  onJumpToDerivation,
}: {
  a: Asset;
  r: EngineResult;
  w: number | undefined;
  zebra: boolean;
  isSpx: boolean;
  openSectors: boolean;
  setOpenSectors: (fn: (v: boolean) => boolean) => void;
  hydrated: boolean;
  pinned: boolean;
  onTogglePin: () => void;
  onJumpToDerivation: () => void;
}) {
  const ar = r.assets[a.id];
  const contrib = ar === undefined || w === undefined ? undefined : (w / 100) * ar.pricePct;
  const priceFlash = useFlash(ar?.pricePct ?? 0, hydrated && ar !== undefined);
  const contribFlash = useFlash(contrib ?? 0, hydrated && contrib !== undefined);
  if (!ar) return null;

  return (
    <React.Fragment>
      {/* `onClick={onTogglePin}` added to the row itself, on request ("if you
          select anywhere on a row... that it stars it so you don't have to
          click the exact star button") — the row's own hover highlight
          (hover:bg-term-line/10) already signalled "this whole row is one
          unit," so a click target narrower than that highlight was the
          actual inconsistency. `cursor-pointer` makes that affordance
          visible before the click, not just on hover. Every OTHER
          interactive element nested inside this row — the star button
          itself, the sector +/- toggle, the "view derivation" link on the
          Price % cell — stops the click from bubbling up to this handler,
          so clicking any of those still does ONLY what it already did
          (without the stop, a click on the star button would fire both the
          button's own onTogglePin AND the row's, toggling the pin twice —
          net no-op — and a click meant to expand sectors or jump to
          Derivation would silently also flip the pin). */}
      <tr
        onClick={onTogglePin}
        className={`cursor-pointer hover:bg-term-line/10 ${zebra ? "bg-term-zebra" : ""}`}
      >
        <Td>
          <div className="flex items-baseline gap-1">
            <Tooltip content={pinned ? "Unpin" : "Pin to top"}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onTogglePin();
                }}
                className={`w-[10px] leading-none ${pinned ? "text-warn" : "text-term-sub"}`}
              >
                {pinned ? "★" : "☆"}
              </button>
            </Tooltip>
            {isSpx ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenSectors((v) => !v);
                }}
                className="w-[9px] font-mono text-term-sub hover:text-term-text"
              >
                {openSectors ? "-" : "+"}
              </button>
            ) : (
              <span className="w-[9px]" />
            )}
            <span className="text-term-sub">{a.label}</span>
          </div>
        </Td>
        <Td align="right" mono className="text-term-muted">
          {w === undefined ? <span className="text-term-sub">&mdash;</span> : w.toFixed(1)}
        </Td>
        {/* Rate/spread/yield are the SHOCK, not the P&L — a +3.91% yield
            move is bad for a bondholder, but colouring it red would mean
            "positive number, red text," which is a worse trap than no
            colour at all. Only Price %/Contrib % carry direction colour;
            these three stay neutral so a trader reads magnitude here and
            direction once, in the Price % column, rather than resolving a
            sign flip across four columns in their head.
            An explicit em dash — not a blank cell — for the rows these
            columns don't apply to (an equity/commodity/FX row has no rate
            leg, spread leg, yield, or duration): a blank cell here reads
            like the value failed to load, not like "this instrument has no
            such thing," which is what Derivation's channel table already
            uses the same dash for. */}
        <Td align="right" mono className="text-term-sub">
          {/* On request — basis points shown as percent everywhere. rateLegBp/
              spreadBp/yieldBp stay bp-denominated internally (the engine's
              own maths are untouched); dividing by 100 here is a display-only
              conversion. 2dp matches fmtBp's old default (whole bp = 1bp =
              0.01%), so no resolution is lost. */}
          {ar.rateLegBp === undefined ? <span className="text-term-sub">&mdash;</span> : fmtPct(ar.rateLegBp / 100)}
        </Td>
        <Td align="right" mono className="text-term-sub">
          {ar.spreadBp === undefined ? <span className="text-term-sub">&mdash;</span> : fmtPct(ar.spreadBp / 100)}
        </Td>
        <Td align="right" mono className="text-term-sub">
          {ar.yieldBp === undefined ? <span className="text-term-sub">&mdash;</span> : fmtPct(ar.yieldBp / 100)}
        </Td>
        <Td align="right" mono className="text-term-muted">
          {ar.duration === undefined ? <span className="text-term-sub">&mdash;</span> : ar.duration.toFixed(1)}
        </Td>
        <Td align="right" mono className="p-0">
          <Tooltip content="View derivation" display="flex" className="w-full">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onJumpToDerivation();
              }}
              className={`block w-full px-1.5 py-1 text-right font-medium ${signColor(ar.pricePct)} ${priceFlash}`}
            >
              {fmtPct(ar.pricePct)}
            </button>
          </Tooltip>
        </Td>
        <Td
          align="right"
          mono
          className={`${contrib === undefined ? "" : signColor(contrib)} ${contribFlash}`}
          style={{ boxShadow: pinned && contrib !== undefined ? "inset 0 0 0 1.5px rgb(var(--warn))" : undefined }}
        >
          {contrib === undefined ? <span className="text-term-sub">&mdash;</span> : fmtPct(contrib)}
        </Td>
      </tr>
      {isSpx && openSectors
        ? SECTORS.map((s, si) => <SectorRow key={s.id} s={s} r={r} hydrated={hydrated} zebra={si % 2 === 1} />)
        : null}
    </React.Fragment>
  );
}

// Equities, Commodities and FX never carry rate/spread/yield/duration — those
// are a bond's shock legs, not a property every instrument has — and
// Commodities/FX never carry a portfolio weight or contribution either,
// since no model portfolio (lib/portfolios.ts) holds any commodity or FX
// position at all, in any of the four allocations. AssetRow/SectorRow above
// already said as much with an em dash in each of those cells, correctly,
// but that meant every Equities row carried 4 dead cells and every
// Commodities/FX row carried 6 of its 7 — a wide, mostly-empty grid repeated
// for asset classes it never applied to. These two narrower row shapes give
// each asset class only the columns it actually has data for.

/** Equities row: Instrument, Weight %, Price Impact %, P&L Contribution % —
 *  the exact number, colour-coded by sign, rather than a magnitude bar
 *  alongside it. */
function AssetRowEquity({
  a,
  r,
  w,
  zebra,
  isSpx,
  openSectors,
  setOpenSectors,
  hydrated,
  pinned,
  onTogglePin,
  onJumpToDerivation,
}: {
  a: Asset;
  r: EngineResult;
  w: number | undefined;
  zebra: boolean;
  isSpx: boolean;
  openSectors: boolean;
  setOpenSectors: (fn: (v: boolean) => boolean) => void;
  hydrated: boolean;
  pinned: boolean;
  onTogglePin: () => void;
  onJumpToDerivation: () => void;
}) {
  const ar = r.assets[a.id];
  const contrib = ar === undefined || w === undefined ? undefined : (w / 100) * ar.pricePct;
  const priceFlash = useFlash(ar?.pricePct ?? 0, hydrated && ar !== undefined);
  const contribFlash = useFlash(contrib ?? 0, hydrated && contrib !== undefined);
  if (!ar) return null;

  return (
    <React.Fragment>
      {/* Same "click anywhere on the row to pin" treatment as AssetRow above
          — see that component's own comment for the full reasoning. */}
      <tr
        onClick={onTogglePin}
        className={`cursor-pointer hover:bg-term-line/10 ${zebra ? "bg-term-zebra" : ""}`}
      >
        <Td>
          <div className="flex items-baseline gap-1">
            <Tooltip content={pinned ? "Unpin" : "Pin to top"}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onTogglePin();
                }}
                className={`w-[10px] leading-none ${pinned ? "text-warn" : "text-term-sub"}`}
              >
                {pinned ? "★" : "☆"}
              </button>
            </Tooltip>
            {isSpx ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenSectors((v) => !v);
                }}
                className="w-[9px] font-mono text-term-sub hover:text-term-text"
              >
                {openSectors ? "-" : "+"}
              </button>
            ) : (
              <span className="w-[9px]" />
            )}
            <span className="text-term-sub">{a.label}</span>
          </div>
        </Td>
        <Td align="right" mono className="text-term-muted">
          {w === undefined ? <span className="text-term-sub">&mdash;</span> : w.toFixed(1)}
        </Td>
        <Td align="right" mono className="p-0">
          <Tooltip content="View derivation" display="flex" className="w-full">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onJumpToDerivation();
              }}
              className={`block w-full px-1.5 py-1 text-right font-medium ${signColor(ar.pricePct)} ${priceFlash}`}
            >
              {fmtPct(ar.pricePct)}
            </button>
          </Tooltip>
        </Td>
        <Td
          align="right"
          mono
          className={`${contrib === undefined ? "" : signColor(contrib)} ${contribFlash}`}
          style={{ boxShadow: pinned && contrib !== undefined ? "inset 0 0 0 1.5px rgb(var(--warn))" : undefined }}
        >
          {contrib === undefined ? <span className="text-term-sub">&mdash;</span> : fmtPct(contrib)}
        </Td>
      </tr>
      {isSpx && openSectors
        ? SECTORS.map((s, si) => <SectorRowEquity key={s.id} s={s} r={r} hydrated={hydrated} zebra={si % 2 === 1} />)
        : null}
    </React.Fragment>
  );
}

function SectorRowEquity({ s, r, hydrated, zebra }: { s: Asset; r: EngineResult; hydrated: boolean; zebra: boolean }) {
  const sr = r.assets[s.id];
  const priceFlash = useFlash(sr?.pricePct ?? 0, hydrated && sr !== undefined);
  if (!sr) return null;
  return (
    <tr className={`hover:bg-term-line/10 ${zebra ? "bg-term-zebra" : "bg-term-raised"}`}>
      <Td className="pl-6 text-term-muted">{s.label}</Td>
      <Td align="right" mono className="text-term-sub">
        &mdash;
      </Td>
      <Td align="right" mono className={`font-medium ${signColor(sr.pricePct)} ${priceFlash}`}>
        {fmtPct(sr.pricePct)}
      </Td>
      <Td align="right" mono className="text-term-sub">
        &mdash;
      </Td>
    </tr>
  );
}

/** Commodities/FX row: Instrument, Price Impact % — the one column either
 *  asset class ever has a real value in. No expand affordance either; unlike
 *  SPX, nothing here decomposes into sub-instruments. */
function AssetRowLean({
  a,
  r,
  zebra,
  hydrated,
  pinned,
  onTogglePin,
  onJumpToDerivation,
}: {
  a: Asset;
  r: EngineResult;
  zebra: boolean;
  hydrated: boolean;
  pinned: boolean;
  onTogglePin: () => void;
  onJumpToDerivation: () => void;
}) {
  const ar = r.assets[a.id];
  const priceFlash = useFlash(ar?.pricePct ?? 0, hydrated && ar !== undefined);
  if (!ar) return null;

  return (
    // Same "click anywhere on the row to pin" treatment as AssetRow above —
    // see that component's own comment for the full reasoning.
    <tr
      onClick={onTogglePin}
      className={`cursor-pointer hover:bg-term-line/10 ${zebra ? "bg-term-zebra" : ""}`}
    >
      <Td>
        <div className="flex items-baseline gap-1">
          <Tooltip content={pinned ? "Unpin" : "Pin to top"}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onTogglePin();
              }}
              className={`w-[10px] leading-none ${pinned ? "text-warn" : "text-term-sub"}`}
            >
              {pinned ? "★" : "☆"}
            </button>
          </Tooltip>
          <span className="text-term-sub">{a.label}</span>
        </div>
      </Td>
      <Td
        align="right"
        mono
        className="p-0"
        style={{ boxShadow: pinned ? "inset 0 0 0 1.5px rgb(var(--warn))" : undefined }}
      >
        <Tooltip content="View derivation" display="flex" className="w-full">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onJumpToDerivation();
            }}
            className={`block w-full px-1.5 py-1 text-right font-medium ${signColor(ar.pricePct)} ${priceFlash}`}
          >
            {fmtPct(ar.pricePct)}
          </button>
        </Tooltip>
      </Td>
    </tr>
  );
}

export default function PnlTab({
  r,
  selected,
  hydrated,
  pinned,
  onTogglePin,
  onJumpToDerivation,
  openSectors,
  setOpenSectors,
  sortKey,
  setSortKey,
  sortDir,
  setSortDir,
}: {
  r: EngineResult;
  selected: string;
  hydrated: boolean;
  pinned: string[];
  onTogglePin: (id: string) => void;
  onJumpToDerivation: (id: string) => void;
  openSectors: boolean;
  setOpenSectors: (fn: (v: boolean) => boolean) => void;
  sortKey: SortKey | null;
  setSortKey: (k: SortKey | null) => void;
  sortDir: SortDir;
  setSortDir: (d: SortDir) => void;
}) {
  const port = r.portfolios.find((p) => p.id === selected) ?? r.portfolios[0];
  const wByAsset: Record<string, number> = {};
  for (const l of port.lines) wByAsset[l.asset] = l.w;
  const pinnedSet = React.useMemo(() => new Set(pinned), [pinned]);

  function toggleSort(key: SortKey) {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("desc");
      return;
    }
    if (sortDir === "desc") {
      setSortDir("asc");
      return;
    }
    setSortKey(null);
  }

  function sortDirOf(key: SortKey): "asc" | "desc" | undefined {
    return sortKey === key ? sortDir : undefined;
  }

  function sortRows(rowsRaw: Asset[]): Asset[] {
    if (!sortKey) return rowsRaw;
    return [...rowsRaw].sort((x, y) => {
      const ax = r.assets[x.id];
      const ay = r.assets[y.id];
      if (!ax || !ay) return 0;
      const vx = sortValue(x, ax, wByAsset[x.id], sortKey);
      const vy = sortValue(y, ay, wByAsset[y.id], sortKey);
      return sortDir === "asc" ? vx - vy : vy - vx;
    });
  }

  const bondRows = sortRows(TOP_LEVEL_ASSETS.filter((a) => a.group === "Bonds"));
  const equityRows = sortRows(TOP_LEVEL_ASSETS.filter((a) => a.group === "Equities"));
  const commodityRows = sortRows(TOP_LEVEL_ASSETS.filter((a) => a.group === "Commodities"));
  const fxRows = sortRows(TOP_LEVEL_ASSETS.filter((a) => a.group === "FX"));

  // Summary figures for the three compact asset-class cards below.
  const equityAvg = avgPrice(equityRows, r);
  const commodityAvg = avgPrice(commodityRows, r);
  const fxAvg = avgPrice(fxRows, r);

  // The full 8-column header — Bonds is the one section where every column
  // is potentially real data. Equities/Commodities/FX get their own
  // narrower headers below instead of this one with cells they'd never
  // fill in.
  const fullHead = (
    <tr className="sticky top-0 z-10 bg-term-raised">
      <Th className="w-[24%]">Instrument</Th>
      <Th align="right" className="w-[9%]" onClick={() => toggleSort("w")} sortDir={sortDirOf("w")}>
        Weight %
      </Th>
      <Th align="right" className="w-[12%]" onClick={() => toggleSort("rate")} sortDir={sortDirOf("rate")}>
        Rate Shock (%)
      </Th>
      <Th align="right" className="w-[12%]" onClick={() => toggleSort("spread")} sortDir={sortDirOf("spread")}>
        Spread Shock (%)
      </Th>
      <Th align="right" className="w-[11%]" onClick={() => toggleSort("yield")} sortDir={sortDirOf("yield")}>
        Shocked Yield
      </Th>
      <Th align="right" className="w-[9%]" onClick={() => toggleSort("duration")} sortDir={sortDirOf("duration")}>
        Duration
      </Th>
      <Th align="right" className="w-[12%]" onClick={() => toggleSort("price")} sortDir={sortDirOf("price")}>
        Price Impact %
      </Th>
      <Th align="right" className="w-[11%]" onClick={() => toggleSort("contrib")} sortDir={sortDirOf("contrib")}>
        P&amp;L Contribution %
      </Th>
    </tr>
  );

  return (
    <>
      <FactorAttributionPanel r={r} selected={port.id} />
      <Panel title={`Asset Detail — ${port.label} weights`}>
        {/* Bonds: the one asset class where all 8 columns are real data —
            full-width table. min-w added by request ("resize correctly on
            every device") — confirmed via a 390px-wide screenshot that
            without it, table-fixed just divides the viewport by 8 instead
            of ever triggering this wrapper's overflow-x-auto scroll, which
            mashed every figure in the row together illegibly (worse than
            Trading's Desk table, which already had a min-w and merely
            lacked a visual scroll cue — see ScrollHint). 720px keeps every
            header's full label on one line at the width this table
            actually needs. */}
        <ScrollHint className="border-b border-term-edge">
          <table className="w-full min-w-[720px] table-fixed border-collapse text-[11px]">
            <thead>{fullHead}</thead>
            <tbody>
              <tr>
                <td colSpan={8} className="p-0">
                  <GroupHeader>Bonds</GroupHeader>
                </td>
              </tr>
              {bondRows.map((a, ri) => (
                <AssetRow
                  key={a.id}
                  a={a}
                  r={r}
                  w={wByAsset[a.id]}
                  zebra={ri % 2 === 1}
                  isSpx={false}
                  openSectors={openSectors}
                  setOpenSectors={setOpenSectors}
                  hydrated={hydrated}
                  pinned={pinnedSet.has(a.id)}
                  onTogglePin={() => onTogglePin(a.id)}
                  onJumpToDerivation={() => onJumpToDerivation(a.id)}
                />
              ))}
            </tbody>
          </table>
        </ScrollHint>

        {/* Equities/Commodities/FX: none of them carry a rate/spread/yield/
            duration leg, and Commodities/FX never carry a portfolio weight
            or contribution either — no model portfolio holds either asset
            class (lib/portfolios.ts). Each gets only the columns it has real
            values for, in its own bordered card instead of one wide table
            mostly filled with dashes. The three cards sit in a grid rather
            than flex-wrap specifically so a CSS grid row's default
            align-items:stretch makes every card exactly as tall as the
            tallest one (FX, with the most instruments) — each card's own
            flex-col layout then pins its footer to that shared bottom edge
            with `mt-auto`, so a short card (Equities, 4 rows) ends in a
            deliberate summary bar at the same height as a long one, not a
            ragged edge of leftover white space. */}
        {/* Always 3 columns, not 1-below-sm — the site no longer reflows
            its layout for a narrow viewport (phone or a resized desktop
            window): the whole page pans as one unit instead, via `<main>`'s
            own `min-w-[1280px]` (providers.tsx) and `html`'s existing
            `overflow-x: auto` (globals.css). These three cards used to be
            `grid-cols-3`, i.e. three `minmax(0, 1fr)` tracks — a track with
            a `0` floor is free to compress a card (and the table inside it)
            below its own content's natural width, which is what forced
            Equities' table into its own local `ScrollHint`/scroll island in
            the first place (an arrow appearing mid-card to say "there's
            more, scroll sideways here specifically"). That's exactly the
            per-component shrinking this page is supposed to not do anymore.
            Explicit `minmax(<floor>, 1fr)` tracks below give each card a
            real floor — Equities' at 420px (its table's own genuine
            per-table minimum: four columns, nine-ish figures), the other
            two at a narrower floor that still fits their two columns — so
            the tracks still grow to fill extra space at full width, but
            never shrink a card's table below legibility. If all three
            floors together don't fit the viewport, the three-card row
            overflows the grid as a whole and the page's own existing
            pan handles it, the same as everywhere else — not a chevron on
            one card. */}
        <div className="grid grid-cols-[minmax(420px,1fr)_minmax(260px,1fr)_minmax(260px,1fr)] gap-0 border-b border-term-edge p-2">
          <div className="flex flex-col border border-term-edge bg-term-panel">
            <GroupHeader>Equities</GroupHeader>
            <div>
              <table className="w-full min-w-[420px] table-fixed border-collapse text-[11px]">
                <thead>
                  <tr className="bg-term-raised">
                    <Th className="w-[44%]">Instrument</Th>
                    <Th align="right" className="w-[16%]" onClick={() => toggleSort("w")} sortDir={sortDirOf("w")}>
                      Wt %
                    </Th>
                    <Th align="right" className="w-[20%]" onClick={() => toggleSort("price")} sortDir={sortDirOf("price")}>
                      Price %
                    </Th>
                    <Th align="right" className="w-[20%]" onClick={() => toggleSort("contrib")} sortDir={sortDirOf("contrib")}>
                      Contrib %
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {equityRows.map((a, ri) => (
                    <AssetRowEquity
                      key={a.id}
                      a={a}
                      r={r}
                      w={wByAsset[a.id]}
                      zebra={ri % 2 === 1}
                      isSpx={a.id === "SPX"}
                      openSectors={openSectors}
                      setOpenSectors={setOpenSectors}
                      hydrated={hydrated}
                      pinned={pinnedSet.has(a.id)}
                      onTogglePin={() => onTogglePin(a.id)}
                      onJumpToDerivation={() => onJumpToDerivation(a.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-auto flex items-center justify-between border-t border-term-edge bg-term-raised px-2 py-1">
              <span className="text-th uppercase text-term-muted">Avg impact</span>
              <span className={`font-mono tnum text-[11px] font-medium ${signColor(equityAvg)}`}>{fmtPct(equityAvg)}</span>
            </div>
          </div>

          <div className="-ml-px flex flex-col border border-term-edge bg-term-panel">
            <GroupHeader>Commodities</GroupHeader>
            <div>
              <table className="w-full table-fixed border-collapse text-[11px]">
                <thead>
                  <tr className="bg-term-raised">
                    <Th className="w-[67%]">Instrument</Th>
                    <Th align="right" className="w-[33%]" onClick={() => toggleSort("price")} sortDir={sortDirOf("price")}>
                      Price %
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {commodityRows.map((a, ri) => (
                    <AssetRowLean
                      key={a.id}
                      a={a}
                      r={r}
                      zebra={ri % 2 === 1}
                      hydrated={hydrated}
                      pinned={pinnedSet.has(a.id)}
                      onTogglePin={() => onTogglePin(a.id)}
                      onJumpToDerivation={() => onJumpToDerivation(a.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-auto flex items-center justify-between border-t border-term-edge bg-term-raised px-2 py-1">
              <span className="text-th uppercase text-term-muted">Avg impact</span>
              <span className={`font-mono tnum text-[11px] font-medium ${signColor(commodityAvg)}`}>{fmtPct(commodityAvg)}</span>
            </div>
          </div>

          <div className="-ml-px flex flex-col border border-term-edge bg-term-panel">
            <GroupHeader>FX</GroupHeader>
            <div>
              <table className="w-full table-fixed border-collapse text-[11px]">
                <thead>
                  <tr className="bg-term-raised">
                    <Th className="w-[67%]">Instrument</Th>
                    <Th align="right" className="w-[33%]" onClick={() => toggleSort("price")} sortDir={sortDirOf("price")}>
                      Price %
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {fxRows.map((a, ri) => (
                    <AssetRowLean
                      key={a.id}
                      a={a}
                      r={r}
                      zebra={ri % 2 === 1}
                      hydrated={hydrated}
                      pinned={pinnedSet.has(a.id)}
                      onTogglePin={() => onTogglePin(a.id)}
                      onJumpToDerivation={() => onJumpToDerivation(a.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-auto flex items-center justify-between border-t border-term-edge bg-term-raised px-2 py-1">
              <span className="text-th uppercase text-term-muted">Avg impact</span>
              <span className={`font-mono tnum text-[11px] font-medium ${signColor(fxAvg)}`}>{fmtPct(fxAvg)}</span>
            </div>
          </div>
        </div>
        {/* A closing "{port.label} total" bar (e.g. "60/40 total") used to sit
            here, repeating the exact figure Portfolio Impact Summary's own
            Return (%) column already shows for the selected allocation —
            removed on request ("remove the bottom section of the p&l that
            says like 60/40 total 20/80 total etc"), since it was the same
            number restated a second time at the foot of this panel rather
            than new information. */}
      </Panel>
    </>
  );
}
