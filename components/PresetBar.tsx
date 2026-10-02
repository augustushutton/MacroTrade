"use client";

import { PRESETS, type Preset } from "@/lib/scenarios";
import { GroupHeader, Tooltip } from "./ui";

// Six independent bordered cards tiled edge-to-edge (3 columns at the widest
// tier, matching VarForm's mosaic immediately below this on the page) —
// previously all six groups sat stacked inside ONE outer border with nothing
// but a thin header rule between them, which read as one long undifferentiated
// list rather than six distinct panels. Order is render order (also the
// grid order, same convention as VarForm's VAR_GROUPS).
const ALL_GROUPS = ["Growth", "Inflation", "Credit & Liquidity", "Policy", "External", "Curve"];

// Every group is permanently open by request — no collapse/expand toggle.
// `expanded`/`setExpanded` are still accepted below so ScenarioContext's
// presetOpen/setPresetOpen plumbing (also used by session save/restore,
// lib/storage.ts, tests/storage.test.ts) doesn't need to be torn out for a
// display-only change here; this component now simply never reads or calls
// them. PRESET_DEFAULT_OPEN is kept for the same reason — ScenarioContext
// still imports it to seed that now-unused state.
export const PRESET_DEFAULT_OPEN: Record<string, boolean> = {
  Growth: true,
  Inflation: true,
  "Credit & Liquidity": true,
};

/** Negative-margin overlap so a card's border coincides with its neighbour's
 *  instead of doubling into a 2px line — identical trick to VarForm's
 *  overlapClass, duplicated rather than shared since the two components'
 *  column counts can diverge independently over time. */
function overlapClass(scope: "sm" | "md" | "xl", i: number): string {
  const cols = scope === "xl" ? 3 : scope === "md" ? 2 : 1;
  const cls: string[] = [];
  if (i % cols !== 0) cls.push("-ml-px");
  if (i >= cols) cls.push("-mt-px");
  return cls.join(" ");
}

export default function PresetBar({
  activeId,
  onPick,
}: {
  activeId: string | null;
  onPick: (p: Preset) => void;
  /** Accepted, unused — see the comment above ALL_GROUPS. Kept so callers
   *  (app/page.tsx) don't need to change for a display-only removal. */
  expanded?: Record<string, boolean>;
  setExpanded?: (group: string, v: boolean) => void;
}) {
  const card = (scope: "sm" | "md" | "xl") => (group: string, i: number) => {
    const presets = PRESETS.filter((p) => p.group === group);

    return (
      <div key={group} className={`border border-term-edge bg-term-panel ${overlapClass(scope, i)}`}>
        {/* Per-group count badge removed by request — the group's own rows
            are listed right below the header, so the count was restating
            something already directly visible rather than adding
            information. */}
        <GroupHeader>{group}</GroupHeader>
        <div>
          {presets.map((p, ri) => {
            const isSel = activeId === p.id;
            return (
              <Tooltip key={p.id} content={p.gist} className="block w-full min-w-0">
                <button
                  type="button"
                  onClick={() => onPick(p)}
                  className={`group flex w-full min-w-0 items-center gap-1.5 px-2 py-dense text-left text-[11px] ${
                    ri % 2 === 1 && !isSel ? "bg-term-zebra" : ""
                  } ${ri > 0 ? "border-t border-term-line" : ""} ${
                    isSel
                      ? "bg-term-text font-medium text-term-panel"
                      : "text-term-sub hover:bg-term-line/10 hover:text-term-text"
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
                      isSel ? "text-term-panel" : "text-term-edge group-hover:text-term-text"
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
      </div>
    );
  };

  // Same fixed 3/2/1-column mosaic as VarForm just below it on the page —
  // one visual system for "a row of independent bordered cards," not two
  // slightly different ones. items-start keeps every card sized to its own
  // content (Policy's 9 presets vs. Inflation's 3) instead of every card in
  // a row stretching to match its tallest neighbour.
  return (
    <>
      <div className="flex flex-col gap-0 md:hidden">{ALL_GROUPS.map(card("sm"))}</div>
      <div className="hidden grid-cols-2 items-start gap-0 md:grid xl:hidden">{ALL_GROUPS.map(card("md"))}</div>
      <div className="hidden grid-cols-3 items-start gap-0 xl:grid">{ALL_GROUPS.map(card("xl"))}</div>
    </>
  );
}
