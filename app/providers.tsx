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
          <main className="mx-auto min-h-screen w-full max-w-[1680px] px-3 py-2">
            <div className="mb-2 no-print">
              <TopNav />
            </div>
            {children}
          </main>
        </ScenarioProvider>
      </ThemeProvider>
      <Analytics />
    </>
  );
}
