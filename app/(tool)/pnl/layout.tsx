import type { Metadata } from "next";
import { NAV } from "@/lib/nav";

// Static per-route <title>, set at request/build time via Next's metadata
// API — not a useEffect setting document.title after mount. The previous
// TopNav did the latter: client-only, so the tab read "MacroTrade" (the
// root layout's title) for a moment on every load before the effect ran,
// and produced nothing for a crawler or a pre-render. Each route's title
// lives in lib/nav.ts, not retyped here, so it can't drift from the nav
// link or the context-bar heading that also read from it.
export const metadata: Metadata = {
  title: `MacroTrade — ${NAV.find((n) => n.href === "/pnl")!.pageTitle}`,
};

export default function PnlLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
