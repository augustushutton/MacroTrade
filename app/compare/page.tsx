"use client";

import CompareTab from "@/components/CompareTab";
import { useScenario } from "@/lib/scenario-context";

export default function ComparePage() {
  const { input, compareGroup, setCompareGroup } = useScenario();
  return <CompareTab input={input} group={compareGroup} setGroup={setCompareGroup} />;
}
