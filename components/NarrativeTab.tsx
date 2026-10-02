"use client";

import React from "react";
import type { EngineResult, Term } from "@/lib/engine";
import { ASSETS, type Asset } from "@/lib/assets";
import { fmtBp, fmtNum, fmtPct, fmtSigned, signColor } from "@/lib/format";
import { Btn, Cap, GroupHeader, Panel, Td, Th, Tooltip } from "./ui";

// Derivation table: beta × shock × multiplier = value, grouped by asset class.

// Abbreviation mapping for display
const ABBREV_MAP: Record<string, string> = {
  BoJ: "Bank of Japan",
  BoE: "Bank of England",
  ECB: "European Central Bank",
  Fed: "Federal Reserve",
  CPI: "Consumer Price Index",
  PCE: "Personal Consumption Expenditures",
  PMI: "Purchasing Managers Index",
  VIX: "Volatility Index",
  OAS: "Option-Adjusted Spread",
  IGSpread: "Investment Grade Spread",
  HY: "High Yield",
  EM: "Emerging Markets",
  FX: "Foreign Exchange",
  QT: "Quantitative Tightening",
  Fwd: "Forward",
  Fwrd: "Forward",
};

function expandAbbrev(label: string): string {
  for (const [abbr, full] of Object.entries(ABBREV_MAP)) {
    // Word-boundary match, not a plain substring check: "Fed".includes with
    // .includes()/.replace() alone also fires inside "Federal" (Debt,
    // Deficit, Reserve itself, ...), corrupting "Federal Debt" into
    // "Federal Reserveeal Debt". \b keeps the abbreviation from matching
    // as a fragment of a longer word it happens to prefix.
    const re = new RegExp(`\\b${abbr}\\b`);
    if (re.test(label)) {
      return label.replace(re, full);
    }
  }
  return label;
}

function TermRows({ terms, unit }: { terms: Term[]; unit: string }) {
  return (
    <>
      {terms.map((t, i) => {
        const adjusted = Math.abs(t.mult - 1) > 0.005;
        return (
          <tr key={`${t.driver}-${i}`} className={`border-b border-term-line ${i % 2 === 1 ? "bg-term-zebra" : ""}`}>
            <Td className="pl-6 text-term-sub">{expandAbbrev(t.label)}</Td>
            <Td align="right" mono className="text-term-muted">
              {fmtSigned(t.shock, 2)}
            </Td>
            <Td align="right" mono className="text-term-muted">
              {fmtSigned(t.beta, 3)}
            </Td>
            <Td align="right" mono className={adjusted ? "text-term-text" : "text-term-edge"}>
              <Tooltip content={t.reasons.length > 0 ? t.reasons.join(" · ") : "No regime, timing, or correlation adjustment"}>
                <span>{fmtNum(t.mult, 3)}</span>
              </Tooltip>
            </Td>
            <Td align="right" mono className={signColor(t.value, 0.005)}>
              {unit === "bp" ? fmtBp(t.value, 1) : fmtPct(t.value)}
            </Td>
          </tr>
        );
      })}
    </>
  );
}

/** The section (and, via tabForGroup below, the tab) a single asset's
 *  breakdown belongs under. Equities and Bonds — the two asset groups with
 *  real internal texture — split further than lib/assets.ts's own coarse
 *  `group` field distinguishes: Equities into the four broad indices the
 *  portfolio holds directly ("Developed" + "Emerging" sub) vs. everything
 *  sector-shaped (the three concentrated sector tilts plus the seven S&P
 *  sector breakouts); Bonds into government-related duration (Treasuries,
 *  plus Agency MBS — government-agency-backed, not a corporate obligation,
 *  so it sits with Treasuries rather than with Credit) vs. corporate credit
 *  (IG, HY BB, HY B/CCC — the "Credit" sub). FX and Commodities have no such
 *  split and map straight through. "Other" (never populated today, but not
 *  one of the four named asset-groups either) rides along with Sectors
 *  rather than silently vanishing if it's ever used.
 *
 *  Kept as one function so groupByClass and the focus-jump effect (PnlTab
 *  linking straight to one asset's derivation) can never disagree about
 *  where a given asset lives. */
function categoryFor(a: Asset): string {
  if (a.group === "Equities") {
    return a.sub === "Developed" || a.sub === "Emerging" ? "Indices" : "Sectors";
  }
  if (a.group === "Bonds") {
    return a.sub === "Credit" ? "Corporate Bonds" : "Government Bonds";
  }
  if (a.group === "Commodities") return "Commodities";
  if (a.group === "FX") return "FX";
  return "Sectors";
}

function groupByClass(assets: typeof ASSETS) {
  const groups: Record<string, typeof ASSETS> = {
    Indices: [],
    Sectors: [],
    "Government Bonds": [],
    "Corporate Bonds": [],
    Commodities: [],
    FX: [],
  };

  for (const a of assets) {
    groups[categoryFor(a)].push(a);
  }

  return Object.entries(groups).filter(([_, items]) => items.length > 0);
}

// One tab per group produced by groupByClass above, each loading a short,
// focused table instead of one long scroll through every asset at once.
// Bare category names, not "Derivations <X>" — the page itself is already
// titled Derivation (TopNav) and this very label doubles as the Panel title
// directly above these tab buttons (see the `<Panel title={...}>` below), so
// a "Derivations" prefix on every tab repeated the page's own context three
// times in the same 250px of vertical space (route title, panel title, six
// tab labels) instead of once.
const GROUP_TABS = [
  { id: "indices", label: "Indices", groups: ["Indices"] },
  { id: "sectors", label: "Sectors", groups: ["Sectors"] },
  { id: "fx", label: "FX", groups: ["FX"] },
  { id: "corporate-bonds", label: "Corporate Bonds", groups: ["Corporate Bonds"] },
  { id: "government-bonds", label: "Government Bonds", groups: ["Government Bonds"] },
  { id: "commodities", label: "Commodities", groups: ["Commodities"] },
] as const;
export type GroupTabId = (typeof GROUP_TABS)[number]["id"];

function tabForGroup(groupName: string): GroupTabId {
  return GROUP_TABS.find((t) => (t.groups as readonly string[]).includes(groupName))?.id ?? "sectors";
}

export default function NarrativeTab({
  r,
  focusAsset = null,
  onFocusHandled,
  activeGroupTab,
  setActiveGroupTab,
}: {
  r: EngineResult;
  /** Set by another tab (e.g. clicking a Price % cell in PnlTab) to expand and
   *  scroll to one asset's derivation on mount. Consumed once. */
  focusAsset?: string | null;
  onFocusHandled?: () => void;
  activeGroupTab: GroupTabId;
  setActiveGroupTab: (g: GroupTabId) => void;
}) {
  // justFocused is a one-shot ~1.6s highlight pulse, not durable UI state —
  // it's deliberately kept local (not lifted to ScenarioContext) since there
  // is nothing meaningful to restore after a route change or reload.
  const [justFocused, setJustFocused] = React.useState<string | null>(null);
  // Every asset's full breakdown renders unconditionally now (no expand/
  // collapse step), so "shown" only needs to filter out assets nothing
  // moved — a focused asset is included even at ~0 impact so the jump-to
  // link from PnlTab always has somewhere to land.
  const shown = ASSETS.filter((a) => Math.abs(r.assets[a.id]?.pricePct ?? 0) > 0.0005 || a.id === focusAsset);
  const grouped = groupByClass(shown);
  const visibleGroups = grouped.filter(([groupName]) => tabForGroup(groupName) === activeGroupTab);

  React.useEffect(() => {
    if (!focusAsset) return;
    const asset = ASSETS.find((a) => a.id === focusAsset);
    if (asset) setActiveGroupTab(tabForGroup(categoryFor(asset)));
    setJustFocused(focusAsset);
    const raf = requestAnimationFrame(() => {
      document.getElementById(`asset-row-${focusAsset}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    const t = setTimeout(() => setJustFocused(null), 1600);
    onFocusHandled?.();
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusAsset]);

  return (
    <div className="space-y-0">
      {/* "Inputs Moved" (every shocked variable vs. its base, in one table)
          was removed by request — each asset's own card below already shows
          the shocks/betas/multipliers that actually drive its number, so
          this was a second, separate listing of the same inputs rather than
          something load-bearing on its own. */}
      <Panel title={GROUP_TABS.find((t) => t.id === activeGroupTab)!.label}>
        {/* overflow-x-auto: six group tabs (Indices/Sectors/FX/Corporate
            Bonds/Government Bonds/Commodities) don't all fit on a phone
            width — same "scroll in place instead of forcing the page wider"
            treatment as TopNav and the dense data tables. */}
        <div className="flex items-center gap-1 overflow-x-auto border-b border-term-edge px-1.5 py-1">
          {GROUP_TABS.map((t) => (
            <Btn key={t.id} active={activeGroupTab === t.id} onClick={() => setActiveGroupTab(t.id)}>
              {t.label}
            </Btn>
          ))}
        </div>
        <div>
          {visibleGroups.map(([groupName, assets]) => (
            <div key={groupName}>
              <GroupHeader>{groupName}</GroupHeader>
              {/* Column ruler once per group, outside the per-asset cards
                  below — table-fixed with the same percentage widths as
                  every card's own table, so the columns line up exactly even
                  though each card renders an independent <table>. */}
              <div className="overflow-x-auto">
                <table className="w-full table-fixed border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-term-raised">
                      <Th className="w-[45%]">Asset</Th>
                      <Th align="right" className="w-[14%]">
                        Shock
                      </Th>
                      <Th align="right" className="w-[14%]">
                        Beta
                      </Th>
                      <Th align="right" className="w-[11%]">
                        Mult
                      </Th>
                      <Th align="right" className="w-[16%]">
                        Value
                      </Th>
                    </tr>
                  </thead>
                </table>
              </div>
              {/* One bordered card per asset, floating on a visible bg-term-bg
                  gutter (py-1.5 + gap-1.5) rather than tiled edge-to-edge —
                  border-term-edge and border-term-line resolve to the exact
                  same colour in the dark theme ("one border colour
                  throughout, per spec" — see globals.css), so a shared,
                  collapsed border between two cards was indistinguishable
                  from an ordinary row divider inside one: the boundary
                  disappeared into the very rows it was meant to separate. A
                  real gap against the darker canvas colour is what actually
                  reads as "these are two different panels," the way an IB
                  workspace tiles separate instrument windows with visible
                  space between them. A long asset's own channel/term rows
                  (15+ for US Large Cap) now scroll inside a visibly bounded
                  box instead of blurring into the next asset's rows with
                  nothing but a colour change to mark the seam. Horizontal
                  padding stays 0 so each card's table columns still line up
                  exactly under the column ruler above. */}
              <div className="overflow-x-auto bg-term-bg py-1.5">
                <div className="flex flex-col gap-1.5">
                {assets.map((a) => {
                  const ar = r.assets[a.id];
                  if (!ar) return null;
                  return (
                    <div key={a.id} className="border border-term-edge bg-term-panel">
                      <table className="w-full table-fixed border-collapse text-[11px]">
                        <tbody>
                          <tr
                            id={`asset-row-${a.id}`}
                            // Sticky, not just top-of-card: each asset's own
                            // channel/term rows can run 15+ deep (see US
                            // Large Cap in the Indices tab), long enough to
                            // scroll its own name off the top of the
                            // viewport while you're still reading its Risk
                            // Premium terms. Pinning the asset row keeps
                            // "which asset am I inside" visible the whole
                            // time instead of only at the moment you first
                            // reach it — and still behaves correctly now
                            // that each asset is its own card: sticky
                            // positioning is bounded by this row's own
                            // parent, so it releases exactly at this card's
                            // bottom edge as the next card's row takes over,
                            // rather than sticking past this asset's own
                            // content. top-0 is correct here (not offset for
                            // TopNav) because TopNav scrolls with the page
                            // rather than staying fixed — by the time this
                            // row would stick, TopNav has already scrolled
                            // out of view.
                            //
                            // bg-term-raised, not bg-term-panel: this row
                            // names the actual subject under study (UST 30Y,
                            // US Large Cap, ...), and the physical
                            // stamped-metal bevel (globals.css's
                            // .bg-term-raised rule) is the app's one visual
                            // cue for "the thing that matters most here."
                            className={`sticky top-0 z-[1] border-b border-term-line bg-term-raised ${justFocused === a.id ? "bg-info/10" : ""}`}
                          >
                            <Td className="font-medium text-term-text">{expandAbbrev(a.label)}</Td>
                            <Td align="right" className="text-term-edge">
                              &mdash;
                            </Td>
                            <Td align="right" className="text-term-edge">
                              &mdash;
                            </Td>
                            <Td align="right" className="text-term-edge">
                              &mdash;
                            </Td>
                            <Td align="right" mono className={`font-medium ${signColor(ar.pricePct)}`}>
                              {fmtPct(ar.pricePct)}
                            </Td>
                          </tr>
                          {ar.channels.map((c) => (
                            <React.Fragment key={c.channel}>
                              {/* Flat bg-term-panel, not bg-term-raised — the
                                  bevel lives on the asset row above, so a
                                  channel label (Price/Spread/Yield/Multiple/
                                  Earnings/Risk Premium) reads as a subordinate
                                  grouping under the subject, not a second
                                  competing focal point. */}
                              <tr className="border-b border-term-line bg-term-panel">
                                <Td className="pl-4 text-term-sub">{c.label}</Td>
                                <Td align="right" className="text-term-edge">
                                  &mdash;
                                </Td>
                                <Td align="right" className="text-term-edge">
                                  &mdash;
                                </Td>
                                <Td align="right" className="text-term-edge">
                                  &mdash;
                                </Td>
                                <Td align="right" mono className={`font-medium ${signColor(c.value, 0.005)}`}>
                                  {c.channel === "rate" || c.channel === "spread" ? fmtBp(c.value, 1) : fmtPct(c.value)}
                                </Td>
                              </tr>
                              <TermRows
                                terms={c.terms}
                                unit={c.channel === "rate" || c.channel === "spread" ? "bp" : "pct"}
                              />
                            </React.Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
