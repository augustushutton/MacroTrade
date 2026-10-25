"use client";

import React from "react";
import { ScenarioProvider } from "@/lib/scenario-context";
import TopNav from "@/components/TopNav";

// Everything the scenario tool itself needs that the public front page
// (app/page.tsx -> components/Landing.tsx) does not: ScenarioProvider, the
// fill-scale zoom transform, TopNav, and the min-w-[1280px] panning <main>.
// This used to all live in app/providers.tsx, applied unconditionally to
// every route including "/" — now that "/" is the real Landing page instead
// of the Builder, that would have wrapped an ordinary public document in
// the tool's own fixed-desktop-width, zoom-scaled app shell and put the
// TopNav tab strip above it, neither of which Landing wants (see its own
// comment). Scoping this to app/(tool)/* via a route group — builder, pnl,
// sensitivity, derivation, trading, execution all moved under
// app/(tool)/... without changing their own URLs (a route group's
// parenthesised segment never appears in the path) — keeps every one of
// those six routes working exactly as before, while "/" now renders outside
// all of it. See app/providers.tsx for the half that stayed global
// (ThemeProvider, Analytics).
const REFERENCE_HEIGHT = 900;
const DESKTOP_MIN_WIDTH = 1280;

// Returns a uniform scale factor for `.app-scale` (globals.css) to visually
// fill more of a tall desktop monitor — see that file's long comment for why
// a transform is the right tool here. Moved verbatim from the old
// app/providers.tsx; see that file's git history for the full reasoning
// behind every constant and check below, none of which changed in the move.
function useFillScale({ min = 1, max = 1.55 }: { min?: number; max?: number } = {}) {
  const [scale, setScale] = React.useState(1);

  React.useEffect(() => {
    function recompute() {
      const vw = window.visualViewport;
      const effWidth = vw ? vw.width : window.innerWidth;
      const effHeight = vw ? vw.height : window.innerHeight;
      if (effWidth < DESKTOP_MIN_WIDTH) {
        setScale((prev) => (prev !== 1 ? 1 : prev));
        return;
      }
      const next = Math.min(max, Math.max(min, effHeight / REFERENCE_HEIGHT));
      setScale((prev) => (Math.abs(prev - next) > 0.01 ? next : prev));
    }

    recompute();
    window.addEventListener("resize", recompute);
    window.visualViewport?.addEventListener("resize", recompute);
    return () => {
      window.removeEventListener("resize", recompute);
      window.visualViewport?.removeEventListener("resize", recompute);
    };
  }, [min, max]);

  return scale;
}

export default function ToolLayout({ children }: { children: React.ReactNode }) {
  const scale = useFillScale();

  return (
    <ScenarioProvider>
      <main className="w-full min-w-[1280px] px-3 py-2">
        <div className="app-scale" style={{ "--app-scale": scale } as React.CSSProperties}>
          <div className="mb-0 no-print">
            <TopNav />
          </div>
          {children}
        </div>
      </main>
    </ScenarioProvider>
  );
}
