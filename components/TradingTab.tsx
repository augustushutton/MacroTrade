"use client";

import React from "react";
import { TOP_LEVEL_ASSETS, type Asset, type AssetGroup } from "@/lib/assets";
import { computeFill, type OrderSide } from "@/lib/execution";
import { place, type ExecutionLeg } from "@/lib/executions";
import { fmtPct, fmtUsd, signColor, signFillBg, signFillFg } from "@/lib/format";
import type { EngineResult } from "@/lib/engine";
import type { Horizon } from "@/lib/paths";
import { Panel, Td, Th } from "./ui";

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
// Realistic ticket-size bounds, on request — the old input had no ceiling
// at all (and a floor of $0, which is really just "invalid," not a real
// minimum clip size). $1,000 is a sane smallest clip for a notional-based
// ticket like this one. The ceiling was lowered from $25M to $1M on a
// follow-up request, tightening it to a single-million-dollar cap.
const MIN_NOTIONAL = 1_000;
const MAX_NOTIONAL = 1_000_000;

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
  // Copied verbatim from Btn's own active-state shadow (ui.tsx) so a pressed
  // segment here reads as literally the same physical control, not a
  // similar-looking one-off — including Btn's own hard 2px/0.85 notch.
  const pressed =
    "z-10 translate-y-px bg-term-bg text-term-text shadow-[inset_2px_2px_0_0_rgb(0_0_0_/_0.85),inset_-1px_-1px_0_0_rgb(255_255_255_/_0.05)]";
  const raised = "border-term-edge bg-term-raised text-term-muted hover:bg-term-line/30 hover:text-term-sub";
  return (
    <div className="flex items-stretch">
      <button
        type="button"
        onClick={() => setSide("buy")}
        className={`relative flex-1 border px-2 py-dense text-[11px] font-semibold uppercase tracking-wide transition-none ${
          side === "buy" ? `border-info ${pressed}` : raised
        }`}
      >
        Buy
      </button>
      <button
        type="button"
        onClick={() => setSide("sell")}
        className={`relative -ml-px flex-1 border px-2 py-dense text-[11px] font-semibold uppercase tracking-wide transition-none ${
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
   *  desk — see lib/format.ts's signFillBg comment. Computed by Desk from
   *  the live values every row reports up via onPreviewChange below, so it
   *  tracks side/notional edits in real time rather than a snapshot. */
  deskMax: number;
  onPreviewChange: (assetId: string, netPnl: number) => void;
}) {
  const [side, setSide] = React.useState<OrderSide>("buy");
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
  // rewriting it out from under them. Clamping to the realistic
  // MIN_NOTIONAL/MAX_NOTIONAL range happens only on blur, below.
  const [notionalText, setNotionalText] = React.useState<string>(String(DEFAULT_NOTIONAL));
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
  // live while typing) but never written BACK into notionalText, which is
  // what keeps the field free to sit empty or mid-edit without a forced "0".
  const notionalNum = Number(notionalText);
  const notional = Number.isFinite(notionalNum) ? Math.max(0, notionalNum) : 0;

  function handleNotionalBlur() {
    // Normalise once editing finishes: snap back to a sane default if the
    // field was left empty/invalid, otherwise clamp into the realistic
    // $1,000–$25M ticket range rather than silently accepting, say, $4.
    const clamped =
      notionalText.trim() === "" || !Number.isFinite(notionalNum)
        ? DEFAULT_NOTIONAL
        : Math.min(MAX_NOTIONAL, Math.max(MIN_NOTIONAL, notionalNum));
    setNotionalText(String(clamped));
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
        <input
          type="number"
          min={MIN_NOTIONAL}
          max={MAX_NOTIONAL}
          step={10000}
          value={notionalText}
          onChange={(e) => setNotionalText(e.target.value)}
          onBlur={handleNotionalBlur}
          className="w-full min-w-0 border border-term-edge bg-term-input px-1.5 py-hair text-right font-mono text-[11px] tnum text-term-text"
        />
      </Td>
      <Td
        align="right"
        mono
        className="font-medium"
        style={{ backgroundColor: signFillBg(preview.netPnl, deskMax), color: signFillFg(preview.netPnl, deskMax) }}
      >
        {fmtUsd(preview.netPnl)}
      </Td>
      <Td align="right" className="p-0">
        <button
          type="button"
          onClick={handlePlace}
          disabled={notional <= 0}
          className={`w-full border px-2 py-dense text-[10px] font-semibold uppercase tracking-wide transition-none disabled:cursor-not-allowed disabled:opacity-40 ${
            justFilled
              ? // Same pressed-in face as SideToggle's active segment, border-up
                // for "confirmed" rather than info/down — plus the existing
                // transmit-pulse press animation on top.
                "z-10 translate-y-px border-up bg-term-bg text-term-text shadow-[inset_2px_2px_0_0_rgb(0_0_0_/_0.85),inset_-1px_-1px_0_0_rgb(255_255_255_/_0.05)] transmit-pulse"
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
}: {
  group: AssetGroup;
  label: string;
  r: EngineResult;
  scenarioLabel: string;
  horizon: Horizon;
}) {
  const rows = TOP_LEVEL_ASSETS.filter((a) => a.group === group);

  // Every row's own live Est. Net P&L, reported up by OrderRow on every
  // side/notional change — keyed by asset id so a row that hasn't mounted
  // yet (or has been removed) can't leave a stale entry behind. deskMax
  // drives every row's fill opacity (see lib/format.ts's signFillBg
  // comment): the biggest move on THIS desk right now, recomputed live
  // rather than a fixed constant, so a single outsized ticket makes every
  // other row's fill visibly fainter by comparison — the same relative
  // read IB's own CHANGE column gives a watchlist.
  const [previews, setPreviews] = React.useState<Record<string, number>>({});
  const onPreviewChange = React.useCallback((assetId: string, netPnl: number) => {
    setPreviews((prev) => (prev[assetId] === netPnl ? prev : { ...prev, [assetId]: netPnl }));
  }, []);
  const deskMax = Math.max(...Object.values(previews).map((v) => Math.abs(v)), 1);

  return (
    <Panel title={label}>
      <div className="overflow-x-auto">
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
                  key={a.id}
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
      </div>
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
  return (
    <div className="bg-term-bg py-1.5">
      <div className="flex flex-col gap-1.5">
        {DESKS.map((d) => (
          <Desk key={d.group} group={d.group} label={d.label} r={r} scenarioLabel={scenarioLabel} horizon={horizon} />
        ))}
      </div>
    </div>
  );
}
