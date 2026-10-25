"use client";

import NarrativeTab from "@/components/NarrativeTab";
import { useScenario } from "@/lib/scenario-context";

export default function DerivationPage() {
  const { result, focusAsset, setFocusAsset, narrativeGroupTab, setNarrativeGroupTab } = useScenario();
  return (
    <NarrativeTab
      r={result}
      focusAsset={focusAsset}
      onFocusHandled={() => setFocusAsset(null)}
      activeGroupTab={narrativeGroupTab}
      setActiveGroupTab={setNarrativeGroupTab}
    />
  );
}
