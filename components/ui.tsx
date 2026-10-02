"use client";

import React from "react";
import Link from "next/link";

// Shared primitives. Uppercase is reserved for table column headers (Th)
// only; panel titles, buttons, and section dividers render in natural case.

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
  // Header type matches GroupHeader exactly (10px/semibold/uppercase/
  // tracking-wide, same py-1) — both are "a bar that labels the section
  // below it," and previously rendered as two different type scales (11px
  // medium sentence-case here vs. 10px semibold uppercase there) for the
  // same role. One header component, one look.
  return (
    <section className={`border border-term-edge bg-term-panel ${className}`}>
      {title ? (
        // `flex-wrap` lets `right` (often a row of selects/segmented
        // buttons — see the ~6 call sites that pass it) drop to its own
        // line under the title instead of forcing this header, and
        // everything that sizes off it, wider than the viewport on a phone.
        // Zero effect wherever there's room for one line, which is every
        // desktop width this was designed at. The `right` wrapper's own
        // `min-w-0 overflow-x-auto` is a second line of defence for the
        // rare case where `right` is still too wide even alone on its own
        // line (e.g. two long dropdowns) — it scrolls in place rather than
        // re-widening the header.
        <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-term-edge bg-term-raised px-2 py-1">
          <h2 className="text-th font-semibold uppercase tracking-wide text-term-sub">{title}</h2>
          {right ? <div className="min-w-0 overflow-x-auto">{right}</div> : null}
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
  // across browsers, rather than relying on the default line-height.
  const base = `border-b border-term-edge text-th leading-[13px] font-medium uppercase tracking-wide text-term-muted ${a} ${className}`;
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
  // per spec — dense rows, no wasted whitespace.
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
      ? // Pressed-in rather than lit: bg-term-bg already reads as
        // "sunk to the page," and a hard, zero-blur two-corner inset
        // (dark top/left, faint light bottom/right — the inverse of
        // the raised bevel below, the standard Windows/Swing "sunken"
        // convention) makes that literal instead of a soft modern
        // inset glow. A 1px downward nudge on the label sells the
        // same "physically depressed" read a real key gets.
        "z-10 translate-y-px border-info bg-term-bg text-term-text shadow-[inset_2px_2px_0_0_rgb(0_0_0_/_0.85),inset_-1px_-1px_0_0_rgb(255_255_255_/_0.05)]"
      : // Raised: bg-term-raised + the global bevel-border rule
        // already carry the flat fill and two-tone hard edge (see
        // globals.css) — a Windows/Swing "button face," not a glossy
        // gradient — so no extra shadow is needed here at all; one
        // more blurred drop-shadow on top would be exactly the soft
        // "modern card" effect this pass is removing.
        "border-term-edge bg-term-raised text-term-muted hover:bg-term-line/30 hover:text-term-sub"
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
  const base = "w-full border-y border-term-edge bg-term-raised px-2 py-1 flex items-center justify-between text-th font-semibold uppercase tracking-wide text-term-sub";
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
