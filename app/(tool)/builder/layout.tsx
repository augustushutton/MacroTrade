import type { Metadata } from "next";
import { NAV } from "@/lib/nav";

// Static per-route <title> — see app/(tool)/pnl/layout.tsx's comment for why
// this is set here rather than via a client-side useEffect. Builder moved
// here from the root route ("/"), so this layout (and lib/nav.ts's updated
// href) is new, not moved — the root's own title is now set directly in
// app/layout.tsx for the public front page instead.
export const metadata: Metadata = {
  title: `MacroTrade — ${NAV.find((n) => n.href === "/builder")!.pageTitle}`,
};

export default function BuilderLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
