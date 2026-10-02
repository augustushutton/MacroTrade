// Single source of truth for the app's four routes. Previously each route's
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
}

export const NAV: NavEntry[] = [
  { href: "/", navLabel: "Builder", pageTitle: "Scenario Builder" },
  { href: "/pnl", navLabel: "P&L", pageTitle: "P&L Attribution" },
  { href: "/sensitivity", navLabel: "Sensitivity", pageTitle: "Sensitivity Matrix" },
  { href: "/derivation", navLabel: "Derivation", pageTitle: "Derivation" },
];

export function navEntryForPath(pathname: string): NavEntry | undefined {
  return NAV.find((n) => (n.href === "/" ? pathname === "/" : pathname.startsWith(n.href)));
}
