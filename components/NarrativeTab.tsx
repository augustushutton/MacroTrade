"use client";

import React from "react";
import type { EngineResult, Term } from "@/lib/engine";
import type { ScenarioInput } from "@/lib/engine";
import { ASSETS } from "@/lib/assets";
import { referenceModels } from "@/lib/econometrics";
import { fmtBp, fmtNum, fmtPct, fmtSigned, signColor } from "@/lib/format";
import { movedVars } from "@/lib/vars";
import { Btn, Cap, GroupHeader, Panel, SignedBar, Td, Th, Tooltip } from "./ui";

// Reference Models: published macro relationships (Taylor rule, Okun's law,
// a reduced-form Phillips curve), run purely as a diagnostic cross-check of
// whether the scenario's OWN inflation/growth/policy/unemployment
// assumptions imply each other consistently. These never feed the pricing
// engine — see lib/econometrics.ts's own header comment for why swapping a
// single-equation textbook coefficient into a jointly-calibrated cross-asset
// model would not be an improvement, and for the citations behind each
// number here.
function ReferenceModelsPanel({ input }: { input: ScenarioInput }) {
  const models = referenceModels(input.state);
  const maxAbsGap = Math.max(1e-6, ...models.map((m) => Math.abs(m.actual - m.implied)));
  return (
    <Panel title="Reference Models (published estimates, cross-check only)">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr className="bg-term-raised">
              <Th className="w-[140px]">Model</Th>
              <Th align="right" className="w-[100px]">
                Implied
              </Th>
              <Th align="right" className="w-[100px]">
                Scenario
              </Th>
              <Th className="w-[130px]">Gap</Th>
              <Th>Citation</Th>
            </tr>
          </thead>
          <tbody>
            {models.map((m) => {
              const gap = m.actual - m.implied;
              return (
                <React.Fragment key={m.id}>
                  <tr className="border-b border-term-line even:bg-term-zebra">
                    <Td className="text-term-text">
                      <Tooltip content={m.formula}>{m.label}</Tooltip>
                    </Td>
                    <Td align="right" mono className="text-term-muted">
                      {fmtSigned(m.implied, 2)} {m.unit}
                    </Td>
                    <Td align="right" mono className="font-medium text-term-text">
                      {fmtSigned(m.actual, 2)} {m.unit}
                    </Td>
                    <Td className="p-0">
                      <div className="px-2 py-dense">
                        <SignedBar v={gap} max={maxAbsGap} />
                      </div>
                    </Td>
                    <Td className="text-term-sub">{m.citation}</Td>
                  </tr>
                  <tr className="border-b border-term-line bg-term-raised">
                    <Td colSpan={5} className="text-term-muted">
                      <span className="text-term-edge">{m.impliedLabel} vs {m.actualLabel}:</span> {m.note}
                    </Td>
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="border-t border-term-line px-2 py-1">
        <Cap>
          Diagnostic only &mdash; these relationships are not part of the pricing engine above and do not affect any
          asset&apos;s price return.
        </Cap>
      </div>
    </Panel>
  );
}

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
  DXY: "Dollar Index",
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

// Group assets by class for better browsing
function groupByClass(assets: typeof ASSETS) {
  const groups: Record<string, typeof ASSETS> = {
    Bonds: [],
    Equities: [],
    Commodities: [],
    FX: [],
    Other: [],
  };

  for (const a of assets) {
    if (a.group === "Bonds") {
      groups.Bonds.push(a);
    } else if (a.group === "Equities") {
      groups.Equities.push(a);
    } else if (a.group === "Commodities") {
      groups.Commodities.push(a);
    } else if (a.group === "FX") {
      groups.FX.push(a);
    } else {
      groups.Other.push(a);
    }
  }

  return Object.entries(groups).filter(([_, items]) => items.length > 0);
}

// Derivation is split one tab per asset class so each loads a short,
// focused table instead of one long scroll through everything at once.
// "Other" (never populated today, but not one of the four named classes
// either) rides along with Equities rather than silently vanishing if
// it's ever used.
const GROUP_TABS = [
  { id: "equities", label: "Derivations Equities", groups: ["Equities", "Other"] },
  { id: "fx", label: "Derivations FX", groups: ["FX"] },
  { id: "bonds", label: "Derivations Bonds", groups: ["Bonds"] },
  { id: "commodities", label: "Derivations Commodities", groups: ["Commodities"] },
] as const;
export type GroupTabId = (typeof GROUP_TABS)[number]["id"];

function tabForGroup(groupName: string): GroupTabId {
  return GROUP_TABS.find((t) => (t.groups as readonly string[]).includes(groupName))?.id ?? "equities";
}

export default function NarrativeTab({
  r,
  input,
  focusAsset = null,
  onFocusHandled,
  activeGroupTab,
  setActiveGroupTab,
}: {
  r: EngineResult;
  input: ScenarioInput;
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
  const moved = movedVars(input.state);
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
    if (asset) setActiveGroupTab(tabForGroup(asset.group));
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
    <div className="space-y-2">
      <ReferenceModelsPanel input={input} />
      <Panel title="Inputs Moved">
        <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr className="bg-term-raised">
              <Th>Variable</Th>
              <Th align="right">Base</Th>
              <Th align="right">Set</Th>
              <Th align="right">Move</Th>
              <Th align="right">Shock</Th>
            </tr>
          </thead>
          <tbody>
            {moved.length === 0 ? (
              <tr>
                <Td colSpan={5} className="text-term-muted">
                  Baseline
                </Td>
              </tr>
            ) : (
              moved.map((v, i) => {
                const cur = input.state[v.id];
                return (
                  <tr key={v.id} className={`border-b border-term-line ${i % 2 === 1 ? "bg-term-zebra" : ""}`}>
                    <Td className="text-term-sub">{expandAbbrev(v.label)}</Td>
                    <Td align="right" mono className="text-term-muted">
                      {v.base.toFixed(v.dp)}
                    </Td>
                    <Td align="right" mono className={`font-medium ${signColor(cur - v.base)}`}>
                      {cur.toFixed(v.dp)}
                    </Td>
                    <Td align="right" mono className={`font-medium ${signColor(cur - v.base)}`}>
                      {fmtSigned(cur - v.base, v.dp)}
                    </Td>
                    <Td align="right" mono className={signColor(cur - v.base)}>
                      {fmtSigned((cur - v.base) / v.norm, 2)}
                    </Td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        </div>
      </Panel>

      <Panel title={GROUP_TABS.find((t) => t.id === activeGroupTab)!.label}>
        <div className="flex items-center gap-1 border-b border-term-edge px-1.5 py-1">
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
              <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[11px]">
                <thead>
                  <tr className="bg-term-raised">
                    <Th className="w-[200px]">Asset</Th>
                    <Th align="right" className="w-[60px]">
                      Shock
                    </Th>
                    <Th align="right" className="w-[60px]">
                      Beta
                    </Th>
                    <Th align="right" className="w-[50px]">
                      Mult
                    </Th>
                    <Th align="right" className="w-[70px]">
                      Value
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {assets.map((a) => {
                    const ar = r.assets[a.id];
                    if (!ar) return null;
                    return (
                      <React.Fragment key={a.id}>
                        <tr
                          id={`asset-row-${a.id}`}
                          // Sticky, not just top-of-group: each asset's own
                          // channel/term rows can run 15+ deep (see US Large
                          // Cap in Derivations Equities), long enough to
                          // scroll its own name off the top of the viewport
                          // while you're still reading its Risk Premium
                          // terms. Pinning the asset row keeps "which asset
                          // am I inside" visible the whole time instead of
                          // only at the moment you first reach it. top-0
                          // is correct here (not offset for TopNav) because
                          // TopNav scrolls with the page rather than staying
                          // fixed — by the time this row would stick, TopNav
                          // has already scrolled out of view. bg-term-panel
                          // (opaque, matching the table's own background)
                          // stops channel/term rows from showing through
                          // underneath it as they scroll past.
                          className={`sticky top-0 z-[1] border-b border-term-line bg-term-panel ${justFocused === a.id ? "bg-info/10" : ""}`}
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
                            <tr className="border-b border-term-line bg-term-raised">
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
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
