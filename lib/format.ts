// Display helpers.
//
// signColor returns complete class-name literals (not composed via a
// template string) because Tailwind's scanner needs to see the literal
// class name in source to include it in the build.

export function signColor(v: number, dead = 0.005): string {
  if (!Number.isFinite(v) || Math.abs(v) < dead) return "text-term-sub";
  return v > 0 ? "text-up" : "text-down";
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

export function fmtBp(v: number, dp = 0): string {
  if (!Number.isFinite(v)) return "n/a";
  return `${sign(v, 0.5 * 10 ** -dp)}${v.toFixed(dp)}bp`;
}

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

/** Display label for a variable's internal `unit` token. A couple of tokens
 *  are internal shorthand that reads as unexplained jargon wherever a value
 *  is actually shown to a trader: "idx" (an index-level move — VIX, DXY,
 *  PMI diffusion indices, ...) and "px" (a raw FX quote-price delta, e.g.
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
  // At high fill opacity the cell is saturated enough that near-black text
  // reads better than near-white on top of a bright up/down tint.
  return a > 0.5 ? "rgb(8 10 14)" : base;
}

/**
 * Solid-fill "watchlist" cell treatment, on request — Interactive Brokers'
 * own watchlist colours its CHANGE column as a full block of solid green or
 * red, not coloured text on the row's own background, and that block-of-
 * colour read is a real, distinct convention from signColor's text-only
 * one. Fixed opacity rather than heatBg's magnitude scaling (there's no
 * "how big was the move" context here, just direction), but reusing
 * heatFg's same high-opacity contrast flip so the two fill treatments in
 * the app stay visually consistent with each other. Returns inline-style
 * values (not Tailwind classes) since the two colours are picked from the
 * same runtime --up/--down custom properties as every other colour in the
 * app, the same reasoning as heatBg/heatFg above.
 */
export function signFillBg(v: number, dead = 0.005): string {
  if (!Number.isFinite(v) || Math.abs(v) < dead) return "transparent";
  return v > 0 ? "rgb(var(--up) / 0.55)" : "rgb(var(--down) / 0.55)";
}
export function signFillFg(v: number, dead = 0.005): string {
  if (!Number.isFinite(v) || Math.abs(v) < dead) return "rgb(var(--term-sub))";
  return "rgb(8 10 14)";
}
