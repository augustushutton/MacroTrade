import type { Metadata } from "next";
import { NAV } from "@/lib/nav";

export const metadata: Metadata = {
  title: `MacroTrade — ${NAV.find((n) => n.href === "/sensitivity")!.pageTitle}`,
};

export default function SensitivityLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
