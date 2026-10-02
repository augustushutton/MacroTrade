"use client";

import React from "react";
import { VAR_GROUPS, VARIABLES, VAR_BY_ID, type Variable, type VarState } from "@/lib/vars";
import { fmtVarDelta, signColor, unitLabel } from "@/lib/format";
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

function VarRow({
  id,
  state,
  onChange,
  domId,
  zebra,
}: {
  id: string;
  state: VarState;
  onChange: (id: string, v: number) => void;
  /** Element id for the label/input pair. VarForm renders three copies of
   *  every row — one per responsive breakpoint, only one visible at a time
   *  (see the grid layouts at the bottom of this file) — so `v-${id}` alone
   *  would collide three times over and produce invalid HTML (duplicate ids
   *  break `htmlFor` association and any `getElementById`/`#id` lookup,
   *  which resolves to only the first match). Each copy passes its own
   *  breakpoint-scoped id. */
  domId: string;
  /** Alternating row shade, same convention as every table elsewhere in the
   *  app (Td's even:bg-term-zebra) — a long, uniform list of identical rows
   *  is exactly the "clump of lines" a real terminal's watchlists avoid by
   *  banding every other row. */
  zebra: boolean;
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
    <div
      className={`grid grid-cols-[minmax(0,1fr)_48px_104px_72px] items-stretch border-b border-term-line ${
        zebra ? "bg-term-zebra" : "bg-term-panel"
      }`}
    >
      <Tooltip content={v.label} className="flex w-full min-w-0 items-center border-r border-term-line px-2 py-dense">
        <label htmlFor={domId} className="block w-full min-w-0 truncate text-[11px] leading-[13px] text-term-sub">
          {v.label}
        </label>
      </Tooltip>
      <Tooltip content="Base value" className="flex items-center border-r border-term-line px-1.5 py-dense">
        <div className="w-full text-right font-mono text-[11px] leading-[13px] tnum text-term-muted">
          {v.base.toFixed(v.dp)}
        </div>
      </Tooltip>
      <div className="flex items-stretch gap-dense border-r border-term-line px-1 py-dense">
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
            className={`w-full min-w-0 border px-1 py-hair text-right font-mono text-[11px] leading-[13px] tnum ${
              moved
                ? "border-warn bg-warn text-term-bg font-medium"
                : "border-term-edge bg-term-input text-term-text"
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
      <div
        className={`flex items-center justify-end px-1.5 py-dense font-mono text-[11px] font-medium leading-[13px] tnum ${
          moved ? signColor(d, 10 ** -v.dp / 2) : "text-term-line"
        }`}
      >
        {fmtVarDelta(v, d)}
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

function GroupCard({
  x,
  state,
  onChange,
  onResetGroup,
  scope,
  className = "",
}: {
  x: GroupEntry;
  state: VarState;
  onChange: (id: string, v: number) => void;
  onResetGroup: (group: string) => void;
  /** Breakpoint tier this copy renders under ("sm" | "md" | "xl") — folded
   *  into each row's element id so the three responsive copies never emit
   *  the same id twice. See VarRow's `domId` doc comment. */
  scope: string;
  /** Negative-margin overlap (see overlapClass below) so this card's border
   *  coincides with its neighbour's instead of doubling up — true edge-to-
   *  edge tiling, like IB's Mosaic panels, rather than a visible gap-turned-
   *  double-line once the grid `gap` itself was removed. */
  className?: string;
}) {
  const movedCount = x.rows.filter((v) => Math.abs((state[v.id] ?? v.base) - v.base) > 1e-9).length;
  // Permanently open by request — no collapse/expand toggle, same change
  // just made to PresetBar's groups. GroupHeader gets no onClick/openState
  // here, so it renders as a plain (non-interactive) label instead of a
  // button with a +/− chevron. `x.isOpen`/`onToggle` (ScenarioContext's
  // open/setOpen, also used by session save/restore in lib/storage.ts and
  // tests/storage.test.ts) are left untouched elsewhere — this component
  // just stops reading x.isOpen to decide whether to render the rows below.
  return (
    <div className={`border border-term-edge bg-term-panel ${className}`}>
      <GroupHeader
        right={
          movedCount > 0 ? (
            <>
              <span className="text-th text-term-text">
                <span className="font-mono tnum font-medium">{movedCount}</span> set
              </span>
              <button
                type="button"
                onClick={() => onResetGroup(x.id)}
                className="text-th text-term-muted hover:text-down"
              >
                {/* Small reset glyph ahead of the label — real function,
                    dressed as the icon-plus-label toolbar buttons a dense
                    trading terminal's panel chrome is built from, rather
                    than a bare text link. */}
                <span aria-hidden className="mr-0.5">
                  &#8634;
                </span>
                Reset
              </button>
            </>
          ) : null
        }
      >
        {x.label}
      </GroupHeader>
      <div>
        {x.rows.map((v, ri) => (
          <VarRow key={v.id} id={v.id} domId={`v-${v.id}-${scope}`} state={state} onChange={onChange} zebra={ri % 2 === 1} />
        ))}
      </div>
    </div>
  );
}

/** Negative-margin overlap for a card sitting in a zero-gap grid, so its
 *  border coincides with its neighbour's instead of doubling into a 2px
 *  line — the same `-ml-px` trick TopNav's segmented buttons already use,
 *  extended here to the second axis (`-mt-px`) since this grid wraps to a
 *  new row. Every column but the first pulls 1px left; every row but the
 *  first pulls 1px up — both at once for an interior cell. */
function overlapClass(scope: string, i: number): string {
  const cols = scope === "xl" ? 3 : scope === "md" ? 2 : 1;
  const cls: string[] = [];
  if (i % cols !== 0) cls.push("-ml-px");
  if (i >= cols) cls.push("-mt-px");
  return cls.join(" ");
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

  // The "curve" group (the four yield-curve pin variables YieldCurveChart
  // owns — see lib/vars.ts) is excluded here on purpose: it exists for the
  // shared state/reset/save plumbing every group gets for free, not to add a
  // seventh square to this grid. Its only editor is the chart itself.
  const groups: GroupEntry[] = VAR_GROUPS.filter((g) => g.id !== "curve")
    .map((g) => ({
      id: g.id,
      label: g.label,
      rows: VARIABLES.filter((v) => v.group === g.id && (q === "" || v.label.toLowerCase().includes(q))),
      isOpen: q !== "" ? true : open[g.id],
    }))
    .filter((x) => !(q !== "" && x.rows.length === 0));

  const card = (scope: string) => (x: GroupEntry, i: number) => (
    <GroupCard
      key={x.id}
      x={x}
      scope={scope}
      state={state}
      onChange={onChange}
      onResetGroup={onResetGroup}
      className={overlapClass(scope, i)}
    />
  );

  // A plain fixed grid, not a height-balancing bin-packer: the six groups
  // in lib/vars.ts (VAR_GROUPS) are deliberately kept within one row of
  // each other (6-8 rows), so unlike the wildly uneven groups this page
  // used to have, source order alone now reads as an even grid without
  // needing to reflow cards between columns. VAR_GROUPS' own order IS the
  // grid order: row 1 = Monetary / Inflation / Growth, row 2 = Financial /
  // FX / Fiscal, a fixed 3-column x 2-row layout at the widest tier
  // (xl:grid-cols-3), 2 columns x 3 rows at the mid tier, one column on
  // mobile.
  return (
    <>
      <div className="flex flex-col gap-0 md:hidden">{groups.map(card("sm"))}</div>
      <div className="hidden grid-cols-2 items-start gap-0 md:grid xl:hidden">{groups.map(card("md"))}</div>
      <div className="hidden grid-cols-3 items-start gap-0 xl:grid">{groups.map(card("xl"))}</div>
    </>
  );
}
