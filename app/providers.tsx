"use client";

import { ThemeProvider } from "@/lib/theme";
import { ScenarioProvider } from "@/lib/scenario-context";
import TopNav from "@/components/TopNav";
import { Analytics } from "@vercel/analytics/react";

// Everything that needs client-side state (theme, the scenario context, nav
// active-link highlighting) lives here, one level below the root layout.
// The root layout itself stays a Server Component so it can export
// `metadata`/`viewport` — Next.js's App Router does not allow a Client
// Component to export either, and the root layout previously tried to be
// both at once (a `"use client"` file exporting `metadata`), which fails
// `next build` outright rather than just warning.
export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ThemeProvider>
        <ScenarioProvider>
          {/* No forced `min-h-screen` here on purpose: a page's height is
              whatever its content actually needs, never artificially
              stretched to fill a tall monitor. Stretching it used to be the
              standard "avoid a too-short page" move, but for a dense
              terminal-style tool it backfires — it turns a short page
              (Builder collapsed, P&L at baseline) into a large block of
              flat, unstructured background sitting INSIDE the app's own
              frame, which reads as broken rather than merely short.

              No `mx-auto` centering either, on the same reasoning applied to
              width instead of height: a centered column leaves two growing
              bands of dead background framing the content on a wide monitor
              — exactly the shape of a marketing page, not a terminal window.

              `max-w-[1920px]` caps the width, and this is now a plain design
              choice rather than a workaround for a bug: every dense table
              (PnlTab, SensitivityTab, NarrativeTab) sets `table-fixed` with
              an explicit percentage width on every column, which is
              deterministic per the CSS2.1 fixed table-layout algorithm — all
              columns scale by the SAME ratio to fill the table's width, so
              nothing strands a figure far from its row with a dead gap in
              front of it, AT ANY WIDTH (verified by screenshotting at
              1280/1440/1920/2560/3440px). That means this cap is free to move
              in either direction without reopening the old bug.

              1920px is chosen because it is the point past which a dense,
              dozen-column terminal table stops reading as "comfortably
              filled" and starts reading as "stretched" — rows the same
              density as a 1440px laptop, just with more dead air between
              columns, which is a worse reading experience even though
              nothing is technically broken. Below 1920px this cap doesn't
              engage at all. Past it, the surplus collects as a single right-
              hand margin (see the no-`mx-auto` note above) rather than
              growing every column to fill an ultrawide or 4K monitor. Raise
              or drop this number as a density preference; the tables behind
              it will not misbehave either way. */}
          <main className="w-full max-w-[1920px] px-3 py-2">
            {/* Scaled up a little on request ("scale everything up ... so it
                fully covers the screen") — TopNav and the page content below
                it were rendering noticeably narrower than a typical desktop
                viewport, leaving bare background beside/under them. The
                `.app-scale` class (globals.css) grows this wrapper 15% via
                `transform: scale()` with a matching width correction, so it
                always re-fills exactly 100% of `<main>` above regardless of
                `<main>`'s own width at a given viewport — this enlarges real
                content only, never blank space, so it doesn't reopen the
                no-min-h-screen/no-mx-auto reasoning above; it just makes the
                content those rules already size to the page a bit bigger. */}
            <div className="app-scale">
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
