"use client";

import React from "react";
import { loadAll, remove, clearAll, onExecutionsChanged, type ExecutionOrder } from "@/lib/executions";
import { fmtNum, fmtPct, fmtUsd, fmtUsdPlain, heatBg, heatFg, signColor } from "@/lib/format";
import { Panel, Td, Th } from "./ui";
import { ScrollHint } from "./ScrollHint";

// Execution — the results side of the Trading / Execution split. Trading
// only ever proposes and prices an order ticket; every row shown here is a
// fill that was actually placed from there (lib/executions.ts,
// localStorage-backed — no account, no backend, same model as Saved
// Scenarios), priced through the same spread + size-scaled impact +
// commission model (lib/execution.ts). Nothing on this page recomputes
// against whatever scenario happens to be on screen right now — an order is
// frozen at the moment it filled, same reasoning as a real blotter: a fill
// that silently re-priced itself every time a slider moved would not be a
// record of anything.

function fmtSlip(bp: number): string {
  return fmtPct(bp / 100, 3);
}

interface Row {
  key: string;
  ts: number;
  scenarioLabel: string;
  label: string;
  notional: number;
  arrivalPct: number;
  fillPct: number;
  slippageBp: number;
  commission: number;
  netPnl: number;
  isSummary: boolean;
  removable: ExecutionOrder | null;
}

function orderToRows(o: ExecutionOrder): Row[] {
  const legRows: Row[] = o.legs.map((leg, i) => ({
    key: `${o.id}-${i}`,
    ts: o.ts,
    scenarioLabel: o.scenarioLabel,
    label: leg.label,
    notional: leg.notional,
    arrivalPct: leg.arrivalPct,
    fillPct: leg.fillPct,
    slippageBp: leg.totalCostBp,
    commission: leg.commission,
    netPnl: leg.netPnl,
    isSummary: false,
    removable: o.legs.length === 1 ? o : null,
  }));
  if (o.legs.length > 1) {
    legRows.push({
      key: `${o.id}-net`,
      ts: o.ts,
      scenarioLabel: o.scenarioLabel,
      label: "Net",
      notional: o.legs.reduce((s, l) => s + l.notional, 0),
      arrivalPct: NaN,
      fillPct: NaN,
      slippageBp: NaN,
      commission: o.commission,
      netPnl: o.netPnl,
      isSummary: true,
      removable: o,
    });
  }
  return legRows;
}

function ExecutionSummary({ orders }: { orders: ExecutionOrder[] }) {
  const legCount = orders.reduce((s, o) => s + o.legs.length, 0);
  const notionalTraded = orders.reduce((s, o) => s + o.legs.reduce((ls, l) => ls + l.notional, 0), 0);
  const grossPnl = orders.reduce((s, o) => s + o.grossPnl, 0);
  const commission = orders.reduce((s, o) => s + o.commission, 0);
  const netPnl = orders.reduce((s, o) => s + o.netPnl, 0);
  const winners = orders.filter((o) => o.netPnl > 0).length;
  const winRate = orders.length > 0 ? (winners / orders.length) * 100 : null;
  // Scaled against the biggest single order's own net P&L — the combined
  // figure in this summary row then reads as strong/faint exactly the way
  // it would sit among the individual orders that made it up, rather than
  // against an arbitrary constant. See lib/format.ts's heatBg comment.
  const netPnlMax = Math.max(...orders.map((o) => Math.abs(o.netPnl)), Math.abs(netPnl), 1);

  return (
    <Panel className="min-w-0" title="Execution Summary">
      {/* overflow-x-auto + an explicit min-width (added alongside the same
          fix on PnlTab's Asset Detail Bonds table and PortfolioSummary,
          SensitivityTab and NarrativeTab's wide tables — see each one's own
          comment): seven columns of mostly non-wrapping $/% figures were
          scrolling in place already, but with no min-width table-fixed just
          divided the viewport by 7 at phone widths instead, confirmed via
          screenshot to mash figures together illegibly rather than ever
          triggering the scroll this wrapper was meant to provide. ScrollHint
          (see that file) adds the visual cue that there's more to scroll
          to. */}
      <ScrollHint>
        <table className="w-full min-w-[640px] table-fixed border-collapse text-[11px]">
          <thead>
            <tr className="bg-term-raised">
              <Th align="right" className="w-[12%]">
                Orders
              </Th>
              <Th align="right" className="w-[12%]">
                Legs filled
              </Th>
              <Th align="right" className="w-[19%]">
                Notional traded
              </Th>
              <Th align="right" className="w-[16%]">
                Gross P&amp;L
              </Th>
              <Th align="right" className="w-[15%]">
                Commission
              </Th>
              <Th align="right" className="w-[14%]">
                Net P&amp;L
              </Th>
              <Th align="right" className="w-[12%]">
                Win rate
              </Th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <Td align="right" mono className="text-term-text">
                {orders.length}
              </Td>
              <Td align="right" mono className="text-term-muted">
                {legCount}
              </Td>
              <Td align="right" mono className="text-term-muted">
                {fmtUsdPlain(notionalTraded)}
              </Td>
              <Td align="right" mono className={signColor(grossPnl)}>
                {fmtUsd(grossPnl)}
              </Td>
              <Td align="right" mono className="text-term-muted">
                {fmtUsdPlain(commission)}
              </Td>
              <Td
                align="right"
                mono
                className="font-medium"
                style={{ background: heatBg(netPnl, netPnlMax), color: heatFg(netPnl, netPnlMax) }}
              >
                {fmtUsd(netPnl)}
              </Td>
              <Td align="right" mono className="text-term-muted">
                {winRate === null ? "—" : `${fmtNum(winRate, 0)}%`}
              </Td>
            </tr>
          </tbody>
        </table>
      </ScrollHint>
    </Panel>
  );
}

function OrderBook({
  orders,
  onRemove,
  onClearAll,
}: {
  orders: ExecutionOrder[];
  onRemove: (id: string) => void;
  onClearAll: () => void;
}) {
  const rows = React.useMemo(() => orders.flatMap(orderToRows), [orders]);
  // Scaled against the biggest |net P&L| among every row actually in this
  // blotter right now (legs and "Net" summary rows alike) — see
  // lib/format.ts's heatBg comment for why it's relative to the table,
  // not a fixed constant.
  const netPnlMax = Math.max(...rows.map((row) => Math.abs(row.netPnl)), 1);

  return (
    <Panel
      className="min-w-0"
      title="Order Book"
      right={
        orders.length > 0 ? (
          <button type="button" onClick={onClearAll} className="text-th uppercase text-term-muted hover:text-term-text">
            Clear All
          </button>
        ) : null
      }
    >
      {rows.length === 0 ? (
        <div className="p-2 text-[11px] text-term-muted">
          No orders filled yet.
        </div>
      ) : (
        // overflow-x-auto + an explicit min-width on the table itself (not
        // just w-full): nine columns of mostly non-wrapping $/%/timestamp
        // tokens is more than any other table in this app carries — a real
        // fill ("10/16, 01:52:05", "$500,000") doesn't abbreviate the way a
        // pre-shortened figure elsewhere does. Below the min-width the table
        // scrolls in its own box instead of cramming unbreakable tokens into
        // collision — the same "scroll in place" intent every other
        // overflow-x-auto wrapper in this app documents (TopNav,
        // NarrativeTab, PnlTab's Asset Detail). ScrollHint (see that file)
        // adds the visual edge cue so that scroll is actually discoverable
        // on a phone instead of silent.
        <ScrollHint>
          <table className="w-full min-w-[760px] table-fixed border-collapse text-[11px]">
            <thead>
              <tr className="bg-term-raised">
                <Th className="w-[13%]">Time</Th>
                <Th className="w-[16%]">Scenario</Th>
                <Th className="w-[19%]">Order</Th>
                <Th align="right" className="w-[11%]">
                  Notional
                </Th>
                <Th align="right" className="w-[9%]">
                  Arrival
                </Th>
                <Th align="right" className="w-[9%]">
                  Fill
                </Th>
                <Th align="right" className="w-[8%]">
                  Slippage
                </Th>
                <Th align="right" className="w-[9%]">
                  Commission
                </Th>
                <Th align="right" className="w-[9%]">
                  Net P&amp;L
                </Th>
                <Th align="right" className="w-[4%]">
                  {" "}
                </Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.key} className={`${r.isSummary ? "bg-term-raised" : i % 2 === 1 ? "bg-term-zebra" : ""}`}>
                  <Td mono className="text-term-muted">
                    {r.isSummary
                      ? ""
                      : new Date(r.ts).toLocaleString("en-US", {
                          month: "numeric",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                          hour12: false,
                        })}
                  </Td>
                  <Td className="text-term-muted">{r.isSummary ? "" : r.scenarioLabel}</Td>
                  <Td className={r.isSummary ? "text-term-text" : "text-term-sub"}>{r.label}</Td>
                  <Td align="right" mono className="text-term-muted">
                    {fmtUsdPlain(r.notional)}
                  </Td>
                  <Td align="right" mono className={r.isSummary ? "text-term-sub" : signColor(r.arrivalPct)}>
                    {r.isSummary ? "—" : fmtPct(r.arrivalPct)}
                  </Td>
                  <Td align="right" mono className={r.isSummary ? "text-term-sub" : signColor(r.fillPct)}>
                    {r.isSummary ? "—" : fmtPct(r.fillPct)}
                  </Td>
                  <Td align="right" mono className={r.isSummary ? "text-term-sub" : "text-term-muted"}>
                    {r.isSummary ? "—" : fmtSlip(r.slippageBp)}
                  </Td>
                  <Td align="right" mono className="text-term-muted">
                    {fmtUsdPlain(r.commission)}
                  </Td>
                  <Td
                    align="right"
                    mono
                    className="font-medium"
                    style={{ background: heatBg(r.netPnl, netPnlMax), color: heatFg(r.netPnl, netPnlMax) }}
                  >
                    {fmtUsd(r.netPnl)}
                  </Td>
                  <Td align="right">
                    {r.removable ? (
                      <button
                        type="button"
                        onClick={() => onRemove(r.removable!.id)}
                        className="text-term-muted hover:text-down-bright"
                        aria-label="Remove order"
                        title="Remove order"
                      >
                        ✕
                      </button>
                    ) : null}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollHint>
      )}
    </Panel>
  );
}

export default function ExecutionTab() {
  const [orders, setOrders] = React.useState<ExecutionOrder[]>([]);

  // Loaded after mount, same reasoning as SavedScenarios.tsx: lib/executions
  // reads localStorage, which doesn't exist on the server render pass.
  // Subscribed to onExecutionsChanged on top of the initial load so an order
  // placed from the Trading tab is picked up without a manual refresh.
  React.useEffect(() => {
    setOrders(loadAll());
    return onExecutionsChanged(() => setOrders(loadAll()));
  }, []);

  function handleRemove(id: string) {
    setOrders(remove(id));
  }

  function handleClearAll() {
    clearAll();
    setOrders([]);
  }

  return (
    <div className="flex flex-col gap-2">
      <ExecutionSummary orders={orders} />
      <OrderBook orders={orders} onRemove={handleRemove} onClearAll={handleClearAll} />
    </div>
  );
}
