"use client";

import React from "react";
import { runScenario, type ScenarioInput } from "@/lib/engine";
import { PORTFOLIOS } from "@/lib/portfolios";
import { HORIZON_LABEL, PATH_BY_ID } from "@/lib/paths";
import { REGIME_BY_ID } from "@/lib/regimes";
import { VAR_BY_ID } from "@/lib/vars";
import { PRESETS, PRESET_GROUPS, presetState, type Preset } from "@/lib/scenarios";
import { fmtPct, fmtSigned, signColor } from "@/lib/format";
import { Btn, Cap, Panel, Td, Th, Tooltip } from "./ui";

// The scenario on screen, re-priced against the fixed preset library. Every
// preset is re-run through the live engine rather than cached, so a
// comparison never mixes numbers from two different versions of the model.

export default function CompareTab({ input }: { input: ScenarioInput }) {
  const [group, setGroup] = React.useState<string>(PRESET_GROUPS[0]);

  const live = runScenario(input);
  const rows = PRESETS.filter((p) => p.group === group).map((p) => {
    const r = runScenario({
      state: presetState(p),
      regimeOverride: p.regime ?? null,
      horizon: p.horizon,
      path: p.path,
      steps: input.steps,
      notional: input.notional,
    });
    return { p, r };
  });

  return (
    <div className="space-y-2">
      <Panel title="Comparison">
        <div className="flex items-center gap-1 border-b border-term-edge px-1.5 py-1">
          {PRESET_GROUPS.map((g) => (
            <Btn key={g} active={group === g} onClick={() => setGroup(g)}>
              {g}
            </Btn>
          ))}
        </div>
        <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr className="bg-term-raised">
              <Th className="w-[220px]">Scenario</Th>
              <Th align="right">Regime</Th>
              <Th align="right">Path</Th>
              <Th align="right">Horizon</Th>
              {PORTFOLIOS.map((p) => (
                <Th key={p.id} align="right">
                  {p.label}
                </Th>
              ))}
              <Th align="right">Variables</Th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-term-edge">
              <Td className="text-term-text">On screen</Td>
              <Td align="right" className="text-term-sub">
                {REGIME_BY_ID[live.regime.active].label}
              </Td>
              <Td align="right" className="text-term-sub">
                {PATH_BY_ID[input.path].label}
              </Td>
              <Td align="right" mono className="text-term-sub">
                {HORIZON_LABEL[input.horizon]}
              </Td>
              {live.portfolios.map((p) => (
                <Td key={p.id} align="right" mono className={signColor(p.pct)}>
                  {fmtPct(p.pct)}
                </Td>
              ))}
              <Td align="right" mono className="text-term-muted">
                {Object.keys(VAR_BY_ID).filter((k) => Math.abs((input.state[k] ?? 0) - VAR_BY_ID[k].base) > 1e-9).length}
              </Td>
            </tr>
            {rows.map(({ p, r }, i) => (
              <tr key={p.id} className={`border-b border-term-line ${i % 2 === 1 ? "bg-term-zebra" : ""}`}>
                <Td>
                  <Tooltip content={p.gist}>
                    <span className="text-term-text">{p.label}</span>
                  </Tooltip>
                </Td>
                <Td align="right" className="text-term-sub">
                  {REGIME_BY_ID[r.regime.active].label}
                </Td>
                <Td align="right" className="text-term-sub">
                  {PATH_BY_ID[p.path].label}
                </Td>
                <Td align="right" mono className="text-term-sub">
                  {HORIZON_LABEL[p.horizon]}
                </Td>
                {r.portfolios.map((port) => {
                  const livePct = live.portfolios.find((q) => q.id === port.id)?.pct ?? 0;
                  const vsLive = port.pct - livePct;
                  return (
                    <Td key={port.id} align="right" mono className={signColor(port.pct)}>
                      {fmtPct(port.pct)}{" "}
                      <Tooltip content="Delta vs the on-screen scenario, in percentage points">
                        <span className={signColor(vsLive)}>({fmtSigned(vsLive, 1)})</span>
                      </Tooltip>
                    </Td>
                  );
                })}
                <Td align="right" mono className="text-term-muted">
                  {Object.keys(p.set).length}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        <div className="border-t border-term-line px-2 py-1">
          <Cap>Parenthetical: delta vs the on-screen scenario, in points</Cap>
        </div>
      </Panel>
    </div>
  );
}
