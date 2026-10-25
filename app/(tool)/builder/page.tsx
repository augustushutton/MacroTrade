"use client";

import PresetBar from "@/components/PresetBar";
import SavedScenarios from "@/components/SavedScenarios";
import VarForm from "@/components/VarForm";
import { GroupHeader } from "@/components/ui";
import { useScenario } from "@/lib/scenario-context";

// Builder page — the built-in Preset library at the top, the user's own
// Saved Scenarios underneath it, and every variable group below that.
//
// This used to be the app's root route ("/"); it moved to /builder when the
// real public front page (components/Landing.tsx) took over "/" — see that
// file's own comment, and app/page.tsx, for the split. Nothing about this
// page's own content changed in that move, only its URL and the layout
// that now wraps it (app/(tool)/layout.tsx instead of the root layout
// directly) — TopNav, ScenarioProvider, and the fill-scale/pan machinery
// still apply here exactly as they did at "/", just scoped to this route
// group now so the public front page doesn't inherit any of it.
//
// This is the original order from before this session's experiments: Preset
// library first (the "pick one off the shelf" surface), Saved Scenarios next
// (the desk's own, separate from the built-in library), VarForm's six groups
// last (the raw inputs everything above is built from).
//
// The yield curve work from later in the session — YieldCurveChart (a
// draggable Treasury curve), RealYieldPanel (implied real yield) and
// ScenarioComparisonChart (saved scenarios' curves overlaid) — has been
// removed by request, all three together since ScenarioComparisonChart's
// entire content was a yield-curve overlay and has nothing left to show
// without YieldCurveChart. All three files are left on disk, untouched and
// simply unused, same reversibility convention as PresetBar's own earlier
// removal and restoration just now.
export default function BuilderPage() {
  const {
    state,
    setVar,
    resetGroup,
    resetAll,
    open,
    setOpen,
    query,
    presetId,
    applyPreset,
    presetOpen,
    setPresetOpen,
  } = useScenario();

  return (
    <div className="space-y-0">
      <div>
        {/* Page-level counterpart to each variable group's own "Reset" button
            (VarForm) — this one clears every group (and the preset/saved-
            scenario selection) back to flat baseline in one click, not just
            the group it sits in. Lives at the top of the Builder page's own
            content, not in TopNav's shared title bar (that bar is reused by
            every route, so a Builder-only action doesn't belong there). No
            left-side label: TopNav's "Scenario Builder" title directly above
            already says what this section is, so GroupHeader's label slot is
            left empty and only hosts this one right-aligned action — same
            toolbar-strip chrome as every other GroupHeader in the app rather
            than a one-off button style. */}
        <GroupHeader
          right={
            <button
              type="button"
              onClick={resetAll}
              className="text-th uppercase text-term-muted hover:text-down"
            >
              <span aria-hidden className="mr-0.5">
                &#8634;
              </span>
              Reset Scenario
            </button>
          }
        >
          {null}
        </GroupHeader>
      </div>
      <div>
        <PresetBar activeId={presetId} onPick={applyPreset} expanded={presetOpen} setExpanded={setPresetOpen} />
      </div>
      <div>
        <SavedScenarios />
      </div>
      <div>
        <VarForm
          state={state}
          onChange={setVar}
          onResetGroup={resetGroup}
          open={open}
          setOpen={setOpen}
          filter={query}
        />
      </div>
    </div>
  );
}
