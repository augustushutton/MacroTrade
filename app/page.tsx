"use client";

import PresetBar from "@/components/PresetBar";
import SavedScenarios from "@/components/SavedScenarios";
import VarForm from "@/components/VarForm";
import { useScenario } from "@/lib/scenario-context";

// Builder page — the built-in Preset library at the top, the user's own
// Saved Scenarios underneath it, and every variable group below that.
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
  const { state, setVar, resetGroup, open, setOpen, query, presetId, applyPreset, presetOpen, setPresetOpen } =
    useScenario();

  return (
    <div className="space-y-0">
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
