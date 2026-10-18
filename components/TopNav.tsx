"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PathSelector, HorizonSelector, PathPreview } from "./Controls";
import { useScenario } from "@/lib/scenario-context";
import { NAV, navEntryForPath } from "@/lib/nav";

/** Badge mark: a hard-cornered (no rounding) near-black square holding a
 * single open zigzag stroke shaped like an "M" — a stock-chart line, not a
 * mountain-plus-baseline. The path deliberately never closes back along the
 * bottom (no trailing `Z`, no fourth point returning to the start), so
 * there's no line joining the two feet of the M — just the M itself.
 * ONE dark-green hex (DARK_GREEN) is reused for both the M stroke and the
 * square's border/outline rather than two independently-chosen greens, so
 * the two can't drift apart the way the M-green and border-grey did before —
 * "the green on the M" and "the outline" are the same paint by
 * construction, not by two numbers matching. */
const DARK_GREEN = "#006400";

function MacroTradeLogo() {
  return (
    <svg width="22" height="22" viewBox="0 0 28 28" className="shrink-0">
      <rect x="1" y="1" width="26" height="26" fill="#121418" stroke={DARK_GREEN} strokeWidth="1.5" />
      <path
        d="M6.5 20.5 L10.5 8.5 L14 15 L17.5 7.5 L21.5 20.5"
        fill="none"
        stroke={DARK_GREEN}
        strokeWidth="3.2"
        strokeLinejoin="miter"
        strokeMiterlimit="4"
        strokeLinecap="square"
      />
    </svg>
  );
}

/**
 * Two-tier header, not one. Tier 1 is the context/toolbar bar: brand, which
 * page you're on, and the two global scenario parameters (path/horizon)
 * that apply to every page, not just the one you're looking at — the
 * controls a trader reaches for most, given top billing. Tier 2 is pure
 * page navigation underneath it. Each tier sizes itself to what it
 * actually contains rather than forcing nav links (stretched to a full
 * row) and the segmented Path/Horizon buttons (an intrinsic, shorter
 * control) into one shared row.
 */
export default function TopNav() {
  const pathname = usePathname();
  const { path, setPath, horizon, setHorizon } = useScenario();
  const active = navEntryForPath(pathname);

  return (
    <div className="border border-term-edge">
      {/* `h-9` dropped in favour of a `min-h-9` + vertical padding: the right
          cluster (Path/Horizon selectors + the Delivery preview) is wide
          enough on its own — five segmented buttons, a small SVG, four more
          buttons — that even after giving it its own scroll strip below, a
          hard-capped height would clip it on the narrowest phones rather
          than just needing a touch more room. `shrink-0` on the brand/title
          side keeps it from being squeezed by the scroll strip claiming
          space via `min-w-0`; `overflow-x-auto` on that strip is the same
          "scroll in place instead of forcing the page wider" treatment used
          for the dense tables elsewhere, so the busiest control cluster in
          the app stays reachable (swipe sideways) rather than clipped, on
          anything from a 320px phone up. Entirely invisible at desktop
          widths, where the strip never needs to scroll. */}
      <header className="flex min-h-9 items-center justify-between gap-2 bg-term-panel px-2.5 py-1">
        <div className="flex shrink-0 items-center gap-3">
          <div className="flex items-center gap-1.5">
            <MacroTradeLogo />
            <span className="text-[13px] font-semibold tracking-[0.02em] text-term-text">MacroTrade</span>
          </div>
          <span className="text-th font-semibold uppercase tracking-wide text-term-sub">
            {active?.pageTitle ?? "MacroTrade"}
          </span>
        </div>
        <div className="flex min-w-0 items-center gap-3 overflow-x-auto">
          <PathSelector path={path} setPath={setPath} />
          <PathPreview path={path} horizon={horizon} />
          <HorizonSelector horizon={horizon} setHorizon={setHorizon} />
        </div>
      </header>

      <nav className="flex items-end gap-1.5 overflow-x-auto border-t border-term-edge bg-term-raised px-2.5 pt-2.5">
        {/* Real folder tabs — on request, pushed further still ("look more
            like folder tabs in legacy software, not buttons"). The
            height-step + gap pass (below) got the SHAPE of a tab sheet
            right but every tab was still a plain rectangle, which is what
            kept reading as "a row of small buttons" no matter how the
            background/border colour was styled: a rectangle is a button's
            silhouette regardless of what sits inside it. The one thing a
            flat rectangle can never read as is a manila folder's flap, so
            each tab's top two corners are chamfered with a clip-path
            octagon (TAB_CLIP below) — the same angled-corner cut Windows
            95/98 property sheets, Delphi, and VB6 drew their tabs with, and
            a real paper folder tab's own corners. Deliberately a straight
            45° cut, not a curve — this app still draws no rounded corners
            anywhere (tailwind.config's borderRadius note); a chamfer keeps
            that discipline while giving the tab a silhouette no button in
            this app's design system shares. Bottom corners stay square
            (unclipped) since that edge is where the tab attaches to the
            tab sheet, not where the "paper" is cut.

            Everything from the previous pass is unchanged underneath the
            new silhouette: `items-end` + a shorter inactive box + a taller
            active one + `gap` between separate tabs (now 1.5 rather than 1,
            so the angled corners read as clearly distinct flaps rather than
            nearly touching), and bg-term-bg on the active tab so its open
            bottom edge continues straight into the page below, with the
            app's existing --info "selected" accent on its top edge. */}
        {NAV.map((l) => {
          const isActive = l.href === active?.href;
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`relative border px-3 text-[11px] font-medium uppercase tracking-wide transition-none ${
                isActive
                  ? "z-10 border-term-edge bg-term-bg pb-1.5 pt-2.5 text-term-text"
                  : "border-term-edge bg-term-raised pb-1.5 pt-1.5 text-term-muted hover:bg-term-line/30 hover:text-term-sub"
              }`}
              style={{
                clipPath: "polygon(7px 0, calc(100% - 7px) 0, 100% 7px, 100% 100%, 0 100%, 0 7px)",
                ...(isActive
                  ? { borderTopColor: "rgb(var(--info))", borderBottomColor: "rgb(var(--term-bg))" }
                  : undefined),
              }}
            >
              {l.navLabel}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
