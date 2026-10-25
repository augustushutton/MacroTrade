"use client";

import TradingTab from "@/components/TradingTab";
import { useScenario } from "@/lib/scenario-context";
import { PRESET_BY_ID } from "@/lib/scenarios";

// Scenario label frozen onto every order placed from this page — see
// lib/executions.ts's ExecutionOrder.scenarioLabel comment for why it's
// purely descriptive and never re-derived later. A loaded built-in preset
// gets its own label (PRESET_BY_ID, the same library PresetBar reads from);
// anything else — a hand-tuned scenario, a loaded saved scenario, the
// baseline itself — reads as "Custom scenario", same convention
// lib/executions.ts's own backup-branch predecessor used.
export default function TradingPage() {
  const { result, horizon, presetId } = useScenario();
  const scenarioLabel = presetId ? (PRESET_BY_ID[presetId]?.label ?? "Custom scenario") : "Custom scenario";

  return <TradingTab r={result} scenarioLabel={scenarioLabel} horizon={horizon} />;
}
