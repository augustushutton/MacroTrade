"use client";

import PresetBar from "@/components/PresetBar";
import VarForm from "@/components/VarForm";
import { useScenario } from "@/lib/scenario-context";

// Builder page — scenario inputs (presets + all variable groups), at full
// page width. Previously this was a 320px sticky sidebar squeezed next to
// results; that made every variable label truncate. Now VarForm lays its
// groups out in a multi-column grid, which needs the room a whole page
// gives it and a sidebar didn't.

export default function BuilderPage() {
  const { state, setVar, resetGroup, open, setOpen, query, applyPreset, presetId } = useScenario();

  return (
    <div className="space-y-3">
      {/* Presets and individual inputs are two different kinds of control —
          one click loads a whole pre-built scenario, the other tunes a
          single variable. The left-edge accent colour on PresetBar (see
          PresetBar.tsx) still marks that distinction visually; the eyebrow
          labels that used to spell it out in text were removed by request. */}
      <div>
        <PresetBar activeId={presetId} onPick={applyPreset} />
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
