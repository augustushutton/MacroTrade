"use client";

import React from "react";
import { GROUP_ORDER, SECTORS, TOP_LEVEL_ASSETS, type Asset } from "@/lib/assets";
import { factorAttribution, type AssetResult, type EngineResult, type PortfolioResult } from "@/lib/engine";
import { BOND_SLEEVE, PORTFOLIOS } from "@/lib/portfolios";
import { fmtBp, fmtPct, fmtUsd, signColor } from "@/lib/format";
import { Cap, GroupHeader, Panel, SignedBar, Td, Th, Tooltip, useFlash } from "./ui";

// Factor Attribution: which macro category actually drove the selected
// portfolio's P&L, not just which asset moved. This is a proportional
// decomposition of the exact number already in Portfolio Impact Summary
// above — see factorAttribution's own comment in lib/engine.ts for how the
// split is computed and why it always sums back to that exact number.
function FactorAttributionPanel({ r, selected }: { r: EngineResult; selected: string }) {
  const attrib = React.useMemo(() => factorAttribution(r, selected), [r, selected]);
  if (attrib.length === 0) {
    return (
      <Panel title="Factor Attribution" className="mb-2">
        <div className="px-3 py-4">
          <Cap>Baseline &mdash; nothing to attribute yet.</Cap>
        </div>
      </Panel>
    );
  }
  const maxAbs = Math.max(...attrib.map((f) => Math.abs(f.contribPct)));
  const total = attrib.reduce((s, f) => s + Math.abs(f.contribPct), 0) || 1;
  return (
    <Panel title="Factor Attribution" className="mb-2">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr className="bg-term-raised">
              <Th className="w-[220px]">Category</Th>
              <Th className="w-[200px]">Contribution</Th>
              <Th align="right" className="w-[80px]">
                P&amp;L (pp)
              </Th>
              <Th align="right" className="w-[60px]">
                Share
              </Th>
            </tr>
          </thead>
          <tbody>
            {attrib.map((f) => (
              <tr key={f.id} className="border-b border-term-line even:bg-term-zebra">
                <Td className="text-term-text">{f.label}</Td>
                <Td className="p-0">
                  <div className="px-2 py-dense">
                    <SignedBar v={f.contribPct} max={maxAbs} />
                  </div>
                </Td>
                <Td align="right" mono className={`font-medium ${signColor(f.contribPct)}`}>
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
}: {
  r: EngineResult;
  p: PortfolioResult;
  isSel: boolean;
  zebra: boolean;
  onSelect: (id: string) => void;
  notional: number;
  hydrated: boolean;
}) {
  const shocked = notional + p.dollars;
  const pctFlash = useFlash(p.pct, hydrated);
  const dollarsFlash = useFlash(p.dollars, hydrated);
  const shockedFlash = useFlash(shocked, hydrated);
  return (
    <tr
      onClick={() => onSelect(p.id)}
      className={`cursor-pointer border-b border-term-line last:border-b-0 ${
        isSel ? "bg-term-raised" : zebra ? "bg-term-zebra" : ""
      } hover:bg-term-raised`}
    >
      <Td className={isSel ? "font-medium text-term-text" : "text-term-sub"}>
        {isSel ? <span className="text-info">&#9656;</span> : <span className="text-term-line">&#9656;</span>} {p.label}
      </Td>
      <Td align="right" mono className="border-r border-term-line text-term-muted">
        {fmtUsd(notional)}
      </Td>
      <Td align="right" mono className={`border-r border-term-line ${signColor(p.dollars)} ${shockedFlash}`}>
        {fmtUsd(shocked)}
      </Td>
      <Td align="right" mono className={`font-medium ${signColor(p.dollars)} ${dollarsFlash}`}>
        {fmtUsd(p.dollars)}
      </Td>
      <Td align="right" mono className={`border-r border-term-line font-medium ${signColor(p.pct)} ${pctFlash}`}>
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
  return (
    <Panel title="Portfolio Impact Summary">
      <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr className="bg-term-raised">
            <Th className="w-[100px] border-r border-term-line">Allocation</Th>
            <Th align="right" className="border-r border-term-line">
              Baseline Value
            </Th>
            <Th align="right" className="border-r border-term-line">
              Shocked Value
            </Th>
            <Th align="right" className="border-r border-term-line">
              Net P&amp;L ($)
            </Th>
            <Th align="right" className="border-r border-term-line">
              Return (%)
            </Th>
            <Th align="right">Duration</Th>
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
            />
          ))}
        </tbody>
      </table>
      </div>
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

function SectorRow({ s, r, hydrated }: { s: Asset; r: EngineResult; hydrated: boolean }) {
  const sr = r.assets[s.id];
  const priceFlash = useFlash(sr?.pricePct ?? 0, hydrated && sr !== undefined);
  if (!sr) return null;
  return (
    <tr className="border-b border-term-line bg-term-raised">
      <Td className="pl-6 text-term-muted">{s.label}</Td>
      {/* Sectors are a decomposition of SPX, not a separate holding, so
          Weight/Rate/Spread/Yield/Duration/Contribution genuinely don't
          apply — an explicit dash in every one of those cells, not a mix of
          "n/a" text and silent blanks, so the row reads as one consistent
          "not applicable" statement rather than a table that forgot to fill
          itself in. */}
      <Td align="right" mono className="text-term-edge">
        &mdash;
      </Td>
      <Td align="right" mono className="text-term-edge">
        &mdash;
      </Td>
      <Td align="right" mono className="text-term-edge">
        &mdash;
      </Td>
      <Td align="right" mono className="text-term-edge border-r border-term-line">
        &mdash;
      </Td>
      <Td align="right" mono className="text-term-edge border-r border-term-line">
        &mdash;
      </Td>
      <Td align="right" mono className={`font-medium border-r border-term-line ${signColor(sr.pricePct)} ${priceFlash}`}>
        {fmtPct(sr.pricePct)}
      </Td>
      <Td align="right" mono className="text-term-edge">
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
      <tr className={`border-b border-term-line ${zebra ? "bg-term-zebra" : ""}`}>
        <Td>
          <div className="flex items-baseline gap-1">
            <Tooltip content={pinned ? "Unpin" : "Pin to top"}>
              <button
                type="button"
                onClick={onTogglePin}
                className={`w-[10px] leading-none ${pinned ? "text-warn" : "text-term-edge hover:text-term-sub"}`}
              >
                {pinned ? "★" : "☆"}
              </button>
            </Tooltip>
            {isSpx ? (
              <button
                type="button"
                onClick={() => setOpenSectors((v) => !v)}
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
          {w === undefined ? <span className="text-term-edge">&mdash;</span> : w.toFixed(1)}
        </Td>
        {/* Rate/spread/yield are the SHOCK, not the P&L — a +391bp yield
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
          {ar.rateLegBp === undefined ? <span className="text-term-edge">&mdash;</span> : fmtBp(ar.rateLegBp)}
        </Td>
        <Td align="right" mono className="text-term-sub">
          {ar.spreadBp === undefined ? <span className="text-term-edge">&mdash;</span> : fmtBp(ar.spreadBp)}
        </Td>
        <Td align="right" mono className="text-term-sub border-r border-term-line">
          {ar.yieldBp === undefined ? <span className="text-term-edge">&mdash;</span> : fmtBp(ar.yieldBp)}
        </Td>
        <Td align="right" mono className="text-term-muted border-r border-term-line">
          {ar.duration === undefined ? <span className="text-term-edge">&mdash;</span> : ar.duration.toFixed(1)}
        </Td>
        <Td align="right" mono className="border-r border-term-line p-0">
          <Tooltip content="View derivation" display="flex" className="w-full">
            <button
              type="button"
              onClick={onJumpToDerivation}
              className={`block w-full px-1.5 py-1 text-right font-medium hover:underline ${signColor(ar.pricePct)} ${priceFlash}`}
            >
              {fmtPct(ar.pricePct)}
            </button>
          </Tooltip>
        </Td>
        <Td align="right" mono className={`${contrib === undefined ? "" : signColor(contrib)} ${contribFlash}`}>
          {contrib === undefined ? <span className="text-term-edge">&mdash;</span> : fmtPct(contrib)}
        </Td>
      </tr>
      {isSpx && openSectors ? SECTORS.map((s) => <SectorRow key={s.id} s={s} r={r} hydrated={hydrated} />) : null}
    </React.Fragment>
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

  const pinnedRows = sortRows(TOP_LEVEL_ASSETS.filter((a) => pinnedSet.has(a.id)));

  return (
    <>
      <FactorAttributionPanel r={r} selected={port.id} />
      <Panel title={`Asset Detail — ${port.label} weights`}>
        <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr className="bg-term-raised">
              <Th className="w-[210px] border-r border-term-line">Instrument</Th>
              <Th align="right" onClick={() => toggleSort("w")} sortDir={sortDirOf("w")}>
                Weight %
              </Th>
              <Th align="right" onClick={() => toggleSort("rate")} sortDir={sortDirOf("rate")}>
                Rate Shock (bp)
              </Th>
              <Th align="right" onClick={() => toggleSort("spread")} sortDir={sortDirOf("spread")}>
                Spread Shock (bp)
              </Th>
              <Th align="right" className="border-r border-term-line" onClick={() => toggleSort("yield")} sortDir={sortDirOf("yield")}>
                Shocked Yield
              </Th>
              <Th align="right" className="border-r border-term-line" onClick={() => toggleSort("duration")} sortDir={sortDirOf("duration")}>
                Duration
              </Th>
              <Th align="right" className="border-r border-term-line" onClick={() => toggleSort("price")} sortDir={sortDirOf("price")}>
                Price Impact %
              </Th>
              <Th align="right" onClick={() => toggleSort("contrib")} sortDir={sortDirOf("contrib")}>
                P&amp;L Contribution %
              </Th>
            </tr>
          </thead>
          <tbody>
            {pinnedRows.length > 0 ? (
              <React.Fragment key="pinned">
                <tr>
                  <td colSpan={8} className="p-0">
                    <GroupHeader>Pinned</GroupHeader>
                  </td>
                </tr>
                {pinnedRows.map((a, ri) => (
                  <AssetRow
                    key={`pin-${a.id}`}
                    a={a}
                    r={r}
                    w={wByAsset[a.id]}
                    zebra={ri % 2 === 1}
                    isSpx={a.id === "SPX"}
                    openSectors={openSectors}
                    setOpenSectors={setOpenSectors}
                    hydrated={hydrated}
                    pinned
                    onTogglePin={() => onTogglePin(a.id)}
                    onJumpToDerivation={() => onJumpToDerivation(a.id)}
                  />
                ))}
              </React.Fragment>
            ) : null}
            {GROUP_ORDER.map((g) => {
              const rows = sortRows(TOP_LEVEL_ASSETS.filter((a) => a.group === g));
              return (
                <React.Fragment key={g}>
                  <tr>
                    <td colSpan={8} className="p-0">
                      <GroupHeader>{g}</GroupHeader>
                    </td>
                  </tr>
                  {rows.map((a, ri) => (
                    <AssetRow
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
                </React.Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-term-edge bg-term-raised">
              <Td className="font-medium text-term-text">{port.label} total</Td>
              <Td align="right" mono className="text-term-muted">
                100.0
              </Td>
              <Td /> <Td />
              <Td className="border-r border-term-line" />
              <Td className="border-r border-term-line" />
              <Td className="border-r border-term-line" />
              <Td align="right" mono className={`font-medium ${signColor(port.pct)}`}>
                {fmtPct(port.pct)}
              </Td>
            </tr>
          </tfoot>
        </table>
        </div>
      </Panel>
    </>
  );
}
