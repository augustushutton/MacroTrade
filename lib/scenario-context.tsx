"use client";

import React from "react";
import { runScenario, type ScenarioInput } from "@/lib/engine";
import { baselineState, VAR_GROUPS, VARIABLES, VAR_BY_ID, type VarState } from "@/lib/vars";
import { presetState, type Preset } from "@/lib/scenarios";
import type { Horizon, PathShape } from "@/lib/paths";
import { DEFAULT_NOTIONAL } from "@/lib/portfolios";
import { toDelta, fromDelta, loadSession, saveSession, type ScenarioSnapshot } from "@/lib/storage";
import { PRESET_DEFAULT_OPEN } from "@/components/PresetBar";
import type { GroupTabId } from "@/components/NarrativeTab";
import type { SortKey, SortDir } from "@/components/PnlTab";

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
  /** The saved-scenario id (lib/storage.ts's SavedScenario) currently loaded
   *  on screen, if any — mutually exclusive with `presetId`, the same way a
   *  user's own saved scenario and the built-in library are two different
   *  shelves that can't both be "the thing on screen" at once. Not persisted
   *  across a reload (unlike the state itself): a minor, deliberate gap —
   *  the values survive, only the "which saved scenario is this" highlight
   *  resets to none. */
  customScenarioId: string | null;
  applySnapshot: (snap: ScenarioSnapshot, id?: string | null) => void;
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
  // The fields below are UI-only state (which accordion is open, which tab
  // or axis is picked) that used to live as local useState inside the
  // component each route page renders. That worked when the whole app was
  // one screen; once each results view became its own route, Next.js
  // unmounts/remounts that component on every navigation and the local
  // state reset — closing sub-boxes, forgetting the sort column, etc. Living
  // here instead means it survives navigating between tabs, same as `open`
  // above already did for VarForm.
  presetOpen: Record<string, boolean>;
  setPresetOpen: (g: string, v: boolean) => void;
  narrativeGroupTab: GroupTabId;
  setNarrativeGroupTab: (g: GroupTabId) => void;
  sensitivityXVar: string;
  setSensitivityXVar: (id: string) => void;
  sensitivityYVar: string;
  setSensitivityYVar: (id: string) => void;
  pnlOpenSectors: boolean;
  setPnlOpenSectors: React.Dispatch<React.SetStateAction<boolean>>;
  pnlSortKey: SortKey | null;
  setPnlSortKey: (k: SortKey | null) => void;
  pnlSortDir: SortDir;
  setPnlSortDir: (d: SortDir) => void;
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
  const [customScenarioId, setCustomScenarioId] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState<string>("");
  const [open, setOpenState] = React.useState<Record<string, boolean>>(() =>
    Object.fromEntries(VAR_GROUPS.map((g) => [g.id, g.defaultOpen])),
  );
  const [pinned, setPinned] = React.useState<string[]>([]);
  // Set by clicking a Price % cell in Asset Detail; consumed once by
  // the Derivation page to expand and scroll to that asset, then cleared,
  // so it doesn't keep re-triggering the scroll on unrelated re-renders.
  const [focusAsset, setFocusAsset] = React.useState<string | null>(null);

  // Per-view UI state, lifted here for the reasons noted on
  // ScenarioContextValue above (survive route navigation).
  const [presetOpen, setPresetOpenState] = React.useState<Record<string, boolean>>(PRESET_DEFAULT_OPEN);
  const [narrativeGroupTab, setNarrativeGroupTab] = React.useState<GroupTabId>("indices");
  const [sensitivityXVar, setSensitivityXVar] = React.useState<string>("");
  const [sensitivityYVar, setSensitivityYVar] = React.useState<string>("");
  const [pnlOpenSectors, setPnlOpenSectors] = React.useState(false);
  const [pnlSortKey, setPnlSortKey] = React.useState<SortKey | null>(null);
  const [pnlSortDir, setPnlSortDir] = React.useState<SortDir>("desc");

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
      if (s.presetOpen) setPresetOpenState((o) => ({ ...o, ...s.presetOpen }));
      if (s.narrativeGroupTab) setNarrativeGroupTab(s.narrativeGroupTab);
      if (s.sensitivityXVar) setSensitivityXVar(s.sensitivityXVar);
      if (s.sensitivityYVar) setSensitivityYVar(s.sensitivityYVar);
      if (typeof s.pnlOpenSectors === "boolean") setPnlOpenSectors(s.pnlOpenSectors);
      if (s.pnlSortKey !== undefined) setPnlSortKey(s.pnlSortKey);
      if (s.pnlSortDir) setPnlSortDir(s.pnlSortDir);
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
      presetOpen,
      narrativeGroupTab,
      sensitivityXVar,
      sensitivityYVar,
      pnlOpenSectors,
      pnlSortKey,
      pnlSortDir,
    });
  }, [
    restored,
    state,
    horizon,
    path,
    steps,
    notional,
    presetId,
    portfolioId,
    open,
    pinned,
    presetOpen,
    narrativeGroupTab,
    sensitivityXVar,
    sensitivityYVar,
    pnlOpenSectors,
    pnlSortKey,
    pnlSortDir,
  ]);

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
    setCustomScenarioId(null);
    setState((s) => ({ ...s, [id]: v }));
  }

  function applyPreset(p: Preset) {
    setState(presetState(p));
    setPath(p.path);
    setHorizon(p.horizon);
    setPresetId(p.id);
    setCustomScenarioId(null);
    setOpenState((o) => {
      const next = { ...o };
      for (const id of Object.keys(p.set)) {
        const g = VAR_BY_ID[id]?.group;
        if (g) next[g] = true;
      }
      return next;
    });
  }

  /** Loads a saved scenario (lib/storage.ts's SavedScenario, via its latest
   *  ScenarioSnapshot) the same way applyPreset loads a built-in one, just
   *  from a user's own shelf instead of the library — `id` is the saved
   *  record's id so the list can highlight which one is on screen, or
   *  omitted for a one-off snapshot (e.g. a future "restore version") that
   *  isn't itself a named, listed scenario. */
  function applySnapshot(snap: ScenarioSnapshot, id: string | null = null) {
    setState(snap.state);
    setPath(snap.path);
    setHorizon(snap.horizon);
    setSteps(snap.steps);
    setNotional(snap.notional);
    setPresetId(null);
    setCustomScenarioId(id);
  }

  function resetAll() {
    setState(baselineState());
    setPresetId(null);
    setCustomScenarioId(null);
  }

  function resetGroup(group: string) {
    setPresetId(null);
    setCustomScenarioId(null);
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
      setCustomScenarioId(null);
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
    customScenarioId,
    applySnapshot,
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
    presetOpen,
    setPresetOpen: (g: string, v: boolean) => setPresetOpenState((o) => ({ ...o, [g]: v })),
    narrativeGroupTab,
    setNarrativeGroupTab,
    sensitivityXVar,
    setSensitivityXVar,
    sensitivityYVar,
    setSensitivityYVar,
    pnlOpenSectors,
    setPnlOpenSectors,
    pnlSortKey,
    setPnlSortKey,
    pnlSortDir,
    setPnlSortDir,
  };

  return <ScenarioContext.Provider value={value}>{children}</ScenarioContext.Provider>;
}

export function useScenario() {
  const ctx = React.useContext(ScenarioContext);
  if (!ctx) throw new Error("useScenario must be used within a ScenarioProvider");
  return ctx;
}
