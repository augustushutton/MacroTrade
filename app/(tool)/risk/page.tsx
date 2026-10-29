"use client";

import RiskTab from "@/components/RiskTab";
import { useScenario } from "@/lib/scenario-context";

export default function RiskPage() {
  const { input, portfolioId } = useScenario();
  return <RiskTab input={input} portfolioId={portfolioId} />;
}
