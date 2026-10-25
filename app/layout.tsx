import type { Metadata, Viewport } from "next";
import "./globals.css";
import Providers from "./providers";

// This file is a Server Component on purpose: `metadata`/`viewport` exports
// are only allowed from a Server Component, and everything that needs
// client-side state (theme, analytics) has been moved out to ./providers.tsx
// — the scenario tool's own state (ScenarioProvider, TopNav, the fill-scale
// shell) now lives one level further out still, in
// app/(tool)/layout.tsx, scoped to the six tool routes only. Previously this
// file was marked "use client" while also exporting `metadata`, which
// Next.js disallows outright — it fails `next build` rather than warning, so
// this split is required for the app to build at all, not just a style
// preference.
//
// The root route ("/") is the public front page (components/Landing.tsx),
// not a tool route any more, so its title is a plain site title+tagline
// rather than sourced from lib/nav.ts's NAV[0] the way it used to be when
// root WAS the Builder — every /(tool)/* route still sources its own title
// from NAV exactly as before (see e.g. app/(tool)/pnl/layout.tsx).
export const metadata: Metadata = {
  title: "MacroTrade — Macro scenario planner for traders and researchers",
  description: "MacroTrade: a macro modeling planner for traders and researchers.",
};

// Matches mobile browser chrome (address bar, tab strip) to the app's dark
// palette instead of leaving it default white. Dark is the default again.
//
// `width: "device-width", initialScale: 1` — the standard, un-special-cased
// viewport meta. This used to instead force a fixed layout viewport (first
// 1280px, then 1170px) specifically so phones would clear the app's own
// `md:`/`xl:` Tailwind breakpoints (providers.tsx/VarForm.tsx/PresetBar.tsx)
// and get a multi-column layout instead of the single-column mobile stack
// those breakpoints used to fall back to. That whole class of breakpoint —
// the sm/md/xl responsive tiers that collapsed VarForm, PresetBar,
// SensitivityTab's two-column row, and PnlTab's three-card row down to
// fewer columns at a narrower width — has since been removed outright (on
// request: a resized desktop browser window was reflowing to the same
// single-column collapse a phone used to, and the look of that
// shrinking/restacking was the actual complaint). Those components now
// always render their widest/desktop structure, with `overflow-x-auto` +
// an explicit `min-w` so a viewport narrower than that structure scrolls
// in place instead of reflowing — for ANY viewport, phone or a shrunk
// desktop window alike. With no breakpoint left to defeat, there's nothing
// left for a forced layout-viewport width to accomplish: `device-width`
// (the browser's own true width) is now the correct value on every device,
// and `initial-scale: 1` is what actually produces the pan/scroll — it
// stops a mobile browser from auto-zooming wide content back out to fit
// the screen (the classic "shrunk to fit" look), leaving the excess width
// to be scrolled across like any oversized page instead, at true native
// (1 CSS px : 1 device px) size. `userScalable` is left at its default so
// pinch-zoom still works on top of that for anyone who wants it. Desktop
// browsers ignore a viewport meta tag's `width` entirely regardless (a
// mobile-only convention) — there the exact same pan/scroll behaviour
// comes from nothing more than the components' own `min-w` now exceeding
// the actual (resized) window width, which is standard CSS overflow, no
// meta tag involved.
export const viewport: Viewport = {
  themeColor: "#0d1016",
  width: "device-width",
  initialScale: 1,
};

// Sets the dark class before hydration to avoid a light-mode flash on load.
// Dark is the default again — light is the opt-in (localStorage
// "msp-theme" = "light"). A localStorage failure (private browsing, etc.)
// falls back to dark, same as the default.
const THEME_INIT = `(function(){try{var t=localStorage.getItem('msp-theme');if(t!=='light')document.documentElement.classList.add('dark');}catch(e){document.documentElement.classList.add('dark');}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="google-site-verification" content="H_21Z6C-ABm2qVfEvBhTE6kVuJZaiS8i_4m5ZrxU4J8" />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      {/* `antialiased` dropped — on a prior pass ("remove any hint of
          modern SaaS look") the same forced grayscale smoothing was
          already stripped from `html` in globals.css, but Tailwind's
          `antialiased` utility sets the identical `-webkit-font-smoothing`/
          `-moz-osx-font-smoothing` properties directly, so this literal
          class name on `<body>` was quietly putting the override right
          back on every page underneath the one it was removed from. */}
      <body className="bg-term-bg text-term-text">
        <Providers>{children}</Providers>
        {/* The "2000s/2010s slightly pixelated" texture (globals.css's
            `.pixel-grid`) — a fixed sibling AFTER everything else in
            `<body>`, not a child of `.app-scale`, so it paints on top of
            the whole viewport as its own layer rather than being tied to
            that element's own box/stacking context. `no-print` drops it from
            the print stylesheet the same way every other screen-only
            affectation in this app already does. */}
        <div aria-hidden="true" className="no-print pixel-grid" />
      </body>
    </html>
  );
}
