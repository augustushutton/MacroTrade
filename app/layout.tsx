import type { Metadata, Viewport } from "next";
import "./globals.css";
import { NAV } from "@/lib/nav";
import Providers from "./providers";

// This file is a Server Component on purpose: `metadata`/`viewport` exports
// are only allowed from a Server Component, and everything that needs
// client-side state (theme, the scenario context, nav highlighting) has been
// moved out to ./providers.tsx. Previously this file was marked "use client"
// while also exporting `metadata`, which Next.js disallows outright — it
// fails `next build` rather than warning, so this split is required for the
// app to build at all, not just a style preference.
//
// Every other route (app/pnl, app/sensitivity, ...) declares an explicit,
// descriptive title via its own layout.tsx, sourced from lib/nav.ts. The
// root route gets the same treatment here rather than a bare "MacroTrade" —
// one route being the unexplained exception to the pattern is its own kind
// of inconsistency.
export const metadata: Metadata = {
  title: `MacroTrade — ${NAV[0].pageTitle}`,
  description: "A macroeconomic planner for investors, traders, and researchers.",
};

// Matches mobile browser chrome (address bar, tab strip) to the app's dark
// palette instead of leaving it default white.
export const viewport: Viewport = {
  themeColor: "#0d1016",
};

// Sets the dark class before hydration to avoid a light-mode flash on load.
const THEME_INIT = `(function(){try{var t=localStorage.getItem('msp-theme');if(t!=='light')document.documentElement.classList.add('dark');}catch(e){document.documentElement.classList.add('dark');}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="google-site-verification" content="H_21Z6C-ABm2qVfEvBhTE6kVuJZaiS8i_4m5ZrxU4J8" />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className="bg-term-bg text-term-text antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
