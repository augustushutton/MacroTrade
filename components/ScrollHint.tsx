"use client";

import React from "react";

// Shared scroll-affordance wrapper for every `overflow-x-auto` container in
// the app (TopNav's two strips, Trading's Desk table, Execution's Order
// Book, and every wide table in PnlTab/SensitivityTab/NarrativeTab that
// scrolls instead of compressing). Added by request ("make it so it
// correctly resizes... for every device") after confirming via phone-width
// screenshots that several of these containers DO scroll correctly but give
// zero visual indication they're scrollable — at 375-390px a user has no
// way to know TRADING/EXECUTION tabs, or a table's trailing columns, exist
// just off-screen unless they happen to swipe blind.
//
// A pure-CSS background-attachment fade (the classic Lea Verou trick) was
// considered and rejected: this app's rows alternate bg-term-panel/
// bg-term-zebra, headers sit on bg-term-raised, and TopNav's strips sit on
// bg-term-raised too — there is no single background colour a CSS-only fade
// could key off that would match every row it passes over, so a
// colour-matched gradient would show a visible seam against half the
// zebra-striped rows. Instead this renders a neutral dark vignette
// (rgba(0,0,0,·) fading to transparent) plus a small chevron glyph — close
// enough to "real" darkening to read as an edge-of-content cue against any
// of this app's surfaces without needing to match one exactly, and in
// keeping with the terminal/CRT aesthetic (a vignette reads as intentional
// here, not as a rendering bug). JS-driven (actual scroll-position
// detection), not a static always-on edge, so it disappears once there's
// nothing left to scroll to in that direction — same spirit as a native
// scrollbar's own overflow indicators.
function useScrollEdges(ref: React.RefObject<HTMLElement | null>) {
  const [atStart, setAtStart] = React.useState(true);
  const [atEnd, setAtEnd] = React.useState(true);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () => {
      const { scrollLeft, scrollWidth, clientWidth } = el;
      // 1px slop: sub-pixel layout can leave scrollLeft a hair short of the
      // true max on some zoom levels, which would otherwise pin atEnd to
      // false forever even though there's nothing left to reveal.
      setAtStart(scrollLeft <= 1);
      setAtEnd(scrollLeft + clientWidth >= scrollWidth - 1);
    };

    measure();
    el.addEventListener("scroll", measure, { passive: true });
    // Catches the container becoming scrollable (or not) purely from a
    // window resize/orientation change — e.g. rotating a phone from
    // portrait to landscape can take a table from "overflowing" to
    // "fits," which a scroll listener alone would never see since no
    // scroll event fires.
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);

    return () => {
      el.removeEventListener("scroll", measure);
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [ref]);

  return { atStart, atEnd };
}

/** Drop-in replacement for `<div className="overflow-x-auto">`: same box,
 *  same children, plus the two edge cues described above. `className` is
 *  merged onto the scrolling element itself (so e.g. `border-b
 *  border-term-edge` callers keep working unchanged), never onto the
 *  outer positioning wrapper. */
export function ScrollHint({
  className = "",
  children,
  as: Tag = "div",
}: {
  className?: string;
  children: React.ReactNode;
  /** TopNav's tab strip is a `<nav>`, not a `<div>` — kept configurable
   *  rather than hardcoding one element so the scrollable node keeps
   *  whatever semantics its caller needs. */
  as?: "div" | "nav";
}) {
  const ref = React.useRef<HTMLElement>(null);
  const { atStart, atEnd } = useScrollEdges(ref);

  return (
    <div className="relative min-w-0">
      {/* @ts-expect-error -- ref's element type depends on Tag ("div" | "nav"); both are plain HTMLElements and accept the same scroll/resize handling above. */}
      <Tag ref={ref} className={`overflow-x-auto ${className}`}>
        {children}
      </Tag>
      {/* pointer-events-none: purely a visual cue, must never intercept the
          swipe/drag that actually scrolls the content underneath. */}
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-y-0 left-0 flex w-5 items-center justify-start bg-gradient-to-r from-black/55 to-transparent transition-opacity duration-150 ${
          atStart ? "opacity-0" : "opacity-100"
        }`}
      >
        <span className="-ml-0.5 font-mono text-[10px] text-term-sub">&lsaquo;</span>
      </div>
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-y-0 right-0 flex w-5 items-center justify-end bg-gradient-to-l from-black/55 to-transparent transition-opacity duration-150 ${
          atEnd ? "opacity-0" : "opacity-100"
        }`}
      >
        <span className="-mr-0.5 font-mono text-[10px] text-term-sub">&rsaquo;</span>
      </div>
    </div>
  );
}
