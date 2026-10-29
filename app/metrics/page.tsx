import MetricsGuide from "@/components/MetricsGuide";
import type { Metadata } from "next";

// Last of the four public front-page routes — see components/
// LandingChrome.tsx and app/page.tsx's own comment for the full context.
export const metadata: Metadata = {
  title: "Metrics — MacroTrade",
  description: "What every chart, table, correlation, and index in MacroTrade actually shows.",
};

export default function MetricsPage() {
  return <MetricsGuide />;
}
