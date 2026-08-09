"use client";

import SensitivityTab from "@/components/SensitivityTab";
import { useScenario } from "@/lib/scenario-context";

export default function SensitivityPage() {
  const { input, portfolioId } = useScenario();
  return <SensitivityTab input={input} portfolioId={portfolioId} />;
}
