"use client";

import NarrativeTab from "@/components/NarrativeTab";
import { useScenario } from "@/lib/scenario-context";

export default function DerivationPage() {
  const { result, input, focusAsset, setFocusAsset } = useScenario();
  return (
    <NarrativeTab r={result} input={input} focusAsset={focusAsset} onFocusHandled={() => setFocusAsset(null)} />
  );
}
