"use client";

import React from "react";
import { VAR_GROUPS, VARIABLES, VAR_BY_ID, type Variable, type VarState } from "@/lib/vars";
import { fmtSigned, signColor, unitLabel } from "@/lib/format";
import { GroupHeader, Tooltip } from "./ui";

// One row per variable: label, base value, shock input flanked by −/+
// steppers, delta badge. Values are set by typing directly, by the stepper
// buttons, or with the arrow keys while the input is focused — plain = 1x
// step, Shift = 10x, Alt = 0.1x (modifier applies to click or arrow key).

/** Rounds to 6dp internally regardless of the variable's display precision,
 *  so a small (0.1x) adjustment on a low-precision field isn't lost to
 *  rounding before it reaches the formatter. */
function roundInternal(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

function clamp(n: number, v: Variable): number {
  return Math.min(v.max, Math.max(v.min, n));
}

function bumpAmount(v: Variable, mods: { shiftKey?: boolean; altKey?: boolean }): number {
  if (mods.shiftKey) return v.step * 10;
  if (mods.altKey) return v.step * 0.1;
  return v.step;
}

const BUMP_TITLE = "±step · Shift ±10x · Alt ±0.1x";

/** Delta badge text: signed value with its unit folded in. Tight (no space)
 *  for units that read naturally glued to the number — %, bp, and x (a
 *  multiple, e.g. "20.5x", never written with a space) — and for a "%"
 *  prefixed compound unit like "% GDP" ("+3.0% GDP", not "+3.0 % GDP" or
 *  "+3.0 %GDP"). A thin space for everything else ("+5 $bn/mo", not
 *  "+5$bn/mo"). No suffix at all when unitLabel maps to "". */
function deltaBadge(v: Variable, d: number): string {
  const s = fmtSigned(d, v.dp);
  const label = unitLabel(v.unit);
  if (label === "") return s;
  if (label === "%" || label === "bp" || label === "x") return `${s}${label}`;
  if (label.startsWith("%")) return `${s}%${label.slice(1)}`;
  return `${s} ${label}`;
}

function VarRow({
  id,
  state,
  onChange,
  domId,
}: {
  id: string;
  state: VarState;
  onChange: (id: string, v: number) => void;
  /** Element id for the label/input pair. VarForm renders three copies of
   *  every row — one per responsive breakpoint, only one visible at a time
   *  (see packColumns below) — so `v-${id}` alone would collide three times
   *  over and produce invalid HTML (duplicate ids break `htmlFor`
   *  association and any `getElementById`/`#id` lookup, which resolves to
   *  only the first match). Each copy passes its own breakpoint-scoped id. */
  domId: string;
}) {
  const v = VAR_BY_ID[id];
  const cur = state[id] ?? v.base;
  const d = cur - v.base;
  const moved = Math.abs(d) > 1e-9;

  // The base column two cells over is always formatted to the variable's
  // declared precision (v.dp) via .toFixed(). This field used to show the
  // raw JS number instead — 4 next to a base of 4.00, 62.6 next to 62.60 —
  // so a row's own two numbers disagreed on how many decimals "this
  // variable" gets. Formatting only while NOT focused keeps that in sync
  // at rest without fighting live typing: forcing .toFixed() on every
  // keystroke would reformat "4" to "4.00" the instant you type it,
  // making it impossible to ever type a trailing decimal like "4.5".
  const [focused, setFocused] = React.useState(false);

  function bump(sign: 1 | -1, mods: { shiftKey?: boolean; altKey?: boolean }) {
    onChange(id, clamp(roundInternal(cur + sign * bumpAmount(v, mods)), v));
  }

  return (
    <div className="grid grid-cols-[minmax(0,1.3fr)_44px_84px_68px] items-center gap-1 border-b border-term-line bg-term-panel px-2 py-dense">
      <Tooltip content={v.label} className="w-full min-w-0">
        <label htmlFor={domId} className="block w-full min-w-0 truncate text-[11px] leading-[13px] text-term-sub">
          {v.label}
        </label>
      </Tooltip>
      <Tooltip content="Base value">
        <div className="text-right font-mono text-[11px] leading-[13px] tnum text-term-muted">
          {v.base.toFixed(v.dp)}
        </div>
      </Tooltip>
      <div className="flex items-stretch gap-dense">
        <Tooltip content={`−${BUMP_TITLE}`}>
          <button
            type="button"
            onClick={(e) => bump(-1, e)}
            className="w-4 shrink-0 border border-term-edge bg-term-raised font-mono text-[11px] leading-none text-term-muted hover:bg-term-line/30 hover:text-term-sub"
          >
            &minus;
          </button>
        </Tooltip>
        <Tooltip content={`Shock — ${unitLabel(v.unit) || "price"} · ${BUMP_TITLE}`} className="w-full min-w-0">
          <input
            id={domId}
            type="number"
            className={`w-full min-w-0 border border-term-edge bg-term-input px-1 py-hair text-right font-mono text-[11px] leading-[13px] tnum ${
              moved ? "text-info" : "text-term-text"
            }`}
            min={v.min}
            max={v.max}
            step={v.step}
            value={focused ? cur : cur.toFixed(v.dp)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n)) onChange(id, clamp(n, v));
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowUp") {
                e.preventDefault();
                bump(1, e);
              } else if (e.key === "ArrowDown") {
                e.preventDefault();
                bump(-1, e);
              }
            }}
          />
        </Tooltip>
        <Tooltip content={`+${BUMP_TITLE}`}>
          <button
            type="button"
            onClick={(e) => bump(1, e)}
            className="w-4 shrink-0 border border-term-edge bg-term-raised font-mono text-[11px] leading-none text-term-muted hover:bg-term-line/30 hover:text-term-sub"
          >
            +
          </button>
        </Tooltip>
      </div>
      <div className={`text-right font-mono text-[11px] leading-[13px] tnum ${moved ? signColor(d, 10 ** -v.dp / 2) : "text-term-line"}`}>
        {deltaBadge(v, d)}
      </div>
    </div>
  );
}

interface GroupEntry {
  id: string;
  label: string;
  rows: Variable[];
  isOpen: boolean;
}

// GroupHeader: border-y (2px) + py-1 (8px) + a ~15px line box.
const HEADER_H = 25;
// VarRow: border-b (1px) + py-dense (6px) + a ~13px line box.
const ROW_H = 20;
// gap-2 between stacked group cards in the same column.
const CARD_GAP = 8;

function estimateHeight(x: GroupEntry): number {
  return HEADER_H + (x.isOpen ? x.rows.length * ROW_H : 0);
}

/**
 * Greedy longest-processing-time-first bin packing: sort groups tallest
 * first, drop each one into whichever column is currently shortest. This
 * is the standard approach for balancing unequal-height blocks across N
 * columns (provably within 4/3 of optimal) — CSS multi-column's own
 * `column-fill: balance` was tried first and rejected here because it can
 * only pour groups into columns in source (DOM) order; it can't reorder
 * content to compensate when the open/collapsed groups aren't evenly
 * spread through that order (which they routinely aren't — a user might
 * expand three groups in a row). Packing explicitly, from the same
 * estimated heights every time, means the layout is deterministic and
 * identical between server and client render, so there's no hydration
 * mismatch and no post-mount reflow.
 */
function packColumns(entries: GroupEntry[], numCols: number): GroupEntry[][] {
  const cols: GroupEntry[][] = Array.from({ length: numCols }, () => []);
  const heights = new Array(numCols).fill(0);
  const sorted = [...entries].sort((a, b) => estimateHeight(b) - estimateHeight(a));
  for (const e of sorted) {
    let shortest = 0;
    for (let i = 1; i < numCols; i++) if (heights[i] < heights[shortest]) shortest = i;
    cols[shortest].push(e);
    heights[shortest] += estimateHeight(e) + CARD_GAP;
  }
  return cols;
}

function GroupCard({
  x,
  state,
  onChange,
  onToggle,
  onResetGroup,
  scope,
}: {
  x: GroupEntry;
  state: VarState;
  onChange: (id: string, v: number) => void;
  onToggle: () => void;
  onResetGroup: (group: string) => void;
  /** Breakpoint tier this copy renders under ("sm" | "md" | "xl") — folded
   *  into each row's element id so the three responsive copies never emit
   *  the same id twice. See VarRow's `domId` doc comment. */
  scope: string;
}) {
  const movedCount = x.rows.filter((v) => Math.abs((state[v.id] ?? v.base) - v.base) > 1e-9).length;
  return (
    <div className="border border-term-edge bg-term-panel">
      <GroupHeader
        onClick={onToggle}
        openState={x.isOpen}
        right={
          movedCount > 0 ? (
            <>
              <span className="text-th text-term-text">
                <span className="font-mono tnum font-medium">{movedCount}</span> set
              </span>
              <button type="button" onClick={() => onResetGroup(x.id)} className="text-th text-term-muted hover:text-down">
                Reset
              </button>
            </>
          ) : null
        }
      >
        {x.label}
      </GroupHeader>
      {x.isOpen ? (
        <div>
          {x.rows.map((v) => (
            <VarRow key={v.id} id={v.id} domId={`v-${v.id}-${scope}`} state={state} onChange={onChange} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function VarForm({
  state,
  onChange,
  onResetGroup,
  open,
  setOpen,
  filter = "",
}: {
  state: VarState;
  onChange: (id: string, v: number) => void;
  onResetGroup: (group: string) => void;
  open: Record<string, boolean>;
  setOpen: (g: string, v: boolean) => void;
  filter?: string;
}) {
  const q = filter.trim().toLowerCase();

  const groups: GroupEntry[] = VAR_GROUPS.map((g) => ({
    id: g.id,
    label: g.label,
    rows: VARIABLES.filter((v) => v.group === g.id && (q === "" || v.label.toLowerCase().includes(q))),
    isOpen: q !== "" ? true : open[g.id],
  })).filter((x) => !(q !== "" && x.rows.length === 0));

  const card = (scope: string) => (x: GroupEntry) => (
    <GroupCard
      key={x.id}
      x={x}
      scope={scope}
      state={state}
      onChange={onChange}
      onResetGroup={onResetGroup}
      onToggle={() => setOpen(x.id, !x.isOpen)}
    />
  );

  // Three explicit, pre-packed layouts — one per breakpoint — swapped by
  // CSS visibility rather than a grid/multi-column container whose column
  // count changes underneath it. A grid forces every column to the height
  // of its tallest row-of-groups; native CSS multi-column (tried first,
  // see packColumns' comment) balances well only when tall and short
  // groups already alternate in source order. Packing per breakpoint up
  // front sidesteps both: each column is exactly as tall as what's greedily
  // assigned to it, with no dependency on group order or open/closed state
  // lining up favourably.
  const twoCol = packColumns(groups, 2);
  const threeCol = packColumns(groups, 3);

  return (
    <>
      <div className="flex flex-col gap-2 md:hidden">{groups.map(card("sm"))}</div>
      <div className="hidden items-start gap-2 md:flex xl:hidden">
        {twoCol.map((col, i) => (
          <div key={i} className="flex min-w-0 flex-1 flex-col gap-2">
            {col.map(card(`md${i}`))}
          </div>
        ))}
      </div>
      <div className="hidden items-start gap-2 xl:flex">
        {threeCol.map((col, i) => (
          <div key={i} className="flex min-w-0 flex-1 flex-col gap-2">
            {col.map(card(`xl${i}`))}
          </div>
        ))}
      </div>
    </>
  );
}
