"use client";

import React from "react";
import { ThemeProvider } from "@/lib/theme";
import { Analytics } from "@vercel/analytics/react";

// Root-level providers only — theme (dark/light class on <html>) and
// analytics, both genuinely global: every route, including the public front
// page (app/page.tsx, components/Landing.tsx), wants the same dark palette
// and the same pageview tracking.
//
// Everything that used to live here alongside these two — ScenarioProvider,
// the fill-scale zoom machinery, TopNav, the min-w-[1280px] panning <main> —
// has moved to app/(tool)/layout.tsx. That machinery is specific to the
// scenario tool itself (Builder/P&L/Sensitivity/Derivation/Trading/
// Execution): Landing has no scenario state, no TopNav tab strip, and is
// meant to run as an ordinary fluid-width document, not the fixed-minimum-
// width, zoom-scaled app shell. Splitting the root layout's providers this
// way is what lets "/" render Landing without inheriting any of that app
// chrome, while every /(tool)/* route still gets all of it exactly as
// before — see app/(tool)/layout.tsx's own comment for the moved half.
export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ThemeProvider>{children}</ThemeProvider>
      <Analytics />
    </>
  );
}
