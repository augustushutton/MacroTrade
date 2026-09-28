// Single source of truth for the app's five routes. Previously each route's
// name was typed out independently in at least two places (the TABS array
// in the old single-page Workspace, used for both the tab strip and
// document.title) and stayed in sync only by hand. Post-split, TopNav's nav
// links, the context-bar page title, and each route's static <title>
// (app/*/layout.tsx) all read from here instead, so the three literally
// cannot drift apart.
export interface NavEntry {
  href: string;
  /** Short label for the persistent top nav link. */
  navLabel: string;
  /** Full label for the context-bar page title and the browser tab title. */
  pageTitle: string;
  /** A small, fixed glyph identifying this module in the nav strip — the
   *  same idea as the icon a dense trading-terminal toolbar puts next to
   *  every panel/menu entry so a module reads as "a distinct instrument,"
   *  not just a text label. Plain geometric shapes (not directional arrows
   *  or up/down triangles), since the app already spends ▲/▼-style shape
   *  language on P&L direction elsewhere — a nav icon needs to stay neutral
   *  so it never reads as a stray signal. */
  navIcon: string;
}

export const NAV: NavEntry[] = [
  { href: "/", navLabel: "Builder", pageTitle: "Scenario Builder", navIcon: "▪" },
  { href: "/pnl", navLabel: "P&L", pageTitle: "P&L Attribution", navIcon: "◆" },
  { href: "/sensitivity", navLabel: "Sensitivity", pageTitle: "Sensitivity Matrix", navIcon: "●" },
  { href: "/derivation", navLabel: "Derivation", pageTitle: "Derivation", navIcon: "▣" },
  { href: "/compare", navLabel: "Compare", pageTitle: "Scenario Comparison", navIcon: "◇" },
];

export function navEntryForPath(pathname: string): NavEntry | undefined {
  return NAV.find((n) => (n.href === "/" ? pathname === "/" : pathname.startsWith(n.href)));
}
