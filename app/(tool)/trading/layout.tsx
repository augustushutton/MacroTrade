import type { Metadata } from "next";
import { NAV } from "@/lib/nav";

// Static per-route <title> — see app/pnl/layout.tsx's comment for why this
// is set here rather than via a client-side useEffect.
export const metadata: Metadata = {
  title: `MacroTrade — ${NAV.find((n) => n.href === "/trading")!.pageTitle}`,
};

export default function TradingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
