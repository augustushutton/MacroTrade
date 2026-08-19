'use client';
import "./globals.css";
import { ThemeProvider } from "@/lib/theme";
import { ScenarioProvider } from "@/lib/scenario-context";
import TopNav from "@/components/TopNav";
import { NAV } from "@/lib/nav";
import { Analytics } from '@vercel/analytics/next';

// Sets the dark class before hydration to avoid a light-mode flash on load.
const THEME_INIT = `(function(){try{var t=localStorage.getItem('msp-theme');if(t!=='light')document.documentElement.classList.add('dark');}catch(e){document.documentElement.classList.add('dark');}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>{`MacroTrade — ${NAV[0].pageTitle}`}</title>
        <meta name="description" content="Cross-asset macro scenario and stress-testing engine." />
        <meta name="theme-color" content="#0d1016" />
        <meta name="google-site-verification" content="H_21Z6C-ABm2qVfEvBhTE6kVuJZaiS8i_4m5ZrxU4J8" />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className="bg-term-bg text-term-text antialiased">
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
      </body>
    </html>
  );
}
