"use client";

import React from "react";
import { HORIZONS, HORIZON_LABEL, PATHS, PATH_BY_ID, type Horizon, type PathShape } from "@/lib/paths";
import { Btn } from "./ui";

/** Tight contiguous button segment — adjacent buttons share a border line
 * (each non-first button overlaps the previous one's right edge by 1px) so
 * the group reads as one control, not a row of separately-spaced buttons.
 * The active button's `z-10` (set in Btn) keeps its border on top at the
 * seams. */
function Segment<T extends string | number>({
  items,
  value,
  onChange,
}: {
  items: { id: T; label: string; title?: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex">
      {items.map((it, i) => (
        <Btn
          key={String(it.id)}
          active={value === it.id}
          onClick={() => onChange(it.id)}
          title={it.title}
          className={i > 0 ? "-ml-px" : ""}
        >
          {it.label}
        </Btn>
      ))}
    </div>
  );
}

export function PathSelector({ path, setPath }: { path: PathShape; setPath: (p: PathShape) => void }) {
  return (
    <Segment
      items={PATHS.map((p) => ({ id: p.id, label: p.label, title: p.gist }))}
      value={path}
      onChange={setPath}
    />
  );
}

export function HorizonSelector({ horizon, setHorizon }: { horizon: Horizon; setHorizon: (h: Horizon) => void }) {
  return (
    <Segment
      items={HORIZONS.map((h) => ({ id: h, label: HORIZON_LABEL[h] }))}
      value={horizon}
      onChange={setHorizon}
    />
  );
}

// Same accent as the brand mark (MacroTradeLogo's DARK_GREEN in TopNav.tsx) —
// one hardcoded hex reused everywhere the app draws its own accent stroke,
// rather than the `up` theme token, which is a lighter, desaturated green
// reserved for P&L direction elsewhere. This is a fixed identity color, not
// a themed data signal, same reasoning as the logo.
const PATH_GREEN = "#006400";

const PREVIEW_W = 96;
const PREVIEW_H = 24;
const PAD_X = 3;
const PAD_Y = 3;
// Resolution the curve is drawn at — independent of the app's `steps`
// control (a numerical-integration setting for the P&L engine, not a
// display setting). High enough that S-Curve's bend and Staged's flat
// treads/vertical risers both render as clean, deliberate lines rather than
// a faceted polygon.
const SAMPLES = 60;

/**
 * Small "what does this path actually look like" preview: fraction of the
 * terminal shock delivered (y) against time through the horizon (x), for
 * the currently selected Path shape. Two reference lines give it a frame a
 * bare squiggle wouldn't have — a solid 0% baseline and a dashed 100% line
 * at the terminal target — so Mean Reverting's overshoot-then-decay reads
 * as "went past the target, gave some back" against a fixed scale, instead
 * of auto-fitting to its own peak and looking identical in shape to a path
 * that never overshoots at all.
 */
export function PathPreview({ path, horizon }: { path: PathShape; horizon: Horizon }) {
  const { d, zeroY, oneY, showOneLine } = React.useMemo(() => {
    const f = PATH_BY_ID[path].f;
    const pts: { t: number; frac: number }[] = [];
    for (let i = 0; i <= SAMPLES; i++) {
      const t = i / SAMPLES;
      pts.push({ t, frac: f(t) });
    }
    const fracs = pts.map((p) => p.frac);
    const minF = Math.min(0, ...fracs);
    const maxF = Math.max(1, ...fracs);
    const span = maxF - minF || 1;

    const innerW = PREVIEW_W - PAD_X * 2;
    const innerH = PREVIEW_H - PAD_Y * 2;
    const x = (t: number) => PAD_X + t * innerW;
    const y = (frac: number) => PAD_Y + innerH - ((frac - minF) / span) * innerH;

    const dStr = pts.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.t).toFixed(2)} ${y(p.frac).toFixed(2)}`).join(" ");
    const zY = y(0);
    const oY = y(1);
    return { d: dStr, zeroY: zY, oneY: oY, showOneLine: Math.abs(oY - zY) > 0.5 };
  }, [path]);

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-th font-semibold uppercase tracking-wide text-term-muted">
        Delivery <span className="normal-case text-term-edge">·</span> 0&ndash;{HORIZON_LABEL[horizon]}
      </span>
      <svg
        width={PREVIEW_W}
        height={PREVIEW_H}
        viewBox={`0 0 ${PREVIEW_W} ${PREVIEW_H}`}
        className="border border-term-edge bg-term-input"
      >
        <line
          x1={PAD_X}
          y1={zeroY}
          x2={PREVIEW_W - PAD_X}
          y2={zeroY}
          className="stroke-term-line"
          strokeWidth="1"
        />
        {showOneLine ? (
          <line
            x1={PAD_X}
            y1={oneY}
            x2={PREVIEW_W - PAD_X}
            y2={oneY}
            className="stroke-term-line"
            strokeWidth="1"
            strokeDasharray="1.5 1.5"
          />
        ) : null}
        <path d={d} fill="none" stroke={PATH_GREEN} strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    </div>
  );
}
