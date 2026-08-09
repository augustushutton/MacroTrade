import type { Metadata } from "next";
import { NAV } from "@/lib/nav";

export const metadata: Metadata = {
  title: `MacroTrade — ${NAV.find((n) => n.href === "/compare")!.pageTitle}`,
};

export default function CompareLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
