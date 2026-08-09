"use client";

import React from "react";

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
        <header className="flex items-center justify-between border-b border-term-edge bg-term-raised px-2 py-1">
          <h2 className="text-th font-semibold uppercase tracking-wide text-term-sub">{title}</h2>
          {right}
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
}: {
  children?: React.ReactNode;
  align?: "left" | "right" | "center";
  mono?: boolean;
  className?: string;
  colSpan?: number;
}) {
  const a = align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
  // Fixed leading (14px), same reasoning as Th. Padding is dense (3px) 8px
  // per spec — dense rows, no wasted whitespace.
  return (
    <td colSpan={colSpan} className={`px-2 py-dense leading-[14px] ${a} ${mono ? "font-mono tnum" : ""} ${className}`}>
      {children}
    </td>
  );
}

export function Btn({
  active = false,
  onClick,
  children,
  title,
  className = "",
}: {
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  title?: string;
  className?: string;
}) {
  return (
    <Tooltip content={title}>
      <button
        type="button"
        onClick={onClick}
        className={`relative border px-2.5 py-dense text-[11px] font-medium transition-none ${
          active
            ? "z-10 border-info bg-term-bg text-term-text"
            : "border-term-edge bg-term-raised text-term-muted hover:bg-term-line/30 hover:text-term-sub"
        } ${className}`}
      >
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

/** Horizontal signed bar. Zero sits on a centre rule, not at the left edge. */
export function SignedBar({ v, max, height = 9 }: { v: number; max: number; height?: number }) {
  const w = max > 0 ? Math.min(50, (Math.abs(v) / max) * 50) : 0;
  const pos = v >= 0;
  return (
    <div className="relative w-full bg-term-raised" style={{ height }}>
      <div className="absolute inset-y-0 left-1/2 w-px bg-term-line" />
      <div
        className={`absolute inset-y-0 ${pos ? "bg-up" : "bg-down"}`}
        style={{ left: pos ? "50%" : `${50 - w}%`, width: `${w}%` }}
      />
    </div>
  );
}
