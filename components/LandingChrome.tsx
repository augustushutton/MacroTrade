import Link from "next/link";
import { MacroTradeLogo } from "./ui";

// Shared chrome for the four public front-page routes — Home (/),
// Variables (/variables), Assets (/assets), Metrics (/metrics). All four are
// plain Server Components, same as the original Landing.tsx (see that
// file's own comment): no scenario state, no interactivity, so this stays a
// Server Component too rather than reaching for TopNav's usePathname-driven
// active-tab detection. Each page already knows which of the four it is, so
// it just says so directly (`active="home"` etc.) instead of this component
// re-deriving it from the URL.
//
// Variables and Assets used to be one combined "Reference" tab/route (a
// single page with a "Variables" section stacked on top of an "Assets"
// section — see components/ReferenceGuide.tsx's git history / the comment
// that used to live here). On request ("Do variable reference and asset
// references and separate them"), split into two top-nav tabs so each is
// its own page rather than two sections sharing one URL.
//
// On request ("Move the white 'MacroTrade: a macro modeling software' text
// to the blue gradient area below the MacroTrade main title"): the tagline
// used to live in its own strip below the header (bg-term-panel, a separate
// box). It's now the second line of the header's own left-hand block,
// directly under the wordmark rather than next to the logo — the logo stays
// sized to the title alone and the title+tagline stack as a column beside
// it, so the tagline visually belongs to "MacroTrade" the way a subtitle
// sits under a masthead, not as its own separate bar.
//
// On request ("implement three dark red folder-like tabs akin to the same
// shape and look of the ones on the actual app"): this reuses the exact
// folder-tab shape TopNav.tsx built for the tool's own Builder/P&L/.../
// Execution strip — rounded top corners via inline borderRadius (the one
// exception to this app's "no rounded corners" rule, same reasoning as
// TopNav's own comment), a taller+filled active tab vs. a shorter+muted
// inactive one, items-end alignment. These tabs first shipped in the
// `--down` red this page's SectionBanner dividers also use (a one-off
// decorative accent — see Landing.tsx's comment on that exception), as a
// deliberate swap from TopNav's own neutral term-* greys. On a follow-up
// request ("make the tab colors like the same they are in the actual
// macrotrade research area"), that swap is gone: the tab strip below now
// uses TopNav's exact classes (border-term-edge/bg-term-raised/
// text-term-muted inactive, border-term-edge/bg-term-bg/text-term-text
// active, hover:bg-term-line/30 hover:text-term-sub), so a tab reads the
// same whether it's sitting under the blue masthead here or under the tool
// header on /builder. The shape (folder flap, rounded top corners, taller
// active tab) is unchanged — only the colour moved off the one-off red and
// onto the app's own neutral tab palette. `--down` stays in use elsewhere
// on this page (SectionBanner) — this was a tab-strip-only change.
export const LANDING_TABS = [
  { id: "home", href: "/", label: "Home" },
  { id: "variables", href: "/variables", label: "Variables" },
  { id: "assets", href: "/assets", label: "Assets" },
  { id: "metrics", href: "/metrics", label: "Metrics" },
] as const;

export type LandingTabId = (typeof LANDING_TABS)[number]["id"];

const TAGLINE = "MacroTrade: A macro modeling planner for traders and researchers";

export function LandingHeader({ active }: { active: LandingTabId }) {
  return (
    <>
      <header
        className="flex items-end justify-between gap-4 px-5 pb-7 pt-14"
        style={{ background: "linear-gradient(to right, rgb(var(--titlebar-blue-a)), rgb(var(--titlebar-blue-b)))" }}
      >
        <div className="flex items-center gap-4">
          <MacroTradeLogo size={56} />
          <div className="flex flex-col gap-1.5">
            <div className="text-[44px] font-bold leading-none text-white">MacroTrade</div>
            <span className="text-[14px] font-bold text-white">{TAGLINE}</span>
          </div>
        </div>
        <Link
          href="/builder"
          className="border border-white bg-term-raised px-7 py-3.5 text-[15px] font-bold uppercase text-white transition-colors hover:bg-up"
        >
          Launch Site
        </Link>
      </header>

      {/* Folder tab strip — now TopNav's own neutral palette (see this
          file's header comment for the "make the tab colors like the same
          they are in the actual macrotrade research area" request that
          moved it off the one-off red). bg-term-raised backs the row
          itself, same as TopNav's own tab strip — inactive tabs share that
          fill so only the active tab's bg-term-bg stands out against it. */}
      <nav className="flex items-end gap-1.5 border-b border-term-edge bg-term-raised px-5 pt-2.5">
        {LANDING_TABS.map((t) => {
          const isActive = t.id === active;
          return (
            <Link
              key={t.id}
              href={t.href}
              className={`relative select-none border px-4 text-[12px] font-bold uppercase ${
                isActive
                  ? "z-10 border-term-edge bg-term-bg pb-2 pt-2.5 text-term-text"
                  : "border-term-edge bg-term-raised pb-1.5 pt-1.5 text-term-muted hover:bg-term-line/30 hover:text-term-sub"
              }`}
              style={{
                borderRadius: "6px 6px 0 0",
                ...(isActive ? { borderBottomColor: "rgb(var(--term-bg))" } : undefined),
              }}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}

/** Red section divider — lifted out of Landing.tsx so Variables, Assets, and
 *  Metrics can all use the exact same banner without duplicating it. See
 *  Landing.tsx's own comment on `bg-down` for why this is red: a one-off
 *  decorative exception to "colour means direction/status," kept consistent
 *  across all four front-page routes rather than reinvented per page. */
export function SectionBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2.5 border border-down bg-down px-2.5 py-1.5 text-[12.5px] font-bold uppercase tracking-wide text-white">
      {children}
    </div>
  );
}
