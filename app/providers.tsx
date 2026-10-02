"use client";

import React from "react";
import { ThemeProvider } from "@/lib/theme";
import { ScenarioProvider } from "@/lib/scenario-context";
import TopNav from "@/components/TopNav";
import { Analytics } from "@vercel/analytics/react";

// Measures how much of the available viewport the app's own content (TopNav
// + whichever page is mounted below it) is actually using, and returns a
// uniform scale factor that closes the gap — see the long comment on
// `.app-scale` in globals.css for why this exists and why a transform
// (rather than stretching a container) is the right tool.
//
// `min`/`max` bound the result: never shrink below the design's natural 1x
// size (a short browser window should just show less, not shrink text), and
// never blow text up past a size that stops reading as a dense terminal
// table and starts reading as a kiosk display.
function useFillScale(
  ref: React.RefObject<HTMLElement>,
  { min = 1, max = 1.55, bottomMargin = 16 }: { min?: number; max?: number; bottomMargin?: number } = {},
) {
  const [scale, setScale] = React.useState(1);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let frame = 0;
    function recompute() {
      if (!el) return;
      // `transform-origin: top left` keeps this corner fixed across any
      // scale, so rect.top/left are stable reference points — unlike
      // rect.height/width, which already include the CURRENT transform and
      // would double-count if used here. `offsetHeight` is the pre-transform
      // layout height (at the current, scale-narrowed local width), which is
      // what we want: the table/panel layouts in this app are fixed-width
      // and row-height driven, not reflow-sensitive, so that height is a
      // good stand-in for "natural height" across the scale range we allow.
      const rect = el.getBoundingClientRect();
      const availableHeight = window.innerHeight - rect.top - bottomMargin;
      const naturalHeight = el.offsetHeight;
      if (naturalHeight <= 0 || availableHeight <= 0) return;
      const next = Math.min(max, Math.max(min, availableHeight / naturalHeight));
      setScale((prev) => (Math.abs(prev - next) > 0.01 ? next : prev));
    }

    recompute();

    // Re-measure on any size change: a window resize/drag, a panel
    // expanding or collapsing, or navigating to a page with different
    // natural content height. requestAnimationFrame coalesces bursts of
    // ResizeObserver callbacks (which otherwise risks the browser's own
    // "loop limit exceeded" warning) into one measurement per frame.
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(recompute);
    });
    ro.observe(el);
    window.addEventListener("resize", recompute);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", recompute);
      cancelAnimationFrame(frame);
    };
  }, [ref, min, max, bottomMargin]);

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
  const scaleRef = React.useRef<HTMLDivElement>(null);
  const scale = useFillScale(scaleRef);

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
            {/* useFillScale (above) measures this wrapper's natural height
                against the real, current viewport height and sets
                `--app-scale` (read by `.app-scale` in globals.css) to
                whatever closes that gap — replacing an earlier fixed 1.15
                guess that worked for a typical laptop screen but left a
                large band of flat background below the content on a big
                external monitor. The width correction paired with the scale
                transform re-fills exactly 100% of `<main>` above regardless
                of `<main>`'s own (now fluid) width at a given viewport —
                this enlarges real content only, never blank space, so it
                doesn't reopen the no-min-h-screen/no-mx-auto reasoning
                above; it just makes the content those rules already size to
                the page fill the screen it's actually sitting on. */}
            <div ref={scaleRef} className="app-scale" style={{ "--app-scale": scale } as React.CSSProperties}>
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
