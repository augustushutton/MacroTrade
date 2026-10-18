// Display helpers.
//
// signColor returns complete class-name literals (not composed via a
// template string) because Tailwind's scanner needs to see the literal
// class name in source to include it in the build.

export function signColor(v: number, dead = 0.005): string {
  if (!Number.isFinite(v) || Math.abs(v) < dead) return "text-term-sub";
  // text-up-bright/text-down-bright, not text-up/text-down: this is the one
  // place a number is coloured with nothing behind it but the ordinary panel
  // background, so it can afford to be a real, punchy green/red. text-up/
  // text-down stay reserved for the dark, fill-safe pair used everywhere a
  // colour sits UNDER white text or alongside a chart (see globals.css's
  // --up-bright/--down-bright comment).
  return v > 0 ? "text-up-bright" : "text-down-bright";
}

/** Sign glyph used in tables. Plain ASCII; no unicode arrows. */
export function sign(v: number, dead = 0.005): string {
  if (!Number.isFinite(v) || Math.abs(v) < dead) return "";
  return v > 0 ? "+" : "";
}

export function fmtPct(v: number, dp = 2): string {
  if (!Number.isFinite(v)) return "n/a";
  return `${sign(v, 10 ** -dp / 2)}${v.toFixed(dp)}%`;
}

export function fmtPctBare(v: number, dp = 2): string {
  if (!Number.isFinite(v)) return "n/a";
  return v.toFixed(dp);
}

// fmtBp (basis-point formatter) was removed on request — every bp-denominated
// figure in the app now displays as percent via fmtPct instead (dividing the
// underlying bp value by 100 at each call site). The internal engine fields
// that still carry "Bp" in their own name (rateLegBp, spreadBp, yieldBp,
// steepNowBp, shockBp, ...) are untouched — only the display layer changed.

export function fmtUsd(v: number): string {
  if (!Number.isFinite(v)) return "n/a";
  const s = v < 0 ? "-" : "+";
  const a = Math.abs(v);
  if (a >= 1_000_000) return `${s}$${(a / 1_000_000).toFixed(2)}M`;
  if (a >= 1_000) return `${s}$${(a / 1_000).toFixed(1)}k`;
  return `${s}$${a.toFixed(0)}`;
}

export function fmtUsdPlain(v: number): string {
  if (!Number.isFinite(v)) return "n/a";
  return `$${Math.round(v).toLocaleString("en-US")}`;
}

export function fmtNum(v: number, dp = 2): string {
  if (!Number.isFinite(v)) return "n/a";
  return v.toFixed(dp);
}

export function fmtSigned(v: number, dp = 2): string {
  if (!Number.isFinite(v)) return "n/a";
  return `${sign(v, 10 ** -dp / 2)}${v.toFixed(dp)}`;
}

/** Signed display for how far a variable has moved from its base, used
 *  everywhere a variable's move is shown — Builder's delta badges,
 *  Sensitivity's Leave-One-Out Move column, Derivation's Inputs Moved Move
 *  column — so the same move reads the same way on every page instead of
 *  mixing bp/idx/x/$bn/mo/% GDP/sd/px/pts/% depending which table you're
 *  looking at. Expressed as a percentage of the variable's base magnitude
 *  (dividing by |base| rather than base itself, so a variable with a
 *  negative base — e.g. Current Account — still shows a positive percentage
 *  for a raw increase, matching what every other sign convention on these
 *  pages already does).
 *
 *  A handful of variables (Forward Guidance, Regional Fed Composite,
 *  Revision Breadth, US Terms of Trade, Energy Supply Shock) have a base of
 *  exactly 0, so "percent of base" is undefined for them — they keep their
 *  original native-unit delta display instead. */
export function fmtVarDelta(v: { base: number; dp: number; unit: string }, d: number): string {
  if (!Number.isFinite(d)) return "n/a";
  if (v.base === 0) {
    const s = fmtSigned(d, v.dp);
    const label = unitLabel(v.unit);
    if (label === "") return s;
    if (label === "%" || label === "bp" || label === "x") return `${s}${label}`;
    if (label.startsWith("%")) return `${s}%${label.slice(1)}`;
    return `${s} ${label}`;
  }
  return fmtPct((d / Math.abs(v.base)) * 100, 1);
}

/** Display label for a variable's internal `unit` token. A couple of tokens
 *  are internal shorthand that reads as unexplained jargon wherever a value
 *  is actually shown to a trader: "idx" (an index-level move — VIX, PMI
 *  diffusion indices, ...) and "px" (a raw FX quote-price delta, e.g.
 *  EUR/USD +0.0050). "idx" becomes the standard, self-evident "pts"; "px"
 *  is dropped to "" (empty), since the surrounding context — the row/column
 *  label, plus the base/live values already shown alongside it — already
 *  establishes that a number is a price-level delta with no ambiguity a
 *  unit suffix would resolve. Shared by VarForm's delta badges and
 *  SensitivityTab's axis headers so the two can't describe the same
 *  variable two different ways. */
export function unitLabel(unit: string): string {
  if (unit === "idx") return "pts";
  if (unit === "px") return "";
  return unit;
}

/** Bar width as a percentage of the widest magnitude in a set. */
export function barPct(v: number, max: number): number {
  if (!Number.isFinite(v) || !Number.isFinite(max) || max <= 0) return 0;
  return Math.min(100, (Math.abs(v) / max) * 100);
}

/**
 * Heat cell background. Opacity carries magnitude off a single up/down hue
 * pair. Inline styles (not Tailwind classes, since opacity is computed at
 * runtime) but resolved through the same --up/--down custom properties as
 * every other colour in the app, so a palette change applies here too. */
export function heatBg(v: number, max: number): string {
  if (!Number.isFinite(v) || max <= 0) return "transparent";
  const a = Math.min(0.85, (Math.abs(v) / max) * 0.85);
  return v >= 0 ? `rgb(var(--up) / ${a.toFixed(3)})` : `rgb(var(--down) / ${a.toFixed(3)})`;
}

/** Text colour that stays legible once heatBg saturates. */
export function heatFg(v: number, max: number): string {
  const base = "rgb(var(--term-text))";
  if (!Number.isFinite(v) || max <= 0) return base;
  const a = Math.min(0.85, (Math.abs(v) / max) * 0.85);
  // At high fill opacity the cell is a deep, saturated up/down colour (dark
  // green or dark red in both themes — these are deliberately dark hues, not
  // bright ones) blended over the panel background. Near-black text on that
  // was actually the bug being fixed here: it nearly vanished into the dark
  // red/green fill. White stays legible against both.
  return a > 0.5 ? "rgb(255 255 255)" : base;
}

/**
 * Solid-fill "watchlist" cell treatment — Interactive Brokers' own watchlist
 * colours its CHANGE column as a full block of solid green or red, not
 * coloured text on the row's own background. On request ("change the
 * opacity"), this dropped its earlier fixed 0.55 opacity in favour of
 * exactly what IB's own CHANGE column actually does: every row's fill
 * intensity is scaled by the SIZE of that row's move relative to the
 * biggest move currently in the same table (pixel-sampled from the
 * reference TWS screenshot — the most negative row, NLNK at -12.24%, reads
 * as a noticeably more saturated red block than BUD's -1.37%, not the same
 * flat red). `max` is the caller's own table — the biggest |v| among the
 * rows actually on screen together — so the scaling is always relative to
 * what a trader is comparing it against, the same reasoning as
 * heatMax/loHeatMax on the Sensitivity tab. Floored at 0.18 rather than
 * heatBg's floor-less scale: a heatmap cell can fade to nothing at the low
 * end because its neighbours carry the eye, but a lone $11 fill in an
 * otherwise-empty Trading row still needs to read as "this is negative,"
 * not vanish into the panel background.
 *
 * signFillFg returns white once the fill is dark enough (a>0.5) — the same
 * near-black-vanishes-into-a-dark-fill fix as heatFg above — and the
 * ordinary term-text colour below that, since a pale, barely-scaled fill
 * needs normal-contrast text, not white-on-almost-nothing.
 */
export function signFillBg(v: number, max: number, dead = 0.005): string {
  if (!Number.isFinite(v) || Math.abs(v) < dead) return "transparent";
  const m = Number.isFinite(max) && max > 0 ? max : Math.abs(v) || 1;
  const a = Math.min(0.85, Math.max(0.18, (Math.abs(v) / m) * 0.85));
  return v > 0 ? `rgb(var(--up) / ${a.toFixed(3)})` : `rgb(var(--down) / ${a.toFixed(3)})`;
}
export function signFillFg(v: number, max: number, dead = 0.005): string {
  if (!Number.isFinite(v) || Math.abs(v) < dead) return "rgb(var(--term-sub))";
  const m = Number.isFinite(max) && max > 0 ? max : Math.abs(v) || 1;
  const a = Math.min(0.85, Math.max(0.18, (Math.abs(v) / m) * 0.85));
  return a > 0.5 ? "rgb(255 255 255)" : "rgb(var(--term-text))";
}

