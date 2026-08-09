import type { Metadata } from "next";
import { NAV } from "@/lib/nav";

export const metadata: Metadata = {
  title: `MacroTrade — ${NAV.find((n) => n.href === "/derivation")!.pageTitle}`,
};

export default function DerivationLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
