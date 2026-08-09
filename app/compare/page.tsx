"use client";

import CompareTab from "@/components/CompareTab";
import { useScenario } from "@/lib/scenario-context";

export default function ComparePage() {
  const { input } = useScenario();
  return <CompareTab input={input} />;
}
