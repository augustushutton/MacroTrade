import AssetReference from "@/components/AssetReference";
import type { Metadata } from "next";

// One of the four public front-page routes — see components/
// LandingChrome.tsx and app/page.tsx's own comment for the full context.
// Used to be half of a combined "/reference" route — see
// components/AssetReference.tsx's own comment for why it's split out.
export const metadata: Metadata = {
  title: "Assets — MacroTrade",
  description: "What's behind every priced asset in MacroTrade, in plain terms.",
};

export default function AssetsPage() {
  return <AssetReference />;
}
