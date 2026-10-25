"use client";

import React from "react";
import Link from "next/link";
import { ScrollHint } from "./ScrollHint";

// Shared primitives. Uppercase is reserved for table column headers (Th)
// only; panel titles, buttons, and section dividers render in natural case.

/** Badge mark: a hard-cornered (no rounding) near-black square holding a
 * single open zigzag stroke shaped like an "M" — a stock-chart line, not a
 * mountain-plus-baseline. The path deliberately never closes back along the
 * bottom (no trailing `Z`, no fourth point returning to the start), so
 * there's no line joining the two feet of the M — just the M itself.
 * ONE dark-green hex (DARK_GREEN) is reused for both the M stroke and the
 * square's border/outline rather than two independently-chosen greens, so
 * the two can't drift apart the way the M-green and border-grey did before —
 * "the green on the M" and "the outline" are the same paint by
 * construction, not by two numbers matching.
 *
 * Moved here from TopNav.tsx (which defined its own fixed-22px copy) so
 * components/Landing.tsx can use the identical mark at its own size (40px,
 * matching the title bar it sits in) instead of a second hand-copied SVG
 * that could drift from this one — exactly the kind of duplication this
 * same comment already warns about for the two greens. `size` defaults to
 * 22, TopNav's original fixed size, so that call site is unchanged. */
const DARK_GREEN = "#006400";

export function MacroTradeLogo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" className="shrink-0">
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

export function Panel({
  title,
  right,
  children,
  className = "",
}: {
  title?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`border border-term-edge bg-term-panel ${className}`}>
      {title ? (
        <header
          // Matches GroupHeader's own base treatment exactly — title and
          // `right` are both direct children of ONE flex row with
          // justify-between, same as GroupHeader below, so `right` actually
          // lands top-right next to the title instead of on a second row of
          // its own. An earlier version put `right` in a separate stacked
          // `<div>` below this header; that div had no justify-end, so
          // `right` (Execution's "Clear All", Sensitivity's X/Y pickers)
          // rendered flush-left under the title rather than beside it,
          // despite this comment already claiming parity with GroupHeader.
          // On request ("apply the builder heading colours and structure
          // everywhere else"), every Panel title bar (every desk header on
          // Trading, Sensitivity, P&L, Derivation, Execution included) uses
          // the same flat bg-term-raised fill, border-y, and px-2/py-1
          // spacing as Builder's own GROWTH/INFLATION/etc. group headers,
          // rather than a separate grey fill of its own. --titlebar-grey-b
          // (and --titlebar-grey-a before it) are left defined in
          // globals.css rather than deleted, same reversibility convention
          // as lib/montecarlo.ts and lib/format.ts's unused
          // heatGradient/signFillGradient.
          className="flex items-center justify-between gap-2 border-y border-term-edge bg-term-raised px-2 py-1"
        >
          {/* font-bold, not font-semibold, on request ("bold headers") —
              see GroupHeader's own comment below; this stayed in lockstep
              with it when the two were unified and does so again here.
              shrink-0 so a long `right` control group never eats into the
              title's own space before ScrollHint below gets a chance to
              scroll it instead. */}
          <h2 className="shrink-0 truncate text-th font-bold uppercase text-term-sub">{title}</h2>
          {right ? (
            // ScrollHint, not a plain overflow-x-auto div, by request
            // ("resize correctly on every device") — this is every Panel's
            // generic header-right slot (Sensitivity's X/Y variable pickers
            // included), and the phone-width probe confirmed it genuinely
            // overflows there with no visual cue it was scrollable, the
            // same bug as every other overflow-x-auto wrapper fixed this
            // pass. min-w-0 lets it actually shrink/scroll within the flex
            // row instead of forcing the header wider than the panel.
            <ScrollHint className="min-w-0">{right}</ScrollHint>
          ) : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export function Cap({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span className={`text-th text-term-muted ${className}`}>{children}</span>;
}

/**
 * Hover-text popups were removed app-wide by request — this now only
 * preserves the layout wrapper (`display`/`className`, e.g. the `w-full
 * min-w-0` a truncating label needs to size correctly inside a grid cell)
 * that callers still depend on. `content`/`side`/`align` are kept in the
 * signature, unused, so none of the ~12 call sites across the app need to
 * change — they can keep passing a tooltip string and it's simply never
 * rendered, rather than hunting down and editing every call site.
 */
export function Tooltip({
  children,
  display = "inline-flex",
  className = "",
}: {
  content?: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "bottom";
  align?: "center" | "start";
  display?: "inline-flex" | "flex";
  className?: string;
}) {
  return <span className={`${display} ${className}`}>{children}</span>;
}

/**
 * Styled wrapper around a native `<select>`. globals.css already strips the
 * OS chrome (`appearance: none`) from every select/input in the app, but
 * SensitivityTab's X/Y pickers were left with no replacement affordance —
 * next to the app's custom −/+ steppers and segmented buttons, a bare
 * dropdown with no visible arrow was the one control that read as
 * unstyled/default HTML rather than part of the same design system. This
 * adds a small mono chevron in the same muted tone as the rest of the
 * chrome, positioned absolutely so it doesn't require extra layout
 * plumbing at call sites — same border/background/text treatment as the
 * dropdown already had otherwise.
 */
export function Select({
  value,
  onChange,
  children,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`relative inline-flex items-center ${className}`}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border border-term-line bg-term-panel py-hair pl-1 pr-4 text-[11px] text-term-text"
      >
        {children}
      </select>
      <span className="pointer-events-none absolute right-1 font-mono text-[9px] text-term-muted">&#9662;</span>
    </div>
  );
}

export function Th({
  children,
  align = "left",
  className = "",
  onClick,
  sortDir,
}: {
  children?: React.ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
  /** Present makes the header a sort toggle. */
  onClick?: () => void;
  /** Current sort direction for THIS column; undefined = not the active sort. */
  sortDir?: "asc" | "desc";
}) {
  const a = align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
  // Fixed leading (13px) so every header row renders at the same 22px height
  // across browsers, rather than relying on the default line-height. The
  // `border-r` column rule a prior "super legacy" pass added here (an IB
  // TWS Classic "Show grid lines in tables" config option) was removed
  // outright on request — just the original `border-b` separating the
  // header from the body stays.
  const base = `border-b border-term-edge text-th leading-[13px] font-medium uppercase text-term-muted ${a} ${className}`;
  if (!onClick) {
    return <th className={`${base} px-2 py-dense`}>{children}</th>;
  }
  const arrow = sortDir === "asc" ? " ▴" : sortDir === "desc" ? " ▾" : "";
  return (
    <th className={`${base} p-0`}>
      <button
        type="button"
        onClick={onClick}
        className={`block w-full px-2 py-dense ${a} hover:text-term-text ${sortDir ? "text-term-sub" : ""}`}
      >
        {children}
        {arrow}
      </button>
    </th>
  );
}

export function Td({
  children,
  align = "left",
  mono = false,
  className = "",
  colSpan,
  style,
}: {
  children?: React.ReactNode;
  align?: "left" | "right" | "center";
  mono?: boolean;
  className?: string;
  colSpan?: number;
  /** Only for a value picked at runtime from a CSS custom property (e.g.
   *  heatBg, or the amber spotlight boxShadow on a selected/pinned/dominant
   *  cell) — a Tailwind class can't express that. Everything else stays a
   *  className so Tailwind's scanner can see it in source. */
  style?: React.CSSProperties;
}) {
  const a = align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
  // Fixed leading (14px), same reasoning as Th. Padding is dense (3px) 8px
  // per spec — dense rows, no wasted whitespace. The ruled `border-b
  // border-r` grid a prior "super legacy" pass added between every body
  // cell was removed outright, on request — back to plain whitespace
  // between rows/columns, no rule lines in the table body at all.
  return (
    <td
      colSpan={colSpan}
      style={style}
      className={`px-2 py-dense leading-[14px] ${a} ${mono ? "font-mono tnum" : ""} ${className}`}
    >
      {children}
    </td>
  );
}

export function Btn({
  active = false,
  onClick,
  href,
  children,
  title,
  className = "",
}: {
  active?: boolean;
  onClick?: () => void;
  /** Renders as a Link instead of a button — for a segment that navigates to
   *  a route (TopNav's page tabs) rather than toggling in-page state (the
   *  Path/Horizon selectors, Derivation's group tabs). Same classes either
   *  way, on purpose: whether a tab is a URL or a local toggle, it should
   *  look like the same kind of control. */
  href?: string;
  children: React.ReactNode;
  title?: string;
  className?: string;
}) {
  const cls = `relative border px-2.5 py-dense text-[11px] font-medium transition-none ${
    active
      ? "z-10 translate-y-px border-info bg-term-bg text-term-text"
      : "border-term-edge bg-term-raised text-term-muted hover:bg-term-line/30 hover:text-term-sub"
  } ${className}`;

  if (href) {
    return (
      <Tooltip content={title}>
        <Link href={href} className={cls}>
          {children}
        </Link>
      </Tooltip>
    );
  }

  return (
    <Tooltip content={title}>
      <button type="button" onClick={onClick} className={cls}>
        {children}
      </button>
    </Tooltip>
  );
}

/** Shared group-divider bar, used by PresetBar, PnlTab, and NarrativeTab.
 * Plain (non-interactive) when no onClick is given; a collapsible button
 * with a +/− indicator otherwise. */
export function GroupHeader({
  children,
  onClick,
  openState,
  right,
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  openState?: boolean;
  right?: React.ReactNode;
  className?: string;
}) {
  // font-bold, not font-semibold, on request ("bold headers" — alongside
  // the all-white text-colour pass in globals.css's term-muted/term-sub
  // comment). With every text tier now the same white, weight is what
  // separates "this is a section header" from "this is a row label or
  // value" — Panel's own title (ui.tsx, above) stays unified with this on
  // the same reasoning that originally unified the two header styles.
  const base = "w-full border-y border-term-edge bg-term-raised px-2 py-1 flex items-center justify-between text-th font-bold uppercase text-term-sub";
  const label = onClick ? (
    <button type="button" onClick={onClick} className="flex flex-1 items-center text-left hover:text-term-text">
      {/* No colour of its own — inherits the button's text-term-sub at rest and
          text-term-text on hover, same as the label next to it, so the symbol
          that says "this collapses" is never dimmer than the text it labels. */}
      <span className="mr-1.5 inline-block w-[8px] font-mono normal-case">{openState ? "−" : "+"}</span>
      {children}
    </button>
  ) : (
    <span>{children}</span>
  );
  return (
    <div className={`${base} ${className}`}>
      {label}
      {right ? <div className="flex items-center gap-2">{right}</div> : null}
    </div>
  );
}

/**
 * Tracks a value across renders and returns a brief "flash-up"/"flash-down"
 * class the instant it moves, then clears itself. `active` gates whether a
 * move actually flashes — the previous value is still tracked while inactive,
 * so a value that changes while inactive (e.g. a restored session on load)
 * does not queue up a flash for the moment activity turns on. `dead` is a
 * minimum absolute delta below which a move is treated as noise.
 */
export function useFlash(value: number, active: boolean, dead = 0): "flash-up" | "flash-down" | "" {
  const prev = React.useRef(value);
  const [cls, setCls] = React.useState<"flash-up" | "flash-down" | "">("");

  React.useEffect(() => {
    const d = value - prev.current;
    prev.current = value;
    if (!active || Math.abs(d) <= dead) return;
    setCls(d > 0 ? "flash-up" : "flash-down");
    const t = setTimeout(() => setCls(""), 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, active]);

  return cls;
}
