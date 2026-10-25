"use client";

import { useRouter } from "next/navigation";
import PnlTab, { PortfolioSummary } from "@/components/PnlTab";
import { useScenario } from "@/lib/scenario-context";

export default function PnlPage() {
  const router = useRouter();
  const {
    result,
    portfolioId,
    setPortfolioId,
    notional,
    hydrated,
    pinned,
    togglePin,
    setFocusAsset,
    pnlOpenSectors,
    setPnlOpenSectors,
    pnlSortKey,
    setPnlSortKey,
    pnlSortDir,
    setPnlSortDir,
  } = useScenario();

  function jumpToDerivation(assetId: string) {
    setFocusAsset(assetId);
    router.push("/derivation");
  }

  return (
    <div>
      <div className="mb-0">
        <PortfolioSummary
          r={result}
          selected={portfolioId}
          onSelect={setPortfolioId}
          notional={notional}
          hydrated={hydrated}
        />
      </div>
      <PnlTab
        r={result}
        selected={portfolioId}
        hydrated={hydrated}
        pinned={pinned}
        onTogglePin={togglePin}
        onJumpToDerivation={jumpToDerivation}
        openSectors={pnlOpenSectors}
        setOpenSectors={setPnlOpenSectors}
        sortKey={pnlSortKey}
        setSortKey={setPnlSortKey}
        sortDir={pnlSortDir}
        setSortDir={setPnlSortDir}
      />
    </div>
  );
}
