"use client";

import React from "react";
import { runScenario, type ScenarioInput } from "@/lib/engine";
import { baselineState, VAR_GROUPS, VARIABLES, VAR_BY_ID, type VarState } from "@/lib/vars";
import { presetState, type Preset } from "@/lib/scenarios";
import type { Horizon, PathShape } from "@/lib/paths";
import { DEFAULT_NOTIONAL } from "@/lib/portfolios";
import { toDelta, fromDelta, loadSession, saveSession } from "@/lib/storage";

// Scenario state used to live entirely inside app/page.tsx's Workspace
// component, which worked when the whole app was one screen. Now that the
// builder and each results view are separate routes, the same state needs
// to survive client-side navigation between them — so it lives here, in a
// context mounted once in app/layout.tsx, instead of being re-created (and
// lost) on every page.

interface ScenarioContextValue {
  state: VarState;
  setVar: (id: string, v: number) => void;
  path: PathShape;
  setPath: (p: PathShape) => void;
  horizon: Horizon;
  setHorizon: (h: Horizon) => void;
  steps: number;
  setSteps: (n: number) => void;
  notional: number;
  setNotional: (n: number) => void;
  portfolioId: string;
  setPortfolioId: (id: string) => void;
  presetId: string | null;
  applyPreset: (p: Preset) => void;
  resetAll: () => void;
  resetGroup: (group: string) => void;
  query: string;
  setQuery: (q: string) => void;
  open: Record<string, boolean>;
  setOpen: (g: string, v: boolean) => void;
  pinned: string[];
  togglePin: (assetId: string) => void;
  focusAsset: string | null;
  setFocusAsset: (id: string | null) => void;
  input: ScenarioInput;
  result: ReturnType<typeof runScenario>;
  dirtyCount: number;
  hydrated: boolean;
}

const ScenarioContext = React.createContext<ScenarioContextValue | null>(null);

export function ScenarioProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<VarState>(baselineState);
  const [path, setPath] = React.useState<PathShape>("immediate");
  const [horizon, setHorizon] = React.useState<Horizon>(12);
  const [steps, setSteps] = React.useState<number>(8);
  const [notional, setNotional] = React.useState<number>(DEFAULT_NOTIONAL);
  const [portfolioId, setPortfolioId] = React.useState<string>("p6040");
  const [presetId, setPresetId] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState<string>("");
  const [open, setOpenState] = React.useState<Record<string, boolean>>(() =>
    Object.fromEntries(VAR_GROUPS.map((g) => [g.id, g.defaultOpen])),
  );
  const [pinned, setPinned] = React.useState<string[]>([]);
  // Set by clicking a Price % cell in Asset Detail; consumed once by
  // the Derivation page to expand and scroll to that asset, then cleared,
  // so it doesn't keep re-triggering the scroll on unrelated re-renders.
  const [focusAsset, setFocusAsset] = React.useState<string | null>(null);

  // Two-stage restore. `restored` flips true once the one-shot read from a
  // prior session has been applied (or found nothing) — the save effect below
  // waits on it so it can never fire before that read and clobber a session
  // with the just-mounted baseline. `hydrated` flips true one render later,
  // gating the change-flash effect (useFlash, ui.tsx) so a restored value
  // doesn't flash as if it had just moved.
  const [restored, setRestored] = React.useState(false);
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    const s = loadSession();
    if (s) {
      setState(fromDelta(s.delta));
      setPath(s.path);
      setHorizon(s.horizon);
      setSteps(s.steps);
      setNotional(s.notional);
      setPresetId(s.presetId);
      setPortfolioId(s.portfolioId);
      setOpenState((o) => ({ ...o, ...s.open }));
      setPinned(s.pinned);
    }
    setRestored(true);
  }, []);

  React.useEffect(() => {
    if (restored) setHydrated(true);
  }, [restored]);

  React.useEffect(() => {
    if (!restored) return;
    saveSession({
      delta: toDelta(state),
      horizon,
      path,
      steps,
      notional,
      presetId,
      portfolioId,
      open,
      pinned,
    });
  }, [restored, state, horizon, path, steps, notional, presetId, portfolioId, open, pinned]);

  function togglePin(assetId: string) {
    setPinned((p) => (p.includes(assetId) ? p.filter((id) => id !== assetId) : [...p, assetId]));
  }

  const input: ScenarioInput = React.useMemo(
    () => ({ state, regimeOverride: null, horizon, path, steps, notional }),
    [state, horizon, path, steps, notional],
  );
  const result = React.useMemo(() => runScenario(input), [input]);

  const dirtyCount = VARIABLES.filter((v) => Math.abs((state[v.id] ?? v.base) - v.base) > 1e-9).length;

  function setVar(id: string, v: number) {
    setPresetId(null);
    setState((s) => ({ ...s, [id]: v }));
  }

  function applyPreset(p: Preset) {
    setState(presetState(p));
    setPath(p.path);
    setHorizon(p.horizon);
    setPresetId(p.id);
    setOpenState((o) => {
      const next = { ...o };
      for (const id of Object.keys(p.set)) {
        const g = VAR_BY_ID[id]?.group;
        if (g) next[g] = true;
      }
      return next;
    });
  }

  function resetAll() {
    setState(baselineState());
    setPresetId(null);
  }

  function resetGroup(group: string) {
    setPresetId(null);
    setState((s) => {
      const next = { ...s };
      for (const v of VARIABLES) if (v.group === group) next[v.id] = v.base;
      return next;
    });
  }

  const value: ScenarioContextValue = {
    state,
    setVar,
    path,
    setPath: (p: PathShape) => {
      setPath(p);
      setPresetId(null);
    },
    horizon,
    setHorizon,
    steps,
    setSteps,
    notional,
    setNotional,
    portfolioId,
    setPortfolioId,
    presetId,
    applyPreset,
    resetAll,
    resetGroup,
    query,
    setQuery,
    open,
    setOpen: (g: string, v: boolean) => setOpenState((o) => ({ ...o, [g]: v })),
    pinned,
    togglePin,
    focusAsset,
    setFocusAsset,
    input,
    result,
    dirtyCount,
    hydrated,
  };

  return <ScenarioContext.Provider value={value}>{children}</ScenarioContext.Provider>;
}

export function useScenario() {
  const ctx = React.useContext(ScenarioContext);
  if (!ctx) throw new Error("useScenario must be used within a ScenarioProvider");
  return ctx;
}
