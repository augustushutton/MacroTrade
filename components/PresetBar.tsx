"use client";

import { PRESETS, type Preset } from "@/lib/scenarios";
import { GroupHeader, Tooltip } from "./ui";

// Primary scenario groups (Growth/Inflation/Credit) are expanded by default;
// secondary groups (Policy/External/Curve) start collapsed. Two-column list
// with a bottom hairline per row, matching the table styling used elsewhere.
const PRIMARY_GROUPS = ["Growth", "Inflation", "Credit & Liquidity"];
const SECONDARY_GROUPS = ["Policy", "External", "Curve"];

// `expanded`/`setExpanded` used to be local state here, which meant this
// accordion reset to its hardcoded defaults every time the Builder route
// remounted (e.g. navigating to P&L and back) even though the identical
// pattern in VarForm's accordion survived, because VarForm's open state is
// lifted into ScenarioContext and this wasn't. Now both live there.
export const PRESET_DEFAULT_OPEN: Record<string, boolean> = {
  Growth: true,
  Inflation: true,
  "Credit & Liquidity": true,
};

export default function PresetBar({
  activeId,
  onPick,
  expanded,
  setExpanded,
}: {
  activeId: string | null;
  onPick: (p: Preset) => void;
  expanded: Record<string, boolean>;
  setExpanded: (group: string, v: boolean) => void;
}) {
  const renderGroup = (group: string) => {
    const presets = PRESETS.filter((p) => p.group === group);
    const isOpen = expanded[group] ?? false;
    const lastRowStartsAt = presets.length - (presets.length % 2 === 0 ? 2 : 1);

    return (
      <div key={group}>
        <GroupHeader onClick={() => setExpanded(group, !isOpen)} openState={isOpen}>
          {group}
        </GroupHeader>
        {isOpen && (
          <div className="grid grid-cols-2">
            {presets.map((p, i) => {
              const isSel = activeId === p.id;
              const isRightCol = i % 2 === 1;
              const isLastRow = i >= lastRowStartsAt;
              return (
                <Tooltip key={p.id} content={p.gist} className="w-full min-w-0">
                  <button
                    type="button"
                    onClick={() => onPick(p)}
                    className={`group flex w-full min-w-0 items-center gap-1.5 px-2 py-dense text-left text-[11px] ${!isRightCol ? "border-r border-term-line" : ""} ${
                      !isLastRow ? "border-b border-term-line" : ""
                    } ${
                      isSel
                        ? "bg-term-text font-medium text-term-panel"
                        : "text-term-sub hover:bg-info/10 hover:text-term-text"
                    }`}
                  >
                    {/* A static "load this scenario" affordance — previously
                        rows were bare text and only revealed they were
                        clickable on hover, reading more like a table of
                        contents than a set of buttons at rest. The arrow
                        sits at rest (not hover-only), dims when not
                        selected/hovered, and matches the row's own state
                        colour rather than introducing a new one. */}
                    <span
                      className={`shrink-0 font-mono ${
                        isSel ? "text-term-panel" : "text-term-edge group-hover:text-info"
                      }`}
                    >
                      &rsaquo;
                    </span>
                    <span className="min-w-0 truncate">{p.label}</span>
                  </button>
                </Tooltip>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    // border-l accent (info blue, 2px) instead of the uniform grey border
    // VarForm's GroupCards use — a low-key but always-on cue that this
    // block is a different kind of control (load-a-scenario) from the
    // input rail below it, reinforcing the page-level eyebrow label rather
    // than duplicating it loudly.
    <div className="border border-term-edge border-l-2 border-l-info bg-term-panel">
      {PRIMARY_GROUPS.map((g) => renderGroup(g))}
      <div className="border-t border-term-edge">{SECONDARY_GROUPS.map((g) => renderGroup(g))}</div>
    </div>
  );
}
