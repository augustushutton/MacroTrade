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
      <header className="flex h-9 items-center justify-between bg-term-panel px-2.5">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <MacroTradeLogo />
            <span className="text-[13px] font-semibold tracking-[0.02em] text-term-text">MacroTrade</span>
          </div>
          <span className="text-th font-semibold uppercase tracking-wide text-term-sub">
            {active?.pageTitle ?? "MacroTrade"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <PathSelector path={path} setPath={setPath} />
          <PathPreview path={path} horizon={horizon} />
          <HorizonSelector horizon={horizon} setHorizon={setHorizon} />
        </div>
      </header>

      <nav className="flex h-7 items-stretch border-t border-term-edge bg-term-raised px-2.5">
        {NAV.map((l) => {
          const isActive = l.href === active?.href;
          return (
            <Link
              key={l.href}
              href={l.href}
              // A 2px underline alone left the active tab reading as barely
              // different from the rest of the row — easy to miss unless
              // you already read the page title above it. Adding a filled
              // background panel behind the active tab (bg-term-panel,
              // matching the page body it belongs to, against the darker
              // bg-term-raised nav strip) makes "you are here" readable
              // from a glance instead of a close look, while the underline
              // stays as the secondary, finer-grained cue.
              className={`flex items-center border-b-2 px-3 text-th font-semibold uppercase tracking-wide ${
                isActive
                  ? "border-up bg-term-panel text-term-text"
                  : "border-transparent text-term-muted hover:bg-term-line/20 hover:text-term-sub"
              }`}
            >
              {l.navLabel}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
