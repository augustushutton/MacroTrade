"use client";

import React from "react";
import { TOP_LEVEL_ASSETS, type Asset, type AssetGroup } from "@/lib/assets";
import { computeFill, type OrderSide } from "@/lib/execution";
import { place, type ExecutionLeg } from "@/lib/executions";
import { fmtPct, fmtUsd, heatBg, heatFg, signColor } from "@/lib/format";
import type { EngineResult } from "@/lib/engine";
import type { Horizon } from "@/lib/paths";
import { Cap, GroupHeader, Panel, Td, Th } from "./ui";
import { ScrollHint } from "./ScrollHint";

// Trading — an IB-style order ticket, not a position blotter (that's
// Execution, the tab next to this one). Three separate desks, one per
// instrument class the Builder/P&L/Derivation pages already know about
// (Shares = Equities, Bonds, Currency = FX; Commodities is left out, per
// request — the user named shares/bonds/currency specifically), each its
// own bordered panel floating on a visible gutter rather than one long
// table — the same "these are separate instrument windows" treatment
// Derivation already gives each asset's own card (see NarrativeTab.tsx's
// comment on why a real gap reads as "two panels" when this app's two
// border colours collapse into one).
//
// Every fill is priced through lib/execution.ts's computeFill — the same
// spread + size-scaled impact + commission model lib/executions.ts's order
// blotter already expects — against the CURRENT scenario's own modelled
// price move for that instrument (EngineResult.assets[id].pricePct). There
// is no separate "what would this trade be worth" invention here: the Net
// P&L column previews exactly the number computeFill will freeze onto the
// order the instant "Fill Order" is clicked, because it calls the same
// function with the same arguments.
//
// On request — an explicit Interactive Brokers read, not a generic "pro
// trading app" one, and specifically not Robinhood's: IB's own TWS order
// ticket has a few visual/verbal signatures no retail app shares, and this
// leans on exactly those rather than inventing new ones:
//   - Blue BUY / red SELL. Every retail broker (Robinhood included) colours
//     buy/sell green/red, mirroring price direction. IB's ticket doesn't —
//     BUY is blue, SELL is red, a deliberately different pair from
//     gain/loss green/red so a side toggle is never confused with a P&L
//     figure. See SideToggle's own comment for which token stands in for
//     "IB blue" here.
//   - "Fill Order," not "Place" or "Buy now" — plain, functional copy for
//     what the button actually does, in the same register as TWS's own
//     "Transmit" (the label this used before a later request renamed it;
//     the mechanics TWS's Transmit implies — a staged order sent for
//     immediate execution — are unchanged). No confirmation/review step was
//     added before it (unlike real TWS) — this ticket has exactly one field
//     that can invalidate an order (notional <= 0, already disabled
//     against), so a second "are you sure" screen would be ceremony with
//     nothing to add.
//   - "MKT" labelled explicitly next to Notional, not hidden — every fill
//     here IS a market order (computeFill has no limit-price concept), so
//     this states that plainly rather than implying a limit-order ticket
//     with no limit field to back it up.

const DEFAULT_NOTIONAL = 500_000;
// Realistic ticket-size bounds — NOT a grid every value gets forced onto.
// This briefly snapped every typed value to the nearest $10k (so $1,233,909
// became $1,230,000, $20 became $10,000) to fix the $1,000-floor/$1M-wall
// version before that, but on request ("can we just calculate it at every
// price between 0 and 1,000,000?") that snap is gone too: every dollar
// amount in range now computes exactly as typed — $1,233,909 would price a
// fill at exactly $1,233,909, not a rounded neighbour of it — and these two
// constants are purely a floor/ceiling clamp, not a step. The floor is 0
// rather than some "smallest real clip" minimum because the Fill Order
// button already disables at notional<=0 (below) — that's the actual gate
// against a $0 order, so a separate nonzero floor here was only ever
// rejecting legitimate small tickets, never anything the button wouldn't
// already catch. Ceiling back at $1,000,000, matching the range asked for.
const MIN_NOTIONAL = 0;
const MAX_NOTIONAL = 1_000_000;
// Spinner increment ONLY — the amount the native number input's up/down
// arrows step by. Typing, pasting, or blurring is untouched by this; it has
// no bearing on what value ends up in the field or gets computed against.
const NOTIONAL_STEP = 10_000;

/** Clamps a raw notional into [MIN_NOTIONAL, MAX_NOTIONAL] — no rounding,
 *  no snapping to any grid. Shared by handleNotionalBlur below so blur and
 *  the live `notional` calculation can't drift out of sync on what counts
 *  as in-range. */
function clampNotional(v: number): number {
  return Math.min(MAX_NOTIONAL, Math.max(MIN_NOTIONAL, v));
}

/** Per-asset ticket draft (side + the notional field's raw text), kept in
 *  module scope rather than OrderRow's own state so it survives a route
 *  change. Next's App Router unmounts the entire /trading tree when you
 *  navigate to another tab (same reason Desk's resetKey exists below) —
 *  ordinary component state can't outlive that, but a plain object at
 *  module scope lives for as long as this page's JS does, regardless of
 *  which route is currently mounted, so a ticket you were mid-typing is
 *  still there when Trading remounts. On request ("save your current
 *  notional when you switch tabs... then back into it").
 *  Deliberately NOT localStorage: this is a live draft, not a placed order
 *  (those already persist for real, across actual reloads, via
 *  lib/executions.ts) — a genuine browser refresh is still meant to be a
 *  clean ticket, same as before this. */
const ticketDrafts: Record<string, { side: OrderSide; notionalText: string }> = {};

/** Wipes every saved draft — called by the Clear button alongside the
 *  existing resetKey bump. Without this, Clear would still only reset what
 *  you can SEE (via the remount resetKey already forces): the instant a
 *  fresh OrderRow re-mounted under the bumped key, its lazy initialiser
 *  would read straight back out of ticketDrafts and silently restore the
 *  exact ticket Clear just wiped off-screen. */
function clearTicketDrafts() {
  for (const k of Object.keys(ticketDrafts)) delete ticketDrafts[k];
}

const DESKS: { group: AssetGroup; label: string }[] = [
  { group: "Equities", label: "Shares" },
  { group: "Bonds", label: "Bonds" },
  { group: "FX", label: "Currency" },
];

// A real two-state segmented control, not two pills sized to their own text
// and packed right — equal-width halves (flex-1) filling the whole column.
//
// On a second pass ("more professional, not Robinhood") this now reuses Btn
// (ui.tsx)'s own "pressed-in, not lit" face EXACTLY, rather than a variant of
// it: the inactive side is the same flat raised bevel every other inactive
// tab in the app gets, and the active side sinks the identical hard
// two-corner inset shadow + 1px label nudge TopNav's own tabs use — right
// down to the literal shadow value, copied from Btn's `active` branch rather
// than redrawn. The first pass filled the active segment with a solid block
// of saturated colour (rgb(var(--info) / 0.55), white text) — a deliberate
// choice at the time, but on reflection that block-of-colour read is closer
// to Robinhood's big, cheerful colour-pill buttons than to anything on an
// actual IB TWS ticket, where a selected toggle is still mostly ink-on-metal
// and color is spent on the one accent that needs it (the border), not the
// whole face. So the face now stays the app's own neutral bg-term-bg/
// text-term-text — the SAME two classes Btn's active state uses — and only
// the border carries the signal: --info (IB's blue BUY) / --down (the same
// red every other sell/short fill in the app already uses). Net effect: Buy
// and Sell now look like two pressed keys on the same terminal as every
// other control on this page, not two colour swatches.
function SideToggle({ side, setSide }: { side: OrderSide; setSide: (s: OrderSide) => void }) {
  const pressed = "z-10 translate-y-px bg-term-bg text-term-text";
  const raised = "border-term-edge bg-term-raised text-term-muted hover:bg-term-line/30 hover:text-term-sub";
  // `leading-none` added on a density pass ("make Trading match the rest of
  // the app, not read so SaaS-like") — every other dense control in this
  // app (the Inflation Assumption stepper, Th/Td's own fixed leading) pins
  // an explicit tight line-height rather than a button's inherited default,
  // and this was the one control on the page that didn't: at this font
  // size the browser's own default line-height for a <button> runs taller
  // than the 14px rhythm Td/Th use everywhere else, which is what made
  // Trading's rows read visibly airier than Sensitivity's or P&L's in a
  // side-by-side comparison, not any padding difference (py-dense here is
  // the same 3px every other dense control already uses).
  return (
    <div className="flex items-stretch">
      <button
        type="button"
        onClick={() => setSide("buy")}
        className={`relative flex-1 border px-2 py-dense text-[11px] font-semibold uppercase leading-none transition-none ${
          side === "buy" ? `border-info ${pressed}` : raised
        }`}
      >
        Buy
      </button>
      <button
        type="button"
        onClick={() => setSide("sell")}
        className={`relative -ml-px flex-1 border px-2 py-dense text-[11px] font-semibold uppercase leading-none transition-none ${
          side === "sell" ? `border-down ${pressed}` : raised
        }`}
      >
        Sell
      </button>
    </div>
  );
}

function OrderRow({
  a,
  pricePct,
  zebra,
  scenarioLabel,
  horizon,
  deskMax,
  onPreviewChange,
}: {
  a: Asset;
  pricePct: number;
  zebra: boolean;
  scenarioLabel: string;
  horizon: Horizon;
  /** Biggest |Est. Net P&L| currently live across every row in this same
   *  desk — see lib/format.ts's heatBg comment. Computed by Desk from
   *  the live values every row reports up via onPreviewChange below, so it
   *  tracks side/notional edits in real time rather than a snapshot. */
  deskMax: number;
  onPreviewChange: (assetId: string, netPnl: number) => void;
}) {
  // Both lazy-initialised from ticketDrafts (see its own comment above) —
  // the function form of useState only runs once, on this row's actual
  // mount, so a row remounting after a tab switch picks its draft back up
  // instead of resetting to "buy"/DEFAULT_NOTIONAL every time.
  const [side, setSide] = React.useState<OrderSide>(() => ticketDrafts[a.id]?.side ?? "buy");
  // Raw text the input actually binds to, kept separate from the numeric
  // `notional` derived below — on request, fixing a bug where the field
  // would show a "0" jumping to the front while editing. The old version
  // bound the input directly to a numeric state and coerced on every
  // keystroke (`Math.max(0, Number(e.target.value) || 0)`), so the instant
  // the field was transiently empty mid-edit (select-all-and-retype, or
  // backspacing to clear it) `Number("")` is NaN, `|| 0` turned that into
  // 0, and the controlled input's displayed value was forced back to the
  // literal string "0" before the next keystroke could land — which is
  // exactly the "0 jumps out to the front" artifact. Typing is now just
  // setting this string verbatim, so the field can sit empty, or show
  // "750" while the user is still typing "750000", without anything
  // rewriting it out from under them. Clamping to the MIN_NOTIONAL–
  // MAX_NOTIONAL range (no rounding — see clampNotional above) happens
  // only on blur, below.
  const [notionalText, setNotionalText] = React.useState<string>(
    () => ticketDrafts[a.id]?.notionalText ?? String(DEFAULT_NOTIONAL),
  );
  // Whether the notional field is the one currently focused — drives which
  // of the two renderings below the input shows (see notionalDisplay's own
  // comment). Local, ephemeral UI state, deliberately not folded into
  // ticketDrafts the way side/notionalText are: which field happens to have
  // focus right now has no business surviving a tab switch.
  const [notionalFocused, setNotionalFocused] = React.useState(false);

  // Writes this row's live side/notionalText back to ticketDrafts on every
  // change, so the NEXT mount (after a tab switch away and back) has
  // something to read. Separate from the onPreviewChange effect below —
  // this one has nothing to do with deskMax, it exists purely so the
  // module-level store stays current.
  React.useEffect(() => {
    ticketDrafts[a.id] = { side, notionalText };
  }, [a.id, side, notionalText]);
  const [justFilled, setJustFilled] = React.useState(false);
  // "" between fills (and for one tick right after clicking Transmit again
  // on the same side — see handlePlace) rather than only toggling between
  // the two flash classes directly: re-applying the identical className a
  // CSS animation is already mid-run on does NOT restart it, so a second
  // buy fill before the first one's flash has finished would otherwise just
  // silently do nothing visually the second time.
  const [rowFlash, setRowFlash] = React.useState<"" | "row-flash-buy" | "row-flash-sell">("");
  const filledTimer = React.useRef<ReturnType<typeof setTimeout>>();
  const flashTimer = React.useRef<ReturnType<typeof setTimeout>>();

  // The numeric value everything below actually computes against — parsed
  // from the raw text on every render (so the preview/disabled-state stay
  // live while typing, exactly as typed, see MIN_NOTIONAL's own comment
  // above) but never written BACK into notionalText, which is what keeps
  // the field free to sit empty or mid-edit without a forced "0". Capped at
  // MAX_NOTIONAL here too, not just in handleNotionalBlur below — on
  // request, after the $1M cap turned out not to actually be enforced at
  // execution time: Fill Order calls computeFill/place with THIS value, and
  // blur-only clamping only protects the number once you click away from
  // the field, not the live value a click on Fill Order reads while you're
  // still mid-edit. Typing "1000000000" and immediately hitting Fill Order
  // (without tabbing or clicking elsewhere first) skipped the clamp
  // entirely and transmitted the full, uncapped figure. (MIN_NOTIONAL is 0
  // now, so there's no separate "floor stays lower while live" distinction
  // to maintain here any more — clampNotional's single range is exactly
  // what both the live preview and the blurred field agree on.)
  const notionalNum = Number(notionalText);
  const notional = Number.isFinite(notionalNum) ? clampNotional(notionalNum) : 0;

  function handleNotionalBlur() {
    // Normalise once editing finishes: snap back to a sane default if the
    // field was left empty/invalid, otherwise just clamp into range —
    // whatever exact figure was typed stays exact, see MIN_NOTIONAL's own
    // comment above for why there's no rounding here any more.
    const clamped =
      notionalText.trim() === "" || !Number.isFinite(notionalNum) ? DEFAULT_NOTIONAL : clampNotional(notionalNum);
    setNotionalText(String(clamped));
    setNotionalFocused(false);
  }

  // What the field actually displays, as opposed to notionalText (the raw
  // digit string everything above computes against) — on request ("revamp
  // Trading... not so SaaS-like"). A bare "500000" in a plain <input
  // type="number"> read as a raw API form field, not money — and the
  // EXACT same figure, the instant an order fills, already renders as
  // "$500,000" on the Execution blotter via fmtUsdPlain (see lib/format.ts
  // and ExecutionTab.tsx). The ticket showing one convention and the
  // blotter showing another for the same dollar amount was itself a
  // visible seam between "this looks like a finance app" and "this looks
  // like a form." Comma-grouped at rest (not focused) via the same
  // toLocaleString("en-US") fmtUsdPlain already uses — this doesn't import
  // fmtUsdPlain itself only because that helper also prepends "$" (the "$"
  // here is its own static Cap glyph beside the field, same pattern as the
  // Inflation Assumption stepper's trailing "%" Cap, so the editable text
  // stays pure digits). Raw digits the instant it's focused: a comma
  // sitting mid-string while you're actively typing/selecting is exactly
  // the kind of thing that fights cursor position and copy/paste, so this
  // only dresses the number up when nobody's mid-edit, the same moment
  // real spreadsheet and ticket software reformats a cell.
  const notionalDisplay =
    notionalFocused || notionalText.trim() === "" || !Number.isFinite(notionalNum)
      ? notionalText
      : Math.round(notionalNum).toLocaleString("en-US");

  // Preserves the native number input's up/down-arrow stepping (by
  // NOTIONAL_STEP) now that the field below is type="text" rather than
  // type="number" — needed for the comma-at-rest display above, since a
  // real <input type="number"> can't render "500,000" at all (thousands
  // separators aren't valid in that element's own value syntax). Only
  // Up/Down are handled; every other key (digits, Backspace, Tab, arrow-
  // left/right to move the caret, ⌘/Ctrl shortcuts) passes straight
  // through untouched.
  function handleNotionalKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    e.preventDefault();
    const base = Number.isFinite(notionalNum) ? notionalNum : 0;
    const next = clampNotional(base + (e.key === "ArrowUp" ? NOTIONAL_STEP : -NOTIONAL_STEP));
    setNotionalText(String(next));
  }

  // Live preview of what this order would realise if placed right now, at
  // the current side/notional against the scenario's own modelled move —
  // this is the exact same call Transmit fills with below, so the preview
  // can never show a different number than the order it promises.
  const preview = computeFill(a.id, side, notional, pricePct);

  // Reports this row's live preview up to Desk on every change (typing in
  // the notional field, flipping Buy/Sell) so Desk can keep deskMax current
  // — a ref-guarded effect rather than computing it during render, since
  // this writes to a DIFFERENT component's state.
  React.useEffect(() => {
    onPreviewChange(a.id, preview.netPnl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a.id, preview.netPnl]);

  function handlePlace() {
    const leg: ExecutionLeg = { ...computeFill(a.id, side, notional, pricePct), label: a.label };
    place("single", [leg], scenarioLabel, horizon, Date.now());

    // Transmit button: a short, sharp press-pulse (transmit-pulse, in
    // globals.css) plus the same "Filled" colour swap as before — a
    // terminal confirms a fill instantly, it doesn't celebrate one, so this
    // stays a snap, not a bounce.
    setJustFilled(true);
    clearTimeout(filledTimer.current);
    filledTimer.current = setTimeout(() => setJustFilled(false), 900);

    // Row-level execution flash, coloured to match the side just
    // transmitted (blue for a buy fill, red for a sell) — the same "an
    // execution report just landed on this line" cue a real quote blotter
    // gives, independent of (and a little longer than) the button's own
    // pulse so the whole row, not just the control you clicked, confirms
    // the fill.
    setRowFlash("");
    clearTimeout(flashTimer.current);
    requestAnimationFrame(() => {
      setRowFlash(side === "buy" ? "row-flash-buy" : "row-flash-sell");
      flashTimer.current = setTimeout(() => setRowFlash(""), 700);
    });
  }

  React.useEffect(
    () => () => {
      clearTimeout(filledTimer.current);
      clearTimeout(flashTimer.current);
    },
    [],
  );

  return (
    <tr className={`${zebra ? "bg-term-zebra" : ""} ${rowFlash}`}>
      <Td className="text-term-sub">{a.label}</Td>
      <Td align="right" mono className={signColor(pricePct)}>
        {fmtPct(pricePct)}
      </Td>
      <Td align="right" className="p-0">
        <SideToggle side={side} setSide={setSide} />
      </Td>
      <Td align="right" className="p-0">
        {/* A single bevelled "field," not two separate boxes — the "$" Cap
            and the input share one border/background so the pairing reads
            as one recessed slot with a fixed currency glyph in it (the way
            a real ticket's amount field is labelled), not a label floating
            next to an unrelated input. */}
        <div className="flex items-stretch border border-term-edge bg-term-input">
          <Cap className="flex shrink-0 items-center pl-1.5 text-term-muted">$</Cap>
          <input
            type="text"
            inputMode="numeric"
            value={notionalDisplay}
            onChange={(e) => setNotionalText(e.target.value.replace(/[^\d]/g, ""))}
            onFocus={() => setNotionalFocused(true)}
            onBlur={handleNotionalBlur}
            onKeyDown={handleNotionalKeyDown}
            className="w-full min-w-0 bg-transparent px-1.5 py-hair text-right font-mono text-[11px] tnum text-term-text"
          />
        </div>
      </Td>
      <Td
        align="right"
        mono
        className="font-medium"
        style={{ background: heatBg(preview.netPnl, deskMax), color: heatFg(preview.netPnl, deskMax) }}
      >
        {fmtUsd(preview.netPnl)}
      </Td>
      <Td align="right" className="p-0">
        <button
          type="button"
          onClick={handlePlace}
          disabled={notional <= 0}
          className={`w-full border px-2 py-dense text-[10px] font-semibold uppercase leading-none transition-none disabled:cursor-not-allowed disabled:opacity-40 ${
            justFilled
              ? "z-10 translate-y-px border-up bg-term-bg text-term-text transmit-pulse"
              : "border-term-edge bg-term-raised text-term-sub hover:bg-term-line/30 hover:text-term-text"
          }`}
        >
          {justFilled ? "✓ Filled" : "Fill Order"}
        </button>
      </Td>
    </tr>
  );
}

function Desk({
  group,
  label,
  r,
  scenarioLabel,
  horizon,
  resetKey,
}: {
  group: AssetGroup;
  label: string;
  r: EngineResult;
  scenarioLabel: string;
  horizon: Horizon;
  /** Bumped by the "Clear" button in TradingTab below. Folded into every
   *  OrderRow's own `key` so bumping it force-remounts each row from
   *  scratch — the idiomatic React way to snap a component's *local* state
   *  (side, notionalText, justFilled, rowFlash — none of which live
   *  anywhere outside OrderRow) back to its initial defaults without
   *  threading a bespoke reset callback through every piece of that state
   *  individually. previews (owned here, not per-row) is cleared the same
   *  tick a fresh resetKey arrives, below. */
  resetKey: number;
}) {
  const rows = TOP_LEVEL_ASSETS.filter((a) => a.group === group);

  // Every row's own live Est. Net P&L, reported up by OrderRow on every
  // side/notional change — keyed by asset id so a row that hasn't mounted
  // yet (or has been removed) can't leave a stale entry behind. deskMax
  // drives every row's fill opacity (see lib/format.ts's heatBg
  // comment): the biggest move on THIS desk right now, recomputed live
  // rather than a fixed constant, so a single outsized ticket makes every
  // other row's fill visibly fainter by comparison — the same relative
  // read IB's own CHANGE column gives a watchlist.
  const [previews, setPreviews] = React.useState<Record<string, number>>({});
  const onPreviewChange = React.useCallback((assetId: string, netPnl: number) => {
    setPreviews((prev) => (prev[assetId] === netPnl ? prev : { ...prev, [assetId]: netPnl }));
  }, []);
  // Every remounted OrderRow re-reports its (now-default) preview on mount
  // anyway, but that lands one tick after the remount itself — dropping the
  // stale previews the instant resetKey changes (rather than waiting for
  // those reports to trickle back in) keeps deskMax from holding a dead
  // asset id's old figure in between.
  //
  // Guarded against the mount firing: an effect with a dependency array
  // still runs once on mount like any other, and that mount run landed in
  // the same commit as every OrderRow child's own onPreviewChange report —
  // which, as a *child* effect, runs BEFORE this parent one — so an
  // unguarded version here stomped every real value they'd just reported
  // back to {} right after they arrived. That's the actual reason deskMax
  // was permanently stuck at its own "no data yet" fallback of 1 and every
  // row rendered at the same maxed-out 0.85 fill opacity no matter its real
  // size, regardless of which colour function was in use — not the
  // signFillBg-vs-heatBg floor difference that was originally suspected.
  //
  // A plain "skip the first call" boolean ref does NOT work here: this app
  // runs with reactStrictMode on, and React's dev-only double-invoke of
  // effects calls this same effect twice back-to-back on mount (to surface
  // exactly this kind of missing-cleanup bug) — a one-shot flag flips to
  // "already skipped" on the first of those two calls and then does
  // nothing to stop the second one, so the wipe still happened, just one
  // beat later. Comparing against the PREVIOUS resetKey value instead is
  // naturally idempotent under that double-invoke: both mount calls see
  // "resetKey hasn't actually changed since last time" and skip, while a
  // real Clear-button bump changes the stored value on its first call so a
  // double-invoked second call also correctly sees "no change" and skips
  // (clearing exactly once, not twice).
  const lastResetKey = React.useRef(resetKey);
  React.useEffect(() => {
    if (lastResetKey.current === resetKey) return;
    lastResetKey.current = resetKey;
    setPreviews({});
  }, [resetKey]);
  const deskMax = Math.max(...Object.values(previews).map((v) => Math.abs(v)), 1);

  return (
    <Panel title={label}>
      <ScrollHint>
        <table className="w-full min-w-[640px] table-fixed border-collapse text-[11px]">
          <thead>
            <tr className="bg-term-raised">
              <Th className="w-[30%]">Instrument</Th>
              <Th align="right" className="w-[13%]">
                Scenario Move
              </Th>
              <Th align="right" className="w-[16%]">
                Side
              </Th>
              <Th align="right" className="w-[16%]">
                Notional &middot; MKT
              </Th>
              <Th align="right" className="w-[15%]">
                Est. Net P&amp;L
              </Th>
              <Th align="right" className="w-[10%]">
                {" "}
              </Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a, ri) => {
              const ar = r.assets[a.id];
              if (!ar) return null;
              return (
                <OrderRow
                  key={`${a.id}-${resetKey}`}
                  a={a}
                  pricePct={ar.pricePct}
                  zebra={ri % 2 === 1}
                  scenarioLabel={scenarioLabel}
                  horizon={horizon}
                  deskMax={deskMax}
                  onPreviewChange={onPreviewChange}
                />
              );
            })}
          </tbody>
        </table>
      </ScrollHint>
    </Panel>
  );
}

export default function TradingTab({
  r,
  scenarioLabel,
  horizon,
}: {
  r: EngineResult;
  scenarioLabel: string;
  horizon: Horizon;
}) {
  // Bumping this remounts every OrderRow across all three desks (see Desk's
  // own comment on resetKey) — the one "Clear" button wipes every open
  // ticket on the page, not just one desk, since there was no per-desk
  // ask, just "all the traders."
  const [resetKey, setResetKey] = React.useState(0);

  return (
    <div className="bg-term-bg py-1.5">
      <div className="flex flex-col gap-1.5">
        {/* Every other tab opens under its own GroupHeader/Panel-header bar
            (P&L's "Portfolio Impact Summary", Sensitivity's "Leave-One-Out
            Attribution", Derivation's "Indices") — Trading used to be the
            one page that didn't, with "Clear" floating alone above the
            desks and nothing else around it. That bare button with no bar
            housing it was the single biggest tell that this page wasn't
            built to the same system as the rest of the app (a lone action
            control above a content block is a generic admin-page pattern,
            not this app's own convention of embedding controls in a
            bordered header's `right` slot, the same way Sensitivity's X/Y
            selectors or Two-Variable Surface's own header-right live). Clear
            now sits in that slot instead, under a title that names what the
            three desks below actually are. */}
        {/* Bordered on all four sides, same wrapper GroupHeader always gets
            elsewhere (PresetBar, PnlTab's Equities/Bonds/Commodities/FX
            cards) — GroupHeader's own `base` class only draws a top/bottom
            rule, so a bare top-level GroupHeader with no wrapper would read
            as a half-finished bar floating with open left/right edges. */}
        <div className="border border-term-edge bg-term-panel">
          <GroupHeader
            right={
              <button
                type="button"
                onClick={() => {
                  // Both halves of "wipe every open ticket": the remount
                  // clears what's on screen, clearTicketDrafts() clears the
                  // module-level store those remounted rows would otherwise
                  // read their "fresh" values straight back out of — see its
                  // own comment above for why order here doesn't matter (the
                  // remount happens on the next render regardless of which
                  // of these two runs first within this handler).
                  clearTicketDrafts();
                  setResetKey((k) => k + 1);
                }}
                className="border border-term-edge bg-term-raised px-2 py-hair text-[10px] font-semibold uppercase leading-none text-term-sub transition-none hover:bg-term-line/30 hover:text-term-text"
              >
                Clear
              </button>
            }
          >
            Order Tickets
          </GroupHeader>
        </div>
        {DESKS.map((d) => (
          <Desk
            key={d.group}
            group={d.group}
            label={d.label}
            r={r}
            scenarioLabel={scenarioLabel}
            horizon={horizon}
            resetKey={resetKey}
          />
        ))}
      </div>
    </div>
  );
}
