"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PathSelector, HorizonSelector, PathPreview } from "./Controls";
import { useScenario } from "@/lib/scenario-context";
import { NAV, navEntryForPath, loadNavOrder, saveNavOrder, orderedNav } from "@/lib/nav";
import { ScrollHint } from "./ScrollHint";
import { MacroTradeLogo } from "./ui";

/**
 * Three-tier header, not two. A genuine Win95/98 MDI frame window is
 * always a caption bar FIRST — app icon, app name — with any actual
 * toolbar/controls living in a second strip underneath it. It gets the
 * iconic navy-to-steel-blue "active title bar" gradient (--titlebar-blue-a
 * → --titlebar-blue-b, the real Windows Standard active-caption colours)
 * on the reasoning that this is the one and only top-level frame in the
 * whole app, so it's always the "active" window by definition. (It briefly
 * went flat #000000 on an earlier request, then was asked back — see the
 * git history / earlier comment for that rationale; the gradient is the
 * current and intended state.) Every Panel beneath this bar is now styled
 * the same as Builder's own GroupHeader (see ui.tsx) rather than a
 * separate grey — only this one top bar keeps its own distinct treatment.
 * Brand (icon + name) lives up here rather than sharing a line with the
 * page's own controls, since "what program is this" is a title bar's whole
 * job.
 */
export default function TopNav() {
  const pathname = usePathname();
  const { path, setPath, horizon, setHorizon } = useScenario();
  const active = navEntryForPath(pathname);

  // Custom tab order — on request ("if you hold a tab, you can move its
  // location so that people could customize tab locations to their fit").
  // Seeded with NAV's own default order (not loadNavOrder()) so the very
  // first client render matches what the server rendered — localStorage
  // doesn't exist during SSR, and a lazy initializer that read it anyway
  // would render one order on the server and a possibly-different one on
  // the client, which is exactly the hydration mismatch ThemeProvider's own
  // comment (lib/theme.tsx) already works around the same way. The real,
  // possibly-customized order loads in the effect below instead, same
  // "default first paint, hydrate the real value a tick later" shape.
  const [order, setOrder] = React.useState<string[]>(() => NAV.map((n) => n.href));
  React.useEffect(() => {
    setOrder(loadNavOrder());
  }, []);
  const tabs = React.useMemo(() => orderedNav(order), [order]);

  // Which tab is currently being dragged, if any — drives both the dragged
  // tab's own dimmed styling below and handleDragOver's "don't reorder
  // against yourself" guard. Native HTML5 drag-and-drop (not pointer events)
  // is enough here: this is a desktop-only tool already (DESKTOP_MIN_WIDTH
  // in app/(tool)/layout.tsx — the whole page pans rather than reflowing
  // below 1280px, and every dense table in the app is built the same way),
  // so there's no touchscreen case to support, and plain draggable anchors
  // already give every desktop browser a built-in drag affordance and ghost
  // image for free.
  const [dragHref, setDragHref] = React.useState<string | null>(null);

  function handleDragStart(href: string) {
    return (e: React.DragEvent<HTMLAnchorElement>) => {
      setDragHref(href);
      e.dataTransfer.effectAllowed = "move";
      // Firefox refuses to start a drag at all unless some data is set.
      e.dataTransfer.setData("text/plain", href);
    };
  }

  // Live-reorders `order` as the dragged tab passes over another one — the
  // same "the list shuffles as you drag" behaviour as every familiar
  // drag-to-reorder list (browser bookmark bars, Trello cards), rather than
  // only committing a reorder on drop. dragend (not drop) is what actually
  // persists the final order below, since a native HTML5 drag can also end
  // outside any valid drop target (dropped off the tab strip entirely) —
  // dragend always fires regardless, drop does not.
  function handleDragOver(overHref: string) {
    return (e: React.DragEvent<HTMLAnchorElement>) => {
      e.preventDefault();
      if (!dragHref || dragHref === overHref) return;
      setOrder((prev) => {
        const from = prev.indexOf(dragHref);
        const to = prev.indexOf(overHref);
        if (from === -1 || to === -1 || from === to) return prev;
        const next = prev.slice();
        next.splice(from, 1);
        next.splice(to, 0, dragHref);
        return next;
      });
    };
  }

  function handleDragEnd() {
    setDragHref(null);
    saveNavOrder(order);
  }

  return (
    <div>
      {/* Borderless on every edge, on an earlier request ("remove the lines
          at the top sides and bottom of the blue gradient"): no top/left/
          right (those used to come from this outer div's own `border`,
          which wrapped the bar too since it's the first child) and no
          bottom (that was this div's own `border-b`, removed outright
          rather than just made transparent). The frame that border used to
          draw around the header + tab strip beneath it hasn't gone away —
          it's just moved onto the wrapper below, which carries it on three
          sides only, so nothing reappears directly under this bar. Navy-
          to-steel-blue gradient — see the component doc comment above. */}
      {/* h-6 → h-11 (22px logo → 28px, 12px wordmark → 16px), then h-11 →
          h-16 (28px logo → 32px, 16px wordmark → 18px) on a second request
          ("expand the blue gradient vertically") — only this bar, not the
          SCENARIO BUILDER row or the tab strip below it, which keep their
          own existing sizing. Each step has grown the bar itself by more
          than the logo/wordmark (24→44→64px vs. 22→28→32px / 12→16→18px),
          same ratio as the first pass: the extra height reads as more
          breathing room around an unchanged-feeling brand lockup, not a
          bigger logo stretched to fill the bar. */}
      <div
        className="flex h-16 shrink-0 items-center gap-2 px-2.5"
        style={{ background: "linear-gradient(to right, rgb(var(--titlebar-blue-a)), rgb(var(--titlebar-blue-b)))" }}
      >
        {/* The brand mark doubles as a "back to the homepage" link. This used
            to be a plain <a> out to an external claude.ai-hosted artifact —
            the public front page didn't live in this Next.js app yet, so
            there was nothing in-app to link to. Now that components/
            Landing.tsx is the real "/" route, this is next/link's <Link>
            like every other in-app route, not an external <a>. No
            underline/color change on its own — it should read as the same
            brand lockup as before, just now clickable. */}
        <Link
          href="/"
          className="flex items-center gap-2 no-underline"
          aria-label="MacroTrade home"
        >
          <MacroTradeLogo size={32} />
          <span className="text-[18px] font-bold text-white">MacroTrade</span>
        </Link>
      </div>

      <div className="border-l border-r border-b border-term-edge">
      {/* `h-9` dropped in favour of a `min-h-9` + vertical padding: the right
          cluster (Path/Horizon selectors + the Delivery preview) is wide
          enough on its own — five segmented buttons, a small SVG, four more
          buttons — that even after giving it its own scroll strip below, a
          hard-capped height would clip it on the narrowest phones rather
          than just needing a touch more room. `overflow-x-auto` on that
          strip is the same "scroll in place instead of forcing the page
          wider" treatment used for the dense tables elsewhere, so the
          busiest control cluster in the app stays reachable (swipe
          sideways) rather than clipped, on anything from a 320px phone up.
          Entirely invisible at desktop widths, where the strip never needs
          to scroll. */}
      <header className="flex min-h-9 items-center justify-between gap-2 bg-term-panel px-2.5 py-1">
        {/* font-bold, not font-semibold, on request ("bold headers") — this
            is the page title, the same tier of "header" as a Panel/
            GroupHeader bar below it, so it bolds with them. */}
        <span className="shrink-0 text-th font-bold uppercase text-term-sub">
          {active?.pageTitle ?? "MacroTrade"}
        </span>
        <ScrollHint className="flex min-w-0 items-center gap-3">
          <PathSelector path={path} setPath={setPath} />
          <PathPreview path={path} horizon={horizon} />
          <HorizonSelector horizon={horizon} setHorizon={setHorizon} />
        </ScrollHint>
      </header>

      <ScrollHint as="nav" className="flex items-end gap-1.5 border-t border-term-edge bg-term-raised px-2.5 pt-2.5">
        {/* Real folder tabs — on request, pushed further still ("look more
            like folder tabs in legacy software, not buttons"). The
            height-step + gap pass (below) got the SHAPE of a tab sheet
            right but every tab was still a plain rectangle, which is what
            kept reading as "a row of small buttons" no matter how the
            background/border colour was styled: a rectangle is a button's
            silhouette regardless of what sits inside it. The one thing a
            flat rectangle can never read as is a manila folder's flap, so
            each tab's top two corners are rounded (inline `borderRadius`,
            not a `rounded-*` class — tailwind.config's borderRadius scale
            is replaced with just `none` so those classes don't compile at
            all; an inline style bypasses that deliberately, as the one
            exception to "no rounded corners anywhere" the user explicitly
            asked for here). This used to be a straight clip-path chamfer
            instead — the same angled-corner cut Windows 95/98 property
            sheets, Delphi, and VB6 drew their tabs with — kept deliberately
            un-curved specifically to preserve that app-wide rule; moved to
            genuine rounding on request ("round the tab corners so they look
            rounded and not sharp"). Bottom corners stay square (radius only
            on the top two corners) since that edge is where the tab
            attaches to the tab sheet, not where the "paper" is cut.

            Everything from the previous pass is unchanged underneath the
            new silhouette: `items-end` + a shorter inactive box + a taller
            active one + `gap` between separate tabs (now 1.5 rather than 1,
            so the angled corners read as clearly distinct flaps rather than
            nearly touching), and bg-term-bg on the active tab so its open
            bottom edge continues straight into the page below. On request
            ("remove the blue line that appears when you click a tab"), the
            active tab's top edge no longer gets the --info accent colour —
            it just keeps the same border-term-edge as every other edge, so
            the active tab is distinguished by height/fill alone, not by a
            coloured line. --info stays defined in globals.css and in use
            elsewhere (e.g. focus/selection accents), just not here. */}
        {tabs.map((l) => {
          const isActive = l.href === active?.href;
          const isDragging = l.href === dragHref;
          return (
            <Link
              key={l.href}
              href={l.href}
              draggable
              onDragStart={handleDragStart(l.href)}
              onDragOver={handleDragOver(l.href)}
              onDrop={(e) => e.preventDefault()}
              onDragEnd={handleDragEnd}
              className={`relative select-none border px-3 text-[11px] font-medium uppercase transition-none ${
                isDragging ? "cursor-grabbing opacity-40" : "cursor-grab"
              } ${
                isActive
                  ? "z-10 border-term-edge bg-term-bg pb-1.5 pt-2.5 text-term-text"
                  : "border-term-edge bg-term-raised pb-1.5 pt-1.5 text-term-muted hover:bg-term-line/30 hover:text-term-sub"
              }`}
              style={{
                borderRadius: "6px 6px 0 0",
                ...(isActive ? { borderBottomColor: "rgb(var(--term-bg))" } : undefined),
              }}
            >
              {l.navLabel}
            </Link>
          );
        })}
      </ScrollHint>
      </div>
    </div>
  );
}
