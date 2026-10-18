import type { Horizon } from "./paths";
import type { FillResult } from "./execution";

// The order blotter. Same shape of decision as lib/storage.ts's saved
// scenarios: localStorage, no account, no backend, no network — and the
// same reason this is its own module rather than folded into storage.ts,
// which already says its subject is "a scenario, saved" — an order fill is
// a different kind of record (an event that happened once, never edited,
// never versioned) and keeping the two separate means neither module's
// shape has to compromise for the other's.
//
// An order is priced and frozen at the moment "Place Order" is clicked —
// it is NOT a live position that recomputes as the scenario builder is
// tweaked afterwards. That matches how every other number already reads in
// this app (a scenario is a snapshot of a world, not a live feed) and it is
// the only sane model for a blotter: a fill that silently changed its own
// price every time you moved a slider would not be a record of anything.

const KEY = "msp.executions.v1";
const LIMIT = 50;

export interface ExecutionLeg extends FillResult {
  label: string;
}

export type OrderKind = "single" | "pair";

export interface ExecutionOrder {
  id: string;
  ts: number;
  kind: OrderKind;
  /** The preset label active when the order filled, or "Custom scenario"
   *  when no built-in preset was loaded — see PRESET_BY_ID in
   *  lib/scenarios.ts. Purely descriptive, never re-derived later. */
  scenarioLabel: string;
  horizon: Horizon;
  legs: ExecutionLeg[];
  grossPnl: number;
  commission: number;
  netPnl: number;
}

const CHANGE_EVENT = "msp:executions-changed";

function safeParse(raw: string | null): ExecutionOrder[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x) => x && typeof x.id === "string" && Array.isArray(x.legs));
  } catch {
    return [];
  }
}

export function loadAll(): ExecutionOrder[] {
  if (typeof window === "undefined") return [];
  return safeParse(window.localStorage.getItem(KEY)).sort((a, b) => b.ts - a.ts);
}

function writeAll(list: ExecutionOrder[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, LIMIT)));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // Quota exhausted. Dropping the write is preferable to throwing inside a
    // click handler — the caller re-reads loadAll() and sees the fill did
    // not land, same failure mode as storage.ts's writeAll.
  }
}

export function onExecutionsChanged(fn: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(CHANGE_EVENT, fn);
  return () => window.removeEventListener(CHANGE_EVENT, fn);
}

export function makeId(seed: number): string {
  return `x${seed.toString(36)}${Math.floor(seed % 1000).toString(36)}`;
}

/** Records a new filled order. `legs` already carries each leg's own priced
 *  FillResult (lib/execution.ts's computeFill) plus a display label; this
 *  just sums them into the order-level totals and writes the record. */
export function place(
  kind: OrderKind,
  legs: ExecutionLeg[],
  scenarioLabel: string,
  horizon: Horizon,
  ts: number,
): ExecutionOrder {
  const order: ExecutionOrder = {
    id: makeId(ts),
    ts,
    kind,
    scenarioLabel,
    horizon,
    legs,
    grossPnl: legs.reduce((s, l) => s + l.grossPnl, 0),
    commission: legs.reduce((s, l) => s + l.commission, 0),
    netPnl: legs.reduce((s, l) => s + l.netPnl, 0),
  };
  writeAll([order, ...loadAll()]);
  return order;
}

export function remove(id: string): ExecutionOrder[] {
  const list = loadAll().filter((o) => o.id !== id);
  writeAll(list);
  return list;
}

export function clearAll(): void {
  writeAll([]);
}
