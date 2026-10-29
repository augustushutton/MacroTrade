// Single source of truth for the app's seven routes. Previously each route's
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
  { href: "/builder", navLabel: "Builder", pageTitle: "Scenario Builder" },
  { href: "/pnl", navLabel: "P&L", pageTitle: "P&L Attribution" },
  { href: "/sensitivity", navLabel: "Sensitivity", pageTitle: "Sensitivity Matrix" },
  { href: "/risk", navLabel: "Risk", pageTitle: "Risk" },
  { href: "/derivation", navLabel: "Derivation", pageTitle: "Derivation" },
  { href: "/trading", navLabel: "Trading", pageTitle: "Trading" },
  { href: "/execution", navLabel: "Execution", pageTitle: "Execution" },
];

export function navEntryForPath(pathname: string): NavEntry | undefined {
  return NAV.find((n) => (n.href === "/" ? pathname === "/" : pathname.startsWith(n.href)));
}

// ---------------------------------------------------------------------------
// Custom tab order — on request ("if you hold a tab, you can move its
// location so that people could customize tab locations to their fit").
// NAV above stays the single source of truth for which routes exist and
// their labels; this is purely a reordering of that list, saved as a list of
// hrefs (the one stable identifier a route has) rather than a reordered copy
// of NAV itself, so the stored preference never goes stale on a label/title
// wording change. localStorage-backed, same "no account, no backend" model
// as saved scenarios (lib/storage.ts) and the theme preference (lib/theme.tsx).
// ---------------------------------------------------------------------------

const NAV_ORDER_KEY = "msp.navorder.v1";

/** Reconciles a stored href order against the CURRENT NAV list — drops any
 *  href that no longer exists (a route removed in a later release) and
 *  appends, in NAV's own order, any href the stored list doesn't mention yet
 *  (a route added since the order was last saved). Without this, adding a
 *  new tab in a later release would silently leave it out of every
 *  returning visitor's tab strip, since their stored order would simply
 *  have no entry for it. Always returns every current NAV href exactly
 *  once. */
function reconcile(order: string[]): string[] {
  const valid = order.filter((href) => NAV.some((n) => n.href === href));
  const missing = NAV.map((n) => n.href).filter((href) => !valid.includes(href));
  return [...valid, ...missing];
}

const defaultOrder = (): string[] => NAV.map((n) => n.href);

/** Reads the saved tab order, reconciled against NAV (see above). Falls
 *  back to NAV's own default order on first visit, a corrupt/foreign value,
 *  or when called during SSR (no localStorage there — TopNav seeds its
 *  state with this same default order and only calls this for real inside a
 *  post-mount effect, so a server-rendered tab strip and its first client
 *  render always agree, same hydration-safety shape as ThemeProvider in
 *  lib/theme.tsx). */
export function loadNavOrder(): string[] {
  if (typeof window === "undefined") return defaultOrder();
  try {
    const raw = window.localStorage.getItem(NAV_ORDER_KEY);
    if (!raw) return defaultOrder();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every((x) => typeof x === "string")) return defaultOrder();
    return reconcile(parsed);
  } catch {
    return defaultOrder();
  }
}

export function saveNavOrder(order: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(NAV_ORDER_KEY, JSON.stringify(order));
  } catch {
    // Quota exhausted or storage blocked; dropping the write is preferable
    // to throwing inside a drag handler. The tab just stays wherever it was
    // dropped for the rest of this session instead of persisting.
  }
}

/** NAV entries in the given href order, reconciled (see reconcile() above)
 *  so the caller never has to special-case a stale or incomplete order
 *  itself. */
export function orderedNav(order: string[]): NavEntry[] {
  const byHref = new Map(NAV.map((n) => [n.href, n]));
  return reconcile(order).map((href) => byHref.get(href)!);
}
