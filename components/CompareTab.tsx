"use client";

import React from "react";
import { runScenario, type EngineResult, type ScenarioInput } from "@/lib/engine";
import { PORTFOLIOS } from "@/lib/portfolios";
import { HORIZON_LABEL, PATH_BY_ID } from "@/lib/paths";
import { REGIME_BY_ID } from "@/lib/regimes";
import { VAR_BY_ID } from "@/lib/vars";
import { PRESETS, PRESET_GROUPS, presetState, type Preset } from "@/lib/scenarios";
import { fmtPct, fmtSigned, signColor } from "@/lib/format";
import { Btn, Cap, Panel, SignedBar, Td, Th, Tooltip } from "./ui";

// The scenario on screen, re-priced against the fixed preset library. Every
// preset is re-run through the live engine rather than cached, so a
// comparison never mixes numbers from two different versions of the model.

/** Grouped bar chart: on-screen vs. one picked preset, one group per
 *  portfolio. Kept in the same dense, no-decoration register as the rest of
 *  the app — no charting library, an SVG built to the actual data's scale. */
function OverlayBars({
  live,
  picked,
  pickedLabel,
}: {
  live: EngineResult["portfolios"];
  picked: EngineResult["portfolios"];
  pickedLabel: string;
}) {
  const w = 640;
  const h = 150;
  const padL = 34;
  const padR = 8;
  const padT = 8;
  const padB = 20;
  const innerH = h - padT - padB;
  const zeroY = padT + innerH / 2;
  const maxAbs = Math.max(1e-6, ...live.map((p) => Math.abs(p.pct)), ...picked.map((p) => Math.abs(p.pct)));
  const scale = innerH / 2 / maxAbs;
  const n = PORTFOLIOS.length;
  const groupW = (w - padL - padR) / n;
  const barW = groupW * 0.28;

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: h }} role="img" aria-label="On-screen scenario vs picked preset, by portfolio">
        <line x1={padL} y1={zeroY} x2={w - padR} y2={zeroY} className="stroke-term-line" strokeWidth={1} />
        {PORTFOLIOS.map((p, i) => {
          const cx = padL + groupW * (i + 0.5);
          const lv = live.find((x) => x.id === p.id)?.pct ?? 0;
          const pv = picked.find((x) => x.id === p.id)?.pct ?? 0;
          const bar = (v: number, dx: number, cls: string) => {
            const bh = Math.abs(v) * scale;
            const bx = cx + dx - barW / 2;
            const by = v >= 0 ? zeroY - bh : zeroY;
            return <rect key={cls + dx} x={bx} y={by} width={barW} height={Math.max(bh, 0.5)} className={cls} />;
          };
          return (
            <g key={p.id}>
              {bar(lv, -barW * 0.6, "fill-term-muted")}
              {bar(pv, barW * 0.6, pv >= 0 ? "fill-up" : "fill-down")}
              <text x={cx} y={h - 5} textAnchor="middle" fontSize={9} className="fill-term-muted">
                {p.label}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="flex items-center gap-3 border-t border-term-line px-2 py-1">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 bg-term-muted" />
          <Cap>On screen</Cap>
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 bg-up" />
          <Cap>{pickedLabel}</Cap>
        </span>
      </div>
    </div>
  );
}

interface VarDeltaRow {
  id: string;
  label: string;
  base: number;
  dp: number;
  unit: string;
  live: number;
  picked: number;
}

/** Every variable where the on-screen scenario and the picked preset
 *  disagree — a superset of either scenario's own "moved from baseline"
 *  list, since two non-baseline scenarios can differ from each other on a
 *  variable that also happens to sit at baseline on-screen. */
function VarDeltaTable({ live, picked }: { live: ScenarioInput["state"]; picked: ScenarioInput["state"] }) {
  const rows: VarDeltaRow[] = Object.values(VAR_BY_ID)
    .map((v) => ({
      id: v.id,
      label: v.label,
      base: v.base,
      dp: v.dp,
      unit: v.unit,
      live: live[v.id] ?? v.base,
      picked: picked[v.id] ?? v.base,
    }))
    .filter((r) => Math.abs(r.live - r.picked) > 1e-9)
    .sort((a, b) => Math.abs(b.live - b.picked) - Math.abs(a.live - a.picked));

  if (rows.length === 0) {
    return (
      <div className="px-3 py-4">
        <Cap>Same variable set &mdash; nothing differs between the two scenarios.</Cap>
      </div>
    );
  }
  const maxAbs = Math.max(...rows.map((r) => Math.abs(r.live - r.picked)));
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr className="bg-term-raised">
            <Th className="w-[190px]">Variable</Th>
            <Th align="right" className="w-[90px]">
              Base
            </Th>
            <Th align="right" className="w-[90px]">
              On Screen
            </Th>
            <Th align="right" className="w-[90px]">
              Preset
            </Th>
            <Th className="w-[150px]">Delta</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-term-line even:bg-term-zebra">
              <Td className="text-term-text">{r.label}</Td>
              <Td align="right" mono className="text-term-muted">
                {r.base.toFixed(r.dp)}
              </Td>
              <Td align="right" mono className={signColor(r.live - r.base, 10 ** -r.dp / 2)}>
                {r.live.toFixed(r.dp)}
              </Td>
              <Td align="right" mono className={signColor(r.picked - r.base, 10 ** -r.dp / 2)}>
                {r.picked.toFixed(r.dp)}
              </Td>
              <Td className="p-0">
                <div className="px-2 py-dense">
                  <SignedBar v={r.live - r.picked} max={maxAbs} />
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function CompareTab({
  input,
  group,
  setGroup,
}: {
  input: ScenarioInput;
  group: string;
  setGroup: (g: string) => void;
}) {
  // Which preset row (if any) is being diffed in full against the on-screen
  // scenario. Transient drill-down, not persisted — same treatment as
  // NarrativeTab's `justFocused`, since there is nothing meaningful to
  // restore across a reload and it resets sensibly to "none" either way.
  const [pickedId, setPickedId] = React.useState<string | null>(null);

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
  const picked = rows.find(({ p }) => p.id === pickedId);

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
              <tr
                key={p.id}
                onClick={() => setPickedId((cur) => (cur === p.id ? null : p.id))}
                className={`cursor-pointer border-b border-term-line hover:bg-info/10 ${
                  pickedId === p.id ? "bg-term-raised" : i % 2 === 1 ? "bg-term-zebra" : ""
                }`}
              >
                <Td>
                  <Tooltip content={p.gist}>
                    <span className={pickedId === p.id ? "font-medium text-term-text" : "text-term-text"}>
                      {pickedId === p.id ? <span className="text-info">&#9656;</span> : null} {p.label}
                    </span>
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
          <Cap>Parenthetical: delta vs the on-screen scenario, in points. Click a row to diff it in full below.</Cap>
        </div>
      </Panel>

      {picked ? (
        <>
          <Panel title={`On Screen vs ${picked.p.label} — Portfolio Impact`}>
            <div className="px-2 py-2">
              <OverlayBars live={live.portfolios} picked={picked.r.portfolios} pickedLabel={picked.p.label} />
            </div>
          </Panel>
          <Panel title={`On Screen vs ${picked.p.label} — Variable Delta`}>
            <VarDeltaTable live={input.state} picked={presetState(picked.p)} />
          </Panel>
        </>
      ) : null}
    </div>
  );
}
