"use client";

import React from "react";
import { ThemeProvider } from "@/lib/theme";
import { ScenarioProvider } from "@/lib/scenario-context";
import TopNav from "@/components/TopNav";
import { Analytics } from "@vercel/analytics/react";

// How tall a typical laptop's browser content area is (window.innerHeight,
// i.e. already past the tab/address bar chrome) — a 1440x900-ish window.
// This is the deliberate reference point: at this height, scale is exactly
// 1 and nothing about today's design changes. Taller windows scale up from
// here. It is a fixed constant, not measured from any page's actual
// content — see the "first version" note below for why that distinction is
// the whole fix.
const REFERENCE_HEIGHT = 900;

// Below this viewport width, the fill-scale mechanism is switched off
// entirely (scale pinned to 1) — matches the app's own `xl` breakpoint
// (VarForm/PresetBar switch to their full 3-column desktop layout at the
// same point). Phones and portrait tablets already get their own responsive
// treatment (TopNav/table scroll strips, stacked columns — see TopNav.tsx,
// SensitivityTab.tsx, NarrativeTab.tsx) sized for an unscaled 1x viewport;
// scaling them up on top of that would shrink their LOCAL layout width
// (the `width: calc(100% / scale)` half of this mechanism) below what those
// breakpoints assume, risking exactly the horizontal-overflow bugs that
// work just fixed.
const DESKTOP_MIN_WIDTH = 1280;

// Returns a uniform scale factor for `.app-scale` (globals.css) to visually
// fill more of a tall desktop monitor — see that file's long comment for why
// a transform is the right tool here.
//
// First version of this measured the CURRENT PAGE's own rendered content
// height and solved for the scale that would make it exactly reach the
// bottom of the window. That produced a different answer on every page
// (Sensitivity's content is shorter than Builder's, Builder's shorter than
// P&L's with every sector expanded, and so on) and recalculated on every
// resize-shaped event — including a panel opening or closing. The result
// was the UI visibly zooming in and out as you clicked between tabs or
// expanded a section, which reads as broken even though each individual
// number was "correct" for that instant. This version deliberately knows
// nothing about page content: it is a pure function of the window's own
// height, so the only thing that changes it is actually resizing the
// window. Navigating pages, expanding an accordion, toggling the CPI
// override — none of it touches `scale`. The tradeoff is that a short page
// may leave a little space below it rather than being stretched to exactly
// fill every pixel; that's the right trade for "stop zooming randomly."
//
// `min`/`max` bound the result: never shrink below the design's natural 1x
// size, and never blow text up past a size that stops reading as a dense
// terminal table and starts reading as a kiosk display.
function useFillScale({ min = 1, max = 1.55 }: { min?: number; max?: number } = {}) {
  const [scale, setScale] = React.useState(1);

  React.useEffect(() => {
    function recompute() {
      if (window.innerWidth < DESKTOP_MIN_WIDTH) {
        setScale((prev) => (prev !== 1 ? 1 : prev));
        return;
      }
      const next = Math.min(max, Math.max(min, window.innerHeight / REFERENCE_HEIGHT));
      setScale((prev) => (Math.abs(prev - next) > 0.01 ? next : prev));
    }

    recompute();
    window.addEventListener("resize", recompute);
    return () => window.removeEventListener("resize", recompute);
  }, [min, max]);

  return scale;
}

// Everything that needs client-side state (theme, the scenario context, nav
// active-link highlighting) lives here, one level below the root layout.
// The root layout itself stays a Server Component so it can export
// `metadata`/`viewport` — Next.js's App Router does not allow a Client
// Component to export either, and the root layout previously tried to be
// both at once (a `"use client"` file exporting `metadata`), which fails
// `next build` outright rather than just warning.
export default function Providers({ children }: { children: React.ReactNode }) {
  const scale = useFillScale();

  return (
    <>
      <ThemeProvider>
        <ScenarioProvider>
          {/* No forced `min-h-screen` here, and no `mx-auto` centering — a
              page's height/width is whatever its content actually needs,
              never artificially stretched by growing a container, which on a
              short page or a narrow column just moves the dead space around
              rather than removing it (see useFillScale above and the
              `.app-scale` comment in globals.css for the mechanism that
              actually fills a large monitor: enlarging real content, not
              stretching a box around it).

              `<main>` itself used to carry a `max-w-[1920px]` cap — a density
              preference from when every dense table (PnlTab, SensitivityTab,
              NarrativeTab) was first made to use `table-fixed` with an
              explicit percentage width on every column, verified safe at any
              width (1280 through 3440px) per the CSS2.1 fixed table-layout
              algorithm: all columns scale by the SAME ratio, so nothing ever
              strands a figure behind a dead gap. That verification is what
              makes removing the cap entirely safe now: on a large external
              display, a column cap just relocates the unused space from
              "beside the table" to "a single right-hand margin" — still
              dead space, just narrower. Letting `<main>` go fully fluid
              removes it instead of relocating it. If a future ultrawide
              monitor makes a dozen columns feel too stretched-thin, that's a
              `max-w` to reintroduce deliberately, not a bug to work around. */}
          <main className="w-full px-3 py-2">
            {/* useFillScale (above) sets `--app-scale` (read by `.app-scale`
                in globals.css) from the window's own height alone — never
                from this wrapper's content, which is what used to make the
                zoom level jump around as you navigated or expanded a panel.
                The width correction paired with the scale transform re-fills
                exactly 100% of `<main>` above regardless of `<main>`'s own
                (now fluid) width at a given viewport — this enlarges real
                content only, never blank space, so it doesn't reopen the
                no-min-h-screen/no-mx-auto reasoning above; it just makes the
                content those rules already size to the page fill more of
                the screen it's actually sitting on, consistently across
                every page. */}
            <div className="app-scale" style={{ "--app-scale": scale } as React.CSSProperties}>
              <div className="mb-0 no-print">
                <TopNav />
              </div>
              {children}
            </div>
          </main>
        </ScenarioProvider>
      </ThemeProvider>
      <Analytics />
    </>
  );
}
