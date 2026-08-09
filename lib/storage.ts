import { baselineState, VAR_BY_ID, type VarState } from "./vars";
import type { Horizon, PathShape } from "./paths";
import type { RegimeId } from "./regimes";

// Saved scenarios live in localStorage. No account, no backend, no network.
//
// Only variables that DIFFER from baseline are written. Storing the full state
// would mean a scenario saved today silently re-reads as something else the day
// a baseline changes; storing the deltas means it re-reads as the same
// ASSUMPTION, which is what was actually saved. The trade is that a baseline
// revision moves old scenarios, and that is the correct behaviour for a
// stress-test tool whose whole subject is deviation from a starting point.

const KEY = "msp.scenarios.v1";
const LIMIT = 200;

export interface ScenarioDelta {
  [varId: string]: number;
}

export interface ScenarioVersion {
  /** Milliseconds. Written by the caller so the module stays pure. */
  ts: number;
  delta: ScenarioDelta;
  horizon: Horizon;
  path: PathShape;
  steps: number;
  notional: number;
  regimeOverride: RegimeId | null;
  note: string;
}

export interface SavedScenario {
  id: string;
  name: string;
  created: number;
  updated: number;
  /** Newest first. Index 0 is the live version. */
  versions: ScenarioVersion[];
}

export interface ScenarioSnapshot {
  state: VarState;
  horizon: Horizon;
  path: PathShape;
  steps: number;
  notional: number;
  regimeOverride: RegimeId | null;
}

export function toDelta(state: VarState): ScenarioDelta {
  const d: ScenarioDelta = {};
  for (const [id, v] of Object.entries(VAR_BY_ID)) {
    const cur = state[id];
    if (cur === undefined || !Number.isFinite(cur)) continue;
    if (Math.abs(cur - v.base) > 1e-9) d[id] = cur;
  }
  return d;
}

export function fromDelta(delta: ScenarioDelta): VarState {
  const s = baselineState();
  for (const [id, v] of Object.entries(delta)) {
    if (VAR_BY_ID[id] && Number.isFinite(v)) s[id] = v;
  }
  return s;
}

function safeParse(raw: string | null): SavedScenario[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x) => x && typeof x.id === "string" && Array.isArray(x.versions));
  } catch {
    return [];
  }
}

export function loadAll(): SavedScenario[] {
  if (typeof window === "undefined") return [];
  return safeParse(window.localStorage.getItem(KEY)).sort((a, b) => b.updated - a.updated);
}

function writeAll(list: SavedScenario[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, LIMIT)));
  } catch {
    // Quota exhausted. Dropping the write is preferable to throwing inside a
    // click handler and taking the tree down; the caller re-reads and sees the
    // save did not land.
  }
}

export function makeId(seed: number): string {
  return `s${seed.toString(36)}${Math.floor(seed % 1000).toString(36)}`;
}

/** Saves a new named scenario. Returns the stored record. */
export function saveNew(name: string, snap: ScenarioSnapshot, ts: number, note = "Initial"): SavedScenario {
  const rec: SavedScenario = {
    id: makeId(ts),
    name: name.trim() || "Untitled",
    created: ts,
    updated: ts,
    versions: [versionOf(snap, ts, note)],
  };
  writeAll([rec, ...loadAll()]);
  return rec;
}

/** Pushes a new version onto an existing scenario. */
export function saveVersion(id: string, snap: ScenarioSnapshot, ts: number, note: string): SavedScenario[] {
  const list = loadAll().map((s) =>
    s.id === id ? { ...s, updated: ts, versions: [versionOf(snap, ts, note), ...s.versions].slice(0, 40) } : s,
  );
  writeAll(list);
  return list;
}

export function rename(id: string, name: string): SavedScenario[] {
  const list = loadAll().map((s) => (s.id === id ? { ...s, name: name.trim() || s.name } : s));
  writeAll(list);
  return list;
}

export function remove(id: string): SavedScenario[] {
  const list = loadAll().filter((s) => s.id !== id);
  writeAll(list);
  return list;
}

function versionOf(snap: ScenarioSnapshot, ts: number, note: string): ScenarioVersion {
  return {
    ts,
    delta: toDelta(snap.state),
    horizon: snap.horizon,
    path: snap.path,
    steps: snap.steps,
    notional: snap.notional,
    regimeOverride: snap.regimeOverride,
    note,
  };
}

export function restore(v: ScenarioVersion): ScenarioSnapshot {
  return {
    state: fromDelta(v.delta),
    horizon: v.horizon,
    path: v.path,
    steps: v.steps,
    notional: v.notional,
    regimeOverride: v.regimeOverride,
  };
}

// ---------------------------------------------------------------------------
// Shareable link. The whole scenario travels in the URL fragment, so a link can
// be pasted anywhere without a server having stored anything. The fragment,
// not the query string, because a fragment is never transmitted to the host.
// ---------------------------------------------------------------------------

/** base64url over UTF-8 bytes. Works in the browser and under the test runner;
 *  `+` and `/` are avoided so the fragment survives being pasted into chat
 *  clients that treat those characters as word boundaries. */
function b64url(json: string): string {
  const bytes = new TextEncoder().encode(json);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const raw =
    typeof btoa === "function" ? btoa(bin) : Buffer.from(bytes).toString("base64");
  return raw.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function unb64url(s: string): string {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  if (typeof atob === "function") {
    const bin = atob(padded);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  return Buffer.from(padded, "base64").toString("utf8");
}

export function encodeSnapshot(snap: ScenarioSnapshot): string {
  const payload = {
    d: toDelta(snap.state),
    h: snap.horizon,
    p: snap.path,
    s: snap.steps,
    n: snap.notional,
    r: snap.regimeOverride,
  };
  return b64url(JSON.stringify(payload));
}

export function decodeSnapshot(hash: string): ScenarioSnapshot | null {
  if (!hash) return null;
  try {
    const p = JSON.parse(unb64url(hash));
    if (!p || typeof p !== "object") return null;
    return {
      state: fromDelta(p.d ?? {}),
      horizon: (p.h ?? 12) as Horizon,
      path: (p.p ?? "immediate") as PathShape,
      steps: typeof p.s === "number" ? p.s : 8,
      notional: typeof p.n === "number" ? p.n : 1_000_000,
      regimeOverride: (p.r ?? null) as RegimeId | null,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Working session. Separate from the named-scenario list above: this is the
// one-slot "where I left off" restore, auto-saved on every change so a reload
// or a closed tab doesn't lose the desk's in-progress work. Reuses the same
// delta encoding so a baseline revision affects both consistently.
// ---------------------------------------------------------------------------

const SESSION_KEY = "msp.session.v1";

export interface SessionState {
  delta: ScenarioDelta;
  horizon: Horizon;
  path: PathShape;
  steps: number;
  notional: number;
  presetId: string | null;
  portfolioId: string;
  open: Record<string, boolean>;
  /** Asset ids pinned to the top of the Asset Detail table. */
  pinned: string[];
}

export function saveSession(s: SessionState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  } catch {
    // Quota exhausted or storage blocked; dropping the write is preferable
    // to throwing inside an effect.
  }
}

export function loadSession(): SessionState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (!p || typeof p !== "object") return null;
    return {
      delta: p.delta && typeof p.delta === "object" ? p.delta : {},
      horizon: (p.horizon ?? 12) as Horizon,
      path: (p.path ?? "immediate") as PathShape,
      steps: typeof p.steps === "number" ? p.steps : 8,
      notional: typeof p.notional === "number" ? p.notional : 1_000_000,
      presetId: typeof p.presetId === "string" ? p.presetId : null,
      portfolioId: typeof p.portfolioId === "string" ? p.portfolioId : "p6040",
      open: p.open && typeof p.open === "object" ? p.open : {},
      pinned: Array.isArray(p.pinned) ? p.pinned.filter((x: unknown) => typeof x === "string") : [],
    };
  } catch {
    return null;
  }
}
