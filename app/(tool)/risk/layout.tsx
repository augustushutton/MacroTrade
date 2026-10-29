import type { Metadata } from "next";
import { NAV } from "@/lib/nav";

export const metadata: Metadata = {
  title: `MacroTrade — ${NAV.find((n) => n.href === "/risk")!.pageTitle}`,
};

export default function RiskLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
