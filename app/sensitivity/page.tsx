"use client";

import SensitivityTab from "@/components/SensitivityTab";
import { useScenario } from "@/lib/scenario-context";

export default function SensitivityPage() {
  const { input, portfolioId, sensitivityXVar, setSensitivityXVar, sensitivityYVar, setSensitivityYVar } =
    useScenario();
  return (
    <SensitivityTab
      input={input}
      portfolioId={portfolioId}
      xVar={sensitivityXVar}
      setXVar={setSensitivityXVar}
      yVar={sensitivityYVar}
      setYVar={setSensitivityYVar}
    />
  );
}
